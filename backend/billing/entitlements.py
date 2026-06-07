"""Plan limits keyed off Clerk user id and Cashfree PG payment rows."""

from __future__ import annotations

from datetime import datetime, timezone

from models import UserBilling

FREE_MAX_PROJECTS = 1
FREE_MAX_PROMPTS_PER_PROJECT = 3

STANDARD_MAX_PROJECTS = 1
STANDARD_MAX_PROMPTS_PER_PROJECT = 10

PRO_MAX_PROJECTS = 3
PRO_MAX_PROMPTS_PER_PROJECT = 10

# Paid access after successful PG order (stored lowercase).
ACTIVE_SUBSCRIPTION_STATUSES = frozenset({"active", "paid"})
# Cancelled = no renewal, but access until current_period_end.
ACCESS_GRANTING_STATUSES = frozenset({"active", "paid", "cancelled"})


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _period_still_valid(row: UserBilling) -> bool:
    end = _parse_iso(row.current_period_end)
    if not end:
        return True
    now = datetime.now(timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return end > now


def subscription_unlocked(row: UserBilling | None) -> bool:
    """Paid limits apply when a Cashfree order was paid and access period is valid."""
    if not row or row.status not in ACCESS_GRANTING_STATUSES:
        return False
    if not (row.gateway_subscription_id or "").strip():
        return False
    return _period_still_valid(row)


def get_limits(clerk_user_id: str) -> tuple[int, int]:
    row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not subscription_unlocked(row):
        return (FREE_MAX_PROJECTS, FREE_MAX_PROMPTS_PER_PROJECT)
    key = row.internal_plan if row.internal_plan in ("standard", "pro") else None
    if key == "standard":
        return (STANDARD_MAX_PROJECTS, STANDARD_MAX_PROMPTS_PER_PROJECT)
    if key == "pro":
        return (PRO_MAX_PROJECTS, PRO_MAX_PROMPTS_PER_PROJECT)
    return (FREE_MAX_PROJECTS, FREE_MAX_PROMPTS_PER_PROJECT)


def effective_plan(clerk_user_id: str) -> str:
    row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not subscription_unlocked(row):
        return "free"
    key = row.internal_plan if row.internal_plan in ("standard", "pro") else None
    if key in ("standard", "pro"):
        return key
    return "free"


def limits_payload(clerk_user_id: str) -> dict:
    max_p, max_pr = get_limits(clerk_user_id)
    return {
        "max_projects": max_p,
        "max_prompts_per_project": max_pr,
    }
