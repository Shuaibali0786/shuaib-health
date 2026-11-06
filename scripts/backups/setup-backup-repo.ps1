# Owner-run helper for T083 to T085 (backups). NOT run by Claude. Read it first, then run it yourself.
#
# What it does, in order (each step asks before it acts):
#   1. makes an age key pair on your laptop (the PRIVATE key stays on your laptop; only the PUBLIC key is used)
#   2. creates the PRIVATE GitHub repo shuaib-health-backups and adds the workflow from docs/runbooks/backup-workflow.yml.example
#   3. stores two repository secrets, typed into hidden prompts (never printed, never in chat, never in history):
#        NEON_BACKUP_URL  the read-only role (backup_ro) DIRECT url of the production branch
#        AGE_RECIPIENT    the age public key (age1...)
#   4. starts the workflow once and shows its status
#
# Needs: age + age-keygen, git, gh (logged in as Shuaibali0786). Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\backups\setup-backup-repo.ps1
# It never writes to the production database: the workflow only reads, through the read-only role.

$ErrorActionPreference = "Stop"
$owner = "Shuaibali0786"
$repo = "shuaib-health-backups"
$keyDir = Join-Path $HOME ".shuaib-health-age"
$keyFile = Join-Path $keyDir "key.txt"

function Confirm-Step($text) {
  $a = Read-Host "$text (y/n)"
  if ($a -ne "y") { throw "Stopped by you." }
}

foreach ($tool in "age", "age-keygen", "git", "gh") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing tool: $tool" }
}

# 1. age key
Confirm-Step "Step 1: create an age key pair in $keyDir"
if (Test-Path $keyFile) { throw "A key already exists at $keyFile. Not overwriting it." }
New-Item -ItemType Directory -Force $keyDir | Out-Null
age-keygen -o $keyFile 2>$null
$public = (Select-String -Path $keyFile -Pattern "^# public key: (age1\S+)").Matches[0].Groups[1].Value
Write-Host "Public key (safe to share): $public"
Write-Host "NOW: copy the contents of $keyFile into your password manager. Without the private key the backups cannot be opened."
Confirm-Step "Done saving the private key in your password manager"

# 2. private repo + workflow
Confirm-Step "Step 2: create the PRIVATE repo $owner/$repo with the backup workflow"
gh repo create "$owner/$repo" --private --description "Encrypted daily backups of Shuaib Health" | Out-Null
$work = Join-Path $env:TEMP "shuaib-health-backups-setup"
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
gh repo clone "$owner/$repo" $work
New-Item -ItemType Directory -Force (Join-Path $work ".github\workflows") | Out-Null
Copy-Item "docs\runbooks\backup-workflow.yml.example" (Join-Path $work ".github\workflows\backup.yml")
Push-Location $work
git add -A
git commit -m "Add daily encrypted backup workflow"
git push origin HEAD
Pop-Location

# 3. secrets (hidden prompts)
Confirm-Step "Step 3: store the two secrets (hidden prompts)"
$url = Read-Host "Paste the NEON_BACKUP_URL (read-only role, DIRECT host). Input is hidden" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($url))
if ($plain -match "-pooler") { throw "That is the pooled host. The backup needs the DIRECT host (no -pooler)." }
$plain | gh secret set NEON_BACKUP_URL --repo "$owner/$repo"
$plain = $null
$public | gh secret set AGE_RECIPIENT --repo "$owner/$repo"

# 4. first run
Confirm-Step "Step 4: run the backup workflow once"
gh workflow run backup.yml --repo "$owner/$repo"
Start-Sleep -Seconds 10
gh run list --repo "$owner/$repo" --limit 1
Write-Host "Watch it finish: gh run watch --repo $owner/$repo"
Write-Host "Then check: the artifact exists, shows the 14-day expiry. Next: docs/runbooks/restore-drill.md."
