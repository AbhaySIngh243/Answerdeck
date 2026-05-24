"""Direct builder timing check (no HTTP auth). Used by pre-push verify."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve()
BACKEND_ROOT = HERE.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv()

from app import create_app  # noqa: E402
from models import Project  # noqa: E402
from routes import reports as reports_mod  # noqa: E402


def main() -> int:
    pid = int(os.getenv("PERF_PROJECT_ID", "16"))
    cold_limit = float(os.getenv("PERF_COLD_SEC", "5"))

    app = create_app()
    with app.app_context():
        project = Project.query.get(pid)
        if not project:
            print(f"Project {pid} not found")
            return 1
        print(f"Project {pid}: {project.name}")

        builders = [
            ("dashboard", reports_mod._get_or_build_dashboard_payload),
            ("prompt-analysis", reports_mod._get_or_build_prompt_analysis_payload),
            ("deep-analysis", reports_mod._get_or_build_deep_analysis_payload),
        ]

        print("\nWarm (cached) timings:")
        for name, fn in builders:
            t0 = time.perf_counter()
            fn(pid)
            print(f"  {name}: {time.perf_counter() - t0:.2f}s")

        reports_mod._cache_invalidate_project(pid)
        print("\nCold (cache cleared) timings:")
        failures: list[str] = []
        for name, fn in builders:
            t0 = time.perf_counter()
            fn(pid)
            elapsed = time.perf_counter() - t0
            status = "PASS" if elapsed <= cold_limit else "FAIL"
            print(f"  {name}: {elapsed:.2f}s {status}")
            if elapsed > cold_limit:
                failures.append(f"{name}: {elapsed:.2f}s > {cold_limit}s")

        if failures:
            print("\nFAILED:")
            for item in failures:
                print(f"  - {item}")
            return 1

        print(f"\nAll builder timings within {cold_limit}s cold threshold.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
