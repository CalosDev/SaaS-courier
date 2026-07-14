param(
  [string]$BackupPath
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "courier" }
$verifyDatabase = "courier_restore_$((Get-Date).ToString('yyyyMMddHHmmss'))"
$containerFile = "/tmp/restore-verification.dump"

if (-not $BackupPath) {
  $latest = Get-ChildItem -Path (Join-Path $root ".artifacts/backups") -Filter "*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $latest) { throw "No backup was found. Run pnpm pilot:backup first." }
  $BackupPath = $latest.FullName
}

$resolvedBackup = (Resolve-Path $BackupPath).Path
Push-Location $root
try {
  & docker compose -f compose.dev.yml cp $resolvedBackup "postgres:$containerFile"
  if ($LASTEXITCODE -ne 0) { throw "Could not copy backup into PostgreSQL container." }

  & docker compose -f compose.dev.yml exec -T postgres createdb -U $user $verifyDatabase
  if ($LASTEXITCODE -ne 0) { throw "Could not create isolated restore database." }

  & docker compose -f compose.dev.yml exec -T postgres pg_restore -U $user -d $verifyDatabase --no-owner --no-privileges $containerFile
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }

  $verification = & docker compose -f compose.dev.yml exec -T postgres psql -U $user -d $verifyDatabase -Atc 'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'
  if ($LASTEXITCODE -ne 0 -or [int]$verification -lt 1) { throw "Restored database has no completed Prisma migrations." }

  Write-Output "Restore verification passed with $verification completed migrations."
} finally {
  & docker compose -f compose.dev.yml exec -T postgres dropdb -U $user --if-exists --force $verifyDatabase | Out-Null
  & docker compose -f compose.dev.yml exec -T postgres rm -f $containerFile | Out-Null
  Pop-Location
}
