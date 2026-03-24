import os
from models import db

def _get_database_uri():
    """Use DATABASE_URL (Supabase Postgres) with SQLAlchemy compatible prefix."""
    url = os.getenv("DATABASE_URL")
    if url:
        # Supabase may return postgres://; SQLAlchemy expects postgresql://
        if url.startswith("postgres://"):
            url = "postgresql+psycopg2://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and "+psycopg2" not in url:
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url
    
    # Fallback to local SQLite if no DATABASE_URL is provided (useful for local dev without postgres)
    DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")
    return f"sqlite:///{DB_PATH}"

def init_db(app):
    """Configure and initialize the SQLAlchemy database."""
    db_uri = _get_database_uri()
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        # Auto-create tables in the new Postgres database
        db.create_all()
