import csv
import io
import ipaddress
import json
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from flask import Blueprint, Response as FlaskResponse, g, jsonify, request

from sqlalchemy import func

from auth import require_auth
from engine.analyzer import (
    _clean_json,
    calculate_visibility_score,
    generate_action_playbook,
    generate_content_piece,
    generate_global_audit,
    generate_project_summary,
    generate_recommendations,
    generate_strategic_action_plan,
    is_spurious_brand_mention,
    _looks_like_spec_phrase,
)
from engine.llm_clients import chat
from engine.brain_pipeline import DisplacementEvent, EvidenceSynthesis
from engine.execution_steps import (
    build_execution_cards_by_domain,
    is_execution_cards_cache_payload,
    resolve_execution_card_for_domain,
)
from engine.perplexity_search import is_perplexity_search_enabled, search_web
from exceptions import NotFoundError
from models import (
    AnalysisJob,
    CompetitorFraming,
    Mention,
    Project,
    ProjectInsight,
    Prompt,
    PromptMetric,
    ReportCache,
    Response,
    VisibilityMetric,
    db,
)

reports_bp = Blueprint("reports", __name__)

GENERIC_CHANNEL_TOKENS = frozenset(
    {
        "online",
        "store",
        "stores",
        "shop",
        "shops",
        "retailer",
        "retailers",
        "marketplace",
        "marketplaces",
        "seller",
        "sellers",
        "dealer",
        "dealers",
        "website",
        "websites",
    }
)

RETAILER_LITERALS = frozenset(
    {
        "amazon",
        "flipkart",
        "walmart",
        "target",
        "ebay",
        "best buy",
        "costco",
        "aliexpress",
    }
)

RETAIL_CONTEXT_HINTS = (
    "where to buy",
    "buy ",
    "buying",
    "available on",
    "available at",
    "shop",
    "store",
    "retailer",
    "marketplace",
    "purchase",
    "price on",
)

NON_ANALYSIS_ENGINES = frozenset({"perplexity_research"})
ALLOWED_EXECUTION_MODELS = frozenset({"chatgpt", "deepseek", "perplexity", "gemini", "claude"})
ALLOWED_CONTENT_TYPES = frozenset({"Article", "Blog", "Reddit Post"})
MAX_EXECUTION_DIRECTIVE_CHARS = 6000

def _cache_get(key: str) -> Any | None:
    try:
        row = ReportCache.query.filter_by(cache_key=key).first()
        if not row or not row.payload_json:
            return None
        if row.expires_at and row.expires_at < datetime.now(timezone.utc).isoformat():
            return None
        return json.loads(row.payload_json)
    except Exception:
        return None


def _cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    try:
        row = ReportCache.query.filter_by(cache_key=key).first()
        if not row:
            row = ReportCache(cache_key=key, generated_at=datetime.now(timezone.utc).isoformat())
            db.session.add(row)
        row.payload_json = json.dumps(value)
        row.generated_at = datetime.now(timezone.utc).isoformat()
        row.expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat()
        db.session.commit()
    except Exception:
        db.session.rollback()


def _cache_invalidate_project(project_id: int) -> None:
    try:
        # Delete specific known cache keys
        deleted = ReportCache.query.filter(
            ReportCache.cache_key.in_([
                f"deep-analysis:{project_id}",
                f"dashboard:{project_id}",
                f"dashboard:v2:{project_id}",
                f"sources-intelligence:{project_id}",
                f"competitor-intelligence:{project_id}",
                f"intel-summary:{project_id}",
                f"global-audit:{project_id}",
            ])
        ).delete(synchronize_session=False)
        # Delete any other project-related cache entries
        deleted += ReportCache.query.filter(
            ReportCache.cache_key.like(f"%project_{project_id}%")
        ).delete(synchronize_session=False)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        # Log error but don't fail - analysis data is already committed
        import logging
        logging.getLogger(__name__).warning("Cache invalidation failed for project %s: %s", project_id, exc)


def _get_or_build_deep_analysis_payload(project_id: int) -> dict:
    """
    Deep analysis and prompt-analysis tables share the same expensive payload.
    Cache once under deep-analysis:{id} so dashboard + prompts tab do not rebuild twice.
    """
    cache_key = f"deep-analysis:{project_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    payload = _build_deep_analysis_payload(project_id)
    _cache_set(cache_key, payload)
    return payload


def invalidate_project_report_caches(project_id: int) -> None:
    """Invalidate persisted report caches after new analysis data is written."""
    _cache_invalidate_project(project_id)


def _looks_like_channel_noise(brand: str, context: str = "") -> bool:
    label = (brand or "").strip().lower()
    if not label:
        return True
    tokens = [token for token in re.findall(r"[a-z0-9]+", label) if token]
    if tokens and len(tokens) <= 4 and all(token in GENERIC_CHANNEL_TOKENS for token in tokens):
        return True
    if label in RETAILER_LITERALS:
        context_lower = (context or "").lower()
        if any(hint in context_lower for hint in RETAIL_CONTEXT_HINTS):
            return True
    return False


def _is_analysis_engine(engine: str) -> bool:
    name = (engine or "").strip().lower()
    if not name:
        return False
    if name in NON_ANALYSIS_ENGINES:
        return False
    if name.endswith("_research"):
        return False
    return True


def _get_project_for_user(project_id: int):
    """Return project if it belongs to the current user, else raise NotFoundError."""
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")
    return project


