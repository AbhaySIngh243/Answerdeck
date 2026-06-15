"""Send demo request notifications to the team inbox."""

from __future__ import annotations

import html
import logging
import os
import smtplib
from email.message import EmailMessage

import requests

log = logging.getLogger(__name__)


def _to_address() -> str:
    return (os.getenv("DEMO_REQUEST_TO_EMAIL") or "hello@answrdeck.com").strip()


def _mail_provider_configured() -> bool:
    return bool((os.getenv("RESEND_API_KEY") or "").strip() or (os.getenv("SMTP_HOST") or "").strip())


def _dev_log_allowed() -> bool:
    if (os.getenv("DEMO_REQUEST_DEV_LOG") or "").strip().lower() in ("1", "true", "yes"):
        return True
    return (os.getenv("FLASK_DEBUG") or "").strip().lower() in ("1", "true", "yes")


def _build_subject(name: str, company: str) -> str:
    return f"Demo request — {name} @ {company}"


def _build_body_text(payload: dict) -> str:
    lines = [
        "New demo request from the Answrdeck landing page",
        "",
        f"Name: {payload.get('name', '')}",
        f"Email: {payload.get('email', '')}",
        f"Company: {payload.get('company', '')}",
    ]
    if payload.get("role"):
        lines.append(f"Role: {payload['role']}")
    if payload.get("message"):
        lines.extend(["", "Message:", str(payload["message"])])
    return "\n".join(lines)


def _esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def _build_body_html(payload: dict) -> str:
    role_row = ""
    if payload.get("role"):
        role_row = (
            f"<tr><td style='padding:8px 0;color:#64748b'>Role</td>"
            f"<td style='padding:8px 0'><strong>{_esc(payload['role'])}</strong></td></tr>"
        )
    message_block = ""
    if payload.get("message"):
        message_block = (
            f"<p style='margin:16px 0 8px;color:#64748b;font-size:13px'>Message</p>"
            f"<p style='margin:0;padding:12px;background:#f8fafc;border-radius:8px;"
            f"white-space:pre-wrap'>{_esc(payload['message'])}</p>"
        )
    email = _esc(payload.get("email"))
    return f"""<!DOCTYPE html>
<html><body style="font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:560px">
  <h2 style="margin:0 0 16px;font-size:18px">New demo request</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:8px 0;color:#64748b;width:120px">Name</td><td style="padding:8px 0"><strong>{_esc(payload.get('name'))}</strong></td></tr>
    <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0"><a href="mailto:{email}">{email}</a></td></tr>
    <tr><td style="padding:8px 0;color:#64748b">Company</td><td style="padding:8px 0"><strong>{_esc(payload.get('company'))}</strong></td></tr>
    {role_row}
  </table>
  {message_block}
</body></html>"""


def _send_via_resend(payload: dict) -> None:
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_email = (os.getenv("RESEND_FROM_EMAIL") or "Answrdeck <onboarding@resend.dev>").strip()
    to_email = _to_address()
    subject = _build_subject(payload["name"], payload["company"])

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": from_email,
            "to": [to_email],
            "reply_to": payload["email"],
            "subject": subject,
            "html": _build_body_html(payload),
            "text": _build_body_text(payload),
        },
        timeout=20,
    )
    if response.status_code >= 400:
        detail = response.text[:500]
        raise RuntimeError(f"Resend API error ({response.status_code}): {detail}")


def _send_via_smtp(payload: dict) -> None:
    host = (os.getenv("SMTP_HOST") or "").strip()
    port = int((os.getenv("SMTP_PORT") or "587").strip())
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASSWORD") or "").strip()
    from_email = (os.getenv("SMTP_FROM_EMAIL") or user or "noreply@answrdeck.com").strip()
    use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in ("1", "true", "yes")

    msg = EmailMessage()
    msg["Subject"] = _build_subject(payload["name"], payload["company"])
    msg["From"] = from_email
    msg["To"] = _to_address()
    msg["Reply-To"] = payload["email"]
    msg.set_content(_build_body_text(payload))
    msg.add_alternative(_build_body_html(payload), subtype="html")

    with smtplib.SMTP(host, port, timeout=20) as server:
        if use_tls:
            server.starttls()
        if user and password:
            server.login(user, password)
        server.send_message(msg)


def send_demo_request_email(payload: dict) -> None:
    """Deliver demo request to the configured inbox. Raises RuntimeError on failure."""
    if (os.getenv("RESEND_API_KEY") or "").strip():
        _send_via_resend(payload)
        return
    if (os.getenv("SMTP_HOST") or "").strip():
        _send_via_smtp(payload)
        return
    if _dev_log_allowed():
        log.info("Demo request (dev log, email not sent): %s", payload)
        return
    raise RuntimeError(
        "Demo request email is not configured. Set RESEND_API_KEY or SMTP_HOST on the server."
    )


def demo_email_ready() -> bool:
    return _mail_provider_configured() or _dev_log_allowed()
