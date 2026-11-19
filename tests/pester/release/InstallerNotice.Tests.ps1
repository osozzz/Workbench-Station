Describe 'Installer notice' {
    It 'shows the privacy summary and then the full license' {
        $root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
        $notice = [IO.File]::ReadAllText((Join-Path $root 'app\src-tauri\installer\license.txt'))
        $license = [IO.File]::ReadAllText((Join-Path $root 'LICENSE'))

        $notice.Replace("`r`n", "`n").EndsWith($license.Replace("`r`n", "`n")) | Should -BeTrue
        $notice | Should -Match 'PRIVACY\.md'
        (Get-Content (Join-Path $root 'app\src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).bundle.licenseFile | Should -Be 'installer/license.txt'
    }
}
