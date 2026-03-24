from functools import wraps
from flask import request, jsonify, g
from clerk_auth import verify_clerk_token

def require_auth(f):
    """Decorator to protect routes and inject the authenticated user."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization header"}), 401
        
        token = auth_header.split(" ")[1]
        
        try:
            # Verify Clerk JWT and inject user into Flask global context.
            g.user = verify_clerk_token(token)
            return f(*args, **kwargs)
            
        except Exception as e:
            return jsonify({"error": "Authentication failed", "detail": str(e)}), 401
            
    return decorated_function
