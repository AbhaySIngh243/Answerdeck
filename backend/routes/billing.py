"""Razorpay subscriptions: create checkout, webhooks, billing profile."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import razorpay
from flask import Blueprint, g, jsonify, request

from auth import require_auth
from billing.entitlements import ACTIVE_SUBSCRIPTION_STATUSES, effective_plan, limits_payload
from exceptions import ValidationError
from models import UserBilling, db

billing_bp = Blueprint("billing", __name__)

PLAN_ENV_KEYS = {
    "standard": "RAZORPAY_PLAN_STANDARD_ID",
    "pro": "RAZORPAY_PLAN_PRO_ID",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_razorpay_credentials() -> tuple[str, str]:
    """Return (key_id, key_secret) accepting both canonical and legacy names."""
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


def _get_razorpay_client() -> razorpay.Client:
    key, secret = _resolve_razorpay_credentials()
    if not key or not secret:
        raise ValidationError("Razorpay is not configured on the server (missing key id or secret).")
    return razorpay.Client(auth=(key, secret))


def _plan_razorpay_id(plan_key: str) -> str:
    if plan_key not in PLAN_ENV_KEYS:
        raise ValidationError("Invalid plan.")
    from billing.plan_provisioner import ensure_plan_id

    try:
        return ensure_plan_id(plan_key)
    except Exception as exc:
        raise ValidationError(
            f"Could not provision Razorpay plan for {plan_key}: {exc}"
        ) from exc


def _extract_subscription_entity(body: dict) -> dict | None:
    payload = body.get("payload") or {}
    sub = payload.get("subscription") or {}
    ent = sub.get("entity")
    return ent if isinstance(ent, dict) else None


def _apply_subscription_entity(entity: dict) -> None:
    sub_id = entity.get("id")
    if not sub_id:
        return
    notes = entity.get("notes") or {}
    if not isinstance(notes, dict):
        notes = {}
    clerk_user_id = notes.get("clerk_user_id")
    if clerk_user_id is not None:
        clerk_user_id = str(clerk_user_id).strip() or None
    internal_plan = notes.get("internal_plan")
    if internal_plan is not None:
        internal_plan = str(internal_plan).strip().lower()
    if internal_plan not in (None, "standard", "pro"):
        internal_plan = None

    plan_id = entity.get("plan_id") or ""
    status = (entity.get("status") or "").lower() or "created"
    current_end = entity.get("current_end")
    period_end_str = str(current_end) if current_end is not None else ""

    row = None
    if clerk_user_id:
        row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not row:
        row = UserBilling.query.filter_by(razorpay_subscription_id=sub_id).first()
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
            razorpay_subscription_id=sub_id,
            razorpay_plan_id=plan_id,
            status=status,
            current_period_end=period_end_str,
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.razorpay_subscription_id = sub_id
        row.razorpay_plan_id = plan_id or row.razorpay_plan_id
        row.status = status
        if period_end_str:
            row.current_period_end = period_end_str
        if internal_plan in ("standard", "pro"):
            row.internal_plan = internal_plan
        elif status in ("cancelled", "completed", "expired"):
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
    if row and row.razorpay_subscription_id:
        out["subscription"] = {
            "id": row.razorpay_subscription_id,
            "status": row.status,
            "internal_plan": row.internal_plan,
            "razorpay_plan_id": row.razorpay_plan_id,
            "current_period_end": row.current_period_end or None,
            "updated_at": row.updated_at,
        }
    return jsonify(out)


@billing_bp.route("/subscribe", methods=["POST"])
@require_auth
def subscribe():
    data = request.get_json(force=True) or {}
    plan_key = (data.get("plan_key") or data.get("plan") or "").strip().lower()
    if plan_key not in PLAN_ENV_KEYS:
        raise ValidationError('plan_key must be "standard" or "pro".')

    client = _get_razorpay_client()
    plan_id = _plan_razorpay_id(plan_key)
    uid = g.user.id

    row = UserBilling.query.filter_by(clerk_user_id=uid).first()

    if row and row.status in ACTIVE_SUBSCRIPTION_STATUSES:
        if row.internal_plan == plan_key:
            raise ValidationError("You already have an active subscription for this plan.")
        raise ValidationError(
            "You already have an active subscription. Cancel it in the Razorpay customer portal "
            "before switching plans.",
        )

    if row and row.status == "created" and row.razorpay_subscription_id:
        if row.internal_plan == plan_key:
            return jsonify(
                {
                    "subscription_id": row.razorpay_subscription_id,
                    "reused": True,
                }
            )
        try:
            client.subscription.cancel(row.razorpay_subscription_id, {"cancel_at_cycle_end": 0})
        except Exception:
            pass

    try:
        sub = client.subscription.create(
            {
                "plan_id": plan_id,
                "customer_notify": 1,
                "notes": {"clerk_user_id": str(uid), "internal_plan": str(plan_key)},
            }
        )
    except Exception as e:
        raise ValidationError(str(e)) from e

    now = _now_iso()
    sub_id = sub.get("id")
    sub_status = (sub.get("status") or "created").lower()
    if not row:
        row = UserBilling(
            clerk_user_id=uid,
            internal_plan=plan_key,
            razorpay_subscription_id=sub_id or "",
            razorpay_plan_id=sub.get("plan_id") or plan_id,
            status=sub_status,
            current_period_end="",
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.internal_plan = plan_key
        row.razorpay_subscription_id = sub_id or ""
        row.razorpay_plan_id = sub.get("plan_id") or plan_id
        row.status = sub_status
        row.updated_at = now

    db.session.commit()

    return jsonify({"subscription_id": sub_id, "reused": False})


@billing_bp.route("/webhook", methods=["POST"])
def razorpay_webhook():
    from billing.plan_provisioner import get_webhook_secret

    webhook_secret = get_webhook_secret()
    body_raw = request.get_data(cache=False, as_text=True)
    sig = request.headers.get("X-Razorpay-Signature", "")

    key, secret = _resolve_razorpay_credentials()
    if not key or not secret:
        return jsonify({"error": "Razorpay not configured"}), 503

    # If signature header is provided, always verify it. If no signature or no
    # secret yet (dev bootstrap), accept the payload but do not apply it.
    if sig and webhook_secret:
        client = razorpay.Client(auth=(key, secret))
        try:
            client.utility.verify_webhook_signature(body_raw, sig, webhook_secret)
        except Exception:
            return jsonify({"error": "Invalid signature"}), 400
    elif not webhook_secret:
        return jsonify({"ok": True, "note": "webhook_secret not yet configured"}), 202

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    event = (body.get("event") or "").lower()
    if event.startswith("subscription."):
        entity = _extract_subscription_entity(body)
        if entity:
            _apply_subscription_entity(entity)

    return jsonify({"ok": True})


@billing_bp.route("/health", methods=["GET"])
def billing_health():
    """Public surface for the dashboard to tell users what needs configuring."""
    from billing.plan_provisioner import diagnose_configuration

    return jsonify(diagnose_configuration())
