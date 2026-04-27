"""Analysis routes and background execution pipeline."""

import os
import json
import uuid
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from flask import Blueprint, current_app, jsonify, request, g

from engine.analyzer import (
    analyze_single_response,
    build_focus_brand_aliases,
    build_competitor_comparison,
    calculate_visibility_score,
    generate_detailed_audit,
    is_focus_brand_match,
    is_spurious_brand_mention,
)
from engine.brain_pipeline import (
    BrandContext,
    CausalSignals,
    DisplacementEvent,
    _make_fallback_causal_signals,
    decompose_intent,
    detect_drift,
    extract_causal_signals,
    synthesize_evidence,
)
from engine.llm_clients import (
    get_available_engine_catalog,
    get_search_layer_status,
    query_engines,
    set_search_layer_provider,
)
from engine.url_verifier import verify_urls
from exceptions import NotFoundError
from extensions import executor
from models import AnalysisJob, DisplacementRecord, Mention, Project, Prompt, Response, VisibilityMetric, db
from auth import require_auth
from routes.reports import invalidate_project_report_caches

analysis_bp = Blueprint("analysis", __name__)

MAX_CONCURRENT_JOBS_PER_USER = int(os.getenv("MAX_CONCURRENT_JOBS_PER_USER", "3"))
MAX_CONCURRENT_JOBS_GLOBAL = int(os.getenv("MAX_CONCURRENT_JOBS_GLOBAL", "8"))
MAX_QUEUED_JOBS_GLOBAL = int(os.getenv("MAX_QUEUED_JOBS_GLOBAL", "24"))
PENDING_JOB_TIMEOUT_MINUTES = int(os.getenv("PENDING_JOB_TIMEOUT_MINUTES", "15"))
RUNNING_JOB_TIMEOUT_MINUTES = int(os.getenv("RUNNING_JOB_TIMEOUT_MINUTES", "25"))
VALID_SEARCH_PROVIDER_OVERRIDES = {"auto", "serper", "perplexity", "none"}
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


