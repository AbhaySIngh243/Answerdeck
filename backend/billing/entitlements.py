"""Plan limits keyed off Clerk user id and Razorpay-backed UserBilling rows."""

from __future__ import annotations

import os
from models import UserBilling

FREE_MAX_PROJECTS = 1
FREE_MAX_PROMPTS_PER_PROJECT = 3

STANDARD_MAX_PROJECTS = 1
STANDARD_MAX_PROMPTS_PER_PROJECT = 10

PRO_MAX_PROJECTS = 3
PRO_MAX_PROMPTS_PER_PROJECT = 10

# Subscription states that unlock paid limits (Razorpay naming).
ACTIVE_SUBSCRIPTION_STATUSES = frozenset(
    {
        "active",
        "authenticated",
        "charged",
    }
)


def _plan_id_to_key(plan_id: str | None) -> str | None:
    if not plan_id:
        return None
    std = (os.getenv("RAZORPAY_PLAN_STANDARD_ID") or "").strip()
    pro = (os.getenv("RAZORPAY_PLAN_PRO_ID") or "").strip()
    if std and plan_id == std:
        return "standard"
    if pro and plan_id == pro:
        return "pro"
    return None


def get_limits(clerk_user_id: str) -> tuple[int, int]:
    """Return (max_projects, max_prompts_per_project) for API enforcement."""
    row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not row or row.status not in ACTIVE_SUBSCRIPTION_STATUSES:
        return (FREE_MAX_PROJECTS, FREE_MAX_PROMPTS_PER_PROJECT)
    key = row.internal_plan if row.internal_plan in ("standard", "pro") else None
    if not key:
        key = _plan_id_to_key(row.razorpay_plan_id)
    if key == "standard":
        return (STANDARD_MAX_PROJECTS, STANDARD_MAX_PROMPTS_PER_PROJECT)
    if key == "pro":
        return (PRO_MAX_PROJECTS, PRO_MAX_PROMPTS_PER_PROJECT)
    return (FREE_MAX_PROJECTS, FREE_MAX_PROMPTS_PER_PROJECT)


def effective_plan(clerk_user_id: str) -> str:
    """Public plan label: free | standard | pro."""
    row = UserBilling.query.filter_by(clerk_user_id=clerk_user_id).first()
    if not row or row.status not in ACTIVE_SUBSCRIPTION_STATUSES:
        return "free"
    key = row.internal_plan if row.internal_plan in ("standard", "pro") else None
    if not key:
        key = _plan_id_to_key(row.razorpay_plan_id)
    if key in ("standard", "pro"):
        return key
    return "free"


def limits_payload(clerk_user_id: str) -> dict:
    max_p, max_pr = get_limits(clerk_user_id)
    return {
        "max_projects": max_p,
        "max_prompts_per_project": max_pr,
    }