def _parse_sources(raw: str) -> list[str]:
    try:
        data = json.loads(raw or "[]")
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _parse_json_object(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", str(text or "").strip())
    return [part.strip() for part in parts if part.strip()]


def _raw_responses_for_prompt(prompt_id: int, limit: int = 8) -> dict[str, str]:
    raw_responses: dict[str, str] = {}
    rows = (
        Response.query.filter_by(prompt_id=prompt_id)
        .order_by(Response.timestamp.desc())
        .limit(limit * 2)
        .all()
    )
    for resp in rows:
        if not _is_analysis_engine(resp.engine):
            continue
        if resp.engine not in raw_responses:
            raw_responses[resp.engine] = resp.response_text
        if len(raw_responses) >= limit:
            break
    return raw_responses


def _competitor_framings_for_prompt(prompt_id: int, limit: int = 20) -> list[dict[str, Any]]:
    rows = (
        CompetitorFraming.query.filter_by(prompt_id=prompt_id)
        .order_by(CompetitorFraming.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "competitor_brand": row.competitor_brand,
            "verbatim_sentence": row.verbatim_sentence,
            "framing_adjectives": row.framing_adjectives,
            "rank_in_response": row.rank_in_response,
            "engine": row.engine,
        }
        for row in rows
    ]


def _project_raw_response_context(project_id: int, per_prompt_limit: int = 4) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    by_engine: dict[str, str] = {}
    by_prompt: dict[str, dict[str, str]] = {}
    for prompt in prompts:
        engine_texts = _raw_responses_for_prompt(prompt.id, limit=per_prompt_limit)
        if engine_texts:
            by_prompt[prompt.prompt_text] = engine_texts
        for engine, text in engine_texts.items():
            by_engine.setdefault(engine, text)
    return by_engine, by_prompt


def _project_competitor_framings(project_id: int, limit: int = 40) -> list[dict[str, Any]]:
    prompt_ids = [p.id for p in Prompt.query.filter_by(project_id=project_id).all()]
    if not prompt_ids:
        return []
    rows = (
        CompetitorFraming.query.filter(CompetitorFraming.prompt_id.in_(prompt_ids))
        .order_by(CompetitorFraming.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "competitor_brand": row.competitor_brand,
            "verbatim_sentence": row.verbatim_sentence,
            "framing_adjectives": row.framing_adjectives,
            "rank_in_response": row.rank_in_response,
            "engine": row.engine,
        }
        for row in rows
    ]


def _generate_domain_insight(domain: str, focus_brand: str, query: str, engine_responses: dict[str, str]) -> dict:
    domain_mentions = []
    domain_lower = str(domain or "").lower()
    for eng, text in (engine_responses or {}).items():
        for sentence in _split_sentences(text):
            if domain_lower and domain_lower in sentence.lower():
                domain_mentions.append(f"{eng}: {sentence[:200]}")
    context = (
        "\n".join(domain_mentions[:4])
        if domain_mentions
        else f"{domain} appeared as a citation source across engine responses for query: {query}"
    )
    prompt = f'''For brand {focus_brand}, the domain {domain} appeared in AI engine results for query "{query}".
Context: {context}
In 1 sentence: why does {domain} matter for {focus_brand}'s AI visibility specifically?
In 1 sentence: what exact action should {focus_brand} take on {domain} this week?
Return JSON: {{"why_it_matters": "...", "action": "..."}}'''
    try:
        parsed = _clean_json(chat("chatgpt", prompt, temperature=0.3))
        if isinstance(parsed, dict) and parsed.get("why_it_matters"):
            return {
                "why_it_matters": str(parsed.get("why_it_matters") or ""),
                "action": str(parsed.get("action") or ""),
            }
    except Exception:
        pass
    return {
        "why_it_matters": f"{domain} cited by engines for this query.",
        "action": f"Establish {focus_brand} presence on {domain}.",
    }


def _to_displacement_event(item: Any) -> DisplacementEvent | None:
    if not isinstance(item, dict):
        return None
    brand = str(item.get("competitor_brand") or "").strip()
    if not brand:
        return None
    cited = str(item.get("cited_url") or "").strip()
    return DisplacementEvent(
        competitor_brand=brand,
        displacement_context=str(item.get("displacement_context") or ""),
        displacement_reason=str(item.get("displacement_reason") or ""),
        rank_of_competitor=item.get("rank_of_competitor") if isinstance(item.get("rank_of_competitor"), int) else None,
        rank_of_focus=item.get("rank_of_focus") if isinstance(item.get("rank_of_focus"), int) else None,
        cited_url=cited or None,
    )


def _coerce_synthesis(payload: dict[str, Any]) -> EvidenceSynthesis | None:
    if not isinstance(payload, dict) or not payload:
        return None
    engines_mentioning = payload.get("engines_mentioning_focus", payload.get("engines_mentioning", []))
    engines_not_mentioning = payload.get("engines_not_mentioning_focus", payload.get("engines_not_mentioning", []))
    events = []
    for raw in payload.get("displacement_events_all", []) or []:
        event = _to_displacement_event(raw)
        if event is not None:
            events.append(event)
    return EvidenceSynthesis(
        engines_mentioning_focus=[str(x) for x in (engines_mentioning or []) if str(x).strip()],
        engines_not_mentioning_focus=[str(x) for x in (engines_not_mentioning or []) if str(x).strip()],
        consensus_rank=payload.get("consensus_rank") if isinstance(payload.get("consensus_rank"), (int, float)) else None,
        rank_variance=float(payload.get("rank_variance") or 0.0),
        top_displacement_competitors=[x for x in (payload.get("top_displacement_competitors") or []) if isinstance(x, dict)],
        recurring_displacement_reasons=[str(x) for x in (payload.get("recurring_displacement_reasons") or []) if str(x).strip()],
        top_cited_domains=[x for x in (payload.get("top_cited_domains") or []) if isinstance(x, dict)],
        citation_concentration=float(payload.get("citation_concentration") or 0.0),
        focus_brand_dominant_framing=str(payload.get("focus_brand_dominant_framing") or "unknown"),
        framing_consistency=float(payload.get("framing_consistency") or 0.0),
        response_structure_distribution=dict(payload.get("response_structure_distribution") or {}),
        displacement_events_all=events,
        evidence_phrases_all=[str(x) for x in (payload.get("evidence_phrases_all") or []) if str(x).strip()],
        engine_contexts=[x for x in (payload.get("engine_contexts") or []) if isinstance(x, dict)],
    )


def _latest_completed_job(prompt_id: int, user_id: str) -> AnalysisJob | None:
    return (
        AnalysisJob.query.filter_by(prompt_id=prompt_id, user_id=user_id, status="completed")
        .order_by(AnalysisJob.completed_at.desc(), AnalysisJob.id.desc())
        .first()
    )


def _build_project_synthesis_summary(project_id: int, user_id: str) -> dict[str, Any]:
    jobs = (
        AnalysisJob.query.filter_by(project_id=project_id, user_id=user_id, status="completed")
        .order_by(AnalysisJob.completed_at.desc(), AnalysisJob.id.desc())
        .all()
    )
    by_prompt: dict[int, AnalysisJob] = {}
    for job in jobs:
        if job.prompt_id not in by_prompt:
            by_prompt[job.prompt_id] = job

    engines_mentioning: set[str] = set()
    engines_not_mentioning: set[str] = set()
    displacement_counts: dict[str, int] = defaultdict(int)
    domain_counts: dict[str, int] = defaultdict(int)
    reason_counts: dict[str, int] = defaultdict(int)

    for job in by_prompt.values():
        synth = _parse_json_object(job.synthesis_json or "")
        if not synth:
            result = _parse_json_object(job.result_json or "")
            synth = result.get("synthesis", {}) if isinstance(result.get("synthesis"), dict) else {}
        if not synth:
            continue
        for engine in synth.get("engines_mentioning_focus", synth.get("engines_mentioning", [])) or []:
            engines_mentioning.add(str(engine))
        for engine in synth.get("engines_not_mentioning_focus", synth.get("engines_not_mentioning", [])) or []:
            engines_not_mentioning.add(str(engine))
        for row in synth.get("top_displacement_competitors", []) or []:
            if not isinstance(row, dict):
                continue
            brand = str(row.get("brand") or "").strip()
            if not brand:
                continue
            displacement_counts[brand] += int(row.get("count") or 1)
        for row in synth.get("top_cited_domains", []) or []:
            if not isinstance(row, dict):
                continue
            domain = str(row.get("domain") or "").strip()
            if not domain:
                continue
            domain_counts[domain] += int(row.get("count") or 1)
        for reason in synth.get("recurring_displacement_reasons", []) or []:
            cleaned = str(reason or "").strip()
            if cleaned:
                reason_counts[cleaned] += 1

    return {
        "engines_mentioning": sorted(engines_mentioning),
        "engines_not_mentioning": sorted(engines_not_mentioning),
        "top_displacement_competitors": [
            {"brand": brand, "count": count}
            for brand, count in sorted(displacement_counts.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
        "top_cited_domains": [
            {"domain": domain, "count": count}
            for domain, count in sorted(domain_counts.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
        "recurring_displacement_reasons": [
            reason
            for reason, _count in sorted(reason_counts.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
    }


def _domain_from_url(url: str) -> str:
    if not url:
        return ""
    cleaned = str(url).strip()
    if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
        return ""
    parsed = urlparse(cleaned)
    host = (parsed.hostname or "").replace("www.", "").lower().strip()
    if not host:
        return ""
    if host in {"localhost"} or host.endswith(".local"):
        return ""
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return ""
    except ValueError:
        pass
    domain = host
    if domain and re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", domain):
        return domain
    return ""


def _normalize_source_url(value: str) -> str:
    cleaned = str(value or "").strip().rstrip(".,;:!?)")
    if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
        return ""
    domain = _domain_from_url(cleaned)
    if not domain:
        return ""
    try:
        parsed = urlparse(cleaned)
        return parsed._replace(fragment="").geturl()
    except Exception:
        return cleaned


def _latest_responses_by_prompt(prompt_id: int) -> list[Response]:
    prompt = Prompt.query.get(prompt_id)
    selected_models_lower: set[str] = set()
    if prompt and hasattr(prompt, "get_models"):
        selected_models_lower = {m.strip().lower() for m in prompt.get_models() if m and m.strip()}

    responses = Response.query.filter_by(prompt_id=prompt_id).order_by(Response.timestamp.desc()).all()
    by_engine: dict[str, Response] = {}
    for response in responses:
        if not _is_analysis_engine(response.engine):
            continue
        if selected_models_lower and response.engine.strip().lower() not in selected_models_lower:
            continue
        if response.engine not in by_engine:
            by_engine[response.engine] = response
    return list(by_engine.values())


def _latest_research_response(prompt_id: int) -> Response | None:
    return (
        Response.query.filter(
            Response.prompt_id == prompt_id,
            Response.engine.like("%_research"),
        )
        .order_by(Response.timestamp.desc())
        .first()
    )


def _compute_overall_health(prompt_rankings: list[dict]) -> str:
    """Compute project health from actual ranking coverage and quality."""
    if not prompt_rankings:
        return "Neutral"

    total = len(prompt_rankings)
    ranked = [row for row in prompt_rankings if row.get("avg_rank") is not None]
    ranked_count = len(ranked)
    coverage_ratio = ranked_count / total

    if ranked_count == 0:
        return "Critical"

    avg_rank = sum(float(row["avg_rank"]) for row in ranked) / ranked_count

    # Strong: broad coverage and consistently top ranks.
    if coverage_ratio >= 0.7 and avg_rank <= 3.0:
        return "Strong"

    # Critical: weak coverage or poor rank quality.
    if coverage_ratio < 0.4 or avg_rank > 6.0:
        return "Critical"

    return "Neutral"


def _compute_health_details(prompt_rankings: list[dict]) -> dict[str, Any]:
    """Return health label plus supporting metrics and intent buckets."""
    if not prompt_rankings:
        return {
            "overall_health": "Neutral",
            "coverage_ratio": 0.0,
            "avg_rank": None,
            "low_visibility_prompts": [],
            "top_visibility_prompts": [],
        }

    total = len(prompt_rankings)
    ranked = [row for row in prompt_rankings if row.get("avg_rank") is not None]
    ranked_count = len(ranked)
    coverage_ratio = ranked_count / total if total > 0 else 0.0

    avg_rank = sum(float(row["avg_rank"]) for row in ranked) / ranked_count if ranked_count else None

    # Bucket prompts based on rank quality.
    low_visibility_prompts = [
        row.get("prompt_text")
        for row in prompt_rankings
        if row.get("prompt_text")
        and (row.get("avg_rank") is None or float(row.get("avg_rank")) > 5.0)
    ]

    top_visibility_prompts = [
        row.get("prompt_text")
        for row in prompt_rankings
        if row.get("prompt_text") and row.get("avg_rank") is not None and float(row.get("avg_rank")) <= 3.0
    ]

    # De-dup while preserving order.
    def _dedupe(items: list[str]) -> list[str]:
        seen = set()
        out = []
        for x in items:
            if x in seen:
                continue
            seen.add(x)
            out.append(x)
        return out

    low_visibility_prompts = _dedupe(low_visibility_prompts)
    top_visibility_prompts = _dedupe(top_visibility_prompts)

    overall_health = _compute_overall_health(prompt_rankings)

    return {
        "overall_health": overall_health,
        "coverage_ratio": coverage_ratio,
        "avg_rank": avg_rank,
        "low_visibility_prompts": low_visibility_prompts,
        "top_visibility_prompts": top_visibility_prompts,
    }


def _build_prompt_detail_payload(prompt_id: int) -> dict:
    prompt = Prompt.query.get(prompt_id)
    if not prompt:
        raise NotFoundError("Prompt not found")

    project = Project.query.get(prompt.project_id)
    focus_brand = project.name if project else ""
    responses = Response.query.filter_by(prompt_id=prompt_id).order_by(Response.timestamp.asc()).all()
    if not responses:
        return {
            "prompt_id": prompt.id,
            "prompt_text": prompt.prompt_text,
            "project_id": prompt.project_id,
            "brand_ranking": [],
            "trend": [],
            "sentiment": {"positive": 0, "neutral": 0, "negative": 0, "not_mentioned": 0},
            "sources": [],
            "competitors": [],
            "audit": [{"title": "No analysis yet", "detail": "Run analysis for this prompt to generate detailed audit findings."}],
            "recommended_actions": [],
            "raw_responses": [],
        }

    # Respect the prompt's selected_models so we only show engines that were actually run.
    selected_models = prompt.get_models() if hasattr(prompt, "get_models") else []
    selected_models_lower = {m.strip().lower() for m in selected_models if m and m.strip()}

    latest_by_engine: dict[str, Response] = {}
    for response in sorted(responses, key=lambda item: item.timestamp, reverse=True):
        if not _is_analysis_engine(response.engine):
            continue
        if selected_models_lower and response.engine.strip().lower() not in selected_models_lower:
            continue
        if response.engine not in latest_by_engine:
            latest_by_engine[response.engine] = response

    raw_responses = [
        {
            "id": response.id,
            "engine": engine,
            "response_text": response.response_text,
            "sources": _parse_sources(response.sources),
            "timestamp": response.timestamp,
        }
        for engine, response in sorted(latest_by_engine.items(), key=lambda item: item[0].lower())
    ]
    raw_response_texts = {engine: response.response_text for engine, response in latest_by_engine.items()}
    competitor_framings = _competitor_framings_for_prompt(prompt_id)

    competitor_scores: dict[str, dict] = defaultdict(lambda: {"mentions": 0, "ranks": []})
    sentiment = {"positive": 0, "neutral": 0, "negative": 0, "not_mentioned": 0}
    source_count: dict[str, int] = defaultdict(int)
    source_links: dict[str, set[str]] = defaultdict(set)
    trend = []

    # Bulk load mentions once to avoid N+1 queries.
    response_ids = [r.id for r in responses]
    mentions_by_response: dict[int, list[Mention]] = defaultdict(list)
    if response_ids:
        for mention in Mention.query.filter(Mention.response_id.in_(response_ids)).all():
            mentions_by_response[mention.response_id].append(mention)

    for response in responses:
        if not _is_analysis_engine(response.engine):
            continue
        if selected_models_lower and response.engine.strip().lower() not in selected_models_lower:
            continue
        mentions = mentions_by_response.get(response.id, [])
        focus = next((m for m in mentions if m.is_focus), None)
        trend.append(
            {
                "timestamp": response.timestamp,
                "engine": response.engine,
                "mentioned": bool(focus),
                "rank": focus.rank if focus else None,
            }
        )

    for engine, response in latest_by_engine.items():
        mentions = mentions_by_response.get(response.id, [])
        focus = next((m for m in mentions if m.is_focus), None)
        if focus:
            sentiment[focus.sentiment if focus.sentiment in sentiment else "neutral"] += 1
        else:
            sentiment["not_mentioned"] += 1

        for mention in mentions:
            if mention.is_focus:
                continue
            if is_spurious_brand_mention(mention.brand or ""):
                continue
            if _looks_like_channel_noise(mention.brand or "", mention.context or ""):
                continue
            if _looks_like_spec_phrase(mention.brand or ""):
                continue
            competitor_scores[mention.brand]["mentions"] += 1
            if mention.rank is not None:
                competitor_scores[mention.brand]["ranks"].append(mention.rank)

        for source in _parse_sources(response.sources):
            normalized_source = _normalize_source_url(source)
            if not normalized_source:
                continue
            domain = _domain_from_url(normalized_source)
            if not domain:
                continue
            source_count[domain] += 1
            source_links[domain].add(normalized_source)

    brand_ranking = []
    for brand, row in competitor_scores.items():
        avg_rank = round(sum(row["ranks"]) / len(row["ranks"]), 2) if row["ranks"] else None
        brand_ranking.append({"name": brand, "mentions": row["mentions"], "avg_rank": avg_rank})
    brand_ranking.sort(key=lambda item: (-item["mentions"], item["avg_rank"] if item["avg_rank"] is not None else 999))

    focus_mentioned = (sentiment["positive"] + sentiment["neutral"] + sentiment["negative"]) > 0
    audit = []
    
    # Fetch persisted research data
    research_resp = _latest_research_response(prompt_id)
    research_data = {}
    if research_resp:
        try:
            research_data = json.loads(research_resp.response_text)
        except Exception:
            pass

    research_sources_raw = research_data.get("sources", [])
    research_sources = [src for src in research_sources_raw if isinstance(src, dict)]
    research_title_by_url: dict[str, str] = {}
    research_title_by_domain: dict[str, str] = {}
    for src in research_sources:
        src_url = _normalize_source_url(src.get("url") or "")
        src_title = str(src.get("title") or "").strip()
        src_domain = str(src.get("domain") or "").strip().lower()
        if src_url and src_title:
            research_title_by_url[src_url] = src_title
            research_title_by_url[src_url.rstrip("/")] = src_title
            domain_from_url = _domain_from_url(src_url)
            if domain_from_url and domain_from_url not in research_title_by_domain:
                research_title_by_domain[domain_from_url] = src_title
        if src_domain and src_title and src_domain not in research_title_by_domain:
            research_title_by_domain[src_domain] = src_title
    
    # Process latest engine results for visibility context
    analyses = {}
    for engine, resp in latest_by_engine.items():
        if engine == "perplexity_research":
            continue
        
        # Get mentions for this response
        m_list = mentions_by_response.get(resp.id, [])
        f_m = next((m for m in m_list if m.is_focus), None)
        
        analyses[engine] = {
            "focus_brand_mentioned": bool(f_m),
            "focus_brand_rank": f_m.rank if f_m else None,
            "focus_brand_sentiment": f_m.sentiment if f_m else "not_mentioned",
            "focus_brand_context": f_m.context if f_m else ""
        }

    latest_ts = max((r.timestamp or "" for r in latest_by_engine.values()), default="")
    audit_cache_key = f"audit:{prompt_id}:{latest_ts}"
    audit = _cache_get(audit_cache_key)
    if audit is None:
        latest_job = _latest_completed_job(prompt_id, g.user.id)
        persisted_audit: list[dict[str, Any]] = []
        if latest_job:
            result_payload = _parse_json_object(latest_job.result_json or "")
            raw_audit = result_payload.get("audit", [])
            if isinstance(raw_audit, list):
                persisted_audit = [row for row in raw_audit if isinstance(row, dict)]
        if persisted_audit:
            audit = persisted_audit[:5]
        else:
            audit = [
                {
                    "title": "No persisted audit yet",
                    "detail": "The raw responses are available, but detailed audit items were not saved for this run.",
                    "priority": "medium",
                }
            ]
        _cache_set(audit_cache_key, audit)

    recommended_specs: list[dict[str, Any]] = []

    # Add research-driven recommendations (from legacy research Responses).
    for src in research_sources[:10]:
        domain = str(src.get("domain") or "").strip() or "authoritative source"
        link = _normalize_source_url(src.get("url") or "") or (
            f"https://{domain}" if domain and " " not in domain else ""
        )
        recommended_specs.append({
            "domain": domain,
            "link": link,
        })
        if len(recommended_specs) >= 6:
            break

    # When no research Response exists (new analyses use the search pre-layer),
    # derive recommendations from the top cited domains in LLM responses.
    if not recommended_specs:
        for domain, count in sorted(source_count.items(), key=lambda item: item[1], reverse=True)[:6]:
            links = sorted(source_links.get(domain, set()))
            recommended_specs.append({
                "domain": domain,
                "link": links[0] if links else f"https://{domain}",
            })

    recommended_actions: list[dict[str, Any]] = []
    if recommended_specs:
        site_url = project.website_url if project else ""
        domain_sig = ":".join(sorted({(spec["domain"] or "").lower() for spec in recommended_specs}))
        exec_cards_cache_key = f"prompt_exec_cards:v2:{prompt_id}:{latest_ts}:{domain_sig}"
        cards_by_domain = _cache_get(exec_cards_cache_key)
        if not is_execution_cards_cache_payload(cards_by_domain):
            cards_by_domain = build_execution_cards_by_domain(
                domains=[spec["domain"] for spec in recommended_specs],
                focus_brand=focus_brand,
                query=prompt.prompt_text,
                project_website_url=site_url,
                raw_engine_responses=raw_response_texts,
                competitor_framings=competitor_framings,
            )
            _cache_set(exec_cards_cache_key, cards_by_domain)

        for spec in recommended_specs:
            card = resolve_execution_card_for_domain(
                spec["domain"],
                cards_by_domain,
                focus_brand=focus_brand,
                query=prompt.prompt_text,
                project_website_url=site_url,
                raw_engine_responses=raw_response_texts,
                competitor_framings=competitor_framings,
            )
            recommended_actions.append({
                "title": str(card.get("title") or ""),
                "detail": str(card.get("detail") or ""),
                "action_plan": list(card.get("steps") or []),
                "link": spec["link"],
            })
    
    # Merge research data into sources list
    ui_sources = []
    research_by_domain = defaultdict(list)
    for s in research_sources:
        research_by_domain[s.get("domain", "").lower()].append(s)

    # Process domains found in LLM responses
    for domain, count in sorted(source_count.items(), key=lambda item: item[1], reverse=True):
        d_lower = domain.lower()
        r_items = research_by_domain.pop(d_lower, [])
        
        # Use a list of dicts for mapped links
        mapped_links = []
        seen_urls = set()

        # Add links from research first (these have titles)
        for r in r_items:
            u = _normalize_source_url(r.get("url") or "")
            if u and u not in seen_urls:
                mapped_links.append({
                    "url": u,
                    "title": (r.get("title") or "").strip() or u.replace("https://", "").replace("www.", "").split("/")[0]
                })
                seen_urls.add(u)

        # Add links found in responses
        for url in source_links.get(domain, []):
            valid_url = _normalize_source_url(url)
            if not valid_url:
                continue
            if valid_url not in seen_urls:
                normalized = valid_url.rstrip("/")
                matched_title = research_title_by_url.get(valid_url) or research_title_by_url.get(normalized)
                if not matched_title:
                    matched_title = research_title_by_domain.get(_domain_from_url(valid_url))
                mapped_links.append({
                    "url": valid_url,
                    "title": matched_title or valid_url.replace("https://", "").replace("www.", "").split("/")[0]
                })
                seen_urls.add(valid_url)

        ui_sources.append({
            "domain": domain + (" (Research Source)" if len(r_items) > 0 else ""),
            "mentions": count,
            "links": mapped_links[:20],
            "is_target": len(r_items) > 0
        })
    
    # Add remaining research sources
    for domain_lower, items in research_by_domain.items():
        mapped_links = []
        for i in items:
            u = _normalize_source_url(i.get("url") or "")
            if u:
                mapped_links.append({
                    "url": u,
                    "title": i.get("title") or u
                })

        ui_sources.append({
            "domain": (items[0].get("domain") or "Research Source") + " (Research Source)",
            "mentions": 0,
            "links": mapped_links,
            "is_target": True
        })

    return {
        "prompt_id": prompt.id,
        "prompt_text": prompt.prompt_text,
        "project_id": prompt.project_id,
        "brand_ranking": brand_ranking[:10],
        "trend": trend,
        "sentiment": sentiment,
        "sources": ui_sources[:15],
        "competitors": brand_ranking[:10],
        "audit": audit,
        "recommended_actions": recommended_actions,
        "raw_responses": raw_responses,
    }


def _build_prompt_rankings(project_id: int) -> list[dict]:
    rows = []
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    prompt_ids = [p.id for p in prompts]
    if not prompt_ids:
        return []

    # Pre-compute per-prompt selected_models for engine filtering.
    prompt_selected: dict[int, set[str]] = {}
    for p in prompts:
        models = p.get_models() if hasattr(p, "get_models") else []
        prompt_selected[p.id] = {m.strip().lower() for m in models if m and m.strip()}

    response_rows = Response.query.filter(Response.prompt_id.in_(prompt_ids)).order_by(Response.timestamp.desc()).all()
    latest_response_by_prompt_engine: dict[tuple[int, str], Response] = {}
    for r in response_rows:
        if not _is_analysis_engine(r.engine):
            continue
        selected = prompt_selected.get(r.prompt_id, set())
        if selected and r.engine.strip().lower() not in selected:
            continue
        key = (r.prompt_id, r.engine)
        if key not in latest_response_by_prompt_engine:
            latest_response_by_prompt_engine[key] = r

    latest_response_ids = [r.id for r in latest_response_by_prompt_engine.values()]
    focus_mentions_by_response: dict[int, Mention] = {}
    if latest_response_ids:
        for m in Mention.query.filter(Mention.response_id.in_(latest_response_ids), Mention.is_focus.is_(True)).all():
            focus_mentions_by_response[m.response_id] = m

    for prompt in prompts:
        latest_responses = [r for (pid, _engine), r in latest_response_by_prompt_engine.items() if pid == prompt.id]
        ranks = []
        for response in latest_responses:
            mention = focus_mentions_by_response.get(response.id)
            if mention and mention.rank is not None:
                ranks.append(float(mention.rank))

        rows.append(
            {
                "prompt_id": prompt.id,
                "prompt_text": prompt.prompt_text,
                "avg_rank": round(sum(ranks) / len(ranks), 2) if ranks else None,
                "engines_analyzed": len(latest_responses),
            }
        )
    return rows


def _build_competitor_visibility(project_id: int) -> list[dict]:
    """Aggregate mention-based visibility plus every configured competitor and the focus brand.

    Previously only brands that already appeared in Mention rows were returned, so configured
    competitors (e.g. Samsung) disappeared from the UI until the LLM happened to mention them.
    """
    project = Project.query.get(project_id)
    if not project:
        return []

    focus_brand = (project.name or "").strip()
    configured = [str(c).strip() for c in project.get_competitors_list() if c and str(c).strip()]
    onboarding = project.get_onboarding_data() if hasattr(project, "get_onboarding_data") else {}
    steps = onboarding.get("steps", {}) if isinstance(onboarding, dict) else {}
    step4 = steps.get("4", {}) if isinstance(steps.get("4"), dict) else {}
    alias_map = step4.get("competitor_aliases", {}) if isinstance(step4, dict) else {}
    alias_reverse: dict[str, str] = {}
    if isinstance(alias_map, dict):
        for canonical, aliases in alias_map.items():
            canonical_name = str(canonical or "").strip()
            if not canonical_name:
                continue
            alias_reverse[canonical_name.lower()] = canonical_name
            if isinstance(aliases, list):
                for alias in aliases:
                    a = str(alias or "").strip()
                    if a:
                        alias_reverse[a.lower()] = canonical_name
    configured_lower = {c.lower() for c in configured}
    focus_lower = focus_brand.lower() if focus_brand else ""

    prompts = Prompt.query.filter_by(project_id=project_id).all()
    prompt_ids = [p.id for p in prompts]

    considered_response_ids: set[int] = set()
    for prompt_id in prompt_ids:
        considered_response_ids.update(r.id for r in _latest_responses_by_prompt(prompt_id))

    # If no prompt analysis responses exist yet, avoid synthesizing placeholder
    # competitor scores from configured names only.
    if not considered_response_ids:
        return []

    # Canonical key = lowercased brand; preserve a human-readable label
    grouped: dict[str, dict] = defaultdict(
        lambda: {"mentions": 0, "response_ids": set(), "ranks": [], "sentiments": [], "any_focus_mention": False, "label": ""}
    )

    if considered_response_ids:
        mentions = Mention.query.filter(Mention.response_id.in_(considered_response_ids)).all()
        for mention in mentions:
            raw = (mention.brand or "").strip()
            if not raw or is_spurious_brand_mention(raw):
                continue
            if _looks_like_channel_noise(raw, mention.context or ""):
                continue
            if _looks_like_spec_phrase(raw):
                continue
            canonical = alias_reverse.get(raw.lower(), raw)
            key = canonical.lower()
            g = grouped[key]
            g["mentions"] += 1
            g["response_ids"].add(mention.response_id)
            g["any_focus_mention"] = g["any_focus_mention"] or bool(mention.is_focus)
            g["sentiments"].append(mention.sentiment or "neutral")
            if mention.rank is not None:
                g["ranks"].append(float(mention.rank))
            if not g["label"]:
                g["label"] = canonical

    total_responses = max(1, len(considered_response_ids))

    def display_label(key_lower: str, fallback: str) -> str:
        if key_lower in grouped and grouped[key_lower]["label"]:
            return grouped[key_lower]["label"]
        return fallback

    # Ordered list of (key_lower, display_name) — focus first, then configured, then any extra mention-only brands
    ordered: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add_brand(display_name: str) -> None:
        dn = (display_name or "").strip()
        if not dn:
            return
        kl = dn.lower()
        if kl in seen:
            return
        seen.add(kl)
        ordered.append((kl, display_label(kl, dn)))

    if focus_brand:
        add_brand(focus_brand)
    for c in configured:
        add_brand(c)
    min_extra_mentions = 2 if total_responses >= 4 else 1
    for kl in sorted(grouped.keys()):
        if kl not in seen:
            g = grouped[kl]
            if g["mentions"] < min_extra_mentions:
                continue
            label = display_label(kl, kl)
            if is_spurious_brand_mention(label) or _looks_like_spec_phrase(label):
                continue
            seen.add(kl)
            ordered.append((kl, label))

    rows: list[dict] = []
    for key_lower, brand_label in ordered:
        row = grouped[key_lower]
        mention_rate = len(row["response_ids"]) / total_responses
        rank_bonus = 0.0
        if row["ranks"]:
            avg_r = sum(row["ranks"]) / len(row["ranks"])
            rank_bonus = max(0, 30 - (avg_r - 1) * 5)
        positive = row["sentiments"].count("positive")
        negative = row["sentiments"].count("negative")
        sentiment_bonus = ((positive - negative) / len(row["sentiments"])) * 10 + 10 if row["sentiments"] else 0

        quality_score = min(100, mention_rate * 60 + rank_bonus + max(0, sentiment_bonus))
        visibility_pct = round(mention_rate * 100, 1)

        is_focus = key_lower == focus_lower if focus_lower else bool(row["any_focus_mention"])

        rows.append(
            {
                "brand": brand_label,
                "visibility_pct": visibility_pct,
                "quality_score": round(quality_score, 1),
                "visibility_score": round(quality_score, 1),  # Backward compatibility
                "mentions": row["mentions"],
                "avg_rank": round(sum(row["ranks"]) / len(row["ranks"]), 2) if row["ranks"] else None,
                "is_focus": is_focus,
                "is_target_competitor": key_lower in configured_lower and key_lower != focus_lower,
            }
        )

    rows.sort(
        key=lambda item: (
            -item["quality_score"],
            -item["visibility_pct"],
            item["brand"].lower(),
        )
    )

    focus_rows = [row for row in rows if row.get("is_focus")]
    configured_rows = [row for row in rows if row.get("is_target_competitor")]
    discovered_rows = [
        row
        for row in rows
        if not row.get("is_focus") and not row.get("is_target_competitor")
    ]

    merged: list[dict] = []
    seen_brands: set[str] = set()
    for row in focus_rows + configured_rows + discovered_rows[:10]:
        brand_key = str(row.get("brand") or "").strip().lower()
        if not brand_key or brand_key in seen_brands:
            continue
        seen_brands.add(brand_key)
        merged.append(row)

    return merged[:20]


def _project_website_host(website_url: str) -> str:
    """Normalized hostname from project website (no scheme/path), or ''."""
    url = (website_url or "").strip()
    if not url:
        return ""
    normalized = url if "://" in url else f"https://{url}"
    try:
        host = (urlparse(normalized).hostname or "").lower().replace("www.", "")
        return host.strip()
    except Exception:
        return ""


def _host_is_under_base(host: str, base_host: str) -> bool:
    h = (host or "").lower().replace("www.", "")
    b = (base_host or "").lower().replace("www.", "")
    if not h or not b:
        return False
    return h == b or h.endswith("." + b)


def _response_cites_project_domain(response: Response, base_host: str) -> bool:
    if not base_host:
        return False
    for source in _parse_sources(response.sources):
        if not isinstance(source, str):
            continue
        normalized = _normalize_source_url(source.strip())
        domain = _domain_from_url(normalized) if normalized else ""
        if domain and _host_is_under_base(domain, base_host):
            return True
    return False


def _latest_project_responses(project_id: int) -> list[Response]:
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    latest: list[Response] = []
    for prompt in prompts:
        latest.extend(_latest_responses_by_prompt(prompt.id))
    return latest


def _compute_official_site_cited_stats(project_id: int, website_url: str) -> dict[str, float | int]:
    base = _project_website_host(website_url)
    latest_responses = _latest_project_responses(project_id)
    total = len(latest_responses)
    if not base or not total:
        return {"official_site_cited_pct": 0.0, "official_site_cited_count": 0, "official_site_responses_total": total}
    cited = sum(1 for r in latest_responses if _response_cites_project_domain(r, base))
    pct = round((cited / total) * 100, 1)
    return {
        "official_site_cited_pct": pct,
        "official_site_cited_count": cited,
        "official_site_responses_total": total,
    }


def _compute_project_visibility_pct(project_id: int) -> float:
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    if not prompts:
        return 0.0

    latest_responses: list[Response] = []
    for prompt in prompts:
        latest_responses.extend(_latest_responses_by_prompt(prompt.id))

    if not latest_responses:
        return 0.0

    response_ids = [r.id for r in latest_responses]
    focus_mention_ids = {
        mention.response_id
        for mention in Mention.query.filter(
            Mention.response_id.in_(response_ids),
            Mention.is_focus.is_(True),
        ).all()
    }
    mention_count = sum(1 for response in latest_responses if response.id in focus_mention_ids)
    return round((mention_count / len(latest_responses)) * 100, 1)


def _build_engine_focus_visibility(project_id: int) -> list[dict[str, Any]]:
    """Target-brand visibility matrix by engine from latest prompt runs."""
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    if not prompts:
        return []

    latest_responses: list[Response] = []
    for prompt in prompts:
        latest_responses.extend(_latest_responses_by_prompt(prompt.id))

    response_ids = [r.id for r in latest_responses]
    focus_mentions_by_response: dict[int, Mention] = {}
    if response_ids:
        for mention in Mention.query.filter(
            Mention.response_id.in_(response_ids),
            Mention.is_focus.is_(True),
        ).all():
            focus_mentions_by_response[mention.response_id] = mention

    by_engine: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"responses": 0, "mentions": 0, "ranks": []}
    )
    for response in latest_responses:
        if not _is_analysis_engine(response.engine):
            continue
        bucket = by_engine[response.engine]
        bucket["responses"] += 1
        focus_mention = focus_mentions_by_response.get(response.id)
        if focus_mention is not None:
            bucket["mentions"] += 1
            if isinstance(focus_mention.rank, int):
                bucket["ranks"].append(float(focus_mention.rank))

    rows: list[dict[str, Any]] = []
    for engine, bucket in by_engine.items():
        responses = int(bucket["responses"] or 0)
        mentions = int(bucket["mentions"] or 0)
        visibility_pct = round((mentions / responses) * 100, 1) if responses else 0.0
        avg_rank = (
            round(sum(bucket["ranks"]) / len(bucket["ranks"]), 2)
            if bucket["ranks"]
            else None
        )
        rows.append(
            {
                "engine": engine,
                "visibility_pct": visibility_pct,
                "avg_rank": avg_rank,
                "responses": responses,
                "mentions": mentions,
            }
        )

    rows.sort(key=lambda item: (-float(item["visibility_pct"]), str(item["engine"])))
    return rows


def _build_competitor_visibility_trend(
    project_id: int,
    days: int = 30,
    competitor_limit: int = 3,
) -> dict[str, Any]:
    """
    Build a multi-series "visibility over time" chart for focus brand + top competitors.

    We derive daily visibility from actual Mention rows:
    - For each Response, a brand is "visible" if it has at least one Mention in that response.
    - Daily visibility_pct = responses_with_brand / total_responses_that_day * 100.
    """
    project = Project.query.get(project_id)
    if not project:
        return {"brands": [], "series": []}

    focus_brand = (project.name or "").strip()
    prompts = Prompt.query.filter_by(project_id=project_id).all()
    prompt_ids = [p.id for p in prompts]
    if not prompt_ids:
        return {"brands": [], "series": []}

    # Choose competitors based on current aggregate visibility table.
    comp_rows = _build_competitor_visibility(project_id)
    competitor_names = [
        str(r.get("brand") or "").strip()
        for r in comp_rows
        if str(r.get("brand") or "").strip()
        and not r.get("is_focus")
    ][:competitor_limit]

    brands = [b for b in [focus_brand, *competitor_names] if b]
    if not brands:
        return {"brands": [], "series": []}

    # Normalize for matching; allow loose equality for "focus brand" mentions.
    brands_lower = {b.lower(): b for b in brands}

    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=max(1, int(days)))
    cutoff_iso = cutoff_dt.date().isoformat()

    # Load candidate responses in the time window.
    responses = (
        Response.query.join(Prompt, Prompt.id == Response.prompt_id)
        .filter(Prompt.project_id == project_id)
        .filter(Response.timestamp >= cutoff_iso)
        .all()
    )
    if not responses:
        return {"brands": brands, "series": []}

    response_ids = [r.id for r in responses]
    mentions = Mention.query.filter(Mention.response_id.in_(response_ids)).all()

    # response_id -> date -> set(brand_lower mentioned)
    mentioned_by_response: dict[int, set[str]] = defaultdict(set)
    for m in mentions:
        raw = str(m.brand or "").strip()
        if not raw:
            continue
        raw_lower = raw.lower()
        if raw_lower in brands_lower:
            mentioned_by_response[m.response_id].add(raw_lower)
            continue
        # fallback: treat focus brand mention as match if m.is_focus
        if focus_brand and m.is_focus:
            mentioned_by_response[m.response_id].add(focus_brand.lower())

    # date -> total responses and per-brand hit counts
    totals_by_date: dict[str, int] = defaultdict(int)
    hits_by_date_brand: dict[tuple[str, str], int] = defaultdict(int)
    for r in responses:
        date = str(r.timestamp or "")[:10] or "unknown"
        totals_by_date[date] += 1
        hits = mentioned_by_response.get(r.id, set())
        for b_lower in hits:
            hits_by_date_brand[(date, b_lower)] += 1

    dates_sorted = sorted(totals_by_date.keys())

    series: list[dict[str, Any]] = []
    for b_lower, label in brands_lower.items():
        points = []
        for date in dates_sorted:
            total = totals_by_date.get(date, 0) or 0
            hit = hits_by_date_brand.get((date, b_lower), 0) or 0
            pct = round((hit / total) * 100, 1) if total else 0.0
            points.append({"x": date, "y": pct})
        series.append({"id": label, "data": points})

    return {"brands": brands, "series": series}


def _collect_competitor_sources(project_id: int) -> list[str]:
    prompt_ids = [p.id for p in Prompt.query.filter_by(project_id=project_id).all()]
    if not prompt_ids:
        return []

    responses = Response.query.filter(Response.prompt_id.in_(prompt_ids)).all()
    source_count: dict[str, int] = defaultdict(int)
    for response in responses:
        if not _is_analysis_engine(response.engine):
            continue
        for source in _parse_sources(response.sources):
            normalized_source = _normalize_source_url(source)
            if not normalized_source:
                continue
            source_count[normalized_source] += 1

    return [source for source, _count in sorted(source_count.items(), key=lambda item: item[1], reverse=True)]


def _project_context_state(project: Project) -> dict[str, Any]:
    onboarding = project.get_onboarding_data() if hasattr(project, "get_onboarding_data") else {}
    completed_steps = onboarding.get("completed_steps", []) if isinstance(onboarding, dict) else []
    normalized_steps = [int(s) for s in completed_steps if isinstance(s, int) or (isinstance(s, str) and s.isdigit())]
    context_ready = bool(getattr(project, "onboarding_completed", False)) and (3 in normalized_steps or 5 in normalized_steps)
    return {
        "context_ready": context_ready,
        "onboarding_completed": bool(getattr(project, "onboarding_completed", False)),
        "onboarding_current_step": onboarding.get("current_step", 1) if isinstance(onboarding, dict) else 1,
        "onboarding_completed_steps": sorted(set(normalized_steps)),
        "limited_context_reason": "" if context_ready else "Complete onboarding to unlock full context-aware recommendations.",
    }


def generate_trajectory_summary(engine_trends, new_displacers, focus_brand, engine: str = "chatgpt") -> str:
    if not engine_trends and not new_displacers:
        return ""
    trend_text = "\n".join(
        f'{eng}: rank delta {data["rank_delta"]:+.1f}, direction {data["direction"]}'
        for eng, data in engine_trends.items()
    )
    displacer_text = ", ".join(new_displacers) if new_displacers else "none"
    prompt = f'''Write one sentence summarizing the visibility trend for {focus_brand}.
Engine rank changes this period: {trend_text}
New competitors displacing the brand: {displacer_text}
The sentence must be specific - name engines, name competitors, state direction.
Do not use the words: visibility, optimize, improve. Start with the brand name or an engine name.
Return only the sentence, no JSON.'''
    try:
        return chat(engine, prompt, temperature=0.3).strip()
    except Exception:
        return ""


def _compute_trajectory(project_id: int, days_back: int = 14) -> dict:
    project = Project.query.get(project_id)
    focus_brand = project.name if project else ""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_back)).date().isoformat()
    recent = PromptMetric.query.filter(
        PromptMetric.project_id == project_id,
        PromptMetric.run_date >= cutoff,
    ).order_by(PromptMetric.run_date.asc(), PromptMetric.id.asc()).all()
    by_engine: dict[str, list[PromptMetric]] = defaultdict(list)
    for row in recent:
        by_engine[row.engine].append(row)

    engine_trends = {}
    for engine_name, rows in by_engine.items():
        ranked_rows = [row for row in rows if row.rank is not None]
        if len(ranked_rows) < 2:
            continue
        midpoint = max(1, len(ranked_rows) // 2)
        older = ranked_rows[:midpoint]
        newer = ranked_rows[midpoint:]
        old_avg = sum(row.rank for row in older) / len(older)
        new_avg = sum(row.rank for row in newer) / len(newer)
        rank_delta = old_avg - new_avg
        direction = "up" if rank_delta > 0.25 else ("down" if rank_delta < -0.25 else "stable")
        engine_trends[engine_name] = {"rank_delta": round(rank_delta, 2), "direction": direction}

    midpoint_date = (datetime.now(timezone.utc) - timedelta(days=days_back / 2)).date().isoformat()
    older_competitors = {row.top_competitor for row in recent if row.run_date < midpoint_date and row.top_competitor}
    newer_competitors = {row.top_competitor for row in recent if row.run_date >= midpoint_date and row.top_competitor}
    new_displacers = sorted(newer_competitors - older_competitors)

    framing_shifts = []
    for engine_name, rows in by_engine.items():
        frame_rows = [row for row in rows if row.framing]
        if len(frame_rows) < 2:
            continue
        old_framing = frame_rows[0].framing
        new_framing = frame_rows[-1].framing
        if old_framing != new_framing:
            framing_shifts.append({"engine": engine_name, "old_framing": old_framing, "new_framing": new_framing})

    return {
        "engine_trends": engine_trends,
        "new_displacers": new_displacers,
        "framing_shifts": framing_shifts,
        "summary_sentence": generate_trajectory_summary(engine_trends, new_displacers, focus_brand),
    }


def _build_dashboard_payload(project_id: int) -> dict:
    project = Project.query.get(project_id)
    if not project:
        raise NotFoundError("Project not found")

    metrics = VisibilityMetric.query.filter_by(project_id=project_id).order_by(VisibilityMetric.date.asc()).all()
    visibility_trend = [{"date": metric.date, "score": metric.score} for metric in metrics]
    current_score = visibility_trend[-1]["score"] if visibility_trend else 0
    current_visibility_pct = _compute_project_visibility_pct(project_id)
    official_site_stats = _compute_official_site_cited_stats(project_id, project.website_url or "")

    prompt_rankings = _build_prompt_rankings(project_id)
    competitors = _build_competitor_visibility(project_id)
    engine_visibility = _build_engine_focus_visibility(project_id)
    competitor_visibility_trend = _build_competitor_visibility_trend(project_id, days=30, competitor_limit=3)
    raw_project_responses, _raw_by_prompt = _project_raw_response_context(project_id)
    competitor_framings = _project_competitor_framings(project_id)
    project_synthesis = _build_project_synthesis_summary(project_id, project.user_id)
    recommendations = generate_recommendations(
        focus_brand=project.name,
        raw_responses=raw_project_responses,
        competitor_framings=competitor_framings,
        synthesis=project_synthesis,
    )
    context_state = _project_context_state(project)
    trajectory = _compute_trajectory(project_id)
    insight = ProjectInsight.query.filter_by(project_id=project_id).first()

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "category": project.category,
            "region": project.region,
            "website_url": project.website_url,
            "competitors": project.get_competitors_list(),
            "onboarding_completed": context_state["onboarding_completed"],
            "onboarding_current_step": context_state["onboarding_current_step"],
            "onboarding_completed_steps": context_state["onboarding_completed_steps"],
            "context_ready": context_state["context_ready"],
        },
        "visibility_pct_current": current_visibility_pct,
        "quality_score_current": current_score,
        "quality_score_trend": visibility_trend,
        "current_visibility_score": current_score,  # Backward compatibility
        "visibility_trend": visibility_trend,  # Backward compatibility
        "official_site_cited_pct": official_site_stats["official_site_cited_pct"],
        "official_site_cited_count": official_site_stats["official_site_cited_count"],
        "official_site_responses_total": official_site_stats["official_site_responses_total"],
        "prompt_rankings": prompt_rankings,
        "competitors": competitors,
        "engine_visibility": engine_visibility,
        "competitor_visibility_trend": competitor_visibility_trend,
        "recommendations": recommendations,
        "trajectory": trajectory,
        "project_insight": {
            "insight_text": insight.insight_text if insight else "",
            "recurring_adjectives": json.loads(insight.recurring_adjectives or "[]") if insight else [],
            "consistent_competitors": json.loads(insight.consistent_competitors or "[]") if insight else [],
            "framing_pattern": insight.framing_pattern if insight else "",
            "generated_at": insight.generated_at if insight else "",
        },
        "context_state": context_state,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _build_deep_analysis_payload(project_id: int) -> dict:
    project = Project.query.get(project_id)
    if not project:
        raise NotFoundError("Project not found")

    prompts = Prompt.query.filter_by(project_id=project_id).all()
    prompt_rows: list[dict] = []
    llm_summary: dict[str, dict] = defaultdict(
        lambda: {
            "responses": 0,
            "focus_mentions": 0,
            "ranks": [],
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "not_mentioned": 0,
            "sources": defaultdict(int),
        }
    )

    source_by_llm: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    source_global: dict[str, int] = defaultdict(int)

    all_latest_responses: list[Response] = []
    responses_by_prompt: dict[int, list[Response]] = defaultdict(list)
    for prompt in prompts:
        latest = _latest_responses_by_prompt(prompt.id)
        responses_by_prompt[prompt.id] = latest
        all_latest_responses.extend(latest)

    all_resp_ids = [r.id for r in all_latest_responses]
    mentions_by_resp: dict[int, list[Mention]] = defaultdict(list)
    if all_resp_ids:
        for m in Mention.query.filter(Mention.response_id.in_(all_resp_ids)).all():
            mentions_by_resp[m.response_id].append(m)

    for prompt in prompts:
        latest_responses = responses_by_prompt[prompt.id]
        llm_result: dict[str, dict] = {}

        for response in latest_responses:
            mentions = mentions_by_resp.get(response.id, [])
            focus_mention = next((m for m in mentions if m.is_focus), None)
            sentiment = focus_mention.sentiment if focus_mention else "not_mentioned"
            rank = focus_mention.rank if focus_mention else None
            mentioned = focus_mention is not None
            sources = _parse_sources(response.sources)

            llm_result[response.engine] = {
                "mentioned": mentioned,
                "rank": rank,
                "sentiment": sentiment,
                "sources": sources,
                "top_competitors": [
                    {"brand": m.brand, "rank": m.rank}
                    for m in mentions
                    if not m.is_focus
                    and not is_spurious_brand_mention(m.brand or "")
                    and not _looks_like_channel_noise(m.brand or "", m.context or "")
                    and not _looks_like_spec_phrase(m.brand or "")
                ][:5],
                "response_id": response.id,
            }

            summary = llm_summary[response.engine]
            summary["responses"] += 1
            if mentioned:
                summary["focus_mentions"] += 1
                if rank is not None:
                    summary["ranks"].append(rank)
                if sentiment in {"positive", "neutral", "negative"}:
                    summary[sentiment] += 1
            else:
                summary["not_mentioned"] += 1

            for source in sources:
                normalized = _normalize_source_url(source)
                if not normalized:
                    continue
                domain = _domain_from_url(normalized)
                source_key = domain or normalized
                summary["sources"][source_key] += 1
                source_by_llm[response.engine][source_key] += 1
                source_global[source_key] += 1

        prompt_rows.append(
            {
                "prompt_id": prompt.id,
                "prompt_text": prompt.prompt_text,
                "prompt_type": prompt.prompt_type,
                "country": prompt.country,
                "tags": prompt.get_tags(),
                "selected_models": prompt.get_models(),
                "is_active": prompt.is_active,
                "engines": llm_result,
            }
        )

    llm_rows = []
    for llm, summary in llm_summary.items():
        avg_rank = round(sum(summary["ranks"]) / len(summary["ranks"]), 2) if summary["ranks"] else None
        mention_rate = round((summary["focus_mentions"] / summary["responses"]) * 100, 1) if summary["responses"] else 0
        llm_rows.append(
            {
                "llm": llm,
                "mention_rate": mention_rate,
                "avg_rank": avg_rank,
                "positive": summary["positive"],
                "neutral": summary["neutral"],
                "negative": summary["negative"],
                "not_mentioned": summary["not_mentioned"],
                "top_sources": [
                    {"source": source, "count": count}
                    for source, count in sorted(summary["sources"].items(), key=lambda item: item[1], reverse=True)[:8]
                ],
            }
        )

    llm_rows.sort(key=lambda item: item["mention_rate"], reverse=True)

    missing_prompts = []
    for prompt_row in prompt_rows:
        mentioned_anywhere = any(engine_data.get("mentioned") for engine_data in prompt_row["engines"].values())
        if not mentioned_anywhere:
            missing_prompts.append(prompt_row["prompt_text"])

    upload_targets = [
        {"source": source, "count": count}
        for source, count in sorted(source_global.items(), key=lambda item: item[1], reverse=True)[:12]
    ]

    search_intel = {"enabled": is_perplexity_search_enabled(), "domains": [], "queries": []}
    if search_intel["enabled"]:
        candidate_queries = []
        candidate_queries.extend(missing_prompts[:3])
        if not candidate_queries:
            candidate_queries.extend([row["prompt_text"] for row in prompt_rows[:3]])

        domain_counts: dict[str, int] = defaultdict(int)
        query_rows = []
        for query in candidate_queries[:3]:
            result = search_web(query=query, max_results=5, max_tokens_per_page=320)
            query_rows.append(
                {
                    "query": query,
                    "ok": result.get("ok", False),
                    "result_count": len(result.get("results", [])),
                }
            )
            for item in result.get("results", []):
                domain = _domain_from_url(item.get("url", ""))
                if domain:
                    domain_counts[domain] += 1

        search_intel["retrieval_points"] = []
        for query in candidate_queries[:3]:
            # Try to fetch from persisted research if possible
            p = Prompt.query.filter_by(project_id=project_id, prompt_text=query).first()
            if p:
                r_resp = _latest_research_response(p.id)
                if r_resp:
                    try:
                        r_data = json.loads(r_resp.response_text)
                        for src in r_data.get("sources", [])[:5]:
                            search_intel["retrieval_points"].append({
                                "domain": src.get("domain"),
                                "title": src.get("title"),
                                "url": src.get("url"),
                                "query": query
                            })
                    except Exception:
                        pass

        if search_intel["retrieval_points"]:
            deduped_points = []
            seen_points = set()
            for point in search_intel["retrieval_points"]:
                key = (
                    str(point.get("url") or "").strip(),
                    str(point.get("query") or "").strip().lower(),
                    str(point.get("title") or "").strip().lower(),
                )
                if key in seen_points:
                    continue
                seen_points.add(key)
                deduped_points.append(point)
            search_intel["retrieval_points"] = deduped_points[:15]

        search_intel["domains"] = [
            {"domain": domain, "count": count}
            for domain, count in sorted(domain_counts.items(), key=lambda item: item[1], reverse=True)[:10]
        ]
        search_intel["queries"] = query_rows

    project_synthesis = _build_project_synthesis_summary(project_id, project.user_id)
    raw_project_responses, _raw_by_prompt = _project_raw_response_context(project_id)
    competitor_framings = _project_competitor_framings(project_id)
    action_plan = generate_strategic_action_plan(
        focus_brand=project.name,
        project_name=project.name,
        missing_prompts=missing_prompts,
        llm_rows=llm_rows,
        upload_targets=upload_targets,
        search_intel=search_intel,
        synthesis=project_synthesis,
        raw_responses=raw_project_responses,
        competitor_framings=competitor_framings,
    )
    context_state = _project_context_state(project)

    return {
        "project_id": project.id,
        "project_name": project.name,
        "prompt_matrix": prompt_rows,
        "llm_summary": llm_rows,
        "upload_targets": upload_targets,
        "search_intel": search_intel,
        "missing_prompts": missing_prompts,
        "action_plan": action_plan,
        "context_state": context_state,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@reports_bp.route("/project/<int:project_id>/dashboard", methods=["GET"])
@require_auth
def get_dashboard_metrics(project_id):
    _get_project_for_user(project_id)
    cache_key = f"dashboard:v2:{project_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)
    payload = _build_dashboard_payload(project_id)
    _cache_set(cache_key, payload)
    return jsonify(payload)


@reports_bp.route("/project/<int:project_id>/intel-summary", methods=["GET"])
@require_auth
def get_project_intel_summary(project_id):
    project = _get_project_for_user(project_id)

    dashboard = _build_dashboard_payload(project_id)
    prompt_rankings = dashboard.get("prompt_rankings", [])
    analyzed_prompt_count = sum(1 for row in prompt_rankings if (row.get("engines_analyzed") or 0) > 0)

    if analyzed_prompt_count == 0:
        return jsonify(
            {
                "overall_health": "No data",
                "executive_summary": "No prompt runs yet. Run analysis to see a summary from your data.",
                "strategic_roadmap": [],
                "competitive_threats": [],
                "top_priority_prompts": [],
                "has_data": False,
            }
        )

    project_meta = {
        "name": project.name,
        "category": project.category,
        "region": project.region
    }
    computed_health = _compute_overall_health(prompt_rankings)
    summary = generate_project_summary(project.name, project_meta, prompt_rankings)

    # Final safety: enforce label from metric-derived logic.
    if not isinstance(summary, dict):
        summary = {}
    summary["overall_health"] = computed_health
    summary["has_data"] = True
    return jsonify(summary)


@reports_bp.route("/project/<int:project_id>/global-audit", methods=["GET"])
@require_auth
def get_project_global_audit(project_id):
    project = _get_project_for_user(project_id)

    prompts = Prompt.query.filter_by(project_id=project_id).all()
    all_raw_responses: dict[str, dict[str, str]] = {}
    for p in prompts:
        raw = _raw_responses_for_prompt(p.id, limit=4)
        if raw:
            all_raw_responses[p.prompt_text] = raw

    global_audit = generate_global_audit(project.name, all_raw_responses, _project_competitor_framings(project_id))
    return jsonify(global_audit)


@reports_bp.route("/project/<int:project_id>/actions/playbook", methods=["POST"])
@require_auth
def generate_project_action_playbook(project_id):
    project = _get_project_for_user(project_id)

    data = request.json or {}
    title = data.get("title", "")
    detail = data.get("detail", "")
    if not title and not detail:
        return jsonify({"error": "title or detail is required"}), 400

    # Strategic Action Plan playbooks always use OpenAI (ChatGPT) — not the Execution Center model.
    playbook = generate_action_playbook(
        focus_brand=project.name,
        action_title=title,
        action_detail=detail,
        industry=project.category or "",
        engine="chatgpt",
    )
    return jsonify(playbook)


@reports_bp.route("/project/<int:project_id>/actions/execute", methods=["POST"])
@require_auth
def execute_project_action(project_id):
    project = _get_project_for_user(project_id)

    data = request.json or {}
    directive = str(data.get("directive") or "").strip()
    content_type = str(data.get("content_type") or "Article").strip()
    query = str(data.get("query") or "").strip()

    if not directive:
        return jsonify({"error": "Directive is required"}), 400
    if len(directive) > MAX_EXECUTION_DIRECTIVE_CHARS:
        return jsonify({"error": f"Directive is too long (max {MAX_EXECUTION_DIRECTIVE_CHARS} characters)"}), 400
    if content_type not in ALLOWED_CONTENT_TYPES:
        return jsonify({"error": "content_type must be one of: Article, Blog, Reddit Post"}), 400

    # Gather context for content generation
    competitors = project.get_competitors_list()
    context_data = {
        "query": query,
        "competitors": competitors,
        "industry": project.category
    }

    engine = str(data.get("model") or "gemini").strip().lower()
    if engine not in ALLOWED_EXECUTION_MODELS:
        return jsonify({"error": "model must be one of: chatgpt, deepseek, perplexity, gemini, claude"}), 400
    content = generate_content_piece(project.name, directive, content_type, context_data, engine=engine)
    return jsonify(content)


@reports_bp.route("/project/<int:project_id>/deep-analysis", methods=["GET"])
@require_auth
def get_deep_analysis(project_id):
    _get_project_for_user(project_id)
    payload = _get_or_build_deep_analysis_payload(project_id)
    return jsonify(payload)


@reports_bp.route("/project/<int:project_id>/export.csv", methods=["GET"])
@require_auth
def export_project_csv(project_id):
    _get_project_for_user(project_id)
    payload = _build_dashboard_payload(project_id)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Answrdeck AI Visibility Report"])
    writer.writerow(["Project", payload["project"]["name"]])
    writer.writerow(["Generated At", payload["updated_at"]])
    writer.writerow(["Current Visibility Score", payload["current_visibility_score"]])
    writer.writerow([])

    writer.writerow(["Prompt Rankings"])
    writer.writerow(["Prompt", "Average Rank", "Engines Analyzed"])
    for row in payload["prompt_rankings"]:
        writer.writerow([row["prompt_text"], row["avg_rank"] if row["avg_rank"] is not None else "Not mentioned", row["engines_analyzed"]])

    writer.writerow([])
    writer.writerow(["Competitor Visibility"])
    writer.writerow(["Brand", "Visibility Score", "Mentions", "Average Rank", "Focus Brand"])
    for row in payload["competitors"]:
        writer.writerow([row["brand"], row["visibility_score"], row["mentions"], row["avg_rank"] if row["avg_rank"] is not None else "-", "Yes" if row["is_focus"] else "No"])

    content = output.getvalue()
    output.close()

    return FlaskResponse(
        content,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=answrdeck_project_{project_id}.csv"},
    )


@reports_bp.route("/project/<int:project_id>/export.pdf", methods=["GET"])
@require_auth
def export_project_pdf(project_id):
    _get_project_for_user(project_id)
    payload = _build_dashboard_payload(project_id)

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except Exception:
        # Fallback to plain text when reportlab is unavailable.
        text = (
            f"Answrdeck AI Visibility Report\n"
            f"Project: {payload['project']['name']}\n"
            f"Current Score: {payload['current_visibility_score']}\n"
            f"Generated: {payload['updated_at']}\n"
        )
        return FlaskResponse(
            text,
            mimetype="text/plain",
            headers={"Content-Disposition": f"attachment; filename=answrdeck_project_{project_id}.txt"},
        )

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 40

    def write_line(line: str, offset: int = 16):
        nonlocal y
        if y < 50:
            pdf.showPage()
            y = height - 40
        pdf.drawString(40, y, line[:120])
        y -= offset

    pdf.setTitle(f"Answrdeck Report - {payload['project']['name']}")
    pdf.setFont("Helvetica-Bold", 14)
    write_line("Answrdeck AI Visibility Report", 22)
    pdf.setFont("Helvetica", 11)
    write_line(f"Project: {payload['project']['name']}")
    write_line(f"Current Visibility Score: {payload['current_visibility_score']}")
    write_line(f"Generated: {payload['updated_at']}")
    write_line("", 12)

    pdf.setFont("Helvetica-Bold", 12)
    write_line("Prompt Rankings", 18)
    pdf.setFont("Helvetica", 10)
    for row in payload["prompt_rankings"]:
        rank = f"#{row['avg_rank']}" if row["avg_rank"] is not None else "Not mentioned"
        write_line(f"- {row['prompt_text']} | {rank} | engines: {row['engines_analyzed']}")

    write_line("", 12)
    pdf.setFont("Helvetica-Bold", 12)
    write_line("Competitor Visibility", 18)
    pdf.setFont("Helvetica", 10)
    for row in payload["competitors"]:
        write_line(f"- {row['brand']}: score {row['visibility_score']}, mentions {row['mentions']}, avg rank {row['avg_rank'] or '-'}")

    write_line("", 12)
    pdf.setFont("Helvetica-Bold", 12)
    write_line("Recommendations", 18)
    pdf.setFont("Helvetica", 10)
    write_line(payload["recommendations"]["recommendation_text"])

    pdf.save()
    buffer.seek(0)

    return FlaskResponse(
        buffer.getvalue(),
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=answrdeck_project_{project_id}.pdf"},
    )


@reports_bp.route("/project/<int:project_id>/prompt-analysis", methods=["GET"])
@require_auth
def prompt_analysis_table(project_id):
    _get_project_for_user(project_id)
    payload = _get_or_build_deep_analysis_payload(project_id)
    rows = []
    for prompt_row in payload["prompt_matrix"]:
        engines = prompt_row.get("engines", {})
        engine_items = list(engines.items())
        analyzed = len(engine_items)
        mention_count = sum(1 for _, item in engine_items if item.get("mentioned"))
        visibility_pct = round((mention_count / analyzed) * 100, 1) if analyzed else 0.0
        focus_mentions = [
            {
                "is_focus": bool(item.get("mentioned")),
                "rank": item.get("rank"),
                "sentiment": item.get("sentiment", "not_mentioned"),
            }
            for _, item in engine_items
        ]
        quality_score = calculate_visibility_score(focus_mentions, analyzed)
        ranked = [item.get("rank") for _, item in engine_items if item.get("rank") is not None]
        avg_rank = round(sum(ranked) / len(ranked), 2) if ranked else None
        sentiments = [item.get("sentiment", "not_mentioned") for _, item in engine_items]
        primary_sentiment = "not_mentioned"
        if sentiments:
            primary_sentiment = max(set(sentiments), key=sentiments.count)

        rows.append(
            {
                "prompt_id": prompt_row["prompt_id"],
                "prompt_text": prompt_row["prompt_text"],
                "prompt_type": prompt_row["prompt_type"],
                "country": prompt_row["country"],
                "tags": prompt_row["tags"],
                "models": [engine for engine, _ in engine_items],
                "visibility_pct": visibility_pct,
                "quality_score": quality_score,
                "visibility": visibility_pct,  # Backward compatibility
                "sentiment": primary_sentiment,
                "avg_rank": avg_rank,
                "engines_analyzed": analyzed,
                "is_active": prompt_row["is_active"],
            }
        )

    rows.sort(key=lambda row: row["prompt_text"].lower())
    return jsonify({"rows": rows, "count": len(rows), "generated_at": payload["generated_at"]})


@reports_bp.route("/prompt/<int:prompt_id>/detail", methods=["GET"])
@require_auth
def prompt_detail(prompt_id):
    prompt = Prompt.query.filter_by(id=prompt_id).first()
    if not prompt:
        raise NotFoundError("Prompt not found")
    project = Project.query.filter_by(id=prompt.project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Prompt not found")
    return jsonify(_build_prompt_detail_payload(prompt_id))


@reports_bp.route("/project/<int:project_id>/sources", methods=["GET"])
@require_auth
def sources_intelligence(project_id):
    project = _get_project_for_user(project_id)

    prompts = Prompt.query.filter_by(project_id=project_id).all()
    prompt_text_by_id = {prompt.id: prompt.prompt_text for prompt in prompts}

    domain_count: dict[str, int] = defaultdict(int)
    urls_by_domain: dict[str, list[str]] = defaultdict(list)
    mentions_by_domain: dict[str, int] = defaultdict(int)
    domain_queries: dict[str, str] = {}
    engine_responses_for_domains: dict[str, str] = {}

    all_source_responses: list[Response] = []
    for prompt in prompts:
        all_source_responses.extend(_latest_responses_by_prompt(prompt.id))

    src_resp_ids = [r.id for r in all_source_responses]
    mention_counts_by_resp: dict[int, int] = defaultdict(int)
    if src_resp_ids:
        for m in Mention.query.filter(Mention.response_id.in_(src_resp_ids)).all():
            mention_counts_by_resp[m.response_id] += 1

    for response in all_source_responses:
        if response.response_text:
            key = f"{response.engine}:{response.prompt_id}"
            engine_responses_for_domains[key] = response.response_text
        if response.response_text and response.response_text.startswith("[") and "error:" in response.response_text.lower()[:80]:
            continue
        sources = _parse_sources(response.sources)
        domains_seen_this_response: set[str] = set()
        for source in sources:
            normalized_source = _normalize_source_url(source)
            if not normalized_source:
                continue
            domain = _domain_from_url(normalized_source)
            if not domain:
                continue
            domain_count[domain] += 1
            if len(urls_by_domain[domain]) < 20:
                if normalized_source not in urls_by_domain[domain]:
                    urls_by_domain[domain].append(normalized_source)
            domains_seen_this_response.add(domain)
            domain_queries.setdefault(domain, prompt_text_by_id.get(response.prompt_id, "tracked project prompts"))

        mention_count = mention_counts_by_resp.get(response.id, 0)
        for domain in domains_seen_this_response:
            mentions_by_domain[domain] += mention_count

    domains = []
    for domain, count in sorted(domain_count.items(), key=lambda item: item[1], reverse=True):
        domains.append(
            {
                "domain": domain,
                "source_mentions": count,
                "brand_mentions": mentions_by_domain.get(domain, 0),
                "links": urls_by_domain.get(domain, []),
            }
        )
    project_host = _project_website_host(project.website_url or "")
    competitors = {c.lower() for c in project.get_competitors_list()}
    strict_sources = []
    for row in domains[:15]:
        domain = row["domain"]
        links = row.get("links", [])
        domain_insight = _generate_domain_insight(
            domain=domain,
            focus_brand=project.name,
            query=domain_queries.get(domain, "tracked project prompts"),
            engine_responses=engine_responses_for_domains,
        )
        if _host_is_under_base(domain, project_host):
            source_class = "Owned"
        elif any(comp in domain.lower() for comp in competitors if comp):
            source_class = "Competitor"
        elif any(token in domain.lower() for token in ("reddit", "x.com", "facebook", "linkedin", "youtube")):
            source_class = "Social"
        elif any(token in domain.lower() for token in ("wikipedia", "quora", "stack", "medium", "github")):
            source_class = "UGC"
        else:
            source_class = "Editorial"
        strict_sources.append(
            {
                "domain": domain,
                "source_class": source_class,
                "why_it_matters": domain_insight.get("why_it_matters", ""),
                "evidence": f"Cited {row.get('source_mentions', 0)} time(s); your brand {row.get('brand_mentions', 0)} time(s) in that context.",
                "action": domain_insight.get("action", ""),
                "priority": "high" if row.get("source_mentions", 0) >= 4 else ("medium" if row.get("source_mentions", 0) >= 2 else "low"),
                "confidence": 0.86,
                "source_count": int(row.get("source_mentions", 0)),
                "links": links[:10],
                "source_type": "measured",
            }
        )
    return jsonify(
        {
            "domains": domains[:15],
            "sources": strict_sources,
            "count": min(len(domains), 15),
            "context_state": _project_context_state(project),
        }
    )


@reports_bp.route("/project/<int:project_id>/competitors", methods=["GET"])
@require_auth
def competitor_table(project_id):
    project = _get_project_for_user(project_id)
    competitors = _build_competitor_visibility(project_id)
    total = sum(item["visibility_pct"] for item in competitors) or 1
    table = []
    for item in competitors:
        table.append(
            {
                "brand": item["brand"],
                "ai_share": round((item["visibility_pct"] / total) * 100, 2),
                "visibility_pct": item["visibility_pct"],
                "quality_score": item["quality_score"],
                "visibility": item["visibility_pct"],  # Backward compatibility
                "avg_rank": item["avg_rank"],
                "mentions": item["mentions"],
                "rank_score": max(0, min(100, round(100 - ((item["avg_rank"] or 10) * 8), 1))),
                "is_focus": item["is_focus"],
                "is_target_competitor": item.get("is_target_competitor", False),
            }
        )

    return jsonify({"rows": table, "count": len(table), "context_state": _project_context_state(project)})


@reports_bp.route("/overview", methods=["GET"])
@require_auth
def global_overview():
    projects = (
        Project.query.filter_by(user_id=g.user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    if not projects:
        return jsonify({"projects": [], "count": 0})

    project_ids = [p.id for p in projects]

    # Avoid N+1 queries: bulk-load prompt counts + latest metric per project.
    prompt_counts = dict(
        db.session.query(Prompt.project_id, func.count(Prompt.id))
        .filter(Prompt.project_id.in_(project_ids))
        .group_by(Prompt.project_id)
        .all()
    )

    latest_dates_subq = (
        db.session.query(
            VisibilityMetric.project_id.label("project_id"),
            func.max(VisibilityMetric.date).label("max_date"),
        )
        .filter(VisibilityMetric.project_id.in_(project_ids))
        .group_by(VisibilityMetric.project_id)
        .subquery()
    )

    latest_metrics = {
        row.project_id: {"score": row.score, "date": row.date}
        for row in (
            db.session.query(VisibilityMetric.project_id, VisibilityMetric.score, VisibilityMetric.date)
            .join(
                latest_dates_subq,
                (VisibilityMetric.project_id == latest_dates_subq.c.project_id)
                & (VisibilityMetric.date == latest_dates_subq.c.max_date),
            )
            .all()
        )
    }

    rows = []
    for project in projects:
        metric = latest_metrics.get(project.id) or {}
        rows.append(
            {
                "project_id": project.id,
                "name": project.name,
                "category": project.category,
                "region": project.region,
                "current_score": metric.get("score", 0) or 0,
                "tracked_prompts": int(prompt_counts.get(project.id, 0) or 0),
                "updated_at": metric.get("date"),
            }
        )

    rows.sort(key=lambda item: item["current_score"], reverse=True)
    return jsonify({"projects": rows, "count": len(rows)})
