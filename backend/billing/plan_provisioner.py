"""Auto-provision Cashfree subscription plans and webhook secret in INR.

If env vars (CASHFREE_PLAN_STANDARD_ID etc.) are set, we honour them directly.
Otherwise the first upgrade call creates plans via SubsCreatePlan and persists
plan ids in billing_config.
"""

from __future__ import annotations

import logging
import os
import secrets
import threading
import uuid
from datetime import datetime, timezone

from cashfree_pg.models.create_plan_request import CreatePlanRequest

from billing.cashfree_client import (
    get_cashfree_client,
    resolve_credentials,
    resolve_environment,
    response_to_dict,
)
from models import BillingConfig, db

log = logging.getLogger(__name__)

_CACHE_LOCK = threading.Lock()
_PLAN_CACHE: dict[str, str] = {}
_WEBHOOK_SECRET_CACHE: str | None = None

PLAN_DEFINITIONS = {
    "standard": {
        "env_name": "CASHFREE_PLAN_STANDARD_ID",
        "config_key": "plan_id_standard",
        "plan_id": "answerdeck_standard_monthly",
        "recurring_amount": 1999.0,
        "name": "Answerdeck Standard (Monthly)",
        "note": "1 project, 10 prompts per project, full dashboard and reports.",
    },
    "pro": {
        "env_name": "CASHFREE_PLAN_PRO_ID",
        "config_key": "plan_id_pro",
        "plan_id": "answerdeck_pro_monthly",
        "recurring_amount": 3999.0,
        "name": "Answerdeck Pro (Monthly)",
        "note": "3 projects, 10 prompts per project, everything in Standard.",
    },
}

WEBHOOK_SECRET_CONFIG_KEY = "webhook_secret_autogen"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    """Return the plan id if we already know it (env or DB), without calling Cashfree."""
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
    """Return a usable Cashfree plan id, creating one on Cashfree if needed."""
    existing = get_plan_id_if_known(plan_key)
    if existing:
        return existing

    plan = PLAN_DEFINITIONS.get(plan_key)
    if not plan:
        raise ValueError(f"Unknown plan key: {plan_key}")

    with _CACHE_LOCK:
        cached = _PLAN_CACHE.get(plan_key)
        if cached:
            return cached

        client = get_cashfree_client()
        amount = float(plan["recurring_amount"])
        request = CreatePlanRequest(
            plan_id=plan["plan_id"],
            plan_name=plan["name"],
            plan_type="PERIODIC",
            plan_currency="INR",
            plan_recurring_amount=amount,
            plan_max_amount=amount,
            plan_max_cycles=1200,
            plan_intervals=1,
            plan_interval_type="MONTH",
            plan_note=plan["note"],
        )
        response = client.SubsCreatePlan(
            create_plan_request=request,
            x_idempotency_key=str(uuid.uuid4()),
        )
        payload = response_to_dict(response)
        plan_id = str(payload.get("plan_id") or plan["plan_id"]).strip()
        if not plan_id:
            raise RuntimeError(f"Cashfree SubsCreatePlan returned no id for {plan_key}.")

        try:
            _write_config(plan["config_key"], plan_id)
        except Exception as exc:
            log.warning("Failed to persist plan id for %s: %s", plan_key, exc)

        _PLAN_CACHE[plan_key] = plan_id
        log.info("Auto-provisioned Cashfree plan %s -> %s", plan_key, plan_id)
        return plan_id


def get_webhook_secret() -> str:
    """Return the webhook secret from env, or an auto-generated value from DB."""
    global _WEBHOOK_SECRET_CACHE

    env_value = (os.getenv("CASHFREE_WEBHOOK_SECRET") or "").strip()
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
                    "Auto-generated Cashfree webhook secret (first boot). "
                    "Paste this value into the Cashfree Dashboard → Webhooks "
                    "for signature verification to succeed: %s",
                    stored,
                )
            except Exception as exc:
                log.warning("Failed to persist autogen webhook secret: %s", exc)
        _WEBHOOK_SECRET_CACHE = stored
        return stored


def diagnose_configuration() -> dict:
    """Report whether keys, plans, and webhook are configured (for /billing/health)."""
    app_id, secret = resolve_credentials()
    keys_configured = bool(app_id and secret)

    plan_status: dict[str, dict] = {}
    for plan_key in PLAN_DEFINITIONS:
        known = get_plan_id_if_known(plan_key)
        plan_status[plan_key] = {
            "configured": bool(known),
            "plan_id": known or "",
        }

    env_secret = bool((os.getenv("CASHFREE_WEBHOOK_SECRET") or "").strip())
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
        "gateway": "cashfree",
        "environment": resolve_environment(),
    }
