$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot 'auth-helper\RSLauncher.Auth\RSLauncher.Auth.csproj'
$outputDirectory = Join-Path $projectRoot 'auth-helper\publish'

$portableDotnet = Join-Path $env:LOCALAPPDATA 'Temp\rslauncher-dotnet-sdk\dotnet.exe'
if (Test-Path -LiteralPath $portableDotnet) {
    $dotnetExecutable = (Get-Item -LiteralPath $portableDotnet).FullName
} else {
    $dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($null -eq $dotnetCommand) {
        throw '.NET 8 SDK is required: https://dotnet.microsoft.com/download/dotnet/8.0'
    }
    $dotnetExecutable = $dotnetCommand.Source
}

& $dotnetExecutable publish $projectFile `
    --configuration Release `
    --runtime win-x64 `
    --self-contained true `
    --output $outputDirectory `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:DebugType=None `
    -p:DebugSymbols=false

if ($LASTEXITCODE -ne 0) {
    throw 'Failed to build the CmlLib authentication helper.'
}

Copy-Item -LiteralPath (Join-Path $projectRoot 'auth-helper\THIRD-PARTY-NOTICES.txt') `
    -Destination (Join-Path $outputDirectory 'THIRD-PARTY-NOTICES.txt') `
    -Force
