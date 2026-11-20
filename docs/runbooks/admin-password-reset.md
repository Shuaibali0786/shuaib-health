# Runbook: reset a forgotten admin password (and check for a lockout)

Use this when an admin cannot sign in and no other admin can reset the password from Staff. It runs
on your own PC against the **production** database. It never prints a password, hash, key or URL,
and it never saves anything to a file.

What it does and does not do:

- `status` is **read-only**. It says whether the account exists, is active, has two-step sign-in on,
  and whether sign-in is locked (5 wrong tries in 15 minutes lock an email for 15 minutes; the lock
  ends by itself).
- `set-password` changes the password of **one** account, asks for it twice with hidden typing (no
  command-line option, no stdin), ends that account's open sessions and lifts its sign-in lock.
  **Two-step sign-in is left as it is.**
- Both commands use the production guard: the masked host and database name are printed and you
  must type the database name.

Tool: `backend/app/auth/admin_access.py` (tests: `backend/tests/unit/test_admin_access_cli.py`).

## Steps (PowerShell, a fresh window)

1. Open a new PowerShell and run `cd D:\shuaib-health\backend`.
2. Paste the Neon **production** URLs with hidden input (pooled, then direct):

   ```
   $s = Read-Host "Neon PRODUCTION pooled URL" -AsSecureString
   $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
   $s = Read-Host "Neon PRODUCTION direct URL" -AsSecureString
   $env:DIRECT_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
   ```

3. Set the other values the command needs. They are throwaway and are not used for the reset:

   ```
   $env:APP_ENV = "development"
   $env:BOOKING_PROXY_SECRET = -join ((48..57+97..122) | Get-Random -Count 40 | % {[char]$_})
   $env:SESSION_SECRET = -join ((48..57+97..122) | Get-Random -Count 40 | % {[char]$_})
   $env:PRIVACY_HASH_KEY = -join ((48..57+97..122) | Get-Random -Count 40 | % {[char]$_})
   ```

   A throwaway `PRIVACY_HASH_KEY` makes the "lock for this email" line unreliable (it says "none
   recorded" even if the email is locked) and means the reset cannot lift that lock. For an exact
   answer set the real production key with the same hidden `Read-Host` pattern as step 2. The line
   "Emails locked right now" is always correct.
4. Read-only check. Replace `<prod host>` with the Neon production host (the same one used for
   `create_admin`). Type the database name when asked:

   ```
   uv run python -m app.auth.admin_access status --email <admin email> --expect-host <prod host>
   ```

   If it says "Account exists: no", the email is not the one on the account: stop and find the
   right email before setting any password.
5. Set the new password (typed twice, hidden):

   ```
   uv run python -m app.auth.admin_access set-password --email <admin email> --expect-host <prod host>
   ```

6. Close the PowerShell window (this drops every variable).
7. Sign in with the new password. Two-step sign-in is unchanged, so you still need your
   authenticator code. If that is lost too, use
   `uv run python -m app.auth.create_admin --email <admin email> --reset-two-factor --expect-host <prod host>`
   (see `two-factor.md`).

The password must pass the normal policy (length, not common, does not contain the email name).

## Lost authenticator: `reset-2fa`

Use this when the password works but the authenticator code does not (phone lost, entry deleted).
Do steps 1 to 3 above (a fresh PowerShell, hidden URLs, throwaway values; the throwaway
`PRIVACY_HASH_KEY` is fine here), then:

```
uv run python -m app.auth.admin_access reset-2fa --email <admin email> --expect-host <prod host>
```

Type the database name when asked. It turns two-step sign-in off for **that one account**, clears its
old secret and backup codes, ends its open sessions and writes a `staff.two_factor_reset` audit row.
It never prints a secret, and the password is not changed. It says so if two-step sign-in was already off.

Then close the PowerShell window, sign in with the **password only**, open **Account** and set up
two-step sign-in again: scan the new QR code and save the new backup codes. Until you do, the
account is protected by the password alone, so do it straight away.
