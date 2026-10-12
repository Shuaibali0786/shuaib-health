# Incident: two database role passwords visible in a screenshot (2026-10-12)

No values are recorded here, by design.

## What happened
While setting up Neon (T055), the owner took a screenshot that showed the **preview** role password and the **backup_ro** role password. The screenshot was shown to the assistant's session only; nothing was committed to the repository.

## Impact
None known. Neither password had been used by any deployment, script or backup yet. Production role credentials were not shown.

## Timeline
- Screenshot taken during Neon setup (T055).
- Before running `set-vercel-env.ps1` (T057/T058), the owner reset **both** passwords in Neon and re-copied the preview pooled and direct connection strings with the new password.
- The script then wrote the new values to the Vercel projects. Nothing used the old values.

## Cause
A dashboard screen that displays a password in clear text was captured whole.

## Fix
Both passwords were reset in Neon before first use; the Vercel projects hold only the new values.

## Prevention
- Never screenshot a Neon, Vercel or Sentry page that shows a password, token or connection string. Crop to the field name, or take the screenshot before the value is revealed.
- Secrets live only in the owner's private files (outside the repository) and are entered into Vercel by script, never typed into chat.
- Rule for the first-deploy runbook: if a secret is shown by accident, reset it before first use and write a short incident note like this one.