def _merge_variant_signals(engine_name: str, variant_signals: dict[str, CausalSignals]) -> CausalSignals:
    preferred_order = ["direct", "comparative", "use_case"]
    ordered = [variant_signals[k] for k in preferred_order if k in variant_signals]
    if not ordered:
        raise ValueError(f"No variant signals for engine '{engine_name}'")
    primary = variant_signals.get("direct", ordered[0])

    all_details: list[dict[str, Any]] = []
    all_sources: list[str] = []
    evidence_phrases: list[str] = []
    cited_urls: list[str] = []
    cited_domains: list[str] = []
    framing_words: list[str] = []
    displacement_events: list[DisplacementEvent] = []
    seen_event_keys: set[tuple[Any, ...]] = set()

    mentioned_any = False
    mention_ranks: list[int] = []
    mention_context = ""
    mention_sentiment = "not_mentioned"

    for sig in ordered:
        ba = sig.brand_analysis or {}
        for detail in ba.get("all_brand_details", []) or []:
            if isinstance(detail, dict):
                all_details.append(detail)
        for src in ba.get("sources", []) or []:
            src_clean = str(src or "").strip()
            if src_clean and src_clean not in all_sources:
                all_sources.append(src_clean)

        if bool(ba.get("focus_brand_mentioned")):
            mentioned_any = True
            rank_val = ba.get("focus_brand_rank")
            if isinstance(rank_val, int):
                mention_ranks.append(rank_val)
            if not mention_context:
                mention_context = str(ba.get("focus_brand_context") or "")
            if mention_sentiment == "not_mentioned":
                mention_sentiment = str(ba.get("focus_brand_sentiment") or "neutral")

        for phrase in sig.focus_brand_evidence_phrases or []:
            cleaned = str(phrase or "").strip()
            if cleaned and cleaned not in evidence_phrases:
                evidence_phrases.append(cleaned)
        for url in sig.focus_brand_cited_urls or []:
            cleaned = str(url or "").strip()
            if cleaned and cleaned not in cited_urls:
                cited_urls.append(cleaned)
        for dom in sig.cited_source_domains or []:
            cleaned = str(dom or "").strip()
            if cleaned and cleaned not in cited_domains:
                cited_domains.append(cleaned)
        for word in sig.framing_words or []:
            cleaned = str(word or "").strip()
            if cleaned and cleaned not in framing_words:
                framing_words.append(cleaned)
        for ev in sig.competitor_displacement_events or []:
            key = (
                ev.competitor_brand,
                ev.displacement_context,
                ev.displacement_reason,
                ev.rank_of_competitor,
                ev.rank_of_focus,
                ev.cited_url,
            )
            if key in seen_event_keys:
                continue
            seen_event_keys.add(key)
            displacement_events.append(ev)

    merged_brand_analysis = dict(primary.brand_analysis or {})
    merged_brand_analysis["all_brand_details"] = all_details
    merged_brand_analysis["sources"] = all_sources
    merged_brand_analysis["focus_brand_mentioned"] = mentioned_any
    merged_brand_analysis["focus_brand_rank"] = min(mention_ranks) if mention_ranks else None
    merged_brand_analysis["focus_brand_sentiment"] = mention_sentiment
    merged_brand_analysis["focus_brand_context"] = mention_context

    merged_framing = next(
        (sig.focus_brand_framing for sig in ordered if str(sig.focus_brand_framing or "").strip() and sig.focus_brand_framing != "absent"),
        primary.focus_brand_framing,
    )

    return CausalSignals(
        brand_analysis=merged_brand_analysis,
        focus_brand_framing=merged_framing,
        focus_brand_evidence_phrases=evidence_phrases,
        focus_brand_cited_urls=cited_urls,
        competitor_displacement_events=displacement_events,
        cited_source_domains=cited_domains,
        framing_words=framing_words,
        response_structure=primary.response_structure,
        engine=engine_name,
        variant="merged",
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _normalize_search_provider_override(value: Any) -> str | None:
    candidate = str(value or "").strip().lower()
    if not candidate:
        return None
    if candidate not in VALID_SEARCH_PROVIDER_OVERRIDES:
        raise ValueError("search_provider must be one of: auto, serper, perplexity, none")
    if candidate == "auto":
        return None
    return candidate


def _reap_stale_jobs() -> int:
    """Fail stale queued/running jobs so capacity is eventually released."""
    now = datetime.now(timezone.utc)
    stale_count = 0
    active_jobs = AnalysisJob.query.filter(AnalysisJob.status.in_(("pending", "running"))).all()

    for job in active_jobs:
        created = _parse_iso(job.created_at)
        started = _parse_iso(job.started_at)

        is_stale_pending = (
            job.status == "pending"
            and created is not None
            and (now - created) > timedelta(minutes=PENDING_JOB_TIMEOUT_MINUTES)
        )
        is_stale_running = (
            job.status == "running"
            and started is not None
            and (now - started) > timedelta(minutes=RUNNING_JOB_TIMEOUT_MINUTES)
        )

        if is_stale_pending or is_stale_running:
            stale_count += 1
            job.status = "failed"
            job.error = "Job timed out while waiting/running. Please retry."
            job.completed_at = _now_iso()

    if stale_count:
        db.session.commit()
    return stale_count


def _active_job_counts(user_id: str) -> tuple[int, int, int, int]:
    user_running = AnalysisJob.query.filter_by(user_id=user_id, status="running").count()
    user_pending = AnalysisJob.query.filter_by(user_id=user_id, status="pending").count()
    global_running = AnalysisJob.query.filter_by(status="running").count()
    global_pending = AnalysisJob.query.filter_by(status="pending").count()
    return user_running, user_pending, global_running, global_pending


def async_run_analysis(
    job_id: str,
    prompt_id: int,
    project_id: int,
    user_id: str,
    app_obj,
    search_provider_override: str | None = None,
) -> None:
    """Background task that queries engines and persists results."""
    started_at = _now_iso()

    try:
        with app_obj.app_context():
            _dbg("H1", "routes/analysis.py:async_run_analysis", "start", {"job_id": job_id, "prompt_id": prompt_id, "project_id": project_id})
            job = AnalysisJob.query.filter_by(job_id=job_id, user_id=user_id).first()
            if job:
                job.status = "running"
                job.started_at = started_at
                db.session.commit()

            # Ensure filtering by user_id in background too
            prompt = Prompt.query.filter_by(id=prompt_id, user_id=user_id).first()
            project = Project.query.filter_by(id=project_id, user_id=user_id).first()
            
            if not prompt or not project:
                if job:
                    job.status = "failed"
                    job.error = "Prompt or project not found or unauthorized"
                    job.completed_at = _now_iso()
                    db.session.commit()
                return

            brand_context = BrandContext(
                brand_name=project.name,
                competitors=project.get_competitors_list(),
                website_url=project.website_url or "",
                category=project.category or "",
                region=project.region or "",
            )

            intent_context = decompose_intent(
                query=prompt.prompt_text,
                brand=project.name,
                category=project.category or "",
                region=project.region or "",
            )
            _dbg("H2", "routes/analysis.py:async_run_analysis", "intent_context", {"buyer_stage": intent_context.buyer_stage, "variants": intent_context.prompt_variants})

            selected_models = prompt.get_models()
            result = query_engines(
                prompt.prompt_text,
                selected_models=selected_models,
                search_provider_override=search_provider_override,
                intent_context=intent_context,
                brand_context=brand_context,
            )
            raw_responses = result.get("responses", {}) if isinstance(result, dict) else result
            variant_responses = result.get("variant_responses", {}) if isinstance(result, dict) else {}
            search_context = result.get("search_context", {}) if isinstance(result, dict) else {}
            grounding_urls = search_context.get("urls", []) or []

            if not raw_responses:
                if job:
                    job.status = "failed"
                    job.error = "No LLM engines configured. Add API keys for ChatGPT/Perplexity/Gemini/Claude/DeepSeek."
                    job.completed_at = _now_iso()
                    db.session.commit()
                return
            _dbg("H3", "routes/analysis.py:async_run_analysis", "query_engines_ok", {"engine_count": len(raw_responses), "engines": list(raw_responses.keys())})

            focus_brand = project.name
            focus_brand_aliases = build_focus_brand_aliases(project.name, project.website_url)
            competitor_brands = project.get_competitors_list()
            causal_signals_by_engine: dict[str, CausalSignals] = {}
            signals_by_engine_variant: dict[str, dict[str, CausalSignals]] = defaultdict(dict)
            variant_payloads: dict[str, dict[str, str]] = {}
            for eng, direct_text in raw_responses.items():
                per_engine: dict[str, str] = {}
                raw_variants = variant_responses.get(eng, {}) if isinstance(variant_responses, dict) else {}
                if isinstance(raw_variants, dict):
                    for variant_key in ("direct", "comparative", "use_case"):
                        value = raw_variants.get(variant_key)
                        if isinstance(value, str) and value.strip():
                            per_engine[variant_key] = value
                if "direct" not in per_engine and isinstance(direct_text, str) and direct_text.strip():
                    per_engine["direct"] = direct_text
                if per_engine:
                    variant_payloads[eng] = per_engine

            total_variant_jobs = sum(len(rows) for rows in variant_payloads.values())
            with ThreadPoolExecutor(max_workers=max(1, total_variant_jobs)) as pool:
                futures = {}
                for eng, variant_map in variant_payloads.items():
                    for variant_key, text in variant_map.items():
                        futures[
                            pool.submit(
                                extract_causal_signals,
                                text,
                                focus_brand,
                                focus_brand_aliases,
                                competitor_brands,
                                prompt.prompt_text,
                                eng,
                                variant_key,
                            )
                        ] = (eng, variant_key, text)
                for future in as_completed(futures):
                    eng_name, variant_key, text = futures[future]
                    try:
                        signals_by_engine_variant[eng_name][variant_key] = future.result()
                    except Exception as exc:
                        app_obj.logger.warning(
                            "causal extraction failed for %s (%s): %s",
                            eng_name,
                            variant_key,
                            exc,
                        )
                        signals_by_engine_variant[eng_name][variant_key] = _make_fallback_causal_signals(
                            response_text=text,
                            focus_brand=focus_brand,
                            focus_brand_aliases=focus_brand_aliases,
                            competitor_brands=competitor_brands,
                            query=prompt.prompt_text,
                            engine_name=eng_name,
                        )

            for eng_name, variant_map in signals_by_engine_variant.items():
                causal_signals_by_engine[eng_name] = _merge_variant_signals(eng_name, variant_map)

            analyses: dict[str, dict] = {
                eng: signals.brand_analysis for eng, signals in causal_signals_by_engine.items()
            }

            research_data = {
                "sources": search_context.get("sources", []),
                "summary": f"Search grounding via {search_context.get('provider', 'none')}",
                "provider": search_context.get("provider", "none"),
            }
            analyses["research_data"] = research_data

            synthesis = synthesize_evidence(
                causal_signals_by_engine=causal_signals_by_engine,
                focus_brand=focus_brand,
                query=prompt.prompt_text,
                research_data=research_data,
            )
            _dbg("H4", "routes/analysis.py:async_run_analysis", "synthesis", {"consensus_rank": synthesis.consensus_rank, "mentioning": synthesis.engines_mentioning_focus, "not_mentioning": synthesis.engines_not_mentioning_focus})

            drift_report = detect_drift(
                project_id=project.id,
                prompt_id=prompt.id,
                current_synthesis=synthesis,
                db_session=db.session,
            )
            _dbg("H5", "routes/analysis.py:async_run_analysis", "drift", {"velocity": drift_report.velocity, "rank_delta": drift_report.rank_delta, "previous_rank": drift_report.previous_rank, "current_rank": drift_report.current_rank})

            audit_items = generate_detailed_audit(
                focus_brand,
                prompt.prompt_text,
                None,
                synthesis=synthesis,
                known_competitors=competitor_brands,
            )
            _dbg("H6", "routes/analysis.py:async_run_analysis", "audit_items", {"count": len(audit_items), "first_issue": (audit_items[0].get("issue") if audit_items else None)})

            all_focus_mentions: list[dict] = []

            # Collect every URL across all engines + grounding so we can
            # verify reachability in one pooled pass instead of per-engine.
            all_urls_to_verify: list[str] = []
            _seen_urls: set[str] = set()
            for engine_name, response_text in raw_responses.items():
                for url in analyses[engine_name].get("sources", []) or []:
                    if url and url not in _seen_urls:
                        _seen_urls.add(url)
                        all_urls_to_verify.append(url)
            for url in grounding_urls or []:
                if url and url not in _seen_urls:
                    _seen_urls.add(url)
                    all_urls_to_verify.append(url)

            try:
                url_status = verify_urls(all_urls_to_verify) if all_urls_to_verify else {}
            except Exception as exc:
                app_obj.logger.info("URL verification skipped: %s", exc)
                url_status = {}

            def _verified_urls(urls: list[str]) -> list[str]:
                out: list[str] = []
                for raw in urls or []:
                    info = url_status.get(raw) or {}
                    status = info.get("status")
                    if status == "ok":
                        out.append(raw)
                    elif status == "broken":
                        continue
                    else:
                        # unknown (skipped or never probed) — keep but mark upstream.
                        out.append(raw)
                return out

            for engine_name, response_text in raw_responses.items():
                analysis = analyses[engine_name]

                engine_sources = list(_verified_urls(analysis.get("sources", [])))
                for url in _verified_urls(grounding_urls):
                    if url not in engine_sources:
                        engine_sources.append(url)

                new_response = Response(
                    prompt_id=prompt.id,
                    engine=engine_name,
                    response_text=response_text,
                    sources=json.dumps(engine_sources),
                    timestamp=_now_iso(),
                )
                db.session.add(new_response)
                db.session.flush()

                for detail in analysis.get("all_brand_details", []):
                    brand = detail.get("brand", "").strip()
                    if not brand or is_spurious_brand_mention(brand):
                        continue
                    is_focus = is_focus_brand_match(brand, focus_brand_aliases)
                    mention = Mention(
                        response_id=new_response.id,
                        brand=brand,
                        is_focus=is_focus,
                        rank=detail.get("rank"),
                        sentiment=detail.get("sentiment", "neutral"),
                        context=detail.get("context", ""),
                    )
                    db.session.add(mention)
                    if is_focus:
                        all_focus_mentions.append(
                            {
                                "is_focus": True,
                                "rank": detail.get("rank"),
                                "sentiment": detail.get("sentiment", "neutral"),
                            }
                        )

            score = calculate_visibility_score(all_focus_mentions, len(raw_responses))
            today = datetime.now(timezone.utc).date().isoformat()

            existing_metric = VisibilityMetric.query.filter_by(project_id=project.id, date=today).first()
            if existing_metric:
                existing_metric.score = round((existing_metric.score + score) / 2, 1)
            else:
                db.session.add(VisibilityMetric(project_id=project.id, score=score, date=today))

            competitors = build_competitor_comparison(analyses, focus_brand)

            # Persist research grounding as a dedicated *_research response so
            # reporting endpoints can reliably recover structured citations later.
            if search_context.get("ok") and research_data.get("sources"):
                provider_name = str(search_context.get("provider") or "search").strip().lower() or "search"
                provider_name = provider_name.replace(" ", "_")
                research_urls = []
                for src in research_data.get("sources", []):
                    if not isinstance(src, dict):
                        continue
                    url = str(src.get("url") or "").strip()
                    if url and url not in research_urls:
                        research_urls.append(url)
                db.session.add(
                    Response(
                        prompt_id=prompt.id,
                        engine=f"{provider_name}_research",
                        response_text=json.dumps(research_data),
                        sources=json.dumps(research_urls),
                        timestamp=_now_iso(),
                    )
                )

            batch_ts = _now_iso()
            for eng_name, signals in causal_signals_by_engine.items():
                for event in signals.competitor_displacement_events:
                    db.session.add(
                        DisplacementRecord(
                            prompt_id=prompt.id,
                            engine=eng_name,
                            competitor_brand=event.competitor_brand,
                            displacement_context=(event.displacement_context or "")[:500],
                            displacement_reason=(event.displacement_reason or "")[:300],
                            rank_of_competitor=event.rank_of_competitor,
                            rank_of_focus=event.rank_of_focus,
                            cited_url=event.cited_url or "",
                            timestamp=batch_ts,
                        )
                    )

            db.session.commit()
            invalidate_project_report_caches(project_id)

            engine_analyses = {
                engine: data
                for engine, data in analyses.items()
                if engine != "research_data"
            }

            payload = {
                "prompt_id": prompt.id,
                "query": prompt.prompt_text,
                "brand": focus_brand,
                "score_impact": score,
                "llm_visibility": [
                    {
                        "llm": engine.upper(),
                        "mentioned": data.get("focus_brand_mentioned", False),
                        "rank": data.get("focus_brand_rank"),
                        "sentiment": data.get("focus_brand_sentiment", "not_mentioned"),
                        "context": data.get("focus_brand_context", ""),
                    }
                    for engine, data in engine_analyses.items()
                ],
                "competitors": competitors,
                "sentiment": _build_sentiment_summary(engine_analyses),
                "insights": {},
                "raw_responses": [
                    {
                        "llm": engine.upper(),
                        "response": text,
                        "sources": analyses[engine].get("sources", []),
                        "source_status": {
                            url: (url_status.get(url) or {}).get("status", "unknown")
                            for url in analyses[engine].get("sources", [])
                        },
                    }
                    for engine, text in raw_responses.items()
                ],
                "url_status": url_status,
                "timestamp": _now_iso(),
                "intent_context": {
                    "buyer_stage": intent_context.buyer_stage,
                    "comparison_axis": intent_context.comparison_axis,
                    "implicit_question": intent_context.implicit_question,
                    "region_signal": intent_context.region_signal,
                },
                "synthesis": {
                    "engines_mentioning": synthesis.engines_mentioning_focus,
                    "engines_not_mentioning": synthesis.engines_not_mentioning_focus,
                    "consensus_rank": synthesis.consensus_rank,
                    "rank_variance": round(synthesis.rank_variance, 2),
                    "top_displacement_competitors": synthesis.top_displacement_competitors,
                    "recurring_displacement_reasons": synthesis.recurring_displacement_reasons,
                    "top_cited_domains": synthesis.top_cited_domains,
                    "citation_concentration": round(synthesis.citation_concentration, 2),
                    "focus_brand_dominant_framing": synthesis.focus_brand_dominant_framing,
                },
                "audit": audit_items,
                "drift": {
                    "velocity": drift_report.velocity,
                    "rank_delta": drift_report.rank_delta,
                    "mention_rate_delta": drift_report.mention_rate_delta,
                    "new_displacing_competitors": drift_report.new_displacing_competitors,
                    "lost_displacing_competitors": drift_report.lost_displacing_competitors,
                    "framing_shift": drift_report.framing_shift,
                    "previous_rank": drift_report.previous_rank,
                    "current_rank": drift_report.current_rank,
                },
            }

            if job:
                job.status = "completed"
                job.result_json = json.dumps(payload)
                job.completed_at = _now_iso()
                job.synthesis_json = json.dumps(payload.get("synthesis") or {})
                job.drift_json = json.dumps(payload.get("drift") or {})
                db.session.commit()
    except Exception as exc:  # pragma: no cover - safety path
        try:
            app_obj.logger.exception("analysis job failed", exc_info=exc)
        except Exception:
            pass
        try:
            with app_obj.app_context():
                job = AnalysisJob.query.filter_by(job_id=job_id, user_id=user_id).first()
                if job:
                    job.status = "failed"
                    job.error = str(exc)
                    job.completed_at = _now_iso()
                    db.session.commit()
        except Exception:
            pass


@analysis_bp.route("/run/<int:prompt_id>", methods=["POST"])
@require_auth
def run_analysis(prompt_id):
    prompt = Prompt.query.filter_by(id=prompt_id, user_id=g.user.id).first()
    if not prompt:
        raise NotFoundError("Prompt not found")

    project = Project.query.filter_by(id=prompt.project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    data = request.get_json(silent=True) or {}
    try:
        search_provider_override = _normalize_search_provider_override(data.get("search_provider"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    _reap_stale_jobs()
    user_running, user_pending, global_running, global_pending = _active_job_counts(g.user.id)
    if user_running + user_pending >= MAX_CONCURRENT_JOBS_PER_USER:
        response = jsonify({"error": "Too many queued jobs. Please wait for current analysis to finish."})
        response.headers["Retry-After"] = "20"
        return response, 429
    if global_running >= MAX_CONCURRENT_JOBS_GLOBAL or (global_running + global_pending) >= MAX_QUEUED_JOBS_GLOBAL:
        response = jsonify({"error": "Server is busy processing analyses. Please retry shortly."})
        response.headers["Retry-After"] = "30"
        return response, 503

    job_id = str(uuid.uuid4())
    created_at = _now_iso()
    db.session.add(
        AnalysisJob(
            job_id=job_id,
            user_id=g.user.id,
            project_id=project.id,
            prompt_id=prompt.id,
            status="pending",
            created_at=created_at,
        )
    )
    db.session.commit()

    app_obj = current_app._get_current_object()
    executor.submit(
        async_run_analysis,
        job_id,
        prompt.id,
        project.id,
        g.user.id,
        app_obj,
        search_provider_override,
    )

    return jsonify(
        {
            "job_id": job_id,
            "message": "Analysis job queued",
            "search_provider": search_provider_override or "auto",
        }
    ), 202


@analysis_bp.route("/run-all/<int:project_id>", methods=["POST"])
@require_auth
def run_all_prompts(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    data = request.get_json(silent=True) or {}
    try:
        search_provider_override = _normalize_search_provider_override(data.get("search_provider"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    prompts = Prompt.query.filter_by(project_id=project_id, user_id=g.user.id).all()
    if not prompts:
        return jsonify({"message": "No prompts found for this project", "results": []}), 200

    _reap_stale_jobs()
    user_running, user_pending, global_running, global_pending = _active_job_counts(g.user.id)
    available_user_slots = max(0, MAX_CONCURRENT_JOBS_PER_USER - (user_running + user_pending))
    available_global_queue_slots = max(0, MAX_QUEUED_JOBS_GLOBAL - (global_running + global_pending))
    available_global_running_slots = max(0, MAX_CONCURRENT_JOBS_GLOBAL - global_running)
    available_slots = min(available_user_slots, available_global_queue_slots, available_global_running_slots)
    if available_slots <= 0:
        if available_user_slots <= 0:
            response = jsonify({"error": "Too many queued jobs. Please wait for current analysis to finish."})
            response.headers["Retry-After"] = "20"
            return response, 429
        response = jsonify({"error": "Server is busy processing analyses. Please retry shortly."})
        response.headers["Retry-After"] = "30"
        return response, 503

    app_obj = current_app._get_current_object()
    jobs: list[dict] = []
    queued_items: list[tuple[str, int]] = []

    created_at = _now_iso()
    for prompt in prompts[:available_slots]:
        job_id = str(uuid.uuid4())
        db.session.add(
            AnalysisJob(
                job_id=job_id,
                user_id=g.user.id,
                project_id=project.id,
                prompt_id=prompt.id,
                status="pending",
                created_at=created_at,
            )
        )
        jobs.append({"prompt_id": prompt.id, "job_id": job_id})
        queued_items.append((job_id, prompt.id))

    db.session.commit()

    # Submit only after jobs are committed so worker threads always see persisted rows.
    for job_id, prompt_id in queued_items:
        executor.submit(
            async_run_analysis,
            job_id,
            prompt_id,
            project.id,
            g.user.id,
            app_obj,
            search_provider_override,
        )

    queued = len(jobs)
    extra = max(0, len(prompts) - queued)
    msg = f"Queued {queued} prompt(s)" + (f" (skipped {extra} due to capacity limits)" if extra else "")
    return jsonify(
        {
            "message": msg,
            "results": jobs,
            "skipped": extra,
            "search_provider": search_provider_override or "auto",
        }
    ), 202


@analysis_bp.route("/status/<job_id>", methods=["GET"])
@require_auth
def get_job_status(job_id):
    job = AnalysisJob.query.filter_by(job_id=job_id, user_id=g.user.id).first()
    if not job:
        raise NotFoundError("Job not found")
    payload: dict[str, Any] = {
        "job_id": job.job_id,
        "status": job.status,
        "created_at": job.created_at,
        "started_at": job.started_at or None,
        "completed_at": job.completed_at or None,
    }
    if job.status == "failed":
        payload["error"] = job.error or "Job failed"
    if job.status == "completed":
        try:
            payload["result"] = json.loads(job.result_json or "{}")
        except Exception:
            payload["result"] = {}
    return jsonify(payload)


@analysis_bp.route("/results/<int:prompt_id>", methods=["GET"])
@require_auth
def get_results(prompt_id):
    prompt = Prompt.query.filter_by(id=prompt_id, user_id=g.user.id).first()
    if not prompt:
        raise NotFoundError("Prompt not found")

    selected_models = prompt.get_models() if hasattr(prompt, "get_models") else []
    selected_lower = {m.strip().lower() for m in selected_models if m and m.strip()}

    responses = Response.query.filter_by(prompt_id=prompt.id).order_by(Response.timestamp.desc()).all()
    payload: list[dict] = []

    all_sources: list[str] = []
    _seen_src: set[str] = set()

    for response in responses:
        engine_lower = (response.engine or "").strip().lower()
        if engine_lower.endswith("_research"):
            continue
        if selected_lower and engine_lower not in selected_lower:
            continue

        mentions = Mention.query.filter_by(response_id=response.id).all()
        sources = json.loads(response.sources or "[]")
        for url in sources:
            if url not in _seen_src:
                _seen_src.add(url)
                all_sources.append(url)
        payload.append(
            {
                "id": response.id,
                "prompt_id": response.prompt_id,
                "engine": response.engine,
                "response_text": response.response_text,
                "timestamp": response.timestamp,
                "sources": sources,
                "mentions": [
                    {
                        "brand": mention.brand,
                        "is_focus": mention.is_focus,
                        "rank": mention.rank,
                        "sentiment": mention.sentiment,
                        "context": mention.context,
                    }
                    for mention in mentions
                ],
            }
        )

    # Only read the cache — never probe here, so the UI never waits.
    try:
        url_status = verify_urls(all_sources, allow_network=False) if all_sources else {}
    except Exception:
        url_status = {}

    for row in payload:
        row["source_status"] = {
            url: (url_status.get(url) or {}).get("status", "unknown")
            for url in row.get("sources", [])
        }

    return jsonify(
        {
            "prompt_id": prompt.id,
            "prompt_text": prompt.prompt_text,
            "responses": payload,
            "url_status": url_status,
        }
    )


@analysis_bp.route("/engines", methods=["GET"])
@require_auth
def list_engines():
    catalog = get_available_engine_catalog()
    enabled = [item for item in catalog if item["enabled"]]
    return jsonify(
        {
            "enabled_engines": [{"id": item["id"], "name": item["name"], "model": item["model"]} for item in enabled],
            "available_engines": catalog,
            "search_layer": get_search_layer_status(),
            "count": len(enabled),
        }
    )


@analysis_bp.route("/test/<int:project_id>", methods=["POST"])
@require_auth
def run_test_prompt(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    selected_models = data.get("selected_models") or []
    try:
        search_provider_override = _normalize_search_provider_override(data.get("search_provider"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if not query:
        return jsonify({"error": "query is required"}), 400

    result = query_engines(
        query,
        selected_models=selected_models,
        search_provider_override=search_provider_override,
    )
    responses = result.get("responses", {}) if isinstance(result, dict) else result
    if not responses:
        return jsonify({"error": "No engines available for test prompt"}), 400

    analyses = {}
    focus_brand_aliases = build_focus_brand_aliases(project.name, project.website_url)
    competitor_brands = project.get_competitors_list()

    def _test_extract(eng, text):
        return eng, analyze_single_response(
            response_text=text,
            focus_brand=project.name,
            query=query,
            competitor_brands=competitor_brands,
            focus_brand_aliases=focus_brand_aliases,
        )

    with ThreadPoolExecutor(max_workers=max(1, len(responses))) as pool:
        futures = {pool.submit(_test_extract, e, t): e for e, t in responses.items()}
        for future in as_completed(futures):
            eng_name, analysis = future.result()
            analyses[eng_name] = analysis

    return jsonify(
        {
            "project_id": project.id,
            "query": query,
            "search_provider": search_provider_override or "auto",
            "results": [
                {
                    "engine": engine,
                    "response_text": text,
                    "analysis": analyses.get(engine, {}),
                }
                for engine, text in responses.items()
            ],
            "sentiment_summary": _build_sentiment_summary(analyses),
            "timestamp": _now_iso(),
        }
    )


@analysis_bp.route("/search-layer", methods=["GET"])
@require_auth
def get_search_layer():
    return jsonify(get_search_layer_status())


@analysis_bp.route("/search-layer", methods=["POST"])
@require_auth
def set_search_layer():
    data = request.get_json(silent=True) or {}
    provider = str(data.get("provider") or "auto").strip().lower()
    if provider not in VALID_SEARCH_PROVIDER_OVERRIDES:
        return jsonify({"error": "provider must be one of: auto, serper, perplexity, none"}), 400
    status = set_search_layer_provider(provider)
    return jsonify(status)


def _build_sentiment_summary(analyses: dict[str, dict]) -> dict[str, Any]:
    mentions = []
    for engine, analysis in analyses.items():
        if analysis.get("focus_brand_mentioned"):
            mentions.append(
                {
                    "source": engine.upper(),
                    "sentiment": analysis.get("focus_brand_sentiment", "neutral"),
                    "text": analysis.get("focus_brand_context", ""),
                }
            )

    positive = sum(1 for m in mentions if m["sentiment"] == "positive")
    neutral = sum(1 for m in mentions if m["sentiment"] == "neutral")
    negative = sum(1 for m in mentions if m["sentiment"] == "negative")

    return {
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "not_mentioned": max(0, len(analyses) - len(mentions)),
        "mentions": [m for m in mentions if m["text"]],
    }
