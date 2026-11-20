Set-StrictMode -Version Latest

# Rules for freeing up space. Only build folders inside the project folders can be removed, and only to the
# Recycle Bin. Everything else is cleaned by each tool's own command. See docs/policies/cleanup-safety.md.

# A build folder only counts when its project file sits next to it, so a "build" or "dist" folder that holds
# source code in some other kind of repository is never offered.
$script:BuildFolderMarkers = [ordered]@{
    'node_modules' = @('package.json')
    '.next'        = @('package.json')
    '.nuxt'        = @('package.json')
    '.svelte-kit'  = @('package.json')
    '.angular'     = @('package.json', 'angular.json')
    'dist'         = @('package.json')
    'build'        = @('package.json', 'build.gradle', 'build.gradle.kts', 'pubspec.yaml')
    'target'       = @('Cargo.toml', 'pom.xml')
    'bin'          = @('*.csproj', '*.fsproj', '*.vbproj')
    'obj'          = @('*.csproj', '*.fsproj', '*.vbproj')
    '.gradle'      = @('build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts')
    '.dart_tool'   = @('pubspec.yaml')
    '.venv'        = @()
    'venv'         = @()
}

function Test-WorkstationBuildFolder {
    <#
    .SYNOPSIS
    Whether a folder is a build folder that may go to the Recycle Bin: inside a project folder, not a link, named
    like build output and next to its project file (a Python environment instead holds pyvenv.cfg).
    #>
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory)][string]$Path,
        [AllowEmptyCollection()][string[]]$DevelopmentRoots = @()
    )

    if (-not [IO.Path]::IsPathRooted($Path)) { return $false }
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $item = Get-Item -LiteralPath $full -Force -ErrorAction SilentlyContinue
    if ($null -eq $item -or -not $item.PSIsContainer) { return $false }
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { return $false }

    $inside = $false
    foreach ($root in @($DevelopmentRoots)) {
        if ([string]::IsNullOrWhiteSpace($root)) { continue }
        $prefix = [IO.Path]::GetFullPath($root).TrimEnd('\') + '\'
        if ($full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { $inside = $true }
    }
    if (-not $inside) { return $false }

    $name = $item.Name.ToLowerInvariant()
    if (-not $script:BuildFolderMarkers.Contains($name)) { return $false }
    if ($name -in @('.venv', 'venv')) { return (Test-Path -LiteralPath (Join-Path $full 'pyvenv.cfg')) }
    foreach ($marker in $script:BuildFolderMarkers[$name]) {
        if (@(Get-ChildItem -LiteralPath $item.Parent.FullName -Filter $marker -File -Force -ErrorAction SilentlyContinue).Count -gt 0) { return $true }
    }
    return $false
}

function Find-WorkstationBuildFolder {
    <#
    .SYNOPSIS
    The build folders under the project folders. It doesn't look inside a build folder, a .git folder or a link.
    #>
    [CmdletBinding()]
    [OutputType([string[]])]
    param(
        [AllowEmptyCollection()][string[]]$DevelopmentRoots = @(),
        [ValidateRange(1, 32)][int]$MaxDepth = 10
    )

    $found = New-Object System.Collections.Generic.List[string]
    $pending = New-Object System.Collections.Generic.Stack[object]
    foreach ($root in @($DevelopmentRoots)) {
        if (-not [string]::IsNullOrWhiteSpace($root) -and (Test-Path -LiteralPath $root -PathType Container)) {
            $pending.Push(@([IO.Path]::GetFullPath($root), 0))
        }
    }
    while ($pending.Count -gt 0) {
        $next = $pending.Pop()
        $folder = [string]$next[0]
        $depth = [int]$next[1]
        foreach ($child in @(Get-ChildItem -LiteralPath $folder -Directory -Force -ErrorAction SilentlyContinue)) {
            if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            if ($child.Name -eq '.git') { continue }
            if (Test-WorkstationBuildFolder -Path $child.FullName -DevelopmentRoots $DevelopmentRoots) {
                $found.Add($child.FullName)
                continue
            }
            if ($depth + 1 -lt $MaxDepth) { $pending.Push(@($child.FullName, ($depth + 1))) }
        }
    }
    return , ($found.ToArray() | Sort-Object)
}

function Get-WorkstationFolderUsage {
    <#
    .SYNOPSIS
    A folder's size in bytes and when a file in it last changed. Links inside it are not followed.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $bytes = [long]0
    $last = [datetime]::MinValue
    # Get-ChildItem -Recurse follows junctions on Windows PowerShell 5.1, and pnpm fills node_modules with them.
    $pending = New-Object System.Collections.Generic.Stack[IO.DirectoryInfo]
    if (Test-Path -LiteralPath $Path -PathType Container) { $pending.Push([IO.DirectoryInfo]::new($Path)) }
    while ($pending.Count -gt 0) {
        $folder = $pending.Pop()
        try { $entries = $folder.GetFileSystemInfos() } catch { continue }
        foreach ($entry in $entries) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            if ($entry -is [IO.DirectoryInfo]) { $pending.Push($entry); continue }
            $bytes += $entry.Length
            if ($entry.LastWriteTime -gt $last) { $last = $entry.LastWriteTime }
        }
    }
    [pscustomobject]@{
        bytes    = $bytes
        lastUsed = if ($last -eq [datetime]::MinValue) { $null } else { $last.ToUniversalTime().ToString('o') }
    }
}

function ConvertFrom-DockerSize {
    <#
    .SYNOPSIS
    Bytes from a size as docker prints it, such as "645.2MB" or "1.2GB (40%)". Null when it can't be read.
    #>
    [CmdletBinding()]
    param([AllowEmptyString()][string]$Text)

    $match = [regex]::Match([string]$Text, '^\s*([\d.]+)\s*([kKMGT]?B)')
    if (-not $match.Success) { return $null }
    # Hash keys ignore case, so kB and KB are one entry.
    $scale = @{ 'B' = 1; 'KB' = 1e3; 'MB' = 1e6; 'GB' = 1e9; 'TB' = 1e12 }[$match.Groups[2].Value]
    return [long]([double]::Parse($match.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture) * $scale)
}

function Remove-WorkstationToRecycleBin {
    <#
    .SYNOPSIS
    Sends a file or folder to the Recycle Bin. If it doesn't fit there, Windows asks before deleting it for good.
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Path)

    if (-not $PSCmdlet.ShouldProcess($Path, 'Send to the Recycle Bin')) { return }
    # Loaded here, so the type is looked up by name; its options are given as text and converted by PowerShell.
    Add-Type -AssemblyName Microsoft.VisualBasic
    $fileSystem = 'Microsoft.VisualBasic.FileIO.FileSystem' -as [type]
    if (Test-Path -LiteralPath $Path -PathType Container) {
        $fileSystem::DeleteDirectory($Path, 'AllDialogs', 'SendToRecycleBin')
    }
    else {
        $fileSystem::DeleteFile($Path, 'AllDialogs', 'SendToRecycleBin')
    }
}

Export-ModuleMember -Function Test-WorkstationBuildFolder, Find-WorkstationBuildFolder, Get-WorkstationFolderUsage, ConvertFrom-DockerSize, Remove-WorkstationToRecycleBin
