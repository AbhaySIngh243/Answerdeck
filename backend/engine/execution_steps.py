"""LLM-grounded execution cards (title + detail + steps) for prompt recommendations."""

from __future__ import annotations

import json
from typing import Any

from engine.analyzer import _clean_json
from engine.llm_clients import chat_with_fallback


def _normalized_domain_key(domain: str) -> str:
    return (domain or "").strip().lower()


def _engine_block(raw_engine_responses: dict[str, str] | None, limit_eng: int = 800) -> str:
    return "\n".join(
        f"{eng}: {str(text or '')[:limit_eng]}"
        for eng, text in (raw_engine_responses or {}).items()
        if str(text or "").strip()
    )


def _competitor_block(competitor_framings: list[dict] | None, n: int = 5) -> str:
    if not competitor_framings:
        return ""
    return "Other brands/options the engines favored: " + "; ".join(
        f'{cf.get("competitor_brand")} — {str(cf.get("verbatim_sentence") or "")[:100]}'
        for cf in competitor_framings[:n]
    )


_SECTOR_RULES = """Infer what this brand offers ONLY from brand name, user query, project website URL, and engine excerpts.
This tool is brand-agnostic: the brand could be a SaaS product, fashion label, restaurant chain, law firm, travel agency,
non-profit, coaching service, e-commerce store, B2B vendor, or anything else.
Do NOT default to gadgets, electronics, hardware specs, or "spec sheets" unless explicitly grounded in the evidence.
Base every tactic on the inferred sector (e.g. "build trust with review sites like Trustpilot" for services,
"write ingredient/sourcing pages" for food brands, "publish pricing comparison posts" for SaaS)."""


_CARD_SHAPE_RULES = """Return a JSON object with exactly these keys:
- "title": short headline for the card (max 90 characters).
  Must name this specific domain AND reference the brand or query — NOT a generic phrase like "Improve your SEO".
- "detail": one sentence (max 220 characters) that explains precisely why THIS domain matters for THIS brand's AI visibility
  on THIS query. Must contain a concrete claim (e.g. "ChatGPT cited this domain 3x" or "Gemini ranked X #1 via this source").
- "steps": exactly 3 strings, each starting with an imperative verb. Every step must be brand- and domain-specific:

  Step 1: Name the specific AI engine from the excerpts + what it said or ranked for this exact query.
           Example: "Submit a guest post to [domain] answering '[query]' — Perplexity cited it as a primary source for this topic."
  Step 2: Either counter a named competitor's specific angle, OR fill the narrative gap the engines showed.
           Never invent a competitor brand. If thin on competitors, quote the framing the engines used and close the gap.
  Step 3: One concrete, measurable, native action on THIS domain this week (e.g. pitch a specific journalist,
          create a comparison page, earn a category listing, update a forum answer).

HARD RULES — any output violating these is invalid:
- Never write generic steps like "Optimize your content", "Publish intent pages", "Build a content strategy".
- Never use filler adverbs: "robustly", "holistically", "comprehensively", "strategically", "leverage".
- Every step must be specific enough that a person with no background could execute it by tomorrow.
- If you cannot ground a step in the provided evidence, use the engine excerpts to infer what tone/format that domain favors.
"""


def _normalize_card(obj: Any) -> dict[str, Any] | None:
    if not isinstance(obj, dict):
        return None
    title = str(obj.get("title") or "").strip()
    detail = str(obj.get("detail") or "").strip()
    raw_steps = obj.get("steps")
    if not isinstance(raw_steps, list):
        return None
    steps = [str(s).strip() for s in raw_steps[:3] if str(s).strip()]
    if not title or not detail or len(steps) < 3:
        return None
    return {"title": title[:200], "detail": detail[:500], "steps": steps}


def build_execution_card_for_domain(
    *,
    focus_brand: str,
    query: str,
    domain: str,
    raw_engine_responses: dict[str, str],
    competitor_framings: list[dict] | None = None,
    project_website_url: str = "",
) -> dict[str, Any]:
    """One Gemini call: full card for a single surface/domain."""

    engine_summary = _engine_block(raw_engine_responses)
    comp_context = _competitor_block(competitor_framings)
    comp_note = (
        comp_context
        if comp_context
        else "No structured competitor list; use only what the engine excerpts imply."
    )

    prompt = f"""You are a direct, senior AI-search strategist advising "{focus_brand}" ({project_website_url or 'URL unknown'}).
Your job: give the SINGLE most impactful play for this brand on this one domain. Write like you are personally
explaining it to the founder — specific, concrete, no filler.

User query the brand wants to rank for: "{query}"
Domain / surface to optimize for: {domain}

{_SECTOR_RULES}

What the AI engines said (verbatim excerpts):
{engine_summary}

Competitor framing context:
{comp_note}

{_CARD_SHAPE_RULES}
Return ONLY one JSON object for domain "{domain}". No markdown fences. No extra keys."""

    try:
        raw = chat_with_fallback(prompt, temperature=0.4, json_mode=True, engines=["gemini", "chatgpt", "claude"])
        parsed = _clean_json(raw)
    except Exception:
        return {"title": "", "detail": "", "steps": []}

    card = _normalize_card(parsed)
    if card:
        return card

    if isinstance(parsed, str):
        try:
            data = json.loads(parsed)
            card = _normalize_card(data)
            if card:
                return card
        except Exception:
            pass

    return {"title": "", "detail": "", "steps": []}


