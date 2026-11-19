[CmdletBinding(DefaultParameterSetName = 'List')]
param(
    [Parameter(Mandatory, ParameterSetName = 'List')][switch]$List,
    [Parameter(Mandatory, ParameterSetName = 'Clean')]
    [ValidateSet('pnpm-store', 'npm-cache', 'pip-cache', 'pub-cache', 'docker', 'temp', 'build-folder', 'wsl-disks', 'windows-update')]
    [string]$Item,
    [Parameter(ParameterSetName = 'Clean')][string]$Path,
    [Parameter(ParameterSetName = 'Clean')][switch]$Confirmed,
    [ValidateNotNullOrEmpty()][string]$DataDirectory,
    [string]$OutputPath
)

# Frees up space, one item at a time. -List measures what each item takes and shows its exact command; it only
# reads. -Item cleans one item, and only with -Confirmed. Caches are cleaned by their own tools, folders go to
# the Recycle Bin, and nothing else is touched. The desktop app's Space view runs this script.
# See docs/policies/cleanup-safety.md.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'Core\Cleanup.Core.psm1') -Force

if ([string]::IsNullOrWhiteSpace($DataDirectory)) { $DataDirectory = Join-Path $PSScriptRoot '..' }
$configuration = Join-Path $DataDirectory 'config\workstation.local.json'
$roots = @()
if (Test-Path -LiteralPath $configuration) {
    $settings = Get-Content -LiteralPath $configuration -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($settings.PSObject.Properties['projects'] -and $settings.projects.PSObject.Properties['developmentRoots']) {
        $roots = @($settings.projects.developmentRoots | Where-Object { $_ })
    }
}

function Find-Tool([string]$Name) {
    $command = Get-Command $Name -CommandType Application, ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source } else { return $null }
}

# A tool's answer as one trimmed line, or null if it didn't run.
function Read-Tool([string]$Name, [string[]]$Arguments) {
    $tool = Find-Tool $Name
    if (-not $tool) { return $null }
    # Windows PowerShell 5.1 turns a tool's warnings on stderr into errors when the preference is Stop.
    $ErrorActionPreference = 'Continue'
    try {
        # All of it first: Select-Object -First stops the tool early, and its exit code with it.
        $lines = @(& $tool @Arguments 2>$null)
        if ($LASTEXITCODE -ne 0 -or $lines.Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]$lines[0])) { return $null }
        return ([string]$lines[0]).Trim()
    }
    catch { return $null }
}

function Get-PubCache {
    if ($env:PUB_CACHE) { return $env:PUB_CACHE }
    return (Join-Path $env:LOCALAPPDATA 'Pub\Cache')
}

function Get-VirtualDisk {
    $patterns = @(
        (Join-Path $env:LOCALAPPDATA 'Packages\*\LocalState\ext4.vhdx'),
        (Join-Path $env:LOCALAPPDATA 'wsl\*\ext4.vhdx'),
        (Join-Path $env:LOCALAPPDATA 'Docker\wsl\*\*.vhdx')
    )
    return @($patterns | ForEach-Object { Get-ChildItem -Path $_ -File -ErrorAction SilentlyContinue })
}

function Get-OldTempEntry {
    $limit = (Get-Date).AddDays(-7)
    return @(Get-ChildItem -LiteralPath $env:TEMP -Force -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $limit })
}

function Get-FreeSpace([string]$Location) {
    $drive = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Location))
    return ([IO.DriveInfo]::new($drive)).AvailableFreeSpace
}

function New-CatalogItem {
    param([string]$Id, [string]$Command, $Bytes, [bool]$Available = $true, [bool]$Admin = $false, [string]$Path = $null, $Footprint = $null, $LastUsed = $null, [bool]$ShowOnly = $false)
    [pscustomobject][ordered]@{
        id        = $Id
        command   = $Command
        bytes     = $Bytes
        footprint = $Footprint
        available = $Available
        admin     = $Admin
        showOnly  = $ShowOnly
        path      = $Path
        lastUsed  = $LastUsed
    }
}

