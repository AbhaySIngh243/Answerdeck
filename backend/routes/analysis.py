"""Analysis routes and background execution pipeline."""

import os
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from flask import Blueprint, current_app, jsonify, request, g

from engine.analyzer import (
    analyze_single_response,
    build_focus_brand_aliases,
    build_competitor_comparison,
    calculate_visibility_score,
    generate_positioning_insights,
    is_focus_brand_match,
    is_spurious_brand_mention,
    research_prompt_sources,
)
from engine.llm_clients import get_available_engine_catalog, query_engines
from exceptions import NotFoundError
from extensions import executor
from models import AnalysisJob, Mention, Project, Prompt, Response, VisibilityMetric, db
from auth import require_auth

analysis_bp = Blueprint("analysis", __name__)

MAX_CONCURRENT_JOBS_PER_USER = int(os.getenv("MAX_CONCURRENT_JOBS_PER_USER", "3"))
MAX_CONCURRENT_JOBS_GLOBAL = int(os.getenv("MAX_CONCURRENT_JOBS_GLOBAL", "8"))
MAX_QUEUED_JOBS_GLOBAL = int(os.getenv("MAX_QUEUED_JOBS_GLOBAL", "24"))
PENDING_JOB_TIMEOUT_MINUTES = int(os.getenv("PENDING_JOB_TIMEOUT_MINUTES", "15"))
RUNNING_JOB_TIMEOUT_MINUTES = int(os.getenv("RUNNING_JOB_TIMEOUT_MINUTES", "25"))


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


def async_run_analysis(job_id: str, prompt_id: int, project_id: int, user_id: str, app_obj) -> None:
    """Background task that queries engines and persists results."""
    started_at = _now_iso()

    try:
        with app_obj.app_context():
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

            selected_models = prompt.get_models()
            raw_responses = query_engines(prompt.prompt_text, selected_models=selected_models)
            if not raw_responses:
                if job:
                    job.status = "failed"
                    job.error = "No LLM engines configured. Add API keys for ChatGPT/Perplexity/Gemini/Claude/DeepSeek."
                    job.completed_at = _now_iso()
                    db.session.commit()
                return

            focus_brand = project.name
            focus_brand_aliases = build_focus_brand_aliases(project.name, project.website_url)
            competitor_brands = project.get_competitors_list()
            analyses: dict[str, dict] = {}
            all_focus_mentions: list[dict] = []

            for engine_name, response_text in raw_responses.items():
                analysis = analyze_single_response(
                    response_text=response_text,
                    focus_brand=focus_brand,
                    query=prompt.prompt_text,
                    competitor_brands=competitor_brands,
                    focus_brand_aliases=focus_brand_aliases,
                )
                analyses[engine_name] = analysis

                new_response = Response(
                    prompt_id=prompt.id,
                    engine=engine_name,
                    response_text=response_text,
                    sources=json.dumps(analysis.get("sources", [])),
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

            # Perform deep research via Perplexity to find where LLMs scrape data
            research_data = research_prompt_sources(prompt.prompt_text)
            analyses["research_data"] = research_data

            # Save research as a special response for persistence
            research_response = Response(
                prompt_id=prompt.id,
                engine="perplexity_research",
                response_text=json.dumps(research_data),
                sources=json.dumps([s.get("url") for s in research_data.get("sources", []) if s.get("url")]),
                timestamp=_now_iso(),
            )
            db.session.add(research_response)

            insights = generate_positioning_insights(
                focus_brand=focus_brand,
                query=prompt.prompt_text,
                analyses=analyses,
                competitors=competitors,
            )

            db.session.commit()

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
                    for engine, data in analyses.items()
                ],
                "competitors": competitors,
                "sentiment": _build_sentiment_summary(analyses),
                "insights": insights,
                "raw_responses": [
                    {
                        "llm": engine.upper(),
                        "response": text,
                        "sources": analyses[engine].get("sources", []),
                    }
                    for engine, text in raw_responses.items()
                ],
                "timestamp": _now_iso(),
            }

            if job:
                job.status = "completed"
                job.result_json = json.dumps(payload)
                job.completed_at = _now_iso()
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
    executor.submit(async_run_analysis, job_id, prompt.id, project.id, g.user.id, app_obj)

    return jsonify({"job_id": job_id, "message": "Analysis job queued"}), 202


@analysis_bp.route("/run-all/<int:project_id>", methods=["POST"])
@require_auth
def run_all_prompts(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

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
        executor.submit(async_run_analysis, job_id, prompt.id, project.id, g.user.id, app_obj)
        jobs.append({"prompt_id": prompt.id, "job_id": job_id})

    db.session.commit()
    queued = len(jobs)
    extra = max(0, len(prompts) - queued)
    msg = f"Queued {queued} prompt(s)" + (f" (skipped {extra} due to capacity limits)" if extra else "")
    return jsonify({"message": msg, "results": jobs, "skipped": extra}), 202


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

    responses = Response.query.filter_by(prompt_id=prompt.id).order_by(Response.timestamp.desc()).all()
    payload: list[dict] = []

    for response in responses:
        mentions = Mention.query.filter_by(response_id=response.id).all()
        payload.append(
            {
                "id": response.id,
                "prompt_id": response.prompt_id,
                "engine": response.engine,
                "response_text": response.response_text,
                "timestamp": response.timestamp,
                "sources": json.loads(response.sources or "[]"),
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

    return jsonify(
        {
            "prompt_id": prompt.id,
            "prompt_text": prompt.prompt_text,
            "responses": payload,
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
    if not query:
        return jsonify({"error": "query is required"}), 400

    responses = query_engines(query, selected_models=selected_models)
    if not responses:
        return jsonify({"error": "No engines available for test prompt"}), 400

    analyses = {}
    focus_brand_aliases = build_focus_brand_aliases(project.name, project.website_url)
    for engine_name, response_text in responses.items():
        analyses[engine_name] = analyze_single_response(
            response_text=response_text,
            focus_brand=project.name,
            query=query,
            competitor_brands=project.get_competitors_list(),
            focus_brand_aliases=focus_brand_aliases,
        )

    return jsonify(
        {
            "project_id": project.id,
            "query": query,
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


def _build_sentiment_summary(analyses: dict[str, dict]) -> dict[str, Any]:
    mentions = []
    for engine, analysis in analyses.items():
        if engine == "research_data":
            continue
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
