$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot 'custom-installer\RSLauncher.Installer\RSLauncher.Installer.csproj'
$payloadPath = Join-Path $projectRoot 'dist\RSLauncher-setup-Windows.exe'
$publishDirectory = Join-Path $projectRoot 'custom-installer\publish'
$outputPath = Join-Path $projectRoot 'dist\RSLauncher-Installer-Windows.exe'
$packagePath = Join-Path $projectRoot 'package.json'

if (-not (Test-Path -LiteralPath $payloadPath)) {
    throw "Build the NSIS installer first: $payloadPath"
}

$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
$version = [string]$package.version

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
    --output $publishDirectory `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -p:Version=$version

if ($LASTEXITCODE -ne 0) {
    throw 'Failed to build the RSLauncher custom installer.'
}

$publishedExecutable = Join-Path $publishDirectory 'RSLauncher.Installer.exe'
if (-not (Test-Path -LiteralPath $publishedExecutable)) {
    throw "Published installer was not found: $publishedExecutable"
}

Copy-Item -LiteralPath $publishedExecutable -Destination $outputPath -Force
Write-Host "Custom installer created: $outputPath"
