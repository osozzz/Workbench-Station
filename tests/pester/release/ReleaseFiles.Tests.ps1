BeforeAll {
    $script:writer = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\.github\scripts\Write-ReleaseFiles.ps1'))

    function New-TestBundle {
        param([string]$Version = '3.0.0', [switch]$WithoutSignature)
        $bundle = Join-Path $TestDrive "bundle-$([guid]::NewGuid().ToString('N'))"
        New-Item -ItemType Directory -Path $bundle | Out-Null
        Set-Content -LiteralPath (Join-Path $bundle "Workbench Station_${Version}_x64-setup.exe") -Value 'installer' -NoNewline
        if (-not $WithoutSignature) { Set-Content -LiteralPath (Join-Path $bundle "Workbench Station_${Version}_x64-setup.exe.sig") -Value "c2lnbmF0dXJl`n" -NoNewline }
        return $bundle
    }

    $script:changelog = Join-Path $TestDrive 'CHANGELOG.md'
    Set-Content -LiteralPath $script:changelog -Encoding UTF8 -Value @"
# Changelog

## Unreleased

## 3.0.0 — 2026-11-20

### Added

- The desktop app.

## 2.3.0 — 2026-11-04

- Older.
"@

    function Invoke-Writer {
        param([string]$Bundle, [string]$Version = '3.0.0')
        $out = Join-Path $TestDrive "out-$([guid]::NewGuid().ToString('N'))"
        & $script:writer -Version $Version -BundleDirectory $Bundle -Changelog $script:changelog -Repository 'osozzz/Workbench-Station' -OutputDirectory $out 6>$null
        return $out
    }
}

Describe 'Write-ReleaseFiles' {
    It 'writes the installer without spaces, its signature, notes, latest.json and checksums' {
        $out = Invoke-Writer -Bundle (New-TestBundle)

        @(Get-ChildItem $out | ForEach-Object Name | Sort-Object) | Should -Be @('latest.json', 'notes.md', 'SHA256SUMS.txt', 'Workbench-Station_3.0.0_x64-setup.exe', 'Workbench-Station_3.0.0_x64-setup.exe.sig')
        (Get-Content (Join-Path $out 'notes.md') -Raw) | Should -Be "### Added`n`n- The desktop app.`n"

        $manifest = Get-Content (Join-Path $out 'latest.json') -Raw | ConvertFrom-Json
        $manifest.version | Should -Be '3.0.0'
        $manifest.notes | Should -Match 'The desktop app'
        $manifest.platforms.'windows-x86_64'.signature | Should -Be 'c2lnbmF0dXJl'
        $manifest.platforms.'windows-x86_64'.url | Should -Be 'https://github.com/osozzz/Workbench-Station/releases/download/v3.0.0/Workbench-Station_3.0.0_x64-setup.exe'

        $sums = Get-Content (Join-Path $out 'SHA256SUMS.txt')
        $sums.Count | Should -Be 3
        $sums[0] | Should -Match '^[0-9a-f]{64}  Workbench-Station_3\.0\.0_x64-setup\.exe$'
    }

    It 'refuses a version without its own CHANGELOG section' {
        { Invoke-Writer -Bundle (New-TestBundle -Version '3.1.0') -Version '3.1.0' } | Should -Throw '*no section for 3.1.0*'
    }

    It 'refuses an unsigned installer' {
        { Invoke-Writer -Bundle (New-TestBundle -WithoutSignature) } | Should -Throw '*no signature*'
    }
}
