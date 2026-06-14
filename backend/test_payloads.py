import traceback
import sys
import os

# Adjust sys.path to find packages
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import Project, Prompt
from routes.reports import (
    _get_or_build_dashboard_payload,
    _get_or_build_prompt_analysis_payload,
    _get_or_build_deep_analysis_payload,
    _get_or_build_sources_payload,
    _get_or_build_global_audit_payload,
    _build_citation_economics_payload,
    _project_competitor_framings,
    _build_competitor_visibility,
)
from engine.full_report import build_full_export_payload

app = create_app()
with app.app_context():
    projects = Project.query.all()
    print(f"Total projects found: {len(projects)}")
    for p in projects:
        print(f"\n=================== TESTING PROJECT {p.id}: {p.name} ===================")
        try:
            print("1. Testing dashboard payload...")
            dash = _get_or_build_dashboard_payload(p.id)
            print("   Success! Current score:", dash.get("current_visibility_score"))
        except Exception as e:
            print("   FAILED dashboard:")
            traceback.print_exc()

        try:
            print("2. Testing prompt analysis payload...")
            pa = _get_or_build_prompt_analysis_payload(p.id)
            print("   Success! Count:", pa.get("count"))
        except Exception as e:
            print("   FAILED prompt analysis:")
            traceback.print_exc()

        try:
            print("3. Testing deep analysis payload...")
            da = _get_or_build_deep_analysis_payload(p.id)
            print("   Success! Query count:", len(da.get("queries", [])))
        except Exception as e:
            print("   FAILED deep analysis:")
            traceback.print_exc()

        try:
            print("4. Testing sources payload...")
            src = _get_or_build_sources_payload(p.id, p)
            print("   Success! Source count:", len(src.get("sources", [])))
        except Exception as e:
            print("   FAILED sources:")
            traceback.print_exc()

        try:
            print("5. Testing global audit payload...")
            ga = _get_or_build_global_audit_payload(p.id, p)
            print("   Success! Items:", len(ga.get("items", [])))
        except Exception as e:
            print("   FAILED global audit:")
            traceback.print_exc()

        try:
            print("6. Testing full export payload...")
            # We mock the user id from project or user.id
            payload = build_full_export_payload(p.id, p.user_id)
            print("   Success!")
        except Exception as e:
            print("   FAILED full export payload:")
            traceback.print_exc()
