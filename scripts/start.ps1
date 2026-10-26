$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $projectRoot '.env'
$exampleEnvPath = Join-Path $projectRoot '.env.example'

if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath $exampleEnvPath -Destination $envPath
    Write-Host 'Đã tạo .env từ .env.example.'
}

Push-Location $projectRoot
try {
    npm.cmd start
}
finally {
    Pop-Location
}
