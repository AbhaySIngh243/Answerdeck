"""6-layer evidence pipeline for LLM brand visibility (see .cursor/rebuilt.md).

Imported at the end of analyzer.py to avoid circular imports; uses lazy imports
from analyzer for ``analyze_single_response`` and helpers.
"""

from __future__ import annotations

import json
import re
import statistics
import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from engine.llm_clients import chat

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class IntentContext:
    buyer_stage: str
    comparison_axis: str
    implicit_question: str
    region_signal: str
    category_signal: str
    prompt_variants: list[str]


@dataclass
class BrandContext:
    brand_name: str
    competitors: list[str]
    website_url: str
    category: str
    region: str


@dataclass
class DisplacementEvent:
    competitor_brand: str
    displacement_context: str
    displacement_reason: str
    rank_of_competitor: int | None
    rank_of_focus: int | None
    cited_url: str | None


@dataclass
class CausalSignals:
    brand_analysis: dict[str, Any]
    focus_brand_framing: str
    focus_brand_evidence_phrases: list[str]
    focus_brand_cited_urls: list[str]
    competitor_displacement_events: list[DisplacementEvent]
    cited_source_domains: list[str]
    framing_words: list[str]
    response_structure: str
    engine: str
    variant: str


@dataclass
class EvidenceSynthesis:
    engines_mentioning_focus: list[str]
    engines_not_mentioning_focus: list[str]
    consensus_rank: float | None
    rank_variance: float
    top_displacement_competitors: list[dict[str, Any]]
    recurring_displacement_reasons: list[str]
    top_cited_domains: list[dict[str, Any]]
    citation_concentration: float
    focus_brand_dominant_framing: str
    framing_consistency: float
    response_structure_distribution: dict[str, int]
    displacement_events_all: list[DisplacementEvent]
    evidence_phrases_all: list[str]
    engine_contexts: list[dict[str, Any]]


@dataclass
class DriftReport:
    has_previous_run: bool
    rank_delta: float | None
    mention_rate_delta: float | None
    new_displacing_competitors: list[str]
    lost_displacing_competitors: list[str]
    framing_shift: str | None
    velocity: str
    previous_rank: float | None
    current_rank: float | None


GENERIC_PHRASES = (
    "publish intent pages",
    "prioritize citation-heavy",
    "llms generally prefer",
    "create dedicated answer",
    "content strategy",
    "establish a weekly",
    "biweekly refresh",
    "intent coverage",
    "citation-ready content",
    "optimize your content",
    "update stale claims",
)
RANKLORE_DEBUG = os.getenv("RANKLORE_DEBUG", "false").lower() in {"1", "true", "yes"}

def _dbg(hypothesis_id: str, location: str, message: str, data: dict[str, Any] | None = None, run_id: str = "acceptance") -> None:
    if not RANKLORE_DEBUG:
        return
    # region agent log
    try:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        path = os.path.join(root, "debug-ef0486.log")
        payload = {
            "sessionId": "ef0486",
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data or {},
            "timestamp": int(time.time() * 1000),
        }
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass
    # endregion agent log


def _safe_intent_defaults(query: str) -> IntentContext:
    return IntentContext(
        buyer_stage="consideration",
        comparison_axis="overall quality",
        implicit_question=query,
        region_signal="",
        category_signal="",
        prompt_variants=[query, query, query],
    )


def decompose_intent(query: str, brand: str, category: str, region: str) -> IntentContext:
    from engine.analyzer import _clean_json

    prompt = f"""You are an intent classifier for a brand visibility system.

Query: "{query}"
Brand: "{brand}"
Category: "{category}"
Region: "{region}"

Return ONLY valid JSON:
{{
  "buyer_stage": "awareness|consideration|decision",
  "comparison_axis": "one short phrase describing what the buyer is comparing",
  "implicit_question": "the real underlying question in one sentence",
  "region_signal": "detected or given region",
  "category_signal": "the product/service category",
  "prompt_variants": [
    "variant 1: direct — original query unchanged",
    "variant 2: comparative — {brand} vs alternatives for [inferred use case]",
    "variant 3: use-case — best [category] for [inferred need] in [region]"
  ]
}}

Rules:
- buyer_stage is "decision" if query contains: best, top, recommend, which, compare, vs, review
- buyer_stage is "consideration" if query contains: how, features, pros cons, pricing
- buyer_stage is "awareness" otherwise
- Keep prompt_variants[0] identical to the input query
"""

    def _call() -> IntentContext:
        raw = chat("chatgpt", prompt, temperature=0.2)
        data = _clean_json(raw)
        if not isinstance(data, dict):
            raise ValueError("bad shape")
        variants = data.get("prompt_variants")
        if not isinstance(variants, list) or len(variants) < 3:
            raise ValueError("bad variants")
        pv = [str(variants[0]).strip(), str(variants[1]).strip(), str(variants[2]).strip()]
        if pv[0] != query:
            pv[0] = query
        return IntentContext(
            buyer_stage=str(data.get("buyer_stage") or "consideration").strip(),
            comparison_axis=str(data.get("comparison_axis") or "overall quality").strip(),
            implicit_question=str(data.get("implicit_question") or query).strip(),
            region_signal=str(data.get("region_signal") or region).strip(),
            category_signal=str(data.get("category_signal") or category).strip(),
            prompt_variants=pv,
        )

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            fut = pool.submit(_call)
            return fut.result(timeout=4.0)
    except (FuturesTimeout, Exception):
        return _safe_intent_defaults(query)


