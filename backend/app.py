"""Flask application entrypoint."""

import os
import sys
from datetime import datetime, timezone

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__))
load_dotenv(override=False)

from database import init_db
from exceptions import APIError
from extensions import executor
from routes.analysis import analysis_bp
from routes.projects import projects_bp
from routes.prompts import prompts_bp
from routes.reports import reports_bp
from routes.billing import billing_bp


def create_app() -> Flask:
    app = Flask(__name__)
    cors_origins = os.getenv("CORS_ORIGINS", "")
    if cors_origins:
        origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
        CORS(app, origins=origins)
    else:
        CORS(app)

    init_db(app)

    app.config["EXECUTOR_TYPE"] = "thread"
    app.config["EXECUTOR_MAX_WORKERS"] = int(os.getenv("EXECUTOR_MAX_WORKERS", "6"))
    executor.init_app(app)

    app.register_blueprint(projects_bp, url_prefix="/api/projects")
    app.register_blueprint(prompts_bp, url_prefix="/api/prompts")
    app.register_blueprint(analysis_bp, url_prefix="/api/analysis")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(billing_bp, url_prefix="/api/billing")

    register_error_handlers(app)
    register_health_route(app)
    return app


def register_health_route(app: Flask) -> None:
    from engine.llm_clients import get_enabled_engines

    @app.route("/api/health", methods=["GET"])
    def health():
        engines = get_enabled_engines()
        return jsonify(
            {
                "status": "online",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "enabled_engines": [cfg.get("display_name", key) for key, cfg in engines.items()],
                "engine_count": len(engines),
            }
        )


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(APIError)
    def handle_api_error(err):
        return jsonify(err.to_dict()), err.status_code

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def server_error(err):
        return jsonify({"error": "Internal server error", "detail": str(err)}), 500


app = create_app()


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=debug_mode)