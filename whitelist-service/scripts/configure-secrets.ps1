$ErrorActionPreference = 'Stop'

function ConvertFrom-SecurePassword {
    param([Security.SecureString]$SecurePassword)
    return [Net.NetworkCredential]::new('', $SecurePassword).Password
}

Write-Host 'Reset RSLauncher whitelist admin password.' -ForegroundColor Cyan
$firstSecure = Read-Host 'Enter new admin password' -AsSecureString
$secondSecure = Read-Host 'Enter the same password again' -AsSecureString
$firstPassword = ConvertFrom-SecurePassword $firstSecure
$secondPassword = ConvertFrom-SecurePassword $secondSecure

if ($firstPassword -ne $secondPassword) {
    Write-Host 'The two passwords do not match.' -ForegroundColor Red
    exit 1
}

if ($firstPassword.Length -lt 8 -or $firstPassword.Length -gt 256) {
    Write-Host 'Password must be between 8 and 256 characters.' -ForegroundColor Red
    exit 1
}

try {
    $env:RS_ADMIN_PASSWORD = $firstPassword
    node scripts/configure-secrets.mjs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Remove-Item Env:RS_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $firstPassword = $null
    $secondPassword = $null
}
