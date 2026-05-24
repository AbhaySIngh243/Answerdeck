"""Pre-push performance smoke test for user-facing GET report routes.

Run from the backend folder while the API server is up:

    cd backend
    set PERF_AUTH_TOKEN=<Clerk JWT from browser devtools>
    set PERF_PROJECT_ID=16
    python -m scripts.perf_smoke

Environment:
    PERF_BASE_URL     API root (default http://localhost:5000/api)
    PERF_PROJECT_ID   Project to exercise (default 16)
    PERF_AUTH_TOKEN   Bearer token — required for /reports/* routes
    PERF_COLD_SEC     Max seconds for first (cold) request (default 5)
    PERF_WARM_SEC     Max seconds for cached warm request (default 1)
    PERF_INTEL_SEC    Max seconds for intel-summary cold (default 3)

Exit code 0 when all routes pass thresholds; 1 otherwise.

Local verify without JWT (uses Flask test client):

    python -m scripts.perf_verify_routes

Manual QA matrix (run in browser before deploy):
    | Screen                         | Verify                                              |
    |--------------------------------|-----------------------------------------------------|
    | Dashboard home                 | Loads in a few seconds, no infinite spinner         |
    | Project dashboard              | KPIs + summary + audit + prompt table populate      |
    | Sources tab (no prompt)        | Overall cited domains from prior runs               |
    | Competitors tab                | Table loads without long wait                       |
    | Opportunities tab              | Heuristic actions if no cache; no hang              |
    | Prompt detail                  | Loading then content or clear empty state           |
    | Expired session                | Refresh prompt, not silent failure                  |
"""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import requests

HERE = Path(__file__).resolve()
BACKEND_ROOT = HERE.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

DEFAULT_BASE = "http://localhost:5000/api"
DEFAULT_PROJECT_ID = 16


@dataclass
class RouteSpec:
    name: str
    path: str
    cold_limit: float
    warm_limit: float


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _routes(project_id: int) -> list[RouteSpec]:
    cold = _env_float("PERF_COLD_SEC", 5.0)
    warm = _env_float("PERF_WARM_SEC", 1.0)
    intel_cold = _env_float("PERF_INTEL_SEC", 3.0)
    pid = project_id
    return [
        RouteSpec("dashboard", f"/reports/project/{pid}/dashboard", cold, warm),
        RouteSpec("intel-summary", f"/reports/project/{pid}/intel-summary", intel_cold, warm),
        RouteSpec("global-audit", f"/reports/project/{pid}/global-audit", cold, warm),
        RouteSpec("sources", f"/reports/project/{pid}/sources", cold, warm),
        RouteSpec("prompt-analysis", f"/reports/project/{pid}/prompt-analysis", cold, warm),
        RouteSpec("competitors", f"/reports/project/{pid}/competitors", cold, warm),
        RouteSpec("overview", "/reports/overview", cold, warm),
    ]


def _timed_get(session: requests.Session, base: str, path: str) -> tuple[float, int]:
    url = f"{base.rstrip('/')}{path}"
    start = time.perf_counter()
    res = session.get(url, timeout=120)
    elapsed = time.perf_counter() - start
    return elapsed, res.status_code


def main() -> int:
    base = os.getenv("PERF_BASE_URL", DEFAULT_BASE).strip() or DEFAULT_BASE
    project_id = int(os.getenv("PERF_PROJECT_ID", str(DEFAULT_PROJECT_ID)))
    token = os.getenv("PERF_AUTH_TOKEN", "").strip()

    print(f"Perf smoke — base={base} project_id={project_id}")
    print()

    try:
        health = requests.get(f"{base.rstrip('/')}/health", timeout=10)
        health.raise_for_status()
        print(f"Health: OK ({health.json().get('status', 'unknown')})")
    except Exception as exc:
        print(f"FAIL health check — is the server running? ({exc})")
        return 1

    if not token:
        print("FAIL PERF_AUTH_TOKEN is required (copy Bearer token from browser devtools).")
        return 1

    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {token}"})

    failures: list[str] = []
    rows: list[tuple[str, float, float, str, str]] = []

    for spec in _routes(project_id):
        cold_s, cold_status = _timed_get(session, base, spec.path)
        warm_s, warm_status = _timed_get(session, base, spec.path)

        cold_ok = cold_status == 200 and cold_s <= spec.cold_limit
        warm_ok = warm_status == 200 and warm_s <= spec.warm_limit
        status = "PASS" if cold_ok and warm_ok else "FAIL"

        if not cold_ok:
            if cold_status != 200:
                failures.append(f"{spec.name}: cold HTTP {cold_status}")
            else:
                failures.append(f"{spec.name}: cold {cold_s:.2f}s > {spec.cold_limit}s")
        if not warm_ok:
            if warm_status != 200:
                failures.append(f"{spec.name}: warm HTTP {warm_status}")
            else:
                failures.append(f"{spec.name}: warm {warm_s:.2f}s > {spec.warm_limit}s")

        rows.append((spec.name, cold_s, warm_s, status, f"{cold_status}/{warm_status}"))

    print()
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
