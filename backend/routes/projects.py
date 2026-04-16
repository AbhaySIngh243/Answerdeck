"""
routes/projects.py
CRUD for brand projects.
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime
import json
import re
from urllib.parse import urlparse
from models import db, Project, Prompt, Response, Mention
from schemas import (
    ProjectCreateSchema,
    ProjectUpdateSchema,
    OnboardingStepSchema,
    OnboardingSuggestionSchema,
    OnboardingAssistantSchema,
)
from pydantic import ValidationError as PydanticValidationError
from exceptions import NotFoundError, ValidationError
from auth import require_auth
from billing.entitlements import get_limits
from engine.prompt_suggestions import generate_competitor_suggestions, generate_project_prompt_suggestions
from engine.onboarding_assistant import generate_assistant_payload

projects_bp = Blueprint("projects", __name__)

ONBOARDING_MAX_STEP = 5
# Legacy projects were only required to complete 3 steps. We still treat those
# as "done" so existing users aren't bumped back into onboarding.
ONBOARDING_LEGACY_COMPLETE_STEPS = frozenset({3, 5})


def _parse_competitors(value):
    """Always return competitors as a JSON string for DB storage."""
    if isinstance(value, list):
        return json.dumps(value)
    if isinstance(value, str):
        try:
            json.loads(value)  # validate
            return value
        except Exception:
            return json.dumps([value])
    return json.dumps([])


def _parse_list(value):
    if isinstance(value, list):
        return json.dumps(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return json.dumps(parsed)
        except Exception:
            return json.dumps([value])
    return json.dumps([])


def _normalize_website_url(value):
    raw = (value or "").strip()
    if not raw:
        return ""
    with_protocol = raw if "://" in raw else f"https://{raw}"
    try:
        parsed = urlparse(with_protocol)
        if not parsed.netloc:
            return raw
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path or ''}"
        return normalized.rstrip("/")
    except Exception:
        return raw


def _default_onboarding(project: Project | None = None) -> dict:
    if not project:
        return {
            "current_step": 1,
            "completed_steps": [],
            "steps": {
                "1": {"brand_name": "", "domain": "", "industry": "", "region": "", "competitors": []},
                "2": {"competitors": [], "competitor_notes": {}},
                "3": {
                    "seed_prompts": [],
                    "prompt_stages": {},
                    "funnel_stage": "awareness",
                },
                "4": {
                    "target_engines": ["chatgpt", "claude", "perplexity", "deepseek"],
                    "search_provider": "auto",
                },
                "5": {"acknowledged": False},
            },
        }

    domain = ""
    if project.website_url:
        try:
            parsed = urlparse(project.website_url if "://" in project.website_url else f"https://{project.website_url}")
            domain = parsed.netloc or parsed.path or ""
        except Exception:
            domain = project.website_url
    base = _default_onboarding(None)
    base["steps"]["1"] = {
        "brand_name": project.name or "",
        "domain": domain,
        "industry": project.category or "",
        "region": project.region or "",
        "competitors": project.get_competitors_list(),
    }
    return base


def _merge_onboarding(existing: dict, incoming: dict, step: int) -> dict:
    payload = existing if isinstance(existing, dict) else {}
    if "steps" not in payload or not isinstance(payload.get("steps"), dict):
        payload = _default_onboarding(None)
    step_key = str(step)
    current = payload["steps"].get(step_key) if isinstance(payload["steps"].get(step_key), dict) else {}
    cleaned_incoming = incoming if isinstance(incoming, dict) else {}
    merged = {**current, **cleaned_incoming}
    payload["steps"][step_key] = merged

    completed_steps = payload.get("completed_steps")
    if not isinstance(completed_steps, list):
        completed_steps = []
    if step not in completed_steps:
        completed_steps.append(step)
    completed_steps = sorted({int(s) for s in completed_steps if isinstance(s, (int, float, str)) and str(s).isdigit()})
    payload["completed_steps"] = completed_steps
    payload["current_step"] = min(ONBOARDING_MAX_STEP, max([1] + [s + 1 for s in completed_steps if s < ONBOARDING_MAX_STEP]))
    return payload


def _validate_step_required(step: int, step_data: dict):
    required_by_step = {
        1: ("brand_name", "domain", "industry", "region", "competitors"),
        2: ("competitors",),
        3: ("seed_prompts",),
        4: ("target_engines",),
        5: (),
    }
    required_fields = required_by_step.get(step, ())
    missing = []
    for field in required_fields:
        value = step_data.get(field)
        if value is None:
            missing.append(field)
            continue
        if isinstance(value, str) and not value.strip():
            missing.append(field)
            continue
        if isinstance(value, list) and len(value) == 0:
            missing.append(field)
            continue
    if missing:
        raise ValidationError(f"Missing required fields for step {step}: {', '.join(missing)}")


def _extract_competitor_suggestions(project: Project, max_items: int = 8) -> list[str]:
    prompts = Prompt.query.filter_by(project_id=project.id).all()
    prompt_ids = [p.id for p in prompts]
    if not prompt_ids:
        return []
    responses = Response.query.filter(Response.prompt_id.in_(prompt_ids)).order_by(Response.timestamp.desc()).limit(200).all()
    response_ids = [r.id for r in responses]
    if not response_ids:
        return []
    existing = {c.lower() for c in project.get_competitors_list()}
    existing.add((project.name or "").lower())
    candidates: dict[str, int] = {}
    for mention in Mention.query.filter(Mention.response_id.in_(response_ids), Mention.is_focus.is_(False)).all():
        label = str(mention.brand or "").strip()
        if not label:
            continue
        if len(re.findall(r"[A-Za-z]", label)) < 2:
            continue
        if label.lower() in existing:
            continue
        candidates[label] = candidates.get(label, 0) + 1
    ranked = [brand for brand, _count in sorted(candidates.items(), key=lambda item: item[1], reverse=True)]
    return ranked[:max_items]


def _project_payload(p: Project):
    onboarding = p.get_onboarding_data() if hasattr(p, "get_onboarding_data") else {}
    completed_steps = onboarding.get("completed_steps") if isinstance(onboarding, dict) else []
    completed_steps = [int(s) for s in completed_steps if isinstance(s, int) or (isinstance(s, str) and s.isdigit())]
    context_ready = bool(getattr(p, "onboarding_completed", False)) and bool(
        ONBOARDING_LEGACY_COMPLETE_STEPS.intersection(completed_steps)
    )
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "competitors": p.get_competitors_list(),
        "region": p.region,
        "website_url": p.website_url,
        "collaborators": p.get_collaborators_list(),
        "created_at": p.created_at,
        "onboarding_completed": bool(getattr(p, "onboarding_completed", False)),
        "onboarding_current_step": onboarding.get("current_step", 1) if isinstance(onboarding, dict) else 1,
        "onboarding_completed_steps": sorted(set(completed_steps)),
        "context_ready": context_ready,
    }


@projects_bp.route("/", methods=["GET"])
@require_auth
def get_projects():
    # Filter by user_id
    projects = Project.query.filter_by(user_id=g.user.id).order_by(Project.created_at.desc()).all()
    return jsonify([_project_payload(p) for p in projects])


@projects_bp.route("/<int:project_id>", methods=["GET"])
@require_auth
def get_project(project_id):
    # Filter by user_id
    p = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not p:
        raise NotFoundError("Project not found")
        
    payload = _project_payload(p)
    payload["onboarding"] = p.get_onboarding_data() if hasattr(p, "get_onboarding_data") else {}
    return jsonify(payload)


@projects_bp.route("/", methods=["POST"])
@require_auth
def create_project():
    max_projects, _ = get_limits(g.user.id)
    count = Project.query.filter_by(user_id=g.user.id).count()
    if count >= max_projects:
        raise ValidationError(
            f"Maximum {max_projects} projects for your plan. Upgrade in Settings or delete a project to create a new one."
        )
    data = request.get_json(force=True) or {}
    try:
        validated = ProjectCreateSchema(**data)
    except PydanticValidationError as e:
        raise ValidationError(payload=e.errors())
        
    competitors = _parse_competitors(validated.competitors)
    normalized_website = _normalize_website_url(validated.website_url)
    new_project = Project(
        user_id=g.user.id, # Assign owner
        name=validated.name,
        category=validated.category,
        competitors=competitors,
        region=validated.region,
        website_url=normalized_website,
        collaborators=_parse_list(validated.collaborators),
        onboarding_completed=False,
        created_at=datetime.now().isoformat()
    )
    onboarding = _default_onboarding(None)
    onboarding["steps"]["1"] = {
        "brand_name": validated.name,
        "domain": normalized_website,
        "industry": validated.category or "",
        "region": validated.region or "",
        "competitors": validated.competitors or [],
    }
    new_project.set_onboarding_data(onboarding)
    db.session.add(new_project)
    db.session.commit()
    return jsonify({"id": new_project.id, "message": "Project created successfully"}), 201


@projects_bp.route("/<int:project_id>", methods=["PUT", "PATCH"])
@require_auth
def update_project(project_id):
    # Filter by user_id
    p = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not p:
        raise NotFoundError("Project not found")

    data = request.get_json(force=True) or {}
    try:
        validated = ProjectUpdateSchema(**data)
    except PydanticValidationError as e:
        raise ValidationError(payload=e.errors())

    if validated.name is not None:
        p.name = validated.name
    if validated.category is not None:
        p.category = validated.category
    if validated.competitors is not None:
        p.competitors = _parse_competitors(validated.competitors)
    if validated.region is not None:
        p.region = validated.region
    if validated.website_url is not None:
        p.website_url = _normalize_website_url(validated.website_url)
    if validated.collaborators is not None:
        p.collaborators = _parse_list(validated.collaborators)

    onboarding = p.get_onboarding_data()
    steps = onboarding.get("steps", {}) if isinstance(onboarding, dict) else {}
    step1 = steps.get("1", {}) if isinstance(steps.get("1"), dict) else {}
    if validated.name is not None:
        step1["brand_name"] = validated.name
    if validated.category is not None:
        step1["industry"] = validated.category
    if validated.region is not None:
        step1["region"] = validated.region
    if validated.website_url is not None:
        step1["domain"] = p.website_url
    if validated.competitors is not None:
        step1["competitors"] = validated.competitors
    if isinstance(onboarding, dict):
        onboarding.setdefault("steps", {})
        onboarding["steps"]["1"] = step1
        p.set_onboarding_data(onboarding)

    db.session.commit()
    return jsonify({"message": "Project updated successfully"})


@projects_bp.route("/<int:project_id>", methods=["DELETE"])
@require_auth
def delete_project(project_id):
    # Filter by user_id
    p = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if p:
        db.session.delete(p)
        db.session.commit()
    return jsonify({"message": "Project deleted successfully"})


@projects_bp.route("/<int:project_id>/invite", methods=["POST"])
@require_auth
def invite_collaborator(project_id):
    # Filter by user_id
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    data = request.get_json(force=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise ValidationError("Valid email is required")

    collaborators = project.get_collaborators_list()
    if email not in collaborators:
        collaborators.append(email)
        project.collaborators = json.dumps(collaborators)
        db.session.commit()

    invite_link = f"{request.host_url.rstrip('/')}/dashboard/project/{project_id}"
    return jsonify({"message": "Collaborator invited", "email": email, "invite_link": invite_link, "collaborators": collaborators})


@projects_bp.route("/<int:project_id>/onboarding/step", methods=["PATCH"])
@require_auth
def update_onboarding_step(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    body = request.get_json(force=True) or {}
    try:
        validated = OnboardingStepSchema(**body)
    except PydanticValidationError as e:
        raise ValidationError(payload=e.errors())

    step = int(validated.step)
    incoming = dict(validated.data or {})
    _validate_step_required(step, incoming)

    onboarding = project.get_onboarding_data()
    merged = _merge_onboarding(onboarding, incoming, step)
    project.set_onboarding_data(merged)

    step1 = merged.get("steps", {}).get("1", {})
    if isinstance(step1, dict):
        if step1.get("brand_name"):
            project.name = str(step1.get("brand_name")).strip()
        if step1.get("industry") is not None:
            project.category = str(step1.get("industry") or "").strip()
        if step1.get("region") is not None:
            project.region = str(step1.get("region") or "").strip()
        if step1.get("domain"):
            project.website_url = _normalize_website_url(str(step1.get("domain")))
        if isinstance(step1.get("competitors"), list):
            project.competitors = _parse_competitors(step1.get("competitors"))

    completed = merged.get("completed_steps", [])
    project.onboarding_completed = bool(ONBOARDING_LEGACY_COMPLETE_STEPS.intersection(completed))
    db.session.commit()
    return jsonify(
        {
            "message": f"Step {step} saved",
            "project": _project_payload(project),
            "onboarding": project.get_onboarding_data(),
        }
    )


@projects_bp.route("/<int:project_id>/onboarding/suggestions", methods=["POST"])
@require_auth
def onboarding_suggestions(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    body = request.get_json(force=True) or {}
    try:
        validated = OnboardingSuggestionSchema(**body)
    except PydanticValidationError as e:
        raise ValidationError(payload=e.errors())

    ctx_name = str(validated.brand_name or "").strip() or project.name
    ctx_domain = str(validated.domain or "").strip() or project.website_url
    ctx_industry = str(validated.industry or "").strip() or project.category
    ctx_region = str(validated.region or "").strip() or project.region
    ctx_competitors = validated.competitors if validated.competitors else project.get_competitors_list()

    project_ctx = {
        "name": ctx_name,
        "category": ctx_industry,
        "region": ctx_region,
        "website_url": ctx_domain,
        "competitors": ctx_competitors,
    }

    prompt_payload = generate_project_prompt_suggestions(project_ctx, max_prompts=5)

    ai_competitors = _extract_competitor_suggestions(project, max_items=8)
    if not ai_competitors:
        ai_competitors = generate_competitor_suggestions(project_ctx, max_items=6)

    return jsonify(
        {
            "suggested_prompts": prompt_payload.get("prompts", []),
            "prompt_source": prompt_payload.get("source", "unknown"),
            "suggested_competitors": ai_competitors,
        }
    )


@projects_bp.route("/<int:project_id>/onboarding/complete", methods=["POST"])
@require_auth
def complete_onboarding(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")
    onboarding = project.get_onboarding_data()
    if not isinstance(onboarding, dict):
        onboarding = _default_onboarding(project)

    steps = onboarding.get("steps", {})

    # Back-compat: if step3 has no seed_prompts but legacy step2 does, migrate.
    step2_legacy = steps.get("2", {}) if isinstance(steps.get("2"), dict) else {}
    step3 = steps.get("3", {}) if isinstance(steps.get("3"), dict) else {}
    if not step3.get("seed_prompts") and isinstance(step2_legacy.get("seed_prompts"), list):
        step3 = dict(step3)
        step3["seed_prompts"] = step2_legacy.get("seed_prompts") or []
        if not step3.get("funnel_stage"):
            step3["funnel_stage"] = step2_legacy.get("funnel_stage") or "awareness"
        steps["3"] = step3

    for idx in range(1, ONBOARDING_MAX_STEP + 1):
        data = steps.get(str(idx), {})
        if not isinstance(data, dict):
            raise ValidationError(f"Step {idx} is incomplete")
        _validate_step_required(idx, data)

    onboarding["completed_steps"] = sorted(set([1, 2, 3, 4, 5]))
    onboarding["current_step"] = ONBOARDING_MAX_STEP
    onboarding["steps"] = steps
    project.set_onboarding_data(onboarding)
    project.onboarding_completed = True

    step1 = steps.get("1", {})
    step2 = steps.get("2", {})
    step4 = steps.get("4", {}) if isinstance(steps.get("4"), dict) else {}

    # Step 1 competitors always win (the base list the user confirmed), but
    # we merge step 2 additions on top for the final stored list.
    merged_competitors: list[str] = []
    seen_c: set[str] = set()
    for raw in list(step1.get("competitors") or []) + list(step2.get("competitors") or []):
        text = str(raw or "").strip()
        key = text.lower()
        if not text or key in seen_c:
            continue
        seen_c.add(key)
        merged_competitors.append(text)
    if merged_competitors:
        project.competitors = _parse_competitors(merged_competitors)

    seed_prompts = step3.get("seed_prompts", []) if isinstance(step3, dict) else []
    target_engines = step4.get("target_engines", []) if isinstance(step4, dict) else []
    if isinstance(seed_prompts, list) and seed_prompts:
        existing_texts = {
            p.prompt_text.strip().lower()
            for p in Prompt.query.filter_by(project_id=project.id, user_id=g.user.id).all()
        }
        now = datetime.now().isoformat()
        for text in seed_prompts[:20]:
            cleaned = str(text).strip()
            if not cleaned or cleaned.lower() in existing_texts:
                continue
            existing_texts.add(cleaned.lower())
            db.session.add(Prompt(
                user_id=g.user.id,
                project_id=project.id,
                prompt_text=cleaned,
                prompt_type="Onboarding",
                selected_models=json.dumps(target_engines if isinstance(target_engines, list) else []),
                created_at=now,
            ))

    db.session.commit()
    return jsonify({"message": "Onboarding completed", "project": _project_payload(project)})


@projects_bp.route("/<int:project_id>/assistant", methods=["POST"])
@require_auth
def onboarding_assistant(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")
    body = request.get_json(force=True) or {}
    try:
        validated = OnboardingAssistantSchema(**body)
    except PydanticValidationError as exc:
        raise ValidationError(payload=exc.errors())

    context = dict(validated.context or {})
    context.setdefault("brand_name", project.name or "")
    context.setdefault("domain", project.website_url or "")
    context.setdefault("industry", project.category or "")
    context.setdefault("region", project.region or "")
    context.setdefault("competitors", project.get_competitors_list())

    payload = generate_assistant_payload(
        step=int(validated.step),
        context=context,
        question=str(validated.question or "").strip(),
    )
    return jsonify(payload)


@projects_bp.route("/<int:project_id>/suggested-prompts", methods=["GET"])
@require_auth
def get_project_suggested_prompts(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    payload = generate_project_prompt_suggestions(
        {
            "name": project.name,
            "category": project.category,
            "region": project.region,
            "website_url": project.website_url,
            "competitors": project.get_competitors_list(),
        },
        max_prompts=3,
    )
    return jsonify(payload)
