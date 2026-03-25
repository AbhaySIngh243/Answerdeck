"""WSGI entrypoint expected by Render's default gunicorn command."""

from app import app  # noqa: F401 – re-export