function Get-Catalog {
    $items = New-Object System.Collections.Generic.List[object]
    $self = 'Clean-Workstation.ps1 -Item'

    $pnpmStore = Read-Tool 'pnpm' @('store', 'path')
    $items.Add((New-CatalogItem -Id 'pnpm-store' -Command 'pnpm store prune' -Available ([bool]$pnpmStore) -Bytes $(if ($pnpmStore) { (Get-WorkstationFolderUsage -Path $pnpmStore).bytes })))

    $npmCache = Read-Tool 'npm' @('config', 'get', 'cache')
    $items.Add((New-CatalogItem -Id 'npm-cache' -Command 'npm cache clean --force' -Available ([bool]$npmCache) -Bytes $(if ($npmCache) { (Get-WorkstationFolderUsage -Path (Join-Path $npmCache '_cacache')).bytes })))

    $pipCache = Read-Tool 'python' @('-m', 'pip', 'cache', 'dir')
    $items.Add((New-CatalogItem -Id 'pip-cache' -Command 'python -m pip cache purge' -Available ([bool]$pipCache) -Bytes $(if ($pipCache) { (Get-WorkstationFolderUsage -Path $pipCache).bytes })))

    $dart = if (Find-Tool 'dart') { 'dart' } elseif (Find-Tool 'flutter') { 'flutter' } else { $null }
    $items.Add((New-CatalogItem -Id 'pub-cache' -Command "$(if ($dart) { $dart } else { 'dart' }) pub cache clean --force" -Available ([bool]$dart) -Bytes $(if ($dart) { (Get-WorkstationFolderUsage -Path (Get-PubCache)).bytes })))

    # Only answers while Docker is running.
    $reclaimable = $null
    if (Find-Tool 'docker') {
        try {
            $lines = @(& (Find-Tool 'docker') system df --format '{{.Reclaimable}}' 2>$null)
            if ($LASTEXITCODE -eq 0) { $reclaimable = [long]($lines | ForEach-Object { ConvertFrom-DockerSize $_ } | Measure-Object -Sum).Sum }
        }
        catch { $reclaimable = $null }
    }
    $items.Add((New-CatalogItem -Id 'docker' -Command 'docker system prune -f' -Available ($null -ne $reclaimable) -Bytes $reclaimable))

    $temp = Get-OldTempEntry
    $tempBytes = [long]0
    foreach ($entry in $temp) { $tempBytes += $(if ($entry.PSIsContainer) { (Get-WorkstationFolderUsage -Path $entry.FullName).bytes } else { $entry.Length }) }
    $items.Add((New-CatalogItem -Id 'temp' -Command "$self temp -Confirmed" -Bytes $tempBytes -Available ($temp.Count -gt 0)))

    foreach ($folder in (Find-WorkstationBuildFolder -DevelopmentRoots $roots)) {
        $usage = Get-WorkstationFolderUsage -Path $folder
        $items.Add((New-CatalogItem -Id 'build-folder' -Command "$self build-folder -Path `"$folder`" -Confirmed" -Bytes $usage.bytes -Path $folder -LastUsed $usage.lastUsed))
    }

    $disks = Get-VirtualDisk
    $diskBytes = [long]($disks | Measure-Object Length -Sum).Sum
    $items.Add((New-CatalogItem -Id 'wsl-disks' -Command "wsl --shutdown; diskpart: compact vdisk ($($disks.Count))" -Bytes $null -Footprint $diskBytes -Admin $true -Available ($disks.Count -gt 0)))

    $items.Add((New-CatalogItem -Id 'windows-update' -Command 'Dism.exe /Online /Cleanup-Image /StartComponentCleanup' -Bytes $null -Admin $true))

    # Shown so the person knows; emptying them stays with them.
    $bin = [long]0
    try {
        foreach ($entry in (New-Object -ComObject Shell.Application).Namespace(10).Items()) { $bin += [long]$entry.ExtendedProperty('Size') }
    }
    catch { $bin = $null }
    $items.Add((New-CatalogItem -Id 'recycle-bin' -Command '' -Bytes $bin -ShowOnly $true))
    $downloads = Join-Path $env:USERPROFILE 'Downloads'
    $items.Add((New-CatalogItem -Id 'downloads' -Command '' -Bytes (Get-WorkstationFolderUsage -Path $downloads).bytes -Path $downloads -ShowOnly $true))

    return $items.ToArray()
}

function Write-Result($Value) {
    $json = ConvertTo-Json -InputObject $Value -Depth 6 -Compress
    if ($OutputPath) {
        [IO.File]::WriteAllText($OutputPath, $json, (New-Object Text.UTF8Encoding $false))
    }
    else {
        $json
    }
}

function Invoke-Tool([string]$Name, [string[]]$Arguments) {
    $tool = Find-Tool $Name
    if (-not $tool) { throw "$Name isn't installed, so there's nothing of it to clean." }
    $ErrorActionPreference = 'Continue'
    & $tool @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "$Name $($Arguments -join ' ') exited with code $LASTEXITCODE." }
}

if ($PSCmdlet.ParameterSetName -eq 'List') {
    Write-Result ([pscustomobject][ordered]@{ generatedAt = (Get-Date).ToUniversalTime().ToString('o'); items = @(Get-Catalog) })
    return
}

if (-not $Confirmed) { throw "Cleaning '$Item' needs -Confirmed. Run -List first to see what it removes and its exact command." }
if ($Item -eq 'build-folder' -and -not (Test-WorkstationBuildFolder -Path $Path -DevelopmentRoots $roots)) {
    throw "$Path isn't a build folder inside the project folders, so it was left alone."
}

$location = if ($Item -eq 'build-folder') { $Path } else { $env:LOCALAPPDATA }
$before = Get-FreeSpace $location
$skipped = 0
switch ($Item) {
    'pnpm-store' { Invoke-Tool 'pnpm' @('store', 'prune') }
    'npm-cache' { Invoke-Tool 'npm' @('cache', 'clean', '--force') }
    'pip-cache' { Invoke-Tool 'python' @('-m', 'pip', 'cache', 'purge') }
    'pub-cache' { Invoke-Tool $(if (Find-Tool 'dart') { 'dart' } else { 'flutter' }) @('pub', 'cache', 'clean', '--force') }
    # Never --volumes: a volume can hold a database.
    'docker' { Invoke-Tool 'docker' @('system', 'prune', '-f') }
    'temp' {
        # Files still in use stay where they are.
        foreach ($entry in (Get-OldTempEntry)) {
            try { Remove-WorkstationToRecycleBin -Path $entry.FullName -Confirm:$false } catch { $skipped++ }
        }
    }
    'build-folder' { Remove-WorkstationToRecycleBin -Path $Path -Confirm:$false }
    'wsl-disks' {
        if (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue) { throw 'Docker Desktop is running. Quit it from its icon near the clock, then try again.' }
        Invoke-Tool 'wsl' @('--shutdown')
        foreach ($disk in (Get-VirtualDisk)) {
            $steps = "select vdisk file=`"$($disk.FullName)`"`r`nattach vdisk readonly`r`ncompact vdisk`r`ndetach vdisk`r`n"
            $script = Join-Path ([IO.Path]::GetTempPath()) "workbench-compact-$([guid]::NewGuid().ToString('N')).txt"
            [IO.File]::WriteAllText($script, $steps)
            try {
                & (Join-Path $env:SystemRoot 'System32\diskpart.exe') /s $script | Out-Null
                if ($LASTEXITCODE -ne 0) { $skipped++ }
            }
            finally { Remove-Item -LiteralPath $script -Force -ErrorAction SilentlyContinue }
        }
    }
    'windows-update' { Invoke-Tool (Join-Path $env:SystemRoot 'System32\Dism.exe') @('/Online', '/Cleanup-Image', '/StartComponentCleanup') }
}

Write-Result ([pscustomobject][ordered]@{ id = $Item; path = $Path; freedBytes = [math]::Max([long]0, (Get-FreeSpace $location) - $before); skipped = $skipped })
