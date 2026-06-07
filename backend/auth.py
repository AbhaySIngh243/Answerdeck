from functools import wraps
from flask import request, jsonify, g
from clerk_auth import verify_clerk_token

def require_auth(f):
    """Decorator to protect routes and inject the authenticated user."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            try:
                print(
                    f"[auth] missing/invalid Authorization header for {request.method} {request.path} "
                    f"(origin={request.headers.get('Origin')!r})"
                )
            except Exception:
                pass
            return jsonify({"error": "Missing or invalid authorization header"}), 401
        
        token = auth_header.split(" ")[1]

        try:
            g.user = verify_clerk_token(token)
        except Exception as e:
            try:
                snippet = token[:16] + "..." if isinstance(token, str) else "<non-string>"
                print(
                    f"[auth] token verification failed for {request.method} {request.path} "
                    f"(token={snippet}, origin={request.headers.get('Origin')!r}): "
                    f"{type(e).__name__}: {e!r}",
                    flush=True,
                )
            except Exception:
                pass
            return jsonify({"error": "Authentication failed", "detail": str(e) or type(e).__name__}), 401

        return f(*args, **kwargs)
            
    return decorated_function
