import os

from models import db

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")
DB_URI = f"sqlite:///{DB_PATH}"


def _ensure_prompt_columns():
    required_columns = {
        "prompt_type": "TEXT DEFAULT 'Manual'",
        "country": "TEXT DEFAULT ''",
        "tags": "TEXT DEFAULT '[]'",
        "selected_models": "TEXT DEFAULT '[]'",
        "is_active": "BOOLEAN NOT NULL DEFAULT 1",
    }

    connection = db.engine.raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA table_info(prompts)")
        existing = {row[1] for row in cursor.fetchall()}

        for column, ddl in required_columns.items():
            if column not in existing:
                cursor.execute(f"ALTER TABLE prompts ADD COLUMN {column} {ddl}")

        connection.commit()
    finally:
        connection.close()


def _ensure_project_columns():
    required_columns = {
        "collaborators": "TEXT DEFAULT '[]'",
    }
    connection = db.engine.raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA table_info(projects)")
        existing = {row[1] for row in cursor.fetchall()}
        for column, ddl in required_columns.items():
            if column not in existing:
                cursor.execute(f"ALTER TABLE projects ADD COLUMN {column} {ddl}")
        connection.commit()
    finally:
        connection.close()


def init_db(app):
    """Configure and initialize the SQLAlchemy database."""
    app.config["SQLALCHEMY_DATABASE_URI"] = DB_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        from sqlalchemy import event
        from sqlalchemy.engine import Engine

        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        db.create_all()
        _ensure_prompt_columns()
        _ensure_project_columns()