def _domain_from_url(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").replace("www.", "").strip().lower()
    except Exception:
        return ""


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", str(text or "").strip())
    return [p.strip() for p in parts if p.strip()]


def _detect_response_structure(response_text: str, brand_analysis: dict[str, Any]) -> str:
    if re.search(r"(?m)^\d+[.)]\s", response_text or ""):
        return "ranked_list"
    if (response_text or "").count("|") >= 3 or " vs " in (response_text or "").lower():
        return "comparison_table"
    details = brand_analysis.get("all_brand_details") or []
    if isinstance(details, list) and len(details) == 1:
        return "single_recommendation"
    return "prose"


def _framing_words_for_aliases(response_text: str, aliases: list[str]) -> list[str]:
    found: set[str] = set()
    text = response_text or ""
    for alias in aliases:
        if not alias or len(alias.strip()) < 2:
            continue
        esc = re.escape(alias.strip())
        for m in re.finditer(rf"(\w+\s+\w+)\s+{esc}", text, flags=re.IGNORECASE):
            found.add(m.group(1).strip().lower())
    return sorted(found)


def _evidence_phrases(response_text: str, aliases: list[str], limit: int = 3) -> list[str]:
    out: list[str] = []
    for sentence in _split_sentences(response_text):
        low = sentence.lower()
        if any(a.strip().lower() in low for a in aliases if a):
            clipped = sentence.strip()
            if len(clipped) > 100:
                clipped = clipped[:97] + "..."
            out.append(clipped)
        if len(out) >= limit:
            break
    return out


def _competitor_rank_one(details: list[dict[str, Any]], competitor_brands: list[str]) -> bool:
    comp_l = {c.lower() for c in competitor_brands if c}
    for d in details:
        if not isinstance(d, dict):
            continue
        b = str(d.get("brand") or "").strip().lower()
        r = d.get("rank")
        if b in comp_l and isinstance(r, int) and r == 1:
            return True
    return False


def _validate_displacement_event(event: dict[str, Any], response_text: str) -> bool:
    context = str(event.get("displacement_context") or "").strip()
    brand = str(event.get("competitor_brand") or "").strip()
    reason = str(event.get("displacement_reason") or "").strip()
    if not context or not brand or not reason:
        return False
    if len(context) < 15 or len(context) > 400:
        return False
    context_words = set(context.lower().split())
    response_words = set(response_text.lower().split())
    overlap = len(context_words & response_words)
    if overlap < min(5, len(context_words) * 0.6):
        return False
    return True


def _parse_displacement_events(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    return []


def extract_causal_signals(
    response_text: str,
    focus_brand: str,
    focus_brand_aliases: list[str],
    competitor_brands: list[str],
    query: str,
    engine_name: str,
    variant: str = "direct",
) -> CausalSignals:
    from engine.analyzer import analyze_single_response, _extract_sources

    brand_analysis = analyze_single_response(
        response_text=response_text,
        focus_brand=focus_brand,
        query=query,
        competitor_brands=competitor_brands,
        focus_brand_aliases=focus_brand_aliases,
    )
    structure = _detect_response_structure(response_text, brand_analysis)
    framing_words = _framing_words_for_aliases(response_text, focus_brand_aliases or [focus_brand])
    neg = {"avoid", "however", "but", "although", "despite", "unfortunately", "caution", "warning"}

    mentioned = bool(brand_analysis.get("focus_brand_mentioned"))
    rank = brand_analysis.get("focus_brand_rank")
    details = brand_analysis.get("all_brand_details") or []

    focus_framing = "mentioned"
    if not mentioned:
        focus_framing = "absent"
    elif isinstance(rank, int):
        if rank > 3 and _competitor_rank_one(details if isinstance(details, list) else [], competitor_brands):
            focus_framing = "displaced"
        elif rank <= 2:
            focus_framing = "recommended"
        elif any(w in neg for w in framing_words):
            focus_framing = "cautioned"
        else:
            focus_framing = "mentioned"
    elif any(w in neg for w in framing_words):
        focus_framing = "cautioned"

    evidence_phrases = _evidence_phrases(response_text, focus_brand_aliases or [focus_brand])
    sources = _extract_sources(response_text)
    cited_urls = list(sources)
    domains: list[str] = []
    for url in sources:
        d = _domain_from_url(url)
        if d:
            domains.append(d)
    domains = list(dict.fromkeys(domains))

    # Always enrich citation domains using web search, not just from LLM response URLs
    if not domains:
        try:
            from engine.analyzer import research_prompt_sources
            web_data = research_prompt_sources(query)
            for source in (web_data.get("sources") or [])[:8]:
                d = source.get("domain", "").strip()
                if d and d not in domains:
                    domains.append(d)
        except Exception:
            pass

    events: list[DisplacementEvent] = []
    run_displacement_llm = (
        focus_framing in {"absent", "displaced", "cautioned"}
        and len(response_text or "") > 200
        and not (isinstance(rank, int) and rank == 1)
    )
    if run_displacement_llm:
        from engine.analyzer import _clean_json

        dprompt = f"""Given this AI response to the query "{query}", extract instances where a competitor was preferred over "{focus_brand}".

AI Response:
{response_text[:3000]}

Known competitors: {json.dumps(competitor_brands[:10])}

Return ONLY valid JSON list:
[{{"competitor_brand": "name", "displacement_context": "exact sentence(s) <150 chars", "displacement_reason": "stated reason <100 chars", "rank_of_competitor": null or int, "rank_of_focus": null or int, "cited_url": null or "url"}}]

RULES:
- Only include clear preference signals for competitor over focus brand
- displacement_reason MUST quote or closely paraphrase the response — do not invent
- Return [] if none found
- Max 5 events
"""
        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                fut = pool.submit(lambda: chat("chatgpt", dprompt, temperature=0.15))
                raw = fut.result(timeout=5.0)
            parsed = _clean_json(raw)
            for row in _parse_displacement_events(parsed)[:5]:
                if not _validate_displacement_event(row, response_text):
                    continue
                events.append(
                    DisplacementEvent(
                        competitor_brand=str(row.get("competitor_brand") or "").strip(),
                        displacement_context=str(row.get("displacement_context") or "").strip()[:150],
                        displacement_reason=str(row.get("displacement_reason") or "").strip()[:100],
                        rank_of_competitor=row.get("rank_of_competitor") if isinstance(row.get("rank_of_competitor"), int) else None,
                        rank_of_focus=row.get("rank_of_focus") if isinstance(row.get("rank_of_focus"), int) else None,
                        cited_url=(str(row.get("cited_url")).strip() if row.get("cited_url") else None),
                    )
                )
        except Exception:
            events = []

    return CausalSignals(
        brand_analysis=brand_analysis,
        focus_brand_framing=focus_framing,
        focus_brand_evidence_phrases=evidence_phrases,
        focus_brand_cited_urls=cited_urls,
        competitor_displacement_events=events,
        cited_source_domains=domains,
        framing_words=framing_words,
        response_structure=structure,
        engine=engine_name,
        variant=variant,
    )


def _make_fallback_causal_signals(
    response_text: str,
    focus_brand: str,
    focus_brand_aliases: list[str],
    competitor_brands: list[str],
    query: str,
    engine_name: str,
) -> CausalSignals:
    from engine.analyzer import analyze_single_response, _extract_sources

    brand_analysis = analyze_single_response(
        response_text=response_text,
        focus_brand=focus_brand,
        query=query,
        competitor_brands=competitor_brands,
        focus_brand_aliases=focus_brand_aliases,
    )
    structure = _detect_response_structure(response_text, brand_analysis)
    return CausalSignals(
        brand_analysis=brand_analysis,
        focus_brand_framing="mentioned" if brand_analysis.get("focus_brand_mentioned") else "absent",
        focus_brand_evidence_phrases=_evidence_phrases(response_text, focus_brand_aliases or [focus_brand]),
        focus_brand_cited_urls=list(_extract_sources(response_text)),
        competitor_displacement_events=[],
        cited_source_domains=[],
        framing_words=[],
        response_structure=structure,
        engine=engine_name,
        variant="direct",
    )


def synthesize_evidence(
    causal_signals_by_engine: dict[str, CausalSignals],
    focus_brand: str,
    query: str,
    research_data: dict[str, Any],
) -> EvidenceSynthesis:
    _ = focus_brand, query, research_data
    mentioning: list[str] = []
    not_mentioning: list[str] = []
    ranks: list[int] = []
    framings: list[str] = []
    struct_dist: dict[str, int] = {}
    displacement_events_all: list[DisplacementEvent] = []
    evidence_all: list[str] = []
    engine_contexts: list[dict[str, Any]] = []

    for eng, sig in causal_signals_by_engine.items():
        ba = sig.brand_analysis
        m = bool(ba.get("focus_brand_mentioned"))
        if m:
            mentioning.append(eng)
            r = ba.get("focus_brand_rank")
            if isinstance(r, int):
                ranks.append(r)
        else:
            not_mentioning.append(eng)
        framings.append(sig.focus_brand_framing)
        struct_dist[sig.response_structure] = struct_dist.get(sig.response_structure, 0) + 1
        displacement_events_all.extend(sig.competitor_displacement_events)
        for p in sig.focus_brand_evidence_phrases:
            if p and p not in evidence_all:
                evidence_all.append(p)
        engine_contexts.append(
            {
                "engine": eng,
                "mentioned": m,
                "rank": ba.get("focus_brand_rank"),
                "sentiment": ba.get("focus_brand_sentiment", "not_mentioned"),
                "context": str(ba.get("focus_brand_context") or ""),
                "dominant_framing": sig.focus_brand_framing,
                "displacement_count": len(sig.competitor_displacement_events),
            }
        )

    consensus = round(statistics.mean(ranks), 2) if ranks else None
    rank_var = float(statistics.pstdev(ranks)) if len(ranks) >= 2 else 0.0

    by_comp: dict[str, list[DisplacementEvent]] = {}
    for ev in displacement_events_all:
        by_comp.setdefault(ev.competitor_brand, []).append(ev)
    top_disp: list[dict[str, Any]] = []
    for brand, evs in sorted(by_comp.items(), key=lambda kv: len(kv[1]), reverse=True)[:5]:
        top_disp.append(
            {
                "brand": brand,
                "count": len(evs),
                "reasons": [e.displacement_reason for e in evs],
                "urls": [e.cited_url for e in evs if e.cited_url],
            }
        )

    reasons = [e.displacement_reason for e in displacement_events_all if e.displacement_reason]
    recurring: list[str] = []
    seen_pairs: set[tuple[str, str]] = set()
    for i, a in enumerate(reasons):
        for b in reasons[i + 1 :]:
            aw, bw = set(a.lower().split()), set(b.lower().split())
            if len(aw & bw) >= 4:
                key = tuple(sorted((a, b)))
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    recurring.append(a if len(a) <= len(b) else b)
    recurring = list(dict.fromkeys(recurring))[:5]

    domain_counts: dict[str, int] = {}
    domain_focus_hit: dict[str, bool] = {}
    domain_comp_hit: dict[str, bool] = {}
    for eng, sig in causal_signals_by_engine.items():
        for d in sig.cited_source_domains:
            domain_counts[d] = domain_counts.get(d, 0) + 1
        for url in sig.focus_brand_cited_urls:
            dom = _domain_from_url(url)
            if dom:
                domain_focus_hit[dom] = True
        for ev in sig.competitor_displacement_events:
            if ev.cited_url:
                dom = _domain_from_url(ev.cited_url)
                if dom:
                    domain_comp_hit[dom] = True

    top_domains: list[dict[str, Any]] = []
    for dom, cnt in sorted(domain_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]:
        top_domains.append(
            {
                "domain": dom,
                "count": cnt,
                "mentions_focus": bool(domain_focus_hit.get(dom)),
                "mentions_competitor": bool(domain_comp_hit.get(dom)),
            }
        )

    total_cites = sum(domain_counts.values())
    citation_concentration = 0.0
    if total_cites > 0 and top_domains:
        sorted_vals = sorted(domain_counts.values(), reverse=True)
        r1 = sorted_vals[0] / total_cites
        if r1 > 0.6:
            citation_concentration = round(r1, 2)
        elif len(sorted_vals) >= 2:
            citation_concentration = round(sorted_vals[1] / total_cites, 2)

    dominant_framing = "mentioned"
    if framings:
        dominant_framing = max(set(framings), key=framings.count)
    framing_consistency = (
        framings.count(dominant_framing) / len(framings) if framings else 1.0
    )

    return EvidenceSynthesis(
        engines_mentioning_focus=mentioning,
        engines_not_mentioning_focus=not_mentioning,
        consensus_rank=consensus,
        rank_variance=rank_var,
        top_displacement_competitors=top_disp,
        recurring_displacement_reasons=recurring,
        top_cited_domains=top_domains,
        citation_concentration=citation_concentration,
        focus_brand_dominant_framing=dominant_framing,
        framing_consistency=round(framing_consistency, 3),
        response_structure_distribution=struct_dist,
        displacement_events_all=displacement_events_all,
        evidence_phrases_all=evidence_all,
        engine_contexts=engine_contexts,
    )


def _validate_audit_item(
    item: dict[str, Any],
    known_competitors: list[str],
    known_engines: list[str],
    known_domains: list[str],
) -> bool:
    evidence = str(item.get("evidence") or "").strip()
    root_cause = str(item.get("root_cause") or "").strip()
    fix_steps = item.get("fix_steps") or []
    issue = str(item.get("issue") or "").strip()
    if not evidence or not root_cause or len(fix_steps) < 1 or not issue:
        return False
    if len(evidence) < 12:
        return False
    # Only enforce entity grounding when we actually have entities to check against
    all_entities = [e.lower() for e in (known_competitors + known_engines + known_domains) if e]
    if len(all_entities) >= 3:
        full_text = " ".join([evidence, root_cause, " ".join(str(s) for s in fix_steps), issue]).lower()
        if not any(entity in full_text for entity in all_entities):
            return False
    # Only block the most obviously hard-coded phrases
    HARD_BLOCKED = (
        "llms generally prefer",
        "publish intent pages",
        "create dedicated answer pages",
    )
    full_text_check = " ".join([evidence, root_cause, " ".join(str(s) for s in fix_steps), issue]).lower()
    if any(phrase in full_text_check for phrase in HARD_BLOCKED):
        return False
    if len(issue) > 120:
        return False
    return True


def _format_displacement_events_for_prompt(events: list[DisplacementEvent], max_events: int = 5) -> str:
    lines: list[str] = []
    for i, e in enumerate(events[:max_events], 1):
        url_part = f" (cited: {e.cited_url})" if e.cited_url else ""
        lines.append(
            f'{i}. {e.competitor_brand} preferred (rank {e.rank_of_competitor}) over focus brand '
            f'(rank {e.rank_of_focus}): "{e.displacement_context}". Reason: {e.displacement_reason}{url_part}'
        )
    return "\n".join(lines) if lines else "None detected."


def _format_engine_contexts_for_prompt(contexts: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for c in contexts:
        ctx = str(c.get("context") or "")
        lines.append(
            f'  {str(c.get("engine", "")).upper()}: mentioned={c.get("mentioned")}, rank={c.get("rank")}, '
            f'framing="{c.get("dominant_framing")}", context="{ctx[:120]}"'
        )
    return "\n".join(lines)


def _format_cited_domains_for_prompt(domains: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for d in domains[:8]:
        lines.append(
            f'  {d["domain"]} (cited {d["count"]}x, mentions_focus={d["mentions_focus"]}, '
            f'mentions_competitor={d["mentions_competitor"]})'
        )
    return "\n".join(lines) if lines else "None detected."


def _format_recurring_reasons(reasons: list[str]) -> str:
    if not reasons:
        return "None detected."
    return "\n".join(f"  - {r}" for r in reasons[:8])


def generate_detailed_audit_evidence(
    focus_brand: str,
    query: str,
    synthesis: EvidenceSynthesis,
    *,
    known_competitors: list[str],
    known_engines: list[str],
    known_domains: list[str],
) -> list[dict[str, Any]]:
    from engine.analyzer import _clean_json, _clip_text, _sanitize_audit_contract

    engine_count = max(
        1,
        len(synthesis.engines_mentioning_focus) + len(synthesis.engines_not_mentioning_focus),
    )
    mention_count = len(synthesis.engines_mentioning_focus)
    displacement_events_formatted = _format_displacement_events_for_prompt(synthesis.displacement_events_all)
    recurring_reasons_formatted = _format_recurring_reasons(synthesis.recurring_displacement_reasons)
    cited_domains_formatted = _format_cited_domains_for_prompt(synthesis.top_cited_domains)
    engine_contexts_formatted = _format_engine_contexts_for_prompt(synthesis.engine_contexts)

    prompt = f"""You are a Strategic AI Visibility Auditor with access to real measurement data.

Brand: "{focus_brand}"
Query: "{query}"

REAL MEASURED EVIDENCE (from {engine_count} AI engines):
Mention coverage: {mention_count}/{engine_count} engines mentioned the brand
Consensus rank: {synthesis.consensus_rank} (average position when mentioned, lower=better)
Rank variance: {synthesis.rank_variance} (>1.5 means unstable/inconsistent positioning)
Dominant framing: "{synthesis.focus_brand_dominant_framing}"

DISPLACEMENT EVENTS (specific times a competitor was preferred over {focus_brand}):
{displacement_events_formatted}

RECURRING REASONS {focus_brand} LOSES TO COMPETITORS:
{recurring_reasons_formatted}

CITATION LANDSCAPE (what LLMs are reading to form opinions):
{cited_domains_formatted}

VERBATIM ENGINE RESPONSES:
{engine_contexts_formatted}

Generate 3-5 audit items. Each MUST be grounded in the specific evidence above.

Return ONLY valid JSON list:
[{{
  "issue": "Short specific headline — max 12 words, names the actual problem",
  "root_cause": "1-2 sentences. Must name a specific engine, competitor, domain, or displacement reason from the evidence. Never write 'LLMs generally...'",
  "evidence": "COPY the exact displacement_context sentence OR engine context quote that proves this issue. This must be verbatim from the evidence above — not paraphrased.",
  "fix_steps": [
    "Step naming specific competitor or domain from evidence",
    "Actionable this week with concrete deliverable",
    "Measurable outcome in 2-4 weeks"
  ],
  "expected_impact": "Which metric improves (rank, mention rate, framing) and estimated delta",
  "priority": "high|medium|low",
  "source_type": "measured",
  "confidence": 0.7-0.95
}}]

STRICT RULES — ENFORCED BY VALIDATOR:
1. "evidence" must be a verbatim or near-verbatim quote from displacement_context or engine context above. Paraphrasing disqualifies the item.
2. "root_cause" must contain at least one proper noun from the evidence (competitor name, engine name, domain name).
3. "fix_steps[0]" must reference the specific competitor, domain, or framing pattern from evidence. "optimize your content" alone will be rejected.
4. Priority "high" = affects 2+ engines OR blocks rank 1 slot. "low" = single engine issue.
5. Do not generate items not supported by evidence. 3 real items beats 5 generic ones.
6. Do NOT include these exact phrases anywhere: "Publish intent pages", "Prioritize citation-heavy domains", "LLMs generally prefer", "Create dedicated answer pages", "content strategy".
"""

    def _parse_and_filter(raw: str) -> list[dict[str, Any]]:
        parsed = _clean_json(raw)
        if not isinstance(parsed, list):
            return []
        cleaned: list[dict[str, Any]] = []
        for row in parsed:
            if not isinstance(row, dict):
                continue
            if not _validate_audit_item(row, known_competitors, known_engines, known_domains):
                continue
            item = {
                "issue": _clip_text(row.get("issue"), 80),
                "root_cause": _clip_text(row.get("root_cause"), 420),
                "evidence": _clip_text(row.get("evidence"), 400),
                "fix_steps": row.get("fix_steps") or [],
                "expected_impact": _clip_text(row.get("expected_impact"), 180),
                "priority": str(row.get("priority") or "medium").lower(),
                "source_type": "measured",
                "confidence": float(row.get("confidence") or 0.8),
                "title": _clip_text(row.get("issue"), 110),
                "solution": " ".join(str(x) for x in (row.get("fix_steps") or [])[:2]),
                "detail": _clip_text(row.get("root_cause"), 320),
                "avoid": _clip_text(row.get("avoid"), 180),
            }
            cleaned.append(item)
        return cleaned

    for attempt in range(2):
        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                fut = pool.submit(
                    lambda: chat("chatgpt", prompt, temperature=0.25 if attempt == 0 else 0.15)
                )
                raw = fut.result(timeout=8.0)
            cleaned = _parse_and_filter(raw)
            _dbg("H6", "engine/brain_pipeline.py:generate_detailed_audit_evidence", "audit_parse", {"attempt": attempt, "kept": len(cleaned)})
            if len(cleaned) >= 2:
                return cleaned[:5]
        except Exception:
            pass

    fallback = _build_evidence_grounded_fallback(
        synthesis,
        focus_brand,
        query,
        known_competitors=known_competitors,
        known_engines=known_engines,
        known_domains=known_domains,
    )
    if not fallback:
        return []
    cleaned = _sanitize_audit_contract(fallback, focus_brand, query, default_priority="medium")
    return cleaned if cleaned else fallback[:5]


def _build_evidence_grounded_fallback(
    synthesis: EvidenceSynthesis,
    focus_brand: str,
    query: str,
    *,
    known_competitors: list[str],
    known_engines: list[str],
    known_domains: list[str],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    eng_total = max(
        1,
        len(synthesis.engines_mentioning_focus) + len(synthesis.engines_not_mentioning_focus),
    )
    if synthesis.engines_not_mentioning_focus:
        eng_name = synthesis.engines_not_mentioning_focus[0]
        ctx = next(
            (c for c in synthesis.engine_contexts if c.get("engine") == eng_name),
            {},
        )
        quote = str(ctx.get("context") or f"No mention of {focus_brand} in {eng_name} output.")[:220]
        items.append(
            {
                "issue": f"{focus_brand} invisible on {eng_name} for this query",
                "root_cause": f"{eng_name} did not surface {focus_brand} while answering '{query[:60]}'.",
                "evidence": quote,
                "fix_steps": [
                    f"Create a page that answers '{query[:80]}' with {focus_brand} named in the first sentence — target {eng_name} retrieval.",
                    f"Add a comparison table: {focus_brand} vs top alternatives, with specs, pricing, and a verdict row.",
                    f"Submit the updated URL for indexing and re-run this exact prompt in 14 days to measure mention rate change.",
                ],
                "expected_impact": "Mention rate should rise on the affected engine.",
                "priority": "high" if len(synthesis.engines_not_mentioning_focus) >= 2 else "medium",
                "source_type": "measured",
                "confidence": 0.78,
            }
        )

    if synthesis.top_displacement_competitors:
        top = synthesis.top_displacement_competitors[0]
        brand = str(top.get("brand") or "competitor")
        ev = next((e for e in synthesis.displacement_events_all if e.competitor_brand == brand), None)
        ev_text = ev.displacement_context if ev else str(top.get("reasons") or [""])[0]
        items.append(
            {
                "issue": f"{brand} wins positioning vs {focus_brand}",
                "root_cause": f"Displacement signals show {brand} preferred in measured responses for '{query[:50]}'.",
                "evidence": ev_text[:400],
                "fix_steps": [
                    f"Write a direct comparison: '{focus_brand} vs {brand} for {query[:60]}' — use the exact wording engines use when they prefer {brand}.",
                    f"Add primary-source proof: link to {focus_brand} documentation, pricing page, or case study that counters the stated displacement reason.",
                    f"Re-run this prompt after publishing and measure whether {brand} still outranks {focus_brand}.",
                ],
                "expected_impact": f"Improved rank and framing vs {brand}.",
                "priority": "high",
                "source_type": "measured",
                "confidence": 0.8,
            }
        )

    if synthesis.top_cited_domains:
        d0 = synthesis.top_cited_domains[0]["domain"]
        items.append(
            {
                "issue": f"Citations concentrate on {d0}",
                "root_cause": f"{d0} shapes how models answer '{query[:40]}' for {focus_brand}.",
                "evidence": f"Domain {d0} cited {synthesis.top_cited_domains[0].get('count', 0)} times in engine outputs.",
                "fix_steps": [
                    f"Search {d0} for existing pages about '{query[:60]}' — if {focus_brand} is missing or outdated, contact the author or submit a correction.",
                    f"Publish a {focus_brand} page that answers '{query[:80]}' verbatim, structured so {d0} can reference it as a primary source.",
                    f"Track whether {d0} starts citing {focus_brand} in the next 3 weeks by re-running this analysis.",
                ],
                "expected_impact": "Citation diversity and trust signals improve.",
                "priority": "medium",
                "source_type": "measured",
                "confidence": 0.72,
            }
        )

    if not items:
        items.append(
            {
                "issue": f"Mixed signals for '{query[:50]}'",
                "root_cause": f"Engines {', '.join(known_engines[:3])} show inconsistent visibility for {focus_brand}.",
                "evidence": " ".join(synthesis.evidence_phrases_all[:2]) or synthesis.focus_brand_dominant_framing,
                "fix_steps": [
                    f"Align messaging with dominant framing '{synthesis.focus_brand_dominant_framing}'",
                    "Add structured proof for each competing claim",
                    "Re-test prompt weekly",
                ],
                "expected_impact": "Lower rank variance across engines.",
                "priority": "medium",
                "source_type": "measured",
                "confidence": 0.7,
            }
        )

    validated: list[dict[str, Any]] = []
    for it in items:
        if _validate_audit_item(it, known_competitors, known_engines, known_domains):
            validated.append(it)
    return validated[:5]


def synthesis_from_legacy_analyses(analyses: dict[str, Any]) -> EvidenceSynthesis:
    """Build a minimal EvidenceSynthesis from slim per-engine dicts (reports route)."""
    causal: dict[str, CausalSignals] = {}
    for engine, data in analyses.items():
        if engine == "research_data" or not isinstance(data, dict):
            continue
        mentioned = bool(data.get("focus_brand_mentioned"))
        ba = {
            "focus_brand_mentioned": mentioned,
            "focus_brand_rank": data.get("focus_brand_rank"),
            "focus_brand_sentiment": data.get("focus_brand_sentiment", "not_mentioned"),
            "focus_brand_context": data.get("focus_brand_context", ""),
            "all_brand_details": [],
            "sources": [],
        }
        sig = CausalSignals(
            brand_analysis=ba,
            focus_brand_framing="mentioned" if mentioned else "absent",
            focus_brand_evidence_phrases=[],
            focus_brand_cited_urls=[],
            competitor_displacement_events=[],
            cited_source_domains=[],
            framing_words=[],
            response_structure="prose",
            engine=engine,
            variant="direct",
        )
        causal[engine] = sig
    return synthesize_evidence(causal, "", "", {})


def detect_drift(
    project_id: int,
    prompt_id: int,
    current_synthesis: EvidenceSynthesis,
    db_session: Any,
) -> DriftReport:
    from models import DisplacementRecord, Response

    _ = project_id
    curr_mention_rate = 0.0
    total_eng = len(current_synthesis.engines_mentioning_focus) + len(
        current_synthesis.engines_not_mentioning_focus
    )
    if total_eng > 0:
        curr_mention_rate = len(current_synthesis.engines_mentioning_focus) / total_eng
    current_rank = current_synthesis.consensus_rank
    _dbg("H5", "engine/brain_pipeline.py:detect_drift", "start", {"prompt_id": prompt_id, "current_rank": current_rank, "current_mention_rate": curr_mention_rate})

    prev_disp = (
        db_session.query(DisplacementRecord)
        .filter(DisplacementRecord.prompt_id == prompt_id)
        .order_by(DisplacementRecord.timestamp.desc())
        .all()
    )
    prev_competitors: set[str] = set()
    if prev_disp:
        latest_ts = prev_disp[0].timestamp
        prev_competitors = {r.competitor_brand for r in prev_disp if r.timestamp == latest_ts}
        if not prev_competitors:
            prev_competitors = {r.competitor_brand for r in prev_disp}
    else:
        _dbg("H5", "engine/brain_pipeline.py:detect_drift", "no_prev_disp", {})

    curr_competitors = {e.competitor_brand for e in current_synthesis.displacement_events_all}
    for row in current_synthesis.top_displacement_competitors:
        b = row.get("brand")
        if b:
            curr_competitors.add(str(b))

    new_disp = sorted(curr_competitors - prev_competitors)
    lost_disp = sorted(prev_competitors - curr_competitors)

    res_rows = (
        db_session.query(Response)
        .filter(Response.prompt_id == prompt_id)
        .order_by(Response.timestamp.desc())
        .all()
    )
    res_rows = [r for r in res_rows if not str(r.engine or "").endswith("_research")]
    if not res_rows:
        _dbg("H5", "engine/brain_pipeline.py:detect_drift", "no_prev_responses", {})
        return DriftReport(
            has_previous_run=bool(prev_disp),
            rank_delta=None,
            mention_rate_delta=None,
            new_displacing_competitors=new_disp,
            lost_displacing_competitors=lost_disp,
            framing_shift=None,
            velocity="first_run",
            previous_rank=None,
            current_rank=current_rank,
        )

    prev_ts = res_rows[0].timestamp
    prev_batch = [r for r in res_rows if r.timestamp == prev_ts]
    if not prev_batch:
        prev_batch = res_rows[: max(1, min(len(res_rows), 8))]

    prev_ranks: list[int] = []
    prev_mentioned_engines = 0
    for resp in prev_batch:
        has_focus = False
        for m in resp.mentions:
            if m.is_focus and isinstance(m.rank, int):
                prev_ranks.append(m.rank)
                has_focus = True
            elif m.is_focus:
                has_focus = True
        if has_focus:
            prev_mentioned_engines += 1

    prev_total = len(prev_batch)
    prev_mention_rate = (prev_mentioned_engines / prev_total) if prev_total else 0.0
    previous_rank = round(statistics.mean(prev_ranks), 2) if prev_ranks else None
    _dbg("H5", "engine/brain_pipeline.py:detect_drift", "prev", {"previous_rank": previous_rank, "prev_mention_rate": prev_mention_rate, "prev_total": prev_total})

    rank_delta: float | None = None
    if previous_rank is not None and current_rank is not None:
        rank_delta = float(previous_rank - current_rank)
    elif previous_rank is None and current_rank is not None:
        rank_delta = 3.0
    elif previous_rank is not None and current_rank is None:
        rank_delta = -3.0

    mention_rate_delta = round(curr_mention_rate - prev_mention_rate, 4)

    velocity = "stable"
    if rank_delta is not None:
        if rank_delta > 0.5:
            velocity = "improving"
        elif rank_delta < -0.5:
            velocity = "declining"
        else:
            velocity = "stable"

    return DriftReport(
        has_previous_run=True,
        rank_delta=rank_delta,
        mention_rate_delta=mention_rate_delta,
        new_displacing_competitors=new_disp,
        lost_displacing_competitors=lost_disp,
        framing_shift=None,
        velocity=velocity,
        previous_rank=previous_rank,
        current_rank=current_rank,
    )
