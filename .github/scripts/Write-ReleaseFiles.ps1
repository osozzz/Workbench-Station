[CmdletBinding()]
param(
    # The version being released, without the "v" of the tag.
    [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
    # The NSIS bundle folder of a release build (tauri.release.conf.json), with the installer and its .sig.
    [Parameter(Mandatory)][string]$BundleDirectory,
    [Parameter(Mandatory)][string]$Changelog,
    [Parameter(Mandatory)][ValidatePattern('^[\w.-]+/[\w.-]+$')][string]$Repository,
    [Parameter(Mandatory)][string]$OutputDirectory
)

# Writes what a GitHub release of the desktop app carries: the installer under a name without spaces (GitHub
# turns spaces in asset names into dots, which would break the update link), its signature, latest.json for
# the in-app updater, SHA256SUMS.txt, and notes.md from the CHANGELOG section of this version.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Relative paths are resolved from the PowerShell location, which .NET's current directory doesn't follow.
$full = { param($Path) $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path) }

# Tauri names the installer after productName in tauri.conf.json.
$installer = Join-Path (& $full $BundleDirectory) "Workbench Station_${Version}_x64-setup.exe"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw "The installer for $Version was not found: $installer" }
$signature = "$installer.sig"
if (-not (Test-Path -LiteralPath $signature -PathType Leaf)) { throw "The installer has no signature ($signature). Build with tauri.release.conf.json and the signing key." }

# The section from "## <version>" to the next "## ", without its heading.
$lines = [IO.File]::ReadAllLines((& $full $Changelog))
$start = [Array]::FindIndex($lines, [Predicate[string]] { param($line) $line -match "^## $([regex]::Escape($Version))(\s|$)" })
if ($start -lt 0) { throw "CHANGELOG has no section for $Version. Rename ""## Unreleased"" to ""## $Version - <date>"" before tagging." }
$end = [Array]::FindIndex($lines, $start + 1, [Predicate[string]] { param($line) $line -match '^## ' })
if ($end -lt 0) { $end = $lines.Count }
$notes = (($lines[($start + 1)..($end - 1)]) -join "`n").Trim()
if ([string]::IsNullOrWhiteSpace($notes)) { throw "The CHANGELOG section for $Version is empty." }

$directory = [IO.Directory]::CreateDirectory((& $full $OutputDirectory)).FullName
$name = "Workbench-Station_${Version}_x64-setup.exe"
Copy-Item -LiteralPath $installer -Destination (Join-Path $directory $name)
Copy-Item -LiteralPath $signature -Destination (Join-Path $directory "$name.sig")

$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $directory 'notes.md'), "$notes`n", $utf8)

$manifest = [ordered]@{
    version   = $Version
    notes     = $notes
    pub_date  = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
    platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
            signature = ([IO.File]::ReadAllText($signature)).Trim()
            url       = "https://github.com/$Repository/releases/download/v$Version/$name"
        }
    }
}
[IO.File]::WriteAllText((Join-Path $directory 'latest.json'), ($manifest | ConvertTo-Json -Depth 5), $utf8)

$sums = foreach ($file in @($name, "$name.sig", 'latest.json')) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes((Join-Path $directory $file)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    "$hash  $file"
}
[IO.File]::WriteAllText((Join-Path $directory 'SHA256SUMS.txt'), (($sums -join "`n") + "`n"), $utf8)

Get-ChildItem -LiteralPath $directory | ForEach-Object { Write-Host $_.Name }
