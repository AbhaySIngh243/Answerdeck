"""Cashfree Payment Gateway: one-time orders, webhooks, plan access."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from cashfree_pg.models.create_order_request import CreateOrderRequest
from cashfree_pg.models.customer_details import CustomerDetails
from cashfree_pg.models.order_meta import OrderMeta
from flask import Blueprint, g, jsonify, redirect, request

from auth import require_auth
from billing.cashfree_client import (
    get_cashfree_client,
    resolve_credentials,
    resolve_environment,
    response_to_dict,
    verify_webhook_signature,
)
from billing.entitlements import (
    effective_plan,
    limits_payload,
    subscription_unlocked,
)
from billing.plan_provisioner import (
    PLAN_ACCESS_DAYS,
    get_webhook_secret,
    plan_amount,
    plan_currency,
)
from exceptions import ValidationError
from models import UserBilling, db

billing_bp = Blueprint("billing", __name__)

PLAN_KEYS = frozenset({"standard", "pro"})
PENDING_CHECKOUT_STATUSES = frozenset({"pending", "initialized", "created"})

_PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _period_end_iso(from_dt: datetime | None = None) -> str:
    base = from_dt or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return (base + timedelta(days=PLAN_ACCESS_DAYS)).isoformat()


def _frontend_settings_url(**query: str) -> str:
    base = (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip().rstrip("/")
    params = urlencode({k: v for k, v in query.items() if v})
    path = f"{base}/dashboard/settings"
    return f"{path}?{params}" if params else path


def _api_public_base() -> str:
    base = (
        os.getenv("API_PUBLIC_URL")
        or os.getenv("BACKEND_URL")
        or "http://localhost:5000"
    ).strip().rstrip("/")
    if "PASTE_NGROK" in base.upper() or "YOUR-NGROK" in base.upper():
        raise ValidationError(
            "Set API_PUBLIC_URL in backend .env to your public HTTPS URL (ngrok or deployed API)."
        )
    if resolve_environment() == "production":
        lowered = base.lower()
        if not lowered.startswith("https://") or "localhost" in lowered or "127.0.0.1" in lowered:
            raise ValidationError(
                "Cashfree production checkout requires API_PUBLIC_URL to be a public HTTPS backend URL."
            )
    return base


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    # Indian convenience: drop the +91 country code so we keep a clean 10-digit number.
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    # Accept either a 10-digit Indian mobile or an international number (with country
    # code). Cashfree converts currency at checkout, so non-Indian buyers must be able
    # to pay too — we only enforce a sane digit-length range here.
    if _PHONE_RE.match(digits) or (8 <= len(digits) <= 15):
        return digits
    raise ValidationError("customer_phone must be a valid phone number including country code.")


def _normalize_email(raw: str | None, fallback_user_email: str | None) -> str:
    email = (raw or fallback_user_email or "").strip().lower()
    if not email or "@" not in email:
        raise ValidationError("customer_email is required for checkout.")
    return email


def _customer_name(email: str, raw_name: str | None) -> str:
    name = (raw_name or "").strip()
    if name:
        return name[:40]
    local = email.split("@", 1)[0].strip()
    return (local or "Answrdeck User")[:40]


def _format_cashfree_error(exc: Exception) -> str:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        msg = body.get("message") or body.get("error") or body.get("detail")
        if msg:
            return str(msg)
    if isinstance(body, str) and body.strip():
        return body.strip()[:500]
    text = str(exc).strip()
    return text or type(exc).__name__


def _order_payload(response) -> dict:
    return response_to_dict(response)


def _fetch_order(client, order_id: str) -> dict:
    response = client.PGFetchOrder(order_id=order_id)
    return _order_payload(response)


def _extract_order_tags(raw_tags) -> dict[str, str]:
    if not isinstance(raw_tags, dict):
        return {}
    out: dict[str, str] = {}
    for key in ("clerk_user_id", "internal_plan"):
        val = raw_tags.get(key)
        if val is not None:
            text = str(val).strip()
            if text:
                out[key] = text
    return out


def _activate_paid_plan(
    *,
    clerk_user_id: str,
    order_id: str,
    plan_key: str,
    row: UserBilling | None = None,
) -> UserBilling:
    now = _now_iso()
    if plan_key not in PLAN_KEYS:
        plan_key = "standard"

    if not row:
        row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not row:
        row = UserBilling(
            clerk_user_id=clerk_user_id,
            internal_plan=plan_key,
            gateway_subscription_id=order_id,
            gateway_plan_id=plan_key,
            status="active",
            current_period_end=_period_end_iso(),
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.internal_plan = plan_key
        row.gateway_subscription_id = order_id
        row.gateway_plan_id = plan_key
        row.status = "active"
        row.current_period_end = _period_end_iso()
        row.updated_at = now

    db.session.commit()
    return row


def _apply_order_paid(order_id: str, tags: dict[str, str] | None = None) -> None:
    order_id = str(order_id or "").strip()
    if not order_id:
        return

    row = UserBilling.query.filter_by(gateway_subscription_id=order_id).first()
    tag_map = tags or {}
    if row:
        tag_map = {
            "clerk_user_id": row.clerk_user_id,
            "internal_plan": row.internal_plan,
            **tag_map,
        }

    clerk_user_id = str(tag_map.get("clerk_user_id") or "").strip()
    plan_key = str(tag_map.get("internal_plan") or "standard").strip().lower()
    if not clerk_user_id:
        return

    _activate_paid_plan(
        clerk_user_id=clerk_user_id,
        order_id=order_id,
        plan_key=plan_key,
        row=row,
    )


def _apply_pg_webhook(data: dict, event_type: str) -> None:
    order = data.get("order") if isinstance(data.get("order"), dict) else {}
    order_id = str(order.get("order_id") or "").strip()
    if not order_id:
        return

    tags = _extract_order_tags(order.get("order_tags"))
    payment = data.get("payment") if isinstance(data.get("payment"), dict) else {}
    payment_status = str(payment.get("payment_status") or "").upper()
    event = event_type.upper()

    if event == "PAYMENT_SUCCESS_WEBHOOK" or payment_status == "SUCCESS":
        try:
            fetched_order = _fetch_order(get_cashfree_client(), order_id)
        except Exception:
            return
        if str(fetched_order.get("order_status") or "").upper() != "PAID":
            return
        fetched_tags = _extract_order_tags(fetched_order.get("order_tags"))
        _apply_order_paid(order_id, {**tags, **fetched_tags})
        return

    row = UserBilling.query.filter_by(gateway_subscription_id=order_id).first()
    if not row:
        return
    if subscription_unlocked(row):
        return

    if event in ("PAYMENT_FAILED_WEBHOOK",) or payment_status == "FAILED":
        row.status = "failed"
        row.updated_at = _now_iso()
        db.session.commit()
        return

    if event in ("PAYMENT_USER_DROPPED_WEBHOOK",) or payment_status == "USER_DROPPED":
        row.status = "pending"
        row.updated_at = _now_iso()
        db.session.commit()


def _sync_order_row(row: UserBilling) -> dict:
    if not row or not (row.gateway_subscription_id or "").strip():
        return {"updated": False, "reason": "no_order", "plan": "free"}

    client = get_cashfree_client()
    order = _fetch_order(client, row.gateway_subscription_id)
    order_status = str(order.get("order_status") or "").upper()
    tags = _extract_order_tags(order.get("order_tags"))

    if order_status == "PAID":
        if not (row.status == "cancelled" and subscription_unlocked(row)):
            clerk_user_id = tags.get("clerk_user_id") or row.clerk_user_id
            plan_key = tags.get("internal_plan") or row.internal_plan or "standard"
            _activate_paid_plan(
                clerk_user_id=clerk_user_id,
                order_id=row.gateway_subscription_id,
                plan_key=plan_key,
                row=row,
            )
    elif order_status in ("EXPIRED", "TERMINATED"):
        row.status = "expired"
        row.updated_at = _now_iso()
        db.session.commit()
    elif order_status == "ACTIVE":
        row.status = "pending"
        row.updated_at = _now_iso()
        db.session.commit()

    db.session.refresh(row)
    return {
        "updated": True,
        "status": row.status,
        "plan": effective_plan(row.clerk_user_id),
    }


@billing_bp.route("/return", methods=["GET", "POST"])
def billing_return():
    """Cashfree redirect after PG checkout; sync order, then open Settings."""
    order_id = str(request.values.get("order_id") or "").strip()
    sync_note = ""

    if order_id:
        row = UserBilling.query.filter_by(gateway_subscription_id=order_id).first()
        if row:
            try:
                result = _sync_order_row(row)
                sync_note = result.get("plan") or ""
            except Exception:
                pass

    if sync_note in ("standard", "pro"):
        return redirect(_frontend_settings_url(billing="return", plan=sync_note), code=302)
    return redirect(_frontend_settings_url(billing="return"), code=302)


@billing_bp.route("/cancel", methods=["POST"])
@require_auth
def billing_cancel():
    """Stop renewal intent; paid access continues until current_period_end."""
    uid = g.user.id
    row = UserBilling.query.filter_by(clerk_user_id=uid).first()
    if not row or not subscription_unlocked(row):
        raise ValidationError("No active plan to cancel.")

    row.status = "cancelled"
    row.updated_at = _now_iso()
    db.session.commit()

    return jsonify(
        {
            "ok": True,
            "plan": effective_plan(uid),
            "subscription": {
                "status": row.status,
                "current_period_end": row.current_period_end or None,
            },
        }
    )


@billing_bp.route("/sync", methods=["POST"])
@require_auth
def billing_sync():
    uid = g.user.id
    row = UserBilling.query.filter_by(clerk_user_id=uid).first()
    if not row:
        return jsonify({"updated": False, "reason": "no_order", "plan": "free"})
    try:
        result = _sync_order_row(row)
    except Exception as exc:
        raise ValidationError(_format_cashfree_error(exc)) from exc
    return jsonify(result)


@billing_bp.route("/me", methods=["GET"])
@require_auth
def billing_me():
    uid = g.user.id
    row = UserBilling.query.filter_by(clerk_user_id=uid).first()
    plan = effective_plan(uid)
    out = {
        "plan": plan,
        "limits": limits_payload(uid),
        "subscription": None,
    }
    if row and row.gateway_subscription_id:
        out["subscription"] = {
            "id": row.gateway_subscription_id,
            "status": row.status,
            "internal_plan": row.internal_plan,
            "gateway_plan_id": row.gateway_plan_id,
            "current_period_end": row.current_period_end or None,
            "updated_at": row.updated_at,
        }
    return jsonify(out)


@billing_bp.route("/subscribe", methods=["POST"])
@require_auth
def subscribe():
    """Create a Cashfree PG order and return payment_session_id for hosted checkout."""
    data = request.get_json(force=True) or {}
    plan_key = (data.get("plan_key") or data.get("plan") or "").strip().lower()
    if plan_key not in PLAN_KEYS:
        raise ValidationError('plan_key must be "standard" or "pro".')

    customer_email = _normalize_email(data.get("customer_email"), g.user.email)
    customer_phone = _normalize_phone(data.get("customer_phone") or "")
    customer_name = _customer_name(customer_email, data.get("customer_name"))

    try:
        client = get_cashfree_client()
        api_base = _api_public_base()
    except RuntimeError as exc:
        raise ValidationError(str(exc)) from exc

    uid = g.user.id
    row = UserBilling.query.filter_by(clerk_user_id=uid).first()

    if subscription_unlocked(row):
        if row.internal_plan == plan_key:
            raise ValidationError("You already have an active plan. Renew after it expires or upgrade from Settings.")
        raise ValidationError(
            "You already have an active plan. Cancel it first or wait until it expires before switching.",
        )

    amount = plan_amount(plan_key)
    if amount <= 0:
        raise ValidationError("Plan amount must be greater than zero.")
    currency = plan_currency()
    order_id = f"ad_{uid.replace('user_', '')[:12]}_{uuid.uuid4().hex[:10]}"

    return_url = f"{api_base}/api/billing/return?order_id={{order_id}}"
    notify_url = f"{api_base}/api/billing/webhook"

    create_req = CreateOrderRequest(
        order_id=order_id,
        order_amount=amount,
        order_currency=currency,
        customer_details=CustomerDetails(
            customer_id=str(uid)[:50],
            customer_email=customer_email,
            customer_phone=customer_phone,
            customer_name=customer_name,
        ),
        order_meta=OrderMeta(
            return_url=return_url,
            notify_url=notify_url,
        ),
        order_tags={
            "clerk_user_id": str(uid),
            "internal_plan": str(plan_key),
        },
        order_note=f"Answrdeck {plan_key} plan - {PLAN_ACCESS_DAYS} days access",
    )

    try:
        response = client.PGCreateOrder(
            create_order_request=create_req,
            x_idempotency_key=str(uuid.uuid4()),
        )
        order = _order_payload(response)
    except Exception as exc:
        raise ValidationError(_format_cashfree_error(exc)) from exc

    session_id = str(order.get("payment_session_id") or "").strip()
    resolved_order_id = str(order.get("order_id") or order_id).strip()
    if not session_id:
        raise ValidationError("Cashfree did not return a payment_session_id.")

    now = _now_iso()
    if not row:
        row = UserBilling(
            clerk_user_id=uid,
            internal_plan=plan_key,
            gateway_subscription_id=resolved_order_id,
            gateway_plan_id=plan_key,
            status="pending",
            current_period_end="",
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.internal_plan = plan_key
        row.gateway_subscription_id = resolved_order_id
        row.gateway_plan_id = plan_key
        row.status = "pending"
        row.current_period_end = ""
        row.updated_at = now

    db.session.commit()

    return jsonify(
        {
            "order_id": resolved_order_id,
            "payment_session_id": session_id,
            "subscription_id": resolved_order_id,
            "subscription_session_id": session_id,
            "reused": False,
        }
    )


@billing_bp.route("/webhook", methods=["POST"])
def cashfree_webhook():
    webhook_secret = get_webhook_secret()
    body_raw = request.get_data(cache=False, as_text=True)
    signature = request.headers.get("x-webhook-signature", "")
    timestamp = request.headers.get("x-webhook-timestamp", "")

    app_id, secret = resolve_credentials()
    if not app_id or not secret:
        return jsonify({"error": "Cashfree not configured"}), 503

    signature_secrets = []
    if webhook_secret:
        signature_secrets.append(webhook_secret)
    if secret and secret not in signature_secrets:
        signature_secrets.append(secret)
    if not signature_secrets:
        return jsonify({"error": "Cashfree webhook signature secret not configured"}), 503

    if not signature or not timestamp:
        return jsonify({"error": "Missing x-webhook-signature or x-webhook-timestamp header"}), 400

    if not any(
        verify_webhook_signature(candidate, signature, timestamp, body_raw)
        for candidate in signature_secrets
    ):
        return jsonify({"error": "Invalid signature"}), 400

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    event_type = str(body.get("type") or "").upper()
    payload_data = body.get("data")
    if isinstance(payload_data, dict):
        _apply_pg_webhook(payload_data, event_type)

    return jsonify({"ok": True})


@billing_bp.route("/health", methods=["GET"])
def billing_health():
    from billing.plan_provisioner import diagnose_configuration

    return jsonify(diagnose_configuration())
