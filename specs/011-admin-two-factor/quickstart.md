# Quickstart: two-step sign-in (local)

1. Make a key (never share it):
   `python -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())"`
   and put it in `backend/.env` as `TWO_FACTOR_KEY=…`.
2. Migrate the dev database: `cd backend && uv run alembic upgrade head`.
3. Run the API and the website as usual. Sign in as an admin, then open **Account → Security** and **Turn on two-step sign-in**.
4. Scan the QR code with an authenticator app, enter the code, and save the 10 backup codes.
5. Sign out and sign in again: the code step appears.
6. Lost phone: another admin opens **Staff → person → Reset two-step sign-in**. If no admin can sign in: `uv run python -m app.auth.create_admin --reset-two-factor <email>` (direct database URL, with the operator present).

Without `TWO_FACTOR_KEY` the security page says two-step sign-in is not available, and nothing else changes.
