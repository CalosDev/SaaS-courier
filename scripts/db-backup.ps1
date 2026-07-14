param(
  [string]$OutputDirectory = ".artifacts/backups"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root $OutputDirectory
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$containerFile = "/tmp/courier-$timestamp.dump"
$localFile = Join-Path $output "courier-$timestamp.dump"
$database = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "courier_saas" }
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "courier" }

New-Item -ItemType Directory -Force -Path $output | Out-Null
Push-Location $root
try {
  & docker compose -f compose.dev.yml exec -T postgres pg_dump -U $user -d $database -Fc -f $containerFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

  & docker compose -f compose.dev.yml cp "postgres:$containerFile" $localFile
  if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed with exit code $LASTEXITCODE" }

  & docker compose -f compose.dev.yml exec -T postgres rm -f $containerFile
  if ($LASTEXITCODE -ne 0) { throw "Temporary backup cleanup failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Output $localFile
