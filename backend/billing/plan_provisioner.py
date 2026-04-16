"""Auto-provision Razorpay subscription plans and webhook secret in INR.

The test Razorpay account does not have plans pre-created, so the first time
we need one we call the Plans API, persist the resulting plan_id in the
`billing_config` table, and cache it in memory for the rest of the process
lifetime. If an env var (RAZORPAY_PLAN_STANDARD_ID etc.) is set, we honour it
directly and never hit the API.

This module is tolerant of a missing DB row (returns empty strings), of an
unreachable Razorpay (raises with a human-readable error), and of duplicate
concurrent callers (uses a process lock around the create/persist path).
"""

from __future__ import annotations

import logging
import os
import secrets
import threading
from datetime import datetime, timezone

import razorpay

from models import BillingConfig, db

log = logging.getLogger(__name__)

# In-memory caches to avoid DB round-trips on hot paths.
_CACHE_LOCK = threading.Lock()
_PLAN_CACHE: dict[str, str] = {}
_WEBHOOK_SECRET_CACHE: str | None = None

PLAN_DEFINITIONS = {
    "standard": {
        "env_name": "RAZORPAY_PLAN_STANDARD_ID",
        "config_key": "plan_id_standard",
        "amount_paise": 199900,  # ₹1,999.00
        "name": "Answerdeck Standard (Monthly)",
        "description": "1 project, 10 prompts per project, full dashboard and reports.",
    },
    "pro": {
        "env_name": "RAZORPAY_PLAN_PRO_ID",
        "config_key": "plan_id_pro",
        "amount_paise": 399900,  # ₹3,999.00
        "name": "Answerdeck Pro (Monthly)",
        "description": "3 projects, 10 prompts per project, everything in Standard.",
    },
}

WEBHOOK_SECRET_CONFIG_KEY = "webhook_secret_autogen"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_credentials() -> tuple[str, str]:
    key = (
        os.getenv("RAZORPAY_KEY_ID")
        or os.getenv("TEST_PAYMENT_API")
        or ""
    ).strip()
    secret = (
        os.getenv("RAZORPAY_KEY_SECRET")
        or os.getenv("TEST_KEY_SECRET")
        or ""
    ).strip()
    return key, secret


def _get_client() -> razorpay.Client:
    key, secret = _resolve_credentials()
    if not key or not secret:
        raise RuntimeError("Razorpay credentials are not configured.")
    return razorpay.Client(auth=(key, secret))


def _read_config(key: str) -> str:
    row = BillingConfig.query.filter_by(key=key).first()
    return (row.value if row and row.value else "").strip()


def _write_config(key: str, value: str) -> None:
    row = BillingConfig.query.filter_by(key=key).first()
    now = _now_iso()
    if row:
        row.value = value
        row.updated_at = now
    else:
        db.session.add(BillingConfig(key=key, value=value, updated_at=now))
    db.session.commit()


def get_plan_id_if_known(plan_key: str) -> str | None:
    """Return the plan id if we already know it (env or DB), without calling Razorpay."""
    plan = PLAN_DEFINITIONS.get(plan_key)
    if not plan:
        return None

    cached = _PLAN_CACHE.get(plan_key)
    if cached:
        return cached

    env_value = (os.getenv(plan["env_name"]) or "").strip()
    if env_value:
        with _CACHE_LOCK:
            _PLAN_CACHE[plan_key] = env_value
        return env_value

    try:
        db_value = _read_config(plan["config_key"])
    except Exception:
        db_value = ""
    if db_value:
        with _CACHE_LOCK:
            _PLAN_CACHE[plan_key] = db_value
        return db_value

    return None


def ensure_plan_id(plan_key: str) -> str:
    """Return a usable Razorpay plan id, creating one on Razorpay if needed."""
    existing = get_plan_id_if_known(plan_key)
    if existing:
        return existing

    plan = PLAN_DEFINITIONS.get(plan_key)
    if not plan:
        raise ValueError(f"Unknown plan key: {plan_key}")

    with _CACHE_LOCK:
        # Re-check inside the lock in case a concurrent call created it.
        cached = _PLAN_CACHE.get(plan_key)
        if cached:
            return cached

        client = _get_client()
        response = client.plan.create(
            {
                "period": "monthly",
                "interval": 1,
                "item": {
                    "name": plan["name"],
                    "amount": plan["amount_paise"],
                    "currency": "INR",
                    "description": plan["description"],
                },
                "notes": {"internal_plan": plan_key, "source": "answerdeck_autoprovision"},
            }
        )
        plan_id = str(response.get("id") or "").strip()
        if not plan_id:
            raise RuntimeError(f"Razorpay plan.create returned no id for {plan_key}.")

        try:
            _write_config(plan["config_key"], plan_id)
        except Exception as exc:
            log.warning("Failed to persist plan id for %s: %s", plan_key, exc)

        _PLAN_CACHE[plan_key] = plan_id
        log.info("Auto-provisioned Razorpay plan %s -> %s", plan_key, plan_id)
        return plan_id


def get_webhook_secret() -> str:
    """Return the webhook secret from env, or an auto-generated value from DB.

    The autogen value is intended for local/dev. In production you should paste
    the same secret in the Razorpay dashboard and set RAZORPAY_WEBHOOK_SECRET
    explicitly in your environment.
    """
    global _WEBHOOK_SECRET_CACHE

    env_value = (os.getenv("RAZORPAY_WEBHOOK_SECRET") or "").strip()
    if env_value:
        return env_value

    if _WEBHOOK_SECRET_CACHE:
        return _WEBHOOK_SECRET_CACHE

    with _CACHE_LOCK:
        if _WEBHOOK_SECRET_CACHE:
            return _WEBHOOK_SECRET_CACHE
        try:
            stored = _read_config(WEBHOOK_SECRET_CONFIG_KEY)
        except Exception:
            stored = ""
        if not stored:
            stored = secrets.token_urlsafe(32)
            try:
                _write_config(WEBHOOK_SECRET_CONFIG_KEY, stored)
                log.warning(
                    "Auto-generated Razorpay webhook secret (first boot). "
                    "Paste this value into the Razorpay Dashboard → Webhooks "
                    "for signature verification to succeed: %s",
                    stored,
                )
            except Exception as exc:
                log.warning("Failed to persist autogen webhook secret: %s", exc)
        _WEBHOOK_SECRET_CACHE = stored
        return stored


def diagnose_configuration() -> dict:
    """Report whether keys, plans, and webhook are configured (for /billing/health)."""
    key, secret = _resolve_credentials()
    keys_configured = bool(key and secret)

    plan_status: dict[str, dict] = {}
    for plan_key in PLAN_DEFINITIONS:
        known = get_plan_id_if_known(plan_key)
        plan_status[plan_key] = {
            "configured": bool(known),
            "plan_id": known or "",
        }

    env_secret = bool((os.getenv("RAZORPAY_WEBHOOK_SECRET") or "").strip())
    autogen_secret = False
    try:
        autogen_secret = bool(_read_config(WEBHOOK_SECRET_CONFIG_KEY))
    except Exception:
        autogen_secret = False

    return {
        "keys_configured": keys_configured,
        "plans": plan_status,
        "plans_configured": all(item["configured"] for item in plan_status.values()),
        "webhook_secret_configured": env_secret,
        "webhook_secret_autogen_present": autogen_secret,
        "ready_for_checkout": keys_configured,
        "currency": "INR",
    }
