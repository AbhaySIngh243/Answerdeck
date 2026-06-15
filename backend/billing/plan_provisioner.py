"""Cashfree PG plan pricing (one-time monthly payments, no recurring mandates)."""

from __future__ import annotations

import logging
import os

from billing.cashfree_client import resolve_credentials, resolve_environment

log = logging.getLogger(__name__)

PLAN_DEFINITIONS = {
    "standard": {
        "amount_env": "CASHFREE_PLAN_STANDARD_AMOUNT",
        "recurring_amount": 79.0,
        "name": "Answrdeck Standard Monthly",
    },
    "pro": {
        "amount_env": "CASHFREE_PLAN_PRO_AMOUNT",
        "recurring_amount": 149.0,
        "name": "Answrdeck Pro Monthly",
    },
}

PLAN_ACCESS_DAYS = int(os.getenv("CASHFREE_PLAN_ACCESS_DAYS") or "30")


def plan_currency() -> str:
    return (os.getenv("CASHFREE_PLAN_CURRENCY") or "USD").strip().upper()


def plan_amount(plan_key: str) -> float:
    definition = PLAN_DEFINITIONS[plan_key]
    raw = (os.getenv(definition["amount_env"]) or "").strip()
    if raw:
        try:
            return float(raw)
        except ValueError:
            log.warning("Invalid %s=%r; using default", definition["amount_env"], raw)
    return float(definition["recurring_amount"])


def payment_methods_for_currency(currency: str | None = None) -> list[str]:
    cur = (currency or plan_currency()).strip().upper()
    if cur == "INR":
        return ["upi", "card", "netbanking", "wallet"]
    return ["card"]


def get_webhook_secret() -> str:
    return (os.getenv("CASHFREE_WEBHOOK_SECRET") or "").strip()


def diagnose_configuration() -> dict:
    app_id, secret = resolve_credentials()
    keys_configured = bool(app_id and secret)
    currency = plan_currency()
    environment = resolve_environment()
    api_public = (
        os.getenv("API_PUBLIC_URL") or os.getenv("BACKEND_URL") or ""
    ).strip()
    public_url_ready = bool(api_public)
    if environment == "production":
        public_url_ready = public_url_ready and api_public.lower().startswith("https://")

    plan_status: dict[str, dict] = {}
    for plan_key, definition in PLAN_DEFINITIONS.items():
        plan_status[plan_key] = {
            "configured": True,
            "amount": plan_amount(plan_key),
            "name": definition["name"],
            "currency": currency,
        }

    webhook_secret = get_webhook_secret()

    return {
        "keys_configured": keys_configured,
        "plans": plan_status,
        "plans_configured": True,
        "webhook_secret_configured": bool(webhook_secret),
        "webhook_url_ready": public_url_ready,
        "ready_for_checkout": keys_configured and bool(webhook_secret) and public_url_ready,
        "currency": currency,
        "payment_methods": payment_methods_for_currency(currency),
        "gateway": "cashfree_pg",
        "billing_mode": "one_time_order",
        "plan_access_days": PLAN_ACCESS_DAYS,
        "environment": environment,
    }
