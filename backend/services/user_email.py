"""Resolve a Clerk user's email for outbound notifications."""

from __future__ import annotations

import logging
import os

import requests

log = logging.getLogger(__name__)


def resolve_user_email(clerk_user_id: str, jwt_email: str | None = None) -> str | None:
    """Return the user's primary email, or None if it cannot be resolved."""
    if jwt_email and "@" in str(jwt_email):
        return str(jwt_email).strip().lower()

    user_id = (clerk_user_id or "").strip()
    if not user_id:
        return None

    secret = (os.getenv("CLERK_SECRET_KEY") or "").strip()
    if not secret:
        return None

    try:
        response = requests.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {secret}"},
            timeout=12,
        )
        if response.status_code >= 400:
            log.warning("Clerk user lookup failed (%s): %s", response.status_code, response.text[:200])
            return None
        payload = response.json()
        addresses = payload.get("email_addresses") or []
        primary_id = payload.get("primary_email_address_id")
        for entry in addresses:
            if not isinstance(entry, dict):
                continue
            email = str(entry.get("email_address") or "").strip().lower()
            if not email or "@" not in email:
                continue
            if primary_id and entry.get("id") == primary_id:
                return email
        for entry in addresses:
            if isinstance(entry, dict):
                email = str(entry.get("email_address") or "").strip().lower()
                if email and "@" in email:
                    return email
    except Exception as exc:
        log.warning("Clerk user lookup error for %s: %s", user_id, exc)
    return None