def build_execution_cards_by_domain(
    *,
    domains: list[str],
    focus_brand: str,
    query: str,
    project_website_url: str = "",
    raw_engine_responses: dict[str, str] | None = None,
    competitor_framings: list[dict] | None = None,
) -> dict[str, dict[str, Any]]:
    """One LLM call: distinct card (title, detail, steps) per domain key."""

    ordered: list[str] = []
    seen: set[str] = set()
    for d in domains or []:
        key = _normalized_domain_key(d)
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append((d or "").strip())

    if not ordered:
        return {}

    engine_summary = _engine_block(raw_engine_responses)
    comp_context = _competitor_block(competitor_framings)
    comp_note = (
        comp_context
        if comp_context
        else "Competitor list may be thin; in step 2 rely on what the excerpts favor when names are missing."
    )

    domain_keys_json = json.dumps(ordered, ensure_ascii=False)
    prompt = f"""You are a direct, senior AI-search strategist advising "{focus_brand}" ({project_website_url or 'URL unknown'}).
Your job: give the single most impactful play for each domain below. Write like you are personally explaining it to the founder.
No filler. No generic advice. Every word must be specific to this brand, this query, and this domain.

User query the brand wants to rank for: "{query}"

{_SECTOR_RULES}

Surfaces to cover — use these strings EXACTLY as JSON keys (same spelling and casing):
{domain_keys_json}

Verbatim AI engine excerpts for this query:
{engine_summary}

Competitor framing context:
{comp_note}

Return ONLY one JSON object. Each key = one domain from the list above. Each value = an object with keys
"title", "detail", "steps" as described below.

{_CARD_SHAPE_RULES}

Additional cross-domain rules:
- Each domain's card must be materially different — no swapping only the domain name.
- Tailor tactics to the surface type: a forum requires different action than a news publisher or marketplace.
- NEVER assume the brand is in tech/electronics unless the evidence says so explicitly.
- Think about what content type the domain publishes (how-to guides, reviews, listicles, Q&A threads) and align the step to that format.

Return ONLY valid JSON. No markdown fences."""

    try:
        raw = chat_with_fallback(prompt, temperature=0.45, json_mode=True, engines=["gemini", "chatgpt", "claude"])
        parsed = _clean_json(raw)
    except Exception:
        return {}

    if not isinstance(parsed, dict):
        return {}

    out: dict[str, dict[str, Any]] = {}
    for k, v in parsed.items():
        dom_key = _normalized_domain_key(str(k))
        if not dom_key:
            continue
        card = _normalize_card(v)
        if card:
            out[dom_key] = card

    return out


def resolve_execution_card_for_domain(
    domain: str,
    cards_by_domain: dict[str, Any],
    *,
    focus_brand: str,
    query: str,
    project_website_url: str,
    raw_engine_responses: dict[str, str] | None,
    competitor_framings: list[dict] | None,
) -> dict[str, Any]:
    """Use batch card when valid; otherwise single-domain LLM. No deterministic templates."""

    key = _normalized_domain_key(domain)
    got: Any = cards_by_domain.get(key) if key else None
    if isinstance(got, dict):
        card = _normalize_card(got)
        if card:
            return card

    return build_execution_card_for_domain(
        focus_brand=focus_brand,
        query=query,
        domain=domain,
        raw_engine_responses=raw_engine_responses or {},
        competitor_framings=competitor_framings,
        project_website_url=project_website_url,
    )


def is_execution_cards_cache_payload(data: Any) -> bool:
    """True if cached value is the v2 dict-of-cards shape (not legacy steps-only lists)."""

    if not isinstance(data, dict) or not data:
        return False
    sample = next(iter(data.values()))
    return isinstance(sample, dict) and isinstance(sample.get("steps"), list)
