import os
from dataclasses import dataclass
from functools import lru_cache

import jwt


@dataclass(frozen=True)
class ClerkUser:
    id: str
    email: str | None = None


def _jwks_url() -> str:
    # Example: https://your-domain.clerk.accounts.dev/.well-known/jwks.json
    return os.getenv("CLERK_JWKS_URL", "").strip()


def _issuer() -> str:
    # Optional strict issuer check.
    return os.getenv("CLERK_JWT_ISSUER", "").strip()


@lru_cache(maxsize=1)
def _jwk_client():
    url = _jwks_url()
    if not url:
        raise ValueError("CLERK_JWKS_URL is not configured")
    return jwt.PyJWKClient(url)


def verify_clerk_token(token: str) -> ClerkUser:
    signing_key = _jwk_client().get_signing_key_from_jwt(token)

    # Do not pass issuer= into jwt.decode: Clerk's iss and CLERK_JWT_ISSUER can differ
    # by a trailing slash; PyJWT treats that as a hard failure.
    kwargs = {
        "algorithms": ["RS256"],
        "options": {"require": ["exp", "sub"]},
        "leeway": 60,
    }
    payload = jwt.decode(token, signing_key.key, **kwargs)

    issuer = _issuer()
    if issuer:
        iss = payload.get("iss")
        if not iss or str(iss).rstrip("/") != str(issuer).rstrip("/"):
            raise jwt.InvalidIssuerError(f"Invalid issuer (expected {issuer!r}, got {iss!r})")
    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise ValueError("Missing subject in Clerk token")

    # Clerk may expose email in custom claims depending on template/settings.
    email = payload.get("email")
    if not isinstance(email, str):
        email = None

    return ClerkUser(id=user_id, email=email)

