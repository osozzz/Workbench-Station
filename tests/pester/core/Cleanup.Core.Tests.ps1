# Nothing here sends anything to the Recycle Bin: the refusals are checked before any removal, and the removal
# itself is never called.
BeforeAll {
    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
    Import-Module (Join-Path $repositoryRoot 'scripts\Core\Cleanup.Core.psm1') -Force
    $script:cleaner = Join-Path $repositoryRoot 'scripts\Clean-Workstation.ps1'

    $script:projects = Join-Path $TestDrive 'projects'
    $web = Join-Path $script:projects 'web'
    $null = New-Item -ItemType Directory -Path (Join-Path $web 'node_modules\left-pad') -Force
    Set-Content -LiteralPath (Join-Path $web 'package.json') -Value '{}'
    Set-Content -LiteralPath (Join-Path $web 'node_modules\left-pad\index.js') -Value ('x' * 100) -NoNewline
    # A nested project inside node_modules must not be offered on its own.
    Set-Content -LiteralPath (Join-Path $web 'node_modules\left-pad\package.json') -Value '{}'
    $null = New-Item -ItemType Directory -Path (Join-Path $web 'node_modules\left-pad\dist') -Force

    $docs = Join-Path $script:projects 'docs'
    $null = New-Item -ItemType Directory -Path (Join-Path $docs 'build') -Force
    $null = New-Item -ItemType Directory -Path (Join-Path $script:projects 'tool\.venv') -Force
    Set-Content -LiteralPath (Join-Path $script:projects 'tool\.venv\pyvenv.cfg') -Value 'home = C:\Python'
    $null = New-Item -ItemType Directory -Path (Join-Path $script:projects 'api\target') -Force
    Set-Content -LiteralPath (Join-Path $script:projects 'api\Cargo.toml') -Value '[package]'

    $script:outside = Join-Path $TestDrive 'elsewhere\node_modules'
    $null = New-Item -ItemType Directory -Path $script:outside -Force
    Set-Content -LiteralPath (Join-Path $TestDrive 'elsewhere\package.json') -Value '{}'

    $script:data = Join-Path $TestDrive 'data'
    $null = New-Item -ItemType Directory -Path (Join-Path $script:data 'config') -Force
    @{ schemaVersion = '1.0'; projects = @{ developmentRoots = @($script:projects) } } | ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath (Join-Path $script:data 'config\workstation.local.json')
}

Describe 'Test-WorkstationBuildFolder' {
    It 'accepts a build folder next to its project file inside a project folder' {
        Test-WorkstationBuildFolder -Path (Join-Path $script:projects 'web\node_modules') -DevelopmentRoots @($script:projects) | Should -BeTrue
        Test-WorkstationBuildFolder -Path (Join-Path $script:projects 'api\target') -DevelopmentRoots @($script:projects) | Should -BeTrue
        Test-WorkstationBuildFolder -Path (Join-Path $script:projects 'tool\.venv') -DevelopmentRoots @($script:projects) | Should -BeTrue
    }

    It 'refuses a folder without its project file, outside the project folders, or the project folder itself' {
        Test-WorkstationBuildFolder -Path (Join-Path $script:projects 'docs\build') -DevelopmentRoots @($script:projects) | Should -BeFalse
        Test-WorkstationBuildFolder -Path $script:outside -DevelopmentRoots @($script:projects) | Should -BeFalse
        Test-WorkstationBuildFolder -Path $script:projects -DevelopmentRoots @($script:projects) | Should -BeFalse
        Test-WorkstationBuildFolder -Path 'node_modules' -DevelopmentRoots @($script:projects) | Should -BeFalse
        Test-WorkstationBuildFolder -Path (Join-Path $script:projects 'web\node_modules') -DevelopmentRoots @() | Should -BeFalse
    }

    It 'refuses a link, even one named like a build folder' {
        $link = Join-Path $script:projects 'linked\node_modules'
        $null = New-Item -ItemType Directory -Path (Split-Path $link) -Force
        Set-Content -LiteralPath (Join-Path (Split-Path $link) 'package.json') -Value '{}'
        $null = New-Item -ItemType Junction -Path $link -Target (Join-Path $script:projects 'web\node_modules')
        try {
            Test-WorkstationBuildFolder -Path $link -DevelopmentRoots @($script:projects) | Should -BeFalse
        }
        finally {
            [IO.Directory]::Delete($link)
        }
    }
}

Describe 'Find-WorkstationBuildFolder' {
    It 'finds build folders without looking inside them' {
        $found = Find-WorkstationBuildFolder -DevelopmentRoots @($script:projects)
        @($found | ForEach-Object { $_.Substring($script:projects.Length + 1) }) | Should -Be @('api\target', 'tool\.venv', 'web\node_modules')
    }
}

Describe 'Get-WorkstationFolderUsage' {
    It 'adds up file sizes' {
        (Get-WorkstationFolderUsage -Path (Join-Path $script:projects 'web\node_modules')).bytes | Should -BeGreaterOrEqual 100
    }
}

Describe 'ConvertFrom-DockerSize' {
    It 'reads sizes as docker prints them' {
        ConvertFrom-DockerSize '645.2MB' | Should -Be 645200000
        ConvertFrom-DockerSize '1.5GB (40%)' | Should -Be 1500000000
        ConvertFrom-DockerSize '20.48kB' | Should -Be 20480
        ConvertFrom-DockerSize '0B (0%)' | Should -Be 0
        ConvertFrom-DockerSize 'n/a' | Should -BeNullOrEmpty
    }
}

Describe 'Clean-Workstation' {
    It 'refuses to clean without -Confirmed' {
        { & $script:cleaner -Item 'npm-cache' -DataDirectory $script:data } | Should -Throw '*needs -Confirmed*'
    }

    It 'refuses a folder that is not a build folder inside the project folders' {
        { & $script:cleaner -Item 'build-folder' -Path $script:outside -Confirmed -DataDirectory $script:data } | Should -Throw '*left alone*'
        { & $script:cleaner -Item 'build-folder' -Path (Join-Path $script:projects 'docs\build') -Confirmed -DataDirectory $script:data } | Should -Throw '*left alone*'
        Test-Path -LiteralPath $script:outside | Should -BeTrue
    }
}
