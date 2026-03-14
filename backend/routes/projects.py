"""
routes/projects.py
CRUD for brand projects.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
import json
from models import db, Project
from schemas import ProjectCreateSchema, ProjectUpdateSchema
from pydantic import ValidationError as PydanticValidationError
from exceptions import NotFoundError, ValidationError

projects_bp = Blueprint("projects", __name__)


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


@projects_bp.route("/", methods=["GET"])
def get_projects():
    projects = Project.query.order_by(Project.created_at.desc()).all()
    result = []
    for p in projects:
        data = {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "competitors": p.get_competitors_list(),
            "region": p.region,
            "website_url": p.website_url,
            "collaborators": p.get_collaborators_list(),
            "created_at": p.created_at
        }
        result.append(data)
    return jsonify(result)


@projects_bp.route("/<int:project_id>", methods=["GET"])
def get_project(project_id):
    p = Project.query.get(project_id)
    if not p:
        raise NotFoundError("Project not found")
        
    data = {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "competitors": p.get_competitors_list(),
        "region": p.region,
        "website_url": p.website_url,
        "collaborators": p.get_collaborators_list(),
        "created_at": p.created_at
    }
    return jsonify(data)


@projects_bp.route("/", methods=["POST"])
def create_project():
    data = request.get_json(force=True) or {}
    try:
        validated = ProjectCreateSchema(**data)
    except PydanticValidationError as e:
        raise ValidationError(payload=e.errors())
        
    competitors = _parse_competitors(validated.competitors)
    new_project = Project(
        name=validated.name,
        category=validated.category,
        competitors=competitors,
        region=validated.region,
        website_url=validated.website_url,
        collaborators=_parse_list(validated.collaborators),
        created_at=datetime.now().isoformat()
    )
    db.session.add(new_project)
    db.session.commit()
    return jsonify({"id": new_project.id, "message": "Project created successfully"}), 201


@projects_bp.route("/<int:project_id>", methods=["PUT", "PATCH"])
def update_project(project_id):
    p = Project.query.get(project_id)
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
        p.website_url = validated.website_url
    if validated.collaborators is not None:
        p.collaborators = _parse_list(validated.collaborators)

    db.session.commit()
    return jsonify({"message": "Project updated successfully"})


@projects_bp.route("/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    p = Project.query.get(project_id)
    if p:
        db.session.delete(p)
        db.session.commit()
    return jsonify({"message": "Project deleted successfully"})


@projects_bp.route("/<int:project_id>/invite", methods=["POST"])
def invite_collaborator(project_id):
    project = Project.query.get(project_id)
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
