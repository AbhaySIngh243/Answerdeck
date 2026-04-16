"""CRUD for prompts within a project."""

import json
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, g
from pydantic import ValidationError as PydanticValidationError

from exceptions import NotFoundError, ValidationError
from models import Prompt, Project, db
from schemas import PromptCreateSchema, PromptUpdateSchema, PromptAssistantSchema
from auth import require_auth
from billing.entitlements import get_limits
from engine.onboarding_assistant import rewrite_prompt

prompts_bp = Blueprint("prompts", __name__)


def _json_list(values):
    if values is None:
        return "[]"
    if isinstance(values, list):
        return json.dumps(values)
    return "[]"


@prompts_bp.route("/project/<int:project_id>", methods=["GET"])
@require_auth
def get_prompts(project_id):
    # Ensure project belongs to user
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")

    prompts = Prompt.query.filter_by(project_id=project_id, user_id=g.user.id).order_by(Prompt.created_at.desc()).all()
    return jsonify(
        [
            {
                "id": p.id,
                "project_id": p.project_id,
                "prompt_text": p.prompt_text,
                "prompt_type": p.prompt_type,
                "country": p.country,
                "tags": p.get_tags(),
                "selected_models": p.get_models(),
                "is_active": p.is_active,
                "created_at": p.created_at,
            }
            for p in prompts
        ]
    )


@prompts_bp.route("/<int:prompt_id>", methods=["GET"])
@require_auth
def get_prompt(prompt_id):
    prompt = Prompt.query.filter_by(id=prompt_id, user_id=g.user.id).first()
    if not prompt:
        raise NotFoundError("Prompt not found")
    return jsonify(
        {
            "id": prompt.id,
            "project_id": prompt.project_id,
            "prompt_text": prompt.prompt_text,
            "prompt_type": prompt.prompt_type,
            "country": prompt.country,
            "tags": prompt.get_tags(),
            "selected_models": prompt.get_models(),
            "is_active": prompt.is_active,
            "created_at": prompt.created_at,
        }
    )


@prompts_bp.route("/project/<int:project_id>", methods=["POST"])
@require_auth
def add_prompt(project_id):
    project = Project.query.filter_by(id=project_id, user_id=g.user.id).first()
    if not project:
        raise NotFoundError("Project not found")
    _, max_prompts = get_limits(g.user.id)
    prompt_count = Prompt.query.filter_by(project_id=project_id).count()
    if prompt_count >= max_prompts:
        raise ValidationError(
            f"Maximum {max_prompts} prompts per project on your plan. Delete a prompt or upgrade to add more."
        )
    data = request.get_json(force=True) or {}
    try:
        validated = PromptCreateSchema(**data)
    except PydanticValidationError as exc:
        raise ValidationError(payload=exc.errors())

    new_prompt = Prompt(
        user_id=g.user.id,
        project_id=project_id,
        prompt_text=validated.prompt_text,
        prompt_type=validated.prompt_type or "Manual",
        country=validated.country or project.region or "",
        tags=_json_list(validated.tags),
        selected_models=_json_list(validated.selected_models),
        is_active=True if validated.is_active is None else bool(validated.is_active),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.session.add(new_prompt)
    db.session.commit()

    return jsonify({"id": new_prompt.id, "message": "Prompt added successfully"}), 201


@prompts_bp.route("/<int:prompt_id>", methods=["PUT", "PATCH"])
@require_auth
def update_prompt(prompt_id):
    prompt = Prompt.query.filter_by(id=prompt_id, user_id=g.user.id).first()
    if not prompt:
        raise NotFoundError("Prompt not found")

    data = request.get_json(force=True) or {}
    try:
        validated = PromptUpdateSchema(**data)
    except PydanticValidationError as exc:
        raise ValidationError(payload=exc.errors())

    if validated.prompt_text is not None:
        prompt.prompt_text = validated.prompt_text
    if validated.prompt_type is not None:
        prompt.prompt_type = validated.prompt_type
    if validated.country is not None:
        prompt.country = validated.country
    if validated.tags is not None:
        prompt.tags = _json_list(validated.tags)
    if validated.selected_models is not None:
        prompt.selected_models = _json_list(validated.selected_models)
    if validated.is_active is not None:
        prompt.is_active = bool(validated.is_active)

    db.session.commit()
    return jsonify({"message": "Prompt updated successfully"})


@prompts_bp.route("/<int:prompt_id>", methods=["DELETE"])
@require_auth
def delete_prompt(prompt_id):
    prompt = Prompt.query.filter_by(id=prompt_id, user_id=g.user.id).first()
    if prompt:
        db.session.delete(prompt)
        db.session.commit()
    return jsonify({"message": "Prompt deleted successfully"})


@prompts_bp.route("/<int:prompt_id>/assistant", methods=["POST"])
@require_auth
def improve_prompt(prompt_id):
    """Rewrite a prompt more crisply and return alternatives."""
    prompt = Prompt.query.filter_by(id=prompt_id, user_id=g.user.id).first()
    if not prompt:
        raise NotFoundError("Prompt not found")
    project = Project.query.filter_by(id=prompt.project_id, user_id=g.user.id).first()

    data = request.get_json(silent=True) or {}
    try:
        validated = PromptAssistantSchema(**data)
    except Exception:
        validated = PromptAssistantSchema()

    payload = rewrite_prompt(
        prompt_text=validated.prompt_text or prompt.prompt_text,
        focus_brand=validated.focus_brand or (project.name if project else ""),
        industry=validated.industry or (project.category if project else ""),
        funnel_stage=validated.funnel_stage or "",
    )
    return jsonify(payload)


@prompts_bp.route("/assistant/draft", methods=["POST"])
@require_auth
def draft_prompt():
    """Draft a brand-new prompt (no existing prompt_id) from hints."""
    data = request.get_json(force=True) or {}
    try:
        validated = PromptAssistantSchema(**data)
    except Exception:
        validated = PromptAssistantSchema()
    payload = rewrite_prompt(
        prompt_text=validated.prompt_text or "Best options in this category",
        focus_brand=validated.focus_brand or "",
        industry=validated.industry or "",
        funnel_stage=validated.funnel_stage or "",
    )
    return jsonify(payload)