"""Smoke test: exercise brand grounding and URL verification.

Run: `python -m scripts.smoke_analysis` from the `backend/` folder after
`python app.py` has started (we borrow its app context).

This does NOT require any paid API credits — it uses purely deterministic
fixtures to verify:

1. `_sanitize_llm_brand_details_against_text` drops hallucinated brands.
2. `build_competitor_comparison` annotates engines_agreeing correctly.
3. `verify_urls` returns a status for each URL (cache-only path by default).

Exit code is 0 on success and 1 on any assertion failure.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the backend package root is importable when running as a script.
HERE = Path(__file__).resolve()
BACKEND_ROOT = HERE.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_brand_grounding() -> None:
    from engine.analyzer import (
        _sanitize_llm_brand_details_against_text,
        build_competitor_comparison,
    )

    raw_text = (
        "Top picks for office headphones:\n"
        "1. Sony WH-1000XM5 — best noise cancelling.\n"
        "2. Bose QC45 — strong comfort and calls.\n"
        "3. Jabra Evolve2 65 — reliable business pick.\n"
    )

    # The extractor emitted an invented "FakeBrand" that never appears.
    parsed = {
        "all_brand_details": [
            {"brand": "Sony", "rank": 1, "sentiment": "positive", "context": "Sony WH-1000XM5 — best noise cancelling."},
            {"brand": "Bose", "rank": 2, "sentiment": "positive", "context": "Bose QC45 — strong comfort and calls."},
            {"brand": "Jabra", "rank": 3, "sentiment": "neutral", "context": "Jabra Evolve2 65 — reliable business pick."},
            {"brand": "FakeBrand", "rank": 4, "sentiment": "positive", "context": "FakeBrand leads the segment."},
        ],
    }
    cleaned = _sanitize_llm_brand_details_against_text(parsed, raw_text, ["Jabra"])
    brands = {b["brand"] for b in cleaned.get("all_brand_details", [])}
    assert "FakeBrand" not in brands, "Expected hallucinated brand to be removed."
    assert {"Sony", "Bose", "Jabra"} <= brands, "Real brands must be kept."

    # Now test cross-engine consensus annotation.
    engine_a = {"all_brand_details": [
        {"brand": "Sony", "rank": 1, "sentiment": "positive", "context": "Sony leads."},
        {"brand": "Bose", "rank": 2, "sentiment": "positive", "context": "Bose second."},
    ]}
    engine_b = {"all_brand_details": [
        {"brand": "Sony", "rank": 1, "sentiment": "positive", "context": "Sony wins."},
    ]}
    engine_c = {"all_brand_details": [
        {"brand": "Bose", "rank": 1, "sentiment": "neutral", "context": "Bose listed."},
    ]}
    comparison = build_competitor_comparison(
        {"chatgpt": engine_a, "claude": engine_b, "deepseek": engine_c},
        focus_brand="Jabra",
    )
    by_brand = {row["brand"]: row for row in comparison}
    assert by_brand.get("Sony", {}).get("engines_agreeing") == 2, (
        "Sony should be agreed on by 2 engines."
    )
    assert by_brand.get("Bose", {}).get("engines_agreeing") == 2, (
        "Bose should be agreed on by 2 engines."
    )

    print("[ok] brand grounding")


def test_url_verifier_cache_only() -> None:
    """Run verify_urls with allow_network=False so we never leave localhost."""
    from app import app  # triggers Flask app + DB init

    from engine.url_verifier import verify_urls

    urls = ["https://example.com", "not-a-real-url", "http://localhost"]
    with app.app_context():
        result = verify_urls(urls, allow_network=False)
    assert all(url in result for url in urls), "Every input url should appear in the result."
    assert result["http://localhost"]["status"] == "broken", (
        "localhost should be filtered out as broken/private."
    )
    assert result["not-a-real-url"]["status"] == "broken", (
        "Non-http strings should be classified as broken."
    )
    print("[ok] url verifier (cache-only)")


def main() -> int:
    try:
        test_brand_grounding()
        test_url_verifier_cache_only()
        print("\nAll smoke checks passed.")
        return 0
    except AssertionError as exc:
        print(f"[fail] {exc}")
        return 1
    except Exception as exc:
        print(f"[error] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
