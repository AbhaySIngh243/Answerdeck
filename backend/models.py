from flask_sqlalchemy import SQLAlchemy
import json
import re

db = SQLAlchemy()

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String, nullable=False, index=True) # Linked to Supabase Auth user.id
    name = db.Column(db.String, nullable=False)
    category = db.Column(db.String, default="")
    competitors = db.Column(db.String, default="[]")
    region = db.Column(db.String, default="")
    website_url = db.Column(db.String, default="")
    collaborators = db.Column(db.String, default="[]")
    created_at = db.Column(db.String, nullable=False)

    prompts = db.relationship('Prompt', backref='project', cascade="all, delete-orphan")
    metrics = db.relationship('VisibilityMetric', backref='project', cascade="all, delete-orphan")

    def get_competitors_list(self):
        try:
            parsed = json.loads(self.competitors)
        except Exception:
            parsed = self.competitors

        if isinstance(parsed, str):
            raw_items = [parsed]
        elif isinstance(parsed, list):
            raw_items = parsed
        else:
            return []

        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in raw_items:
            for part in re.split(r"[,\n;]+", str(raw or "")):
                item = part.strip()
                if not item:
                    continue
                key = item.lower()
                if key in seen:
                    continue
                seen.add(key)
                cleaned.append(item)
        return cleaned

    def get_collaborators_list(self):
        try:
            return json.loads(self.collaborators)
        except Exception:
            return []


class Prompt(db.Model):
    __tablename__ = 'prompts'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String, nullable=False, index=True) # Linked to Supabase Auth user.id
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    prompt_text = db.Column(db.String, nullable=False)
    prompt_type = db.Column(db.String, default="Manual")
    country = db.Column(db.String, default="")
    tags = db.Column(db.String, default="[]")
    selected_models = db.Column(db.String, default="[]")
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.String, nullable=False)

    responses = db.relationship('Response', backref='prompt', cascade="all, delete-orphan")

    def get_tags(self):
        try:
            value = json.loads(self.tags or "[]")
            return value if isinstance(value, list) else []
        except Exception:
            return []

    def get_models(self):
        try:
            value = json.loads(self.selected_models or "[]")
            return value if isinstance(value, list) else []
        except Exception:
            return []


class Response(db.Model):
    __tablename__ = 'responses'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompts.id', ondelete="CASCADE"), nullable=False)
    engine = db.Column(db.String, nullable=False)
    response_text = db.Column(db.String, nullable=False)
    sources = db.Column(db.String, default="[]")
    timestamp = db.Column(db.String, nullable=False)

    mentions = db.relationship('Mention', backref='response', cascade="all, delete-orphan")


class Mention(db.Model):
    __tablename__ = 'mentions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    response_id = db.Column(db.Integer, db.ForeignKey('responses.id', ondelete="CASCADE"), nullable=False)
    brand = db.Column(db.String, nullable=False)
    is_focus = db.Column(db.Boolean, nullable=False, default=False)
    rank = db.Column(db.Integer, nullable=True)
    sentiment = db.Column(db.String, default="neutral")
    context = db.Column(db.String, default="")


class VisibilityMetric(db.Model):
    __tablename__ = 'visibility_metrics'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    score = db.Column(db.Float, nullable=False)
    date = db.Column(db.String, nullable=False)


class AnalysisJob(db.Model):
    __tablename__ = "analysis_jobs"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    job_id = db.Column(db.String, nullable=False, unique=True, index=True)
    user_id = db.Column(db.String, nullable=False, index=True)
    project_id = db.Column(db.Integer, nullable=False, index=True)
    prompt_id = db.Column(db.Integer, nullable=False, index=True)

    status = db.Column(db.String, nullable=False, default="pending", index=True)  # pending|running|completed|failed
    error = db.Column(db.String, default="")
    result_json = db.Column(db.Text, default="")

    created_at = db.Column(db.String, nullable=False)
    started_at = db.Column(db.String, default="")
    completed_at = db.Column(db.String, default="")
