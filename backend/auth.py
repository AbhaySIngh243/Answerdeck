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
            # Verify Clerk JWT and inject user into Flask global context.
            g.user = verify_clerk_token(token)
            return f(*args, **kwargs)
            
        except Exception as e:
            try:
                snippet = token[:16] + "..." if isinstance(token, str) else "<non-string>"
                print(
                    f"[auth] token verification failed for {request.method} {request.path} "
                    f"(token={snippet}, origin={request.headers.get('Origin')!r}): {e}"
                )
            except Exception:
                pass
            return jsonify({"error": "Authentication failed", "detail": str(e)}), 401
            
    return decorated_function
