import os
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import inspect, text

from models import db


def _normalize_postgres_uri(url: str) -> str:
    """Supabase may return postgres://; SQLAlchemy + psycopg2 expect postgresql+psycopg2://."""
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://") :]
    elif url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _ensure_sslmode_require(url: str) -> str:
    """Supabase requires SSL; ensure sslmode=require if missing (helps some hosts)."""
    if "sslmode=" in url.lower():
        return url
    parsed = urlparse(url)
    q = parse_qs(parsed.query, keep_blank_values=True)
    q["sslmode"] = ["require"]
    new_query = urlencode(q, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _get_database_uri():
    """Resolve DB URL for SQLAlchemy.

    On Render, Supabase *direct* host ``db.<ref>.supabase.co`` often resolves to IPv6; the
    platform may show "Network is unreachable". Prefer the **pooler** URI from the Supabase
    dashboard (Database → Connection string → Transaction pooler) and set either
    ``DATABASE_POOLER_URL`` or ``SUPABASE_POOLER_URL``, or paste that URI as ``DATABASE_URL``.
    """
    url = (
        os.getenv("DATABASE_POOLER_URL", "").strip()
        or os.getenv("SUPABASE_POOLER_URL", "").strip()
        or os.getenv("DATABASE_URL", "").strip()
    )
    if url:
        url = _normalize_postgres_uri(url)
        if url.startswith("postgresql+psycopg2"):
            url = _ensure_sslmode_require(url)
        return url

    # Fallback to local SQLite if no DATABASE_URL is provided (useful for local dev without postgres)
    DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")
    return f"sqlite:///{DB_PATH}"


def init_db(app):
    """Configure and initialize the SQLAlchemy database."""
    db_uri = _get_database_uri()
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    db.init_app(app)

    with app.app_context():
        # Auto-create tables in the new Postgres database
        db.create_all()
        _ensure_runtime_schema(db.engine)


def _ensure_runtime_schema(engine):
    """Best-effort additive schema updates for environments without migrations."""
    try:
        inspector = inspect(engine)
        if "projects" not in inspector.get_table_names():
            return
        columns = {col["name"] for col in inspector.get_columns("projects")}
        statements = []
        if "onboarding_data" not in columns:
            statements.append("ALTER TABLE projects ADD COLUMN onboarding_data TEXT DEFAULT '{}'")
        if "onboarding_completed" not in columns:
            statements.append("ALTER TABLE projects ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE")
        if not statements:
            return
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
    except Exception:
        # Startup should not fail due to best-effort schema drift handling.
        return
