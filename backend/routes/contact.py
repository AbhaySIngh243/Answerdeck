"""Public contact endpoints (no auth)."""

from __future__ import annotations

import re

from flask import Blueprint, jsonify, request

from exceptions import ValidationError
from services.demo_request_mail import demo_email_ready, send_demo_request_email

contact_bp = Blueprint("contact", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@contact_bp.route("/demo-request", methods=["POST"])
def demo_request():
    data = request.get_json(force=True, silent=True) or {}
    if not isinstance(data, dict):
        raise ValidationError("Invalid JSON body.")

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    company = (data.get("company") or "").strip()
    role = (data.get("role") or "").strip()
    message = (data.get("message") or "").strip()

    if len(name) < 2:
        raise ValidationError("Please enter your full name.")
    if not email or not _EMAIL_RE.match(email):
        raise ValidationError("Please enter a valid work email.")
    if len(company) < 2:
        raise ValidationError("Please enter your company name.")
    if len(message) > 2000:
        raise ValidationError("Message is too long (max 2000 characters).")
    if len(role) > 120:
        raise ValidationError("Role is too long.")

    if not demo_email_ready():
        raise ValidationError(
            "Demo requests are temporarily unavailable. Email hello@answrdeck.com and we will get back to you."
        )

    payload = {
        "name": name,
        "email": email,
        "company": company,
        "role": role,
        "message": message,
    }

    try:
        send_demo_request_email(payload)
    except Exception as exc:
        raise ValidationError(
            "We could not send your request right now. Try again shortly or email hello@answrdeck.com."
        ) from exc

    return jsonify(
        {
            "message": "Thanks — your demo request was sent. We will reply within one business day.",
            "sent_to": "hello@answrdeck.com",
        }
    )
