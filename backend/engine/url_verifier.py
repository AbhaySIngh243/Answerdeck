"""Lightweight URL reachability checks with a DB-backed cache.

We never trust a citation URL blindly — a verified reachability chip in the UI
is one of the biggest "this tool is real" signals. The cache keeps us below
the latency/cost floor even when a single report contains dozens of sources.

Public contract:

    verify_urls(urls: list[str], max_age_hours: int = 72) -> dict[str, dict]

Returns ``{ url: {"http_code": int, "status": "ok"|"broken"|"unknown", "verified_at": iso} }``

All functions are safe to call from worker threads — we use a shared session
but SQLAlchemy ``db.session`` calls happen one-at-a-time through a thread-local
session created by Flask-SQLAlchemy's app context.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Iterable
from urllib.parse import urlparse

import requests

from models import VerifiedUrl, db

log = logging.getLogger(__name__)

_SESSION_LOCK = threading.Lock()
_SESSION: requests.Session | None = None

HEAD_TIMEOUT_SECONDS = 3.0
GET_TIMEOUT_SECONDS = 4.5
USER_AGENT = (
    "Mozilla/5.0 (compatible; AnswerdeckVerifier/1.0; +https://answerdeck.local)"
)


def _session() -> requests.Session:
    global _SESSION
    if _SESSION is not None:
        return _SESSION
    with _SESSION_LOCK:
        if _SESSION is None:
            session = requests.Session()
            session.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})
            adapter = requests.adapters.HTTPAdapter(
                pool_connections=8, pool_maxsize=24, max_retries=0
            )
            session.mount("http://", adapter)
            session.mount("https://", adapter)
            _SESSION = session
    return _SESSION


def _is_public_http_url(url: str) -> bool:
    try:
        parsed = urlparse((url or "").strip())
        if parsed.scheme not in {"http", "https"}:
            return False
        host = (parsed.hostname or "").strip().lower()
        if not host or host in {"localhost"} or host.endswith(".local"):
            return False
        return True
    except Exception:
        return False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_is_fresh(row: VerifiedUrl, max_age_hours: int) -> bool:
    if not row or not row.verified_at:
        return False
    try:
        ts = datetime.fromisoformat(row.verified_at.replace("Z", "+00:00"))
    except Exception:
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - ts <= timedelta(hours=max_age_hours)


def _probe(url: str) -> tuple[int, str]:
    """Return (http_code, status_label)."""
    session = _session()
    code = 0
    try:
        resp = session.head(url, timeout=HEAD_TIMEOUT_SECONDS, allow_redirects=True)
        code = resp.status_code
        if code < 400:
            return code, "ok"
        # Many real pages reject HEAD with 403/405; retry with GET.
        if code in (403, 405, 400):
            resp = session.get(
                url,
                timeout=GET_TIMEOUT_SECONDS,
                allow_redirects=True,
                stream=True,
            )
            code = resp.status_code
            resp.close()
    except Exception:
        try:
            resp = session.get(
                url,
                timeout=GET_TIMEOUT_SECONDS,
                allow_redirects=True,
                stream=True,
            )
            code = resp.status_code
            resp.close()
        except Exception as exc:
            log.debug("url probe failed for %s: %s", url, exc)
            return 0, "broken"

    if code and code < 400:
        return code, "ok"
    return code or 0, "broken"


def verify_urls(
    urls: Iterable[str],
    max_age_hours: int = 72,
    allow_network: bool = True,
) -> dict[str, dict]:
    """Return a dict mapping each normalized URL to its reachability status.

    URLs that fail the public/http check are returned with ``status="broken"``.
    """
    result: dict[str, dict] = {}
    to_probe: list[str] = []
    cleaned_urls: list[str] = []
    seen: set[str] = set()

    for raw in urls or []:
        url = str(raw or "").strip().rstrip(".,;:!?)")
        if not url or url in seen:
            continue
        seen.add(url)
        if not _is_public_http_url(url):
            result[url] = {"http_code": 0, "status": "broken", "verified_at": _now_iso()}
            continue
        cleaned_urls.append(url)

    # Pull cached rows in one shot.
    if cleaned_urls:
        try:
            existing = VerifiedUrl.query.filter(VerifiedUrl.url.in_(cleaned_urls)).all()
        except Exception as exc:
            log.warning("verified_urls query failed: %s", exc)
            existing = []
        by_url = {row.url: row for row in existing}
    else:
        by_url = {}

    for url in cleaned_urls:
        row = by_url.get(url)
        if row and _cache_is_fresh(row, max_age_hours):
            result[url] = {
                "http_code": int(row.http_code or 0),
                "status": row.status or "unknown",
                "verified_at": row.verified_at,
            }
        else:
            to_probe.append(url)

    if not allow_network:
        for url in to_probe:
            row = by_url.get(url)
            result[url] = {
                "http_code": int(row.http_code or 0) if row else 0,
                "status": row.status if row else "unknown",
                "verified_at": row.verified_at if row else "",
            }
        return result

    for url in to_probe:
        code, status = _probe(url)
        now = _now_iso()
        result[url] = {"http_code": code, "status": status, "verified_at": now}
        try:
            row = by_url.get(url) or VerifiedUrl.query.filter_by(url=url).first()
            if row is None:
                db.session.add(
                    VerifiedUrl(
                        url=url, http_code=code, status=status, verified_at=now,
                    )
                )
            else:
                row.http_code = code
                row.status = status
                row.verified_at = now
            db.session.commit()
        except Exception as exc:
            log.warning("persist verified_url failed for %s: %s", url, exc)
            try:
                db.session.rollback()
            except Exception:
                pass

    return result


def drop_broken(urls: Iterable[str]) -> list[str]:
    """Convenience: return only URLs that verified as reachable."""
    statuses = verify_urls(urls)
    keep: list[str] = []
    for url in urls or []:
        value = str(url or "").strip().rstrip(".,;:!?)")
        if not value:
            continue
        info = statuses.get(value)
        if info and info.get("status") == "ok":
            keep.append(value)
    return keep
