"""Cashfree subscriptions: create checkout, webhooks, billing profile."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone

from cashfree_pg.models.create_subscription_request import CreateSubscriptionRequest
from cashfree_pg.models.create_subscription_request_authorization_details import (
    CreateSubscriptionRequestAuthorizationDetails,
)
from cashfree_pg.models.create_subscription_request_plan_details import (
    CreateSubscriptionRequestPlanDetails,
)
from cashfree_pg.models.create_subscription_request_subscription_meta import (
    CreateSubscriptionRequestSubscriptionMeta,
)
from cashfree_pg.models.manage_subscription_request import ManageSubscriptionRequest
from cashfree_pg.models.subscription_customer_details import SubscriptionCustomerDetails
from flask import Blueprint, g, jsonify, request

from auth import require_auth
from billing.cashfree_client import (
    get_cashfree_client,
    resolve_credentials,
    response_to_dict,
    verify_webhook_signature,
)
from billing.entitlements import ACTIVE_SUBSCRIPTION_STATUSES, effective_plan, limits_payload
from exceptions import ValidationError
from models import UserBilling, db

billing_bp = Blueprint("billing", __name__)

PLAN_KEYS = frozenset({"standard", "pro"})

IN_CHECKOUT_STATUSES = frozenset({"initialized", "created"})
REVOKED_STATUSES = frozenset(
    {
        "cancelled",
        "completed",
        "expired",
        "customer_cancelled",
        "customer_paused",
        "link_expired",
        "card_expired",
    }
)

_PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _frontend_return_url() -> str:
    base = (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip().rstrip("/")
    return f"{base}/dashboard/settings?billing=return"


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if not _PHONE_RE.match(digits):
        raise ValidationError("customer_phone must be a valid 10-digit Indian mobile number.")
    return digits


def _normalize_email(raw: str | None, fallback_user_email: str | None) -> str:
    email = (raw or fallback_user_email or "").strip().lower()
    if not email or "@" not in email:
        raise ValidationError("customer_email is required for subscription checkout.")
    return email


def _customer_name(email: str, raw_name: str | None) -> str:
    name = (raw_name or "").strip()
    if name:
        return name[:40]
    local = email.split("@", 1)[0].strip()
    return (local or "Answerdeck User")[:40]


def _plan_id(plan_key: str) -> str:
    if plan_key not in PLAN_KEYS:
        raise ValidationError("Invalid plan.")
    from billing.plan_provisioner import ensure_plan_id

    try:
        return ensure_plan_id(plan_key)
    except Exception as exc:
        raise ValidationError(f"Could not provision Cashfree plan for {plan_key}: {exc}") from exc


def _subscription_payload(response) -> dict:
    return response_to_dict(response)


def _fetch_subscription(client, subscription_id: str) -> dict:
    response = client.SubsFetchSubscription(subscription_id=subscription_id)
    return _subscription_payload(response)


def _cancel_subscription(client, subscription_id: str) -> None:
    if not subscription_id:
        return
    req = ManageSubscriptionRequest(subscription_id=subscription_id, action="CANCEL")
    client.SubsManageSubscription(
        subscription_id=subscription_id,
        manage_subscription_request=req,
        x_idempotency_key=str(uuid.uuid4()),
    )


def _extract_tags(raw_tags) -> dict[str, str]:
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


def _apply_subscription_webhook(data: dict) -> None:
    sub_details = data.get("subscription_details") or {}
    if not isinstance(sub_details, dict):
        return

    sub_id = str(sub_details.get("subscription_id") or "").strip()
    if not sub_id:
        return

    tags = _extract_tags(sub_details.get("subscription_tags"))
    clerk_user_id = tags.get("clerk_user_id")
    internal_plan = tags.get("internal_plan")
    if internal_plan:
        internal_plan = internal_plan.lower()
    if internal_plan not in (None, "standard", "pro"):
        internal_plan = None

    plan_details = data.get("plan_details") or {}
    plan_id = ""
    if isinstance(plan_details, dict):
        plan_id = str(plan_details.get("plan_id") or "").strip()

    raw_status = str(sub_details.get("subscription_status") or "initialized")
    status = raw_status.lower()
    expiry = sub_details.get("subscription_expiry_time")
    period_end_str = str(expiry) if expiry is not None else ""

    row = None
    if clerk_user_id:
        row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not row:
        row = UserBilling.query.filter_by(gateway_subscription_id=sub_id).first()
        if row:
            clerk_user_id = row.clerk_user_id

    if not clerk_user_id:
        return

    now = _now_iso()
    if not row:
        ip = internal_plan
        if ip not in ("standard", "pro"):
            from billing.plan_provisioner import get_plan_id_if_known

            std = get_plan_id_if_known("standard") or ""
            pro = get_plan_id_if_known("pro") or ""
            if plan_id and std and plan_id == std:
                ip = "standard"
            elif plan_id and pro and plan_id == pro:
                ip = "pro"
            else:
                ip = "free"
        row = UserBilling(
            clerk_user_id=clerk_user_id,
            internal_plan=ip,
            gateway_subscription_id=sub_id,
            gateway_plan_id=plan_id,
            status=status,
            current_period_end=period_end_str,
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.gateway_subscription_id = sub_id
        row.gateway_plan_id = plan_id or row.gateway_plan_id
        row.status = status
        if period_end_str:
            row.current_period_end = period_end_str
        if internal_plan in ("standard", "pro"):
            row.internal_plan = internal_plan
        elif status in REVOKED_STATUSES:
            row.internal_plan = "free"
        row.updated_at = now

    db.session.commit()


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
    data = request.get_json(force=True) or {}
    plan_key = (data.get("plan_key") or data.get("plan") or "").strip().lower()
    if plan_key not in PLAN_KEYS:
        raise ValidationError('plan_key must be "standard" or "pro".')

    customer_email = _normalize_email(data.get("customer_email"), g.user.email)
    customer_phone = _normalize_phone(data.get("customer_phone") or "")
    customer_name = _customer_name(customer_email, data.get("customer_name"))

    try:
        client = get_cashfree_client()
    except RuntimeError as exc:
        raise ValidationError(str(exc)) from exc

    plan_id = _plan_id(plan_key)
    uid = g.user.id
    row = UserBilling.query.filter_by(clerk_user_id=uid).first()

    if row and row.status in ACTIVE_SUBSCRIPTION_STATUSES:
        if row.internal_plan == plan_key:
            raise ValidationError("You already have an active subscription for this plan.")
        raise ValidationError(
            "You already have an active subscription. Cancel it in Cashfree or contact support "
            "before switching plans.",
        )

    if row and row.status in IN_CHECKOUT_STATUSES and row.gateway_subscription_id:
        if row.internal_plan == plan_key:
            try:
                existing = _fetch_subscription(client, row.gateway_subscription_id)
                session_id = str(existing.get("subscription_session_id") or "").strip()
                if session_id:
                    return jsonify(
                        {
                            "subscription_id": row.gateway_subscription_id,
                            "subscription_session_id": session_id,
                            "reused": True,
                        }
                    )
            except Exception:
                pass
        try:
            _cancel_subscription(client, row.gateway_subscription_id)
        except Exception:
            pass

    merchant_sub_id = f"ad_{uid.replace('user_', '')[:20]}_{uuid.uuid4().hex[:12]}"
    create_req = CreateSubscriptionRequest(
        subscription_id=merchant_sub_id,
        customer_details=SubscriptionCustomerDetails(
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
        ),
        plan_details=CreateSubscriptionRequestPlanDetails(plan_id=plan_id),
        authorization_details=CreateSubscriptionRequestAuthorizationDetails(
            authorization_amount=1.0,
            authorization_amount_refund=False,
            payment_methods=["upi", "card", "enach"],
        ),
        subscription_meta=CreateSubscriptionRequestSubscriptionMeta(
            return_url=_frontend_return_url(),
            notification_channel=["EMAIL", "SMS"],
        ),
        subscription_tags={
            "clerk_user_id": str(uid),
            "internal_plan": str(plan_key),
        },
    )

    try:
        response = client.SubsCreateSubscription(
            create_subscription_request=create_req,
            x_idempotency_key=str(uuid.uuid4()),
        )
        sub = _subscription_payload(response)
    except Exception as e:
        raise ValidationError(str(e)) from e

    now = _now_iso()
    sub_id = str(sub.get("subscription_id") or merchant_sub_id).strip()
    session_id = str(sub.get("subscription_session_id") or "").strip()
    sub_status = str(sub.get("subscription_status") or "INITIALIZED").lower()
    resolved_plan_id = str((sub.get("plan_details") or {}).get("plan_id") or plan_id)

    if not session_id:
        raise ValidationError("Cashfree did not return a subscription_session_id.")

    if not row:
        row = UserBilling(
            clerk_user_id=uid,
            internal_plan=plan_key,
            gateway_subscription_id=sub_id,
            gateway_plan_id=resolved_plan_id,
            status=sub_status,
            current_period_end="",
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.internal_plan = plan_key
        row.gateway_subscription_id = sub_id
        row.gateway_plan_id = resolved_plan_id
        row.status = sub_status
        row.updated_at = now

    db.session.commit()

    return jsonify(
        {
            "subscription_id": sub_id,
            "subscription_session_id": session_id,
            "reused": False,
        }
    )


@billing_bp.route("/webhook", methods=["POST"])
def cashfree_webhook():
    from billing.plan_provisioner import get_webhook_secret

    webhook_secret = get_webhook_secret()
    body_raw = request.get_data(cache=False, as_text=True)
    signature = request.headers.get("x-webhook-signature", "")
    timestamp = request.headers.get("x-webhook-timestamp", "")

    app_id, secret = resolve_credentials()
    if not app_id or not secret:
        return jsonify({"error": "Cashfree not configured"}), 503

    if not webhook_secret:
        return jsonify({"error": "Webhook secret not configured — cannot verify payload"}), 503

    if not signature or not timestamp:
        return jsonify({"error": "Missing x-webhook-signature or x-webhook-timestamp header"}), 400

    if not verify_webhook_signature(webhook_secret, signature, timestamp, body_raw):
        return jsonify({"error": "Invalid signature"}), 400

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    event_type = str(body.get("type") or "").upper()
    subscription_events = {
        "SUBSCRIPTION_STATUS_CHANGED",
        "SUBSCRIPTION_STATUS_CHANGE",
        "SUBSCRIPTION_AUTH_STATUS",
        "SUBSCRIPTION_PAYMENT_SUCCESS",
        "SUBSCRIPTION_PAYMENT_FAILED",
        "SUBSCRIPTION_PAYMENT_CANCELLED",
    }
    if event_type in subscription_events:
        payload_data = body.get("data")
        if isinstance(payload_data, dict):
            _apply_subscription_webhook(payload_data)

    return jsonify({"ok": True})


@billing_bp.route("/health", methods=["GET"])
def billing_health():
    """Public surface for the dashboard to tell users what needs configuring."""
    from billing.plan_provisioner import diagnose_configuration

    return jsonify(diagnose_configuration())
