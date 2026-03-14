"""Analysis routes and background execution pipeline."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, current_app, jsonify, request

from engine.analyzer import (
    analyze_single_response,
    build_competitor_comparison,
    calculate_visibility_score,
    generate_positioning_insights,
    research_prompt_sources,
)
from engine.llm_clients import get_available_engine_catalog, query_engines
from exceptions import NotFoundError
from extensions import executor
from models import Mention, Project, Prompt, Response, VisibilityMetric, db

analysis_bp = Blueprint("analysis", __name__)

# In-memory job store. Swap with Redis/job table for distributed workers.
JOB_STATUSES: dict[str, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def async_run_analysis(job_id: str, prompt_id: int, project_id: int, app_obj) -> None:
    """Background task that queries engines and persists results."""
    JOB_STATUSES[job_id] = {"status": "running", "started_at": _now_iso()}

    try:
        with app_obj.app_context():
            prompt = Prompt.query.get(prompt_id)
            project = Project.query.get(project_id)
            if not prompt or not project:
                JOB_STATUSES[job_id] = {"status": "failed", "error": "Prompt or project not found"}
                return

            selected_models = prompt.get_models()
            raw_responses = query_engines(prompt.prompt_text, selected_models=selected_models)
            if not raw_responses:
                JOB_STATUSES[job_id] = {
                    "status": "failed",
                    "error": "No LLM engines configured. Add API keys for ChatGPT/Perplexity/Gemini/Claude/DeepSeek.",
                }
                return

            focus_brand = project.name
            competitor_brands = project.get_competitors_list()
            analyses: dict[str, dict] = {}
            all_focus_mentions: list[dict] = []

            for engine_name, response_text in raw_responses.items():
                analysis = analyze_single_response(
                    response_text=response_text,
                    focus_brand=focus_brand,
                    query=prompt.prompt_text,
                    competitor_brands=competitor_brands,
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
                    if not brand:
                        continue
                    is_focus = brand.lower() == focus_brand.lower()
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

            JOB_STATUSES[job_id] = {
                "status": "completed",
                "completed_at": _now_iso(),
                "result": payload,
            }
    except Exception as exc:  # pragma: no cover - safety path
        try:
            app_obj.logger.exception("analysis job failed", exc_info=exc)
        except Exception:
            pass
        JOB_STATUSES[job_id] = {"status": "failed", "error": str(exc), "completed_at": _now_iso()}


@analysis_bp.route("/run/<int:prompt_id>", methods=["POST"])
def run_analysis(prompt_id):
    prompt = Prompt.query.get(prompt_id)
    if not prompt:
        raise NotFoundError("Prompt not found")

    project = Project.query.get(prompt.project_id)
    if not project:
        raise NotFoundError("Project not found")

    job_id = str(uuid.uuid4())
    JOB_STATUSES[job_id] = {"status": "pending", "created_at": _now_iso()}

    app_obj = current_app._get_current_object()
    executor.submit(async_run_analysis, job_id, prompt.id, project.id, app_obj)

    return jsonify({"job_id": job_id, "message": "Analysis job queued"}), 202


@analysis_bp.route("/run-all/<int:project_id>", methods=["POST"])
def run_all_prompts(project_id):
    project = Project.query.get(project_id)
    if not project:
        raise NotFoundError("Project not found")

    prompts = Prompt.query.filter_by(project_id=project_id).all()
    if not prompts:
        return jsonify({"message": "No prompts found for this project", "results": []}), 200

    app_obj = current_app._get_current_object()
    jobs: list[dict] = []

    for prompt in prompts:
        job_id = str(uuid.uuid4())
        JOB_STATUSES[job_id] = {"status": "pending", "created_at": _now_iso()}
        executor.submit(async_run_analysis, job_id, prompt.id, project.id, app_obj)
        jobs.append({"prompt_id": prompt.id, "job_id": job_id})

    return jsonify({"message": f"Queued {len(prompts)} prompt(s)", "results": jobs}), 202


@analysis_bp.route("/status/<job_id>", methods=["GET"])
def get_job_status(job_id):
    status_info = JOB_STATUSES.get(job_id)
    if not status_info:
        raise NotFoundError("Job not found")
    return jsonify(status_info)


@analysis_bp.route("/results/<int:prompt_id>", methods=["GET"])
def get_results(prompt_id):
    prompt = Prompt.query.get(prompt_id)
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
def run_test_prompt(project_id):
    project = Project.query.get(project_id)
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
    for engine_name, response_text in responses.items():
        analyses[engine_name] = analyze_single_response(
            response_text=response_text,
            focus_brand=project.name,
            query=query,
            competitor_brands=project.get_competitors_list(),
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
