"""Email alerts when AI visibility moves between analysis runs."""

from __future__ import annotations

import hashlib
import html
import json
import logging
import os
import smtplib
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from typing import Any

import requests

from models import AnalysisJob, Prompt, Project, ReportCache, db
from services.user_email import resolve_user_email

log = logging.getLogger(__name__)


def _alerts_enabled() -> bool:
    raw = (os.getenv("MOVEMENT_ALERTS_ENABLED") or "true").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    return _mail_configured() or _dev_log_allowed()


def _mail_configured() -> bool:
    return bool((os.getenv("RESEND_API_KEY") or "").strip() or (os.getenv("SMTP_HOST") or "").strip())


def _dev_log_allowed() -> bool:
    if (os.getenv("MOVEMENT_ALERTS_DEV_LOG") or "").strip().lower() in ("1", "true", "yes"):
        return True
    return (os.getenv("FLASK_DEBUG") or "").strip().lower() in ("1", "true", "yes")


def _frontend_base() -> str:
    return (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip().rstrip("/")


def _esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def _alert_worthy_events(feed: dict[str, Any]) -> list[dict[str, Any]]:
    if not feed.get("has_history"):
        return []
    events = feed.get("events") if isinstance(feed.get("events"), list) else []
    worthy: list[dict[str, Any]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        severity = str(event.get("severity") or "").lower()
        direction = str(event.get("direction") or "").lower()
        if severity == "high":
            worthy.append(event)
        elif direction == "down" and severity in ("high", "medium"):
            worthy.append(event)
        elif event.get("type") == "new_competitor" and severity == "medium":
            worthy.append(event)
    return worthy[:8]


def _all_active_prompts_analyzed(project_id: int, user_id: str) -> bool:
    active_prompts = Prompt.query.filter_by(
        project_id=project_id, user_id=user_id, is_active=True
    ).count()
    if active_prompts <= 0:
        return False
    completed_jobs = (
        AnalysisJob.query.filter_by(project_id=project_id, user_id=user_id, status="completed")
        .with_entities(AnalysisJob.prompt_id)
        .distinct()
        .count()
    )
    return completed_jobs >= active_prompts


def _alert_fingerprint(feed: dict[str, Any], events: list[dict[str, Any]]) -> str:
    summary = feed.get("summary") if isinstance(feed.get("summary"), dict) else {}
    parts = [
        str(summary.get("last_checked") or ""),
        str(summary.get("previous_check") or ""),
    ]
    for event in events:
        parts.extend(
            [
                str(event.get("type") or ""),
                str(event.get("headline") or ""),
                str(event.get("from") or ""),
                str(event.get("to") or ""),
            ]
        )
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:24]
    return digest


def _alert_already_sent(project_id: int, fingerprint: str) -> bool:
    key = f"movement-alert-sent:{project_id}:{fingerprint}"
    row = ReportCache.query.filter_by(cache_key=key).first()
    if not row or not row.payload_json:
        return False
    if row.expires_at and row.expires_at < datetime.now(timezone.utc).isoformat():
        return False
    return True


def _mark_alert_sent(project_id: int, fingerprint: str) -> None:
    key = f"movement-alert-sent:{project_id}:{fingerprint}"
    try:
        row = ReportCache.query.filter_by(cache_key=key).first()
        if not row:
            row = ReportCache(
                cache_key=key,
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
            db.session.add(row)
        row.payload_json = json.dumps({"sent_at": datetime.now(timezone.utc).isoformat()})
        row.generated_at = datetime.now(timezone.utc).isoformat()
        row.expires_at = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        db.session.commit()
    except Exception:
        db.session.rollback()


def _build_subject(project_name: str, summary: dict[str, Any], events: list[dict[str, Any]]) -> str:
    drops = int(summary.get("drops") or 0)
    gains = int(summary.get("gains") or 0)
    high = sum(1 for e in events if str(e.get("severity") or "").lower() == "high")
    if high and drops:
        return f"⚠ {project_name}: {drops} visibility drop{'s' if drops != 1 else ''} detected"
    if gains and not drops:
        return f"↑ {project_name}: {gains} visibility gain{'s' if gains != 1 else ''}"
    return f"{project_name}: AI visibility update"


def _build_text(project_name: str, feed: dict[str, Any], events: list[dict[str, Any]], dashboard_url: str) -> str:
    summary = feed.get("summary") if isinstance(feed.get("summary"), dict) else {}
    lines = [
        f"AI visibility update for {project_name}",
        "",
        f"Comparing {summary.get('previous_check') or 'previous run'} → {summary.get('last_checked') or 'latest run'}",
        f"Gains: {summary.get('gains', 0)} · Drops: {summary.get('drops', 0)}",
        "",
        "What changed:",
    ]
    for event in events:
        lines.append(f"- {event.get('headline')}")
        if event.get("detail"):
            lines.append(f"  {event.get('detail')}")
    lines.extend(["", f"Open dashboard: {dashboard_url}", "", "— Answrdeck"])
    return "\n".join(lines)


def _event_row(event: dict[str, Any]) -> str:
    direction = str(event.get("direction") or "").lower()
    tone = "#dc2626" if direction == "down" else ("#16a34a" if direction == "up" else "#d97706")
    badge = "Drop" if direction == "down" else ("Gain" if direction == "up" else "Watch")
    from_to = ""
    if event.get("from") or event.get("to"):
        from_to = (
            f"<p style='margin:8px 0 0;font-size:12px;color:#64748b'>"
            f"<span style='background:#f8fafc;padding:2px 6px;border-radius:4px'>{_esc(event.get('from'))}</span>"
            f" → <span style='color:{tone};font-weight:600'>{_esc(event.get('to'))}</span></p>"
        )
    return (
        f"<li style='margin:0 0 12px;padding:12px;background:#f8fafc;border-radius:10px;list-style:none'>"
        f"<div style='display:flex;justify-content:space-between;gap:8px;align-items:flex-start'>"
        f"<strong style='font-size:14px;color:#0f172a'>{_esc(event.get('headline'))}</strong>"
        f"<span style='font-size:10px;font-weight:700;color:{tone};text-transform:uppercase'>{badge}</span>"
        f"</div>"
        f"<p style='margin:6px 0 0;font-size:12px;color:#64748b'>{_esc(event.get('detail'))}</p>"
        f"{from_to}</li>"
    )


def _build_html(
    project_name: str,
    feed: dict[str, Any],
    events: list[dict[str, Any]],
    dashboard_url: str,
) -> str:
    summary = feed.get("summary") if isinstance(feed.get("summary"), dict) else {}
    event_html = "".join(_event_row(event) for event in events)
    return f"""<!DOCTYPE html>
<html><body style="font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px">
  <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Answrdeck alert</p>
  <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25">{_esc(project_name)}</h1>
  <p style="margin:0 0 16px;font-size:14px;color:#64748b">
    { _esc(summary.get('previous_check') or 'Previous run') } → { _esc(summary.get('last_checked') or 'Latest run') }
  </p>
  <div style="display:flex;gap:8px;margin-bottom:20px">
    <span style="background:#ecfdf5;color:#15803d;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:600">↑ {int(summary.get('gains') or 0)} gains</span>
    <span style="background:#fef2f2;color:#dc2626;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:600">↓ {int(summary.get('drops') or 0)} drops</span>
  </div>
  <ul style="margin:0;padding:0">{event_html}</ul>
  <a href="{_esc(dashboard_url)}" style="display:inline-block;margin-top:20px;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600">Open project dashboard</a>
  <p style="margin:24px 0 0;font-size:11px;color:#94a3b8">You receive this when Answrdeck detects meaningful movement across your tracked AI prompts.</p>
</body></html>"""


def _send_via_resend(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_email = (os.getenv("RESEND_FROM_EMAIL") or "Answrdeck <onboarding@resend.dev>").strip()
    response = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        },
        timeout=20,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Resend API error ({response.status_code}): {response.text[:500]}")


def _send_via_smtp(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    host = (os.getenv("SMTP_HOST") or "").strip()
    port = int((os.getenv("SMTP_PORT") or "587").strip())
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASSWORD") or "").strip()
    from_email = (os.getenv("SMTP_FROM_EMAIL") or user or "noreply@answerdeck.com").strip()
    use_tls = (os.getenv("SMTP_USE_TLS") or "true").strip().lower() in ("1", "true", "yes")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=20) as server:
        if use_tls:
            server.starttls()
        if user and password:
            server.login(user, password)
        server.send_message(msg)


def send_movement_alert_email(
    *,
    to_email: str,
    project_name: str,
    project_id: int,
    feed: dict[str, Any],
    events: list[dict[str, Any]],
) -> None:
    dashboard_url = f"{_frontend_base()}/dashboard/project/{project_id}"
    subject = _build_subject(project_name, feed.get("summary") or {}, events)
    text_body = _build_text(project_name, feed, events, dashboard_url)
    html_body = _build_html(project_name, feed, events, dashboard_url)

    if (os.getenv("RESEND_API_KEY") or "").strip():
        _send_via_resend(to_email, subject, text_body, html_body)
        return
    if (os.getenv("SMTP_HOST") or "").strip():
        _send_via_smtp(to_email, subject, text_body, html_body)
        return
    if _dev_log_allowed():
        log.info(
            "Movement alert (dev log, email not sent) to=%s project=%s events=%s",
            to_email,
            project_name,
            [e.get("headline") for e in events],
        )
        return
    raise RuntimeError("Movement alert email is not configured. Set RESEND_API_KEY or SMTP_HOST.")


def maybe_send_movement_alert(project_id: int, user_id: str) -> None:
    """Send a deduplicated alert email when visibility materially changed."""
    if not _alerts_enabled():
        return

    project = Project.query.filter_by(id=project_id, user_id=user_id).first()
    if not project:
        return

    from routes.reports import _build_movement_feed

    feed = _build_movement_feed(project_id)
    events = _alert_worthy_events(feed)
    if not events:
        return

    high_events = [e for e in events if str(e.get("severity") or "").lower() == "high"]
    if not high_events and not _all_active_prompts_analyzed(project_id, user_id):
        return

    fingerprint = _alert_fingerprint(feed, events)
    if _alert_already_sent(project_id, fingerprint):
        return

    to_email = resolve_user_email(user_id)
    if not to_email:
        log.info("Movement alert skipped: no email for user %s", user_id)
        return

    try:
        send_movement_alert_email(
            to_email=to_email,
            project_name=project.name or "Your project",
            project_id=project_id,
            feed=feed,
            events=events,
        )
        _mark_alert_sent(project_id, fingerprint)
        log.info("Movement alert sent to %s for project %s", to_email, project_id)
    except Exception as exc:
        log.warning("Movement alert failed for project %s: %s", project_id, exc)
