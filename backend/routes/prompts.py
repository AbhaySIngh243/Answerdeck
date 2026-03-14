"""CRUD for prompts within a project."""

import json
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from pydantic import ValidationError as PydanticValidationError

from exceptions import NotFoundError, ValidationError
from models import Prompt, Project, db
from schemas import PromptCreateSchema, PromptUpdateSchema

prompts_bp = Blueprint("prompts", __name__)


def _json_list(values):
    if values is None:
        return "[]"
    if isinstance(values, list):
        return json.dumps(values)
    return "[]"


@prompts_bp.route("/project/<int:project_id>", methods=["GET"])
def get_prompts(project_id):
    prompts = Prompt.query.filter_by(project_id=project_id).order_by(Prompt.created_at.desc()).all()
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
def get_prompt(prompt_id):
    prompt = Prompt.query.get(prompt_id)
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
def add_prompt(project_id):
    project = Project.query.get(project_id)
    if not project:
        raise NotFoundError("Project not found")

    data = request.get_json(force=True) or {}
    try:
        validated = PromptCreateSchema(**data)
    except PydanticValidationError as exc:
        raise ValidationError(payload=exc.errors())

    new_prompt = Prompt(
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
def update_prompt(prompt_id):
    prompt = Prompt.query.get(prompt_id)
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
def delete_prompt(prompt_id):
    prompt = Prompt.query.get(prompt_id)
    if prompt:
        db.session.delete(prompt)
        db.session.commit()
    return jsonify({"message": "Prompt deleted successfully"})