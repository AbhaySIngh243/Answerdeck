"""Sample-size gates for analysis confidence.

Every metric and LLM-generated narrative in the reporting layer must be guarded by
a minimum amount of underlying evidence. Profound-style products always show the
underlying ``n`` and refuse to render insights when ``n`` is too small. These
helpers are the single source of truth for those thresholds so the API, the
prompt-orchestration layer, and the UI all agree on what counts as
"insufficient", "low", "moderate", or "high" confidence.
"""

from __future__ import annotations

from typing import Any, Iterable

MIN_RESPONSES_FOR_COMPETITOR_TABLE = 6
MIN_RESPONSES_FOR_NARRATIVE = 8
MIN_RESPONSES_FOR_AVG_RANK_PER_BRAND = 3
MIN_QUERIES_FOR_RECURRING_ISSUES = 2

LOW_CONFIDENCE_RESPONSES = 15
HIGH_CONFIDENCE_RESPONSES = 30


def confidence_tier(n_responses: int) -> str:
    """Return one of ``"insufficient" | "low" | "moderate" | "high"``."""
    try:
        n = int(n_responses or 0)
    except (TypeError, ValueError):
        n = 0
    if n < MIN_RESPONSES_FOR_NARRATIVE:
        return "insufficient"
    if n < LOW_CONFIDENCE_RESPONSES:
        return "low"
    if n < HIGH_CONFIDENCE_RESPONSES:
        return "moderate"
    return "high"


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def coverage_meta(
    *,
    n_prompts: int = 0,
    n_engines: int = 0,
    n_responses: int = 0,
    n_queries_with_responses: int | None = None,
) -> dict[str, Any]:
    """Build the ``_coverage`` block surfaced on every reporting payload."""
    prompts = _safe_int(n_prompts)
    engines = _safe_int(n_engines)
    responses = _safe_int(n_responses)
    queries_with_responses = (
        _safe_int(n_queries_with_responses)
        if n_queries_with_responses is not None
        else prompts
    )
    tier = confidence_tier(responses)

    needs = 0
    if tier == "insufficient":
        needs = max(0, MIN_RESPONSES_FOR_NARRATIVE - responses)

    return {
        "n_prompts": prompts,
        "n_engines": engines,
        "n_responses": responses,
        "n_queries_with_responses": queries_with_responses,
        "tier": tier,
        "responses_needed_for_narrative": needs,
        "thresholds": {
            "min_responses_for_competitor_table": MIN_RESPONSES_FOR_COMPETITOR_TABLE,
            "min_responses_for_narrative": MIN_RESPONSES_FOR_NARRATIVE,
            "min_queries_for_recurring_issues": MIN_QUERIES_FOR_RECURRING_ISSUES,
            "min_responses_for_avg_rank_per_brand": MIN_RESPONSES_FOR_AVG_RANK_PER_BRAND,
            "low_confidence_responses": LOW_CONFIDENCE_RESPONSES,
            "high_confidence_responses": HIGH_CONFIDENCE_RESPONSES,
        },
    }


def confidence_from_evidence(
    n_responses_supporting: int,
    n_engines_supporting: int,
) -> float | None:
    """Map raw evidence counts to a 0-1 confidence used by action cards.

    Returns ``None`` when there is zero supporting evidence so the UI can hide
    a "confidence %" badge entirely instead of inventing one. The formula is
    intentionally simple and monotonic; we deliberately cap at 0.95 because no
    real measurement on a small portfolio should claim near-certainty.
    """
    n_responses = _safe_int(n_responses_supporting)
    n_engines = _safe_int(n_engines_supporting)
    if n_responses <= 0:
        return None
    base = 0.4 + 0.06 * n_responses + 0.05 * n_engines
    return round(min(0.95, base), 2)


def normalize_text(text: str) -> str:
    """Lowercase + collapse whitespace so substring checks are robust."""
    return " ".join(str(text or "").lower().split())


def text_similarity(a: str, b: str) -> float:
    """Token-set Jaccard similarity in ``[0.0, 1.0]``.

    Used by sanitizers to detect when an LLM has parroted a tracked prompt
    string back as an "action" or "insight". Stopwords are intentionally NOT
    filtered because we want to catch direct echoes (e.g. "best smart TVs in
    India 2025" would survive any stopword filter anyway).
    """
    tokens_a = set(normalize_text(a).split())
    tokens_b = set(normalize_text(b).split())
    if not tokens_a or not tokens_b:
        return 0.0
    inter = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    if union == 0:
        return 0.0
    return inter / union


def text_echoes_any(candidate: str, references: Iterable[str], threshold: float = 0.8) -> bool:
    """Return True if ``candidate`` is near-identical to any reference string."""
    cand = normalize_text(candidate)
    if not cand:
        return False
    for ref in references:
        ref_norm = normalize_text(ref)
        if not ref_norm:
            continue
        if cand == ref_norm:
            return True
        if cand in ref_norm or ref_norm in cand:
            shorter = min(len(cand), len(ref_norm))
            longer = max(len(cand), len(ref_norm))
            if shorter / longer >= threshold:
                return True
        if text_similarity(candidate, ref) >= threshold:
            return True
    return False
