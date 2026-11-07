# Owner-run helper for the monthly restore drill (T086 and every month after). NOT run by Claude.
# Read it first, then run it yourself from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\backups\restore-drill.ps1 -Backup C:\path\shuaib-health-YYYYMMDD-HHMM.dump.age
#
# What it does (each step asks before it acts):
#   1. decrypts the backup with your age PRIVATE key into a temporary file
#   2. restores it into a Neon SCRATCH branch (never production) whose URL you type into a hidden prompt
#   3. runs scripts\backups\drill-counts.sql (read-only counts) on the scratch branch
#   4. deletes the decrypted dump, whatever happened
#
# Guards: refuses a pooled ("-pooler") URL; asks you to type the scratch branch name, which must start with
# "restore-drill-"; refuses if the scratch database already holds bookings (a sign it is not a fresh scratch
# branch). Needs: age, pg_restore and psql version 17.

param(
  [Parameter(Mandatory = $true)][string]$Backup,
  [string]$KeyFile = (Join-Path $HOME ".shuaib-health-age\key.txt")
)

$ErrorActionPreference = "Stop"

function Confirm-Step($text) {
  $a = Read-Host "$text (y/n)"
  if ($a -ne "y") { throw "Stopped by you." }
}

foreach ($tool in "age", "pg_restore", "psql") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing tool: $tool" }
}
if (-not (Test-Path $Backup)) { throw "Backup file not found: $Backup" }
if (-not (Test-Path $KeyFile)) { throw "age private key not found at $KeyFile (copy it from your password manager to a temporary file)." }
$major = [int]((pg_restore --version) -replace '^\D*(\d+).*$', '$1')
if ($major -lt 17) { throw "pg_restore $major found; version 17 or newer is needed." }

$started = Get-Date
$dump = Join-Path $env:TEMP ("restore-drill-" + [guid]::NewGuid().ToString("N") + ".dump")
$countsSql = Join-Path $PSScriptRoot "drill-counts.sql"

try {
  # 1. decrypt
  Confirm-Step "Step 1: decrypt $Backup into a temporary file"
  age -d -i $KeyFile -o $dump $Backup
  if ((Get-Item $dump).Length -lt 10000) { throw "Decrypted file is suspiciously small. Stopping." }

  # 2. scratch URL (hidden) + guards
  $branch = Read-Host "Type the Neon scratch branch name (must start with restore-drill-)"
  if ($branch -notmatch '^restore-drill-\d{8}$') { throw "Branch name must look like restore-drill-YYYYMMDD. Never restore into production." }
  $secure = Read-Host "Paste the DIRECT connection string of branch $branch. Input is hidden" -AsSecureString
  $env:PGURL_SCRATCH = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  if ($env:PGURL_SCRATCH -match "-pooler") { throw "That is the pooled host. Use the DIRECT host of the scratch branch." }

  $existing = psql $env:PGURL_SCRATCH -tA -v ON_ERROR_STOP=0 -c "SELECT count(*) FROM appointment" 2>$null
  if ($existing -match '^\d+$' -and [int]$existing -gt 0) {
    Write-Host "The target already has $existing bookings."
    Confirm-Step "It must be a NEW scratch branch named $branch, not production. Continue anyway"
  }

  Confirm-Step "Step 2: restore into branch $branch (it overwrites that branch only)"
  pg_restore --clean --if-exists --no-owner --no-privileges -d $env:PGURL_SCRATCH $dump
  if ($LASTEXITCODE -gt 1) { throw "pg_restore failed (exit $LASTEXITCODE). Keep the scratch branch and tell Claude the first error line (no URLs)." }

  # 3. counts (read-only)
  Write-Host "Step 3: row counts on the scratch branch:"
  psql $env:PGURL_SCRATCH -v ON_ERROR_STOP=1 -f $countsSql
  $ref = Read-Host "Optional: type one known booking reference (10 characters) to look up, or press Enter to skip"
  if ($ref -match '^[0-9A-HJKMNP-TV-Z]{10}$') {
    # psql only expands :'ref' (safely quoted) in input it reads, not in -c, so the query goes in through stdin.
    "SELECT CASE WHEN EXISTS (SELECT 1 FROM appointment WHERE reference = :'ref') THEN 'FOUND' ELSE 'NOT FOUND' END;" |
      psql $env:PGURL_SCRATCH -tA -v ON_ERROR_STOP=1 -v ref="$ref"
  }

  $minutes = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
  Write-Host "Drill time so far: $minutes minutes. Now run the same counts on production (read-only role) and compare."
  Write-Host "Then delete branch $branch in the Neon console."
}
finally {
  # 4. clean up, always
  if (Test-Path $dump) { Remove-Item -Force $dump }
  Remove-Item Env:\PGURL_SCRATCH -ErrorAction SilentlyContinue
  Write-Host "Decrypted dump deleted. Delete the temporary private-key copy too if you made one."
}
