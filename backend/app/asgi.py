"""Vercel entrypoint: a top-level ``app``. Tests and local runs keep using ``create_app()``."""

from app.main import create_app

app = create_app()
