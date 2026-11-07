# Two-step sign-in (Feature 011)

🔑 = owner. Never paste a key, code or password into chat, an issue or a commit.

## Turn it on for a deployment (🔑, 5 minutes)
1. On your laptop, make a key:
   `python -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())"`
2. Vercel → `shuaib-health-api` → Settings → Environment Variables → add `TWO_FACTOR_KEY` with that value for **Production**. For **Preview**, make a **different** key. Do not add it to `shuaib-health-web`: the website never needs it.
3. Keep a copy in your password manager (the `D:\private` notes). **Losing it locks every enrolled admin out of the code step** (see "Key lost").
4. Redeploy the API (variables apply only to a new deployment).
5. Check: sign in as an admin → sidebar **Security** → "Turn on two-step sign-in" is offered.

Without the key, the Security page says "not available on this system yet". Nothing else changes.

## Enrol (each admin)
Security → Turn on → current password → scan the QR code (or type the key) in an authenticator app → enter the code → save the 10 backup codes (print or password manager) → tick "I have saved…" → Done.

## Lost phone
- **Another admin can sign in:** Staff → the person → **Reset two-step sign-in** → confirm. They are signed out, sign in with the password, and enrol again.
- **No admin can sign in** (🔑, with the operator at the keyboard):
  `cd backend && uv run python -m app.auth.create_admin --email <their email> --reset-two-factor --expect-host <production host>`
  It asks you to confirm the database host and prints only "Two-step sign-in turned off…". This is logged as a system action.

## Key lost or changed
Every enrolled account gets "Two-step sign-in is not available right now" at the code step. It is never a password-only fallback.
1. Put the old key back if you have it, then redeploy. Everything works again.
2. If the key is gone: set a new key, redeploy, then reset each enrolled person with the operator command above. They enrol again.

## What the Activity log shows
- Asked for a sign-in code
- Failed sign-in code ("Wrong code")
- Turned on / Turned off two-step sign-in
- Used a backup code
- Made new backup codes
- Reset two-step sign-in, by an admin or by the system

No code, key or password is ever written to the log.
