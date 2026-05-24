"""HTTP route timing via Flask test client (no live JWT required)."""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import patch

from dotenv import load_dotenv

HERE = Path(__file__).resolve()
BACKEND_ROOT = HERE.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv()

from app import create_app  # noqa: E402
from clerk_auth import ClerkUser  # noqa: E402
from models import Project  # noqa: E402
from routes import reports as reports_mod  # noqa: E402


@dataclass
class RouteSpec:
    name: str
    path: str
    cold_limit: float
    warm_limit: float


def _routes(project_id: int) -> list[RouteSpec]:
    cold = float(os.getenv("PERF_COLD_SEC", "5"))
    warm = float(os.getenv("PERF_WARM_SEC", "1"))
    intel_cold = float(os.getenv("PERF_INTEL_SEC", "3"))
    pid = project_id
    return [
        RouteSpec("dashboard", f"/api/reports/project/{pid}/dashboard", cold, warm),
        RouteSpec("intel-summary", f"/api/reports/project/{pid}/intel-summary", intel_cold, warm),
        RouteSpec("global-audit", f"/api/reports/project/{pid}/global-audit", cold, warm),
        RouteSpec("sources", f"/api/reports/project/{pid}/sources", cold, warm),
        RouteSpec("prompt-analysis", f"/api/reports/project/{pid}/prompt-analysis", cold, warm),
        RouteSpec("competitors", f"/api/reports/project/{pid}/competitors", cold, warm),
        RouteSpec("overview", "/api/reports/overview", cold, warm),
    ]


def main() -> int:
    pid = int(os.getenv("PERF_PROJECT_ID", "16"))
    app = create_app()

    with app.app_context():
        project = Project.query.get(pid)
        if not project:
            print(f"Project {pid} not found")
            return 1
        user = ClerkUser(id=project.user_id)

    def fake_verify(_token: str) -> ClerkUser:
        return user

    failures: list[str] = []
    rows: list[tuple[str, float, float, str, str]] = []

    with app.app_context():
        reports_mod._cache_invalidate_project(pid)

        with patch("auth.verify_clerk_token", fake_verify):
            client = app.test_client()
            headers = {"Authorization": "Bearer test-token"}

            for spec in _routes(pid):
                t0 = time.perf_counter()
                cold_res = client.get(spec.path, headers=headers)
                cold_s = time.perf_counter() - t0

                t0 = time.perf_counter()
                warm_res = client.get(spec.path, headers=headers)
                warm_s = time.perf_counter() - t0

                cold_ok = cold_res.status_code == 200 and cold_s <= spec.cold_limit
                warm_ok = warm_res.status_code == 200 and warm_s <= spec.warm_limit
                status = "PASS" if cold_ok and warm_ok else "FAIL"

                if not cold_ok:
                    if cold_res.status_code != 200:
                        failures.append(f"{spec.name}: cold HTTP {cold_res.status_code}")
                    else:
                        failures.append(f"{spec.name}: cold {cold_s:.2f}s > {spec.cold_limit}s")
                if not warm_ok:
                    if warm_res.status_code != 200:
                        failures.append(f"{spec.name}: warm HTTP {warm_res.status_code}")
                    else:
                        failures.append(f"{spec.name}: warm {warm_s:.2f}s > {spec.warm_limit}s")

                rows.append(
                    (
                        spec.name,
                        cold_s,
                        warm_s,
                        status,
                        f"{cold_res.status_code}/{warm_res.status_code}",
                    )
                )

    print(f"Route perf (test client) — project_id={pid}")
    print(f"{'Route':<18} {'Cold (s)':>10} {'Warm (s)':>10} {'HTTP':>8} {'Result':>8}")
    print("-" * 58)
    for name, cold_s, warm_s, status, http in rows:
        print(f"{name:<18} {cold_s:>10.2f} {warm_s:>10.2f} {http:>8} {status:>8}")

    print()
    if failures:
        print("FAILED:")
        for item in failures:
            print(f"  - {item}")
        return 1

    print("All routes within thresholds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
