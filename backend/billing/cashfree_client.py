"""Cashfree Payment Gateway client helpers (credentials, API client, webhook verify)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time

from cashfree_pg.api_client import Cashfree

DEFAULT_API_VERSION = "2025-01-01"


def resolve_credentials() -> tuple[str, str]:
    """Return (app_id, secret_key)."""
    app_id = (os.getenv("CASHFREE_APP_ID") or "").strip()
    secret = (os.getenv("CASHFREE_SECRET_KEY") or "").strip()
    return app_id, secret


def resolve_environment() -> str:
    return (os.getenv("CASHFREE_ENVIRONMENT") or "sandbox").strip().lower()


def resolve_api_version() -> str:
    return (os.getenv("CASHFREE_API_VERSION") or DEFAULT_API_VERSION).strip()


def get_cashfree_client() -> Cashfree:
    app_id, secret = resolve_credentials()
    if not app_id or not secret:
        raise RuntimeError("Cashfree credentials are not configured.")
    env_name = resolve_environment()
    x_env = Cashfree.PRODUCTION if env_name == "production" else Cashfree.SANDBOX
    client = Cashfree(
        XEnvironment=x_env,
        XClientId=app_id,
        XClientSecret=secret,
    )
    client.XApiVersion = resolve_api_version()
    return client


def verify_webhook_signature(
    webhook_secret: str,
    signature: str,
    timestamp: str,
    raw_body: str,
    max_age_seconds: int = 300,
) -> bool:
    """Verify Cashfree webhook using the raw body and reject replayed payloads."""
    if not webhook_secret or not signature or not timestamp:
        return False

    try:
        parsed_ts = float(str(timestamp).strip())
        # Cashfree sends epoch milliseconds on PG webhooks.
        if parsed_ts > 10_000_000_000:
            parsed_ts = parsed_ts / 1000
        if abs(time.time() - parsed_ts) > max_age_seconds:
            return False
    except (TypeError, ValueError):
        return False

    signature_data = timestamp + raw_body
    digest = hmac.new(
        webhook_secret.encode("utf-8"),
        msg=signature_data.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    computed = base64.b64encode(digest).decode()
    return hmac.compare_digest(computed, signature)


def response_to_dict(response) -> dict:
    """Normalize Cashfree SDK ApiResponse.data to a plain dict."""
    data = getattr(response, "data", None)
    if data is None:
        return {}
    if isinstance(data, dict):
        return data
    if hasattr(data, "model_dump"):
        return data.model_dump()
    if hasattr(data, "to_dict"):
        return data.to_dict()
    return dict(data)
