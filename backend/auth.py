import logging
from functools import wraps

from flask import request, jsonify, g

from clerk_auth import verify_clerk_token

logger = logging.getLogger(__name__)


def require_auth(f):
    """Decorator to protect routes and inject the authenticated user."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            logger.info(
                "Missing/invalid Authorization header for %s %s",
                request.method,
                request.path,
            )
            return jsonify({"error": "Missing or invalid authorization header"}), 401

        token = auth_header.split(" ")[1]

        try:
            g.user = verify_clerk_token(token)
        except Exception as e:
            # Log the detail server-side only; never leak verification internals
            # (or any token material) back to the client.
            logger.warning(
                "Token verification failed for %s %s: %s",
                request.method,
                request.path,
                type(e).__name__,
            )
            return jsonify({"error": "Authentication failed"}), 401

        return f(*args, **kwargs)

    return decorated_function
