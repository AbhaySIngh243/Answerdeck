"""Compatibility entrypoint for Render/Gunicorn.

Some Render configs default to `gunicorn your_application:app`. The project’s primary
entrypoint remains `app:app`, but providing this module makes deployments resilient to
that common placeholder.
"""

from app import app  # re-export

