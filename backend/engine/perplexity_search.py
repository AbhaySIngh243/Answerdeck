"""Perplexity Search API integration for source-intelligence enrichment."""

import os
from typing import Any

import requests

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "").strip()
PERPLEXITY_SEARCH_URL = os.getenv("PERPLEXITY_SEARCH_URL", "https://api.perplexity.ai/search")
PERPLEXITY_TIMEOUT_SECONDS = int(os.getenv("PERPLEXITY_TIMEOUT_SECONDS", "30"))


def is_perplexity_search_enabled() -> bool:
    return bool(PERPLEXITY_API_KEY)


def search_web(query: str, max_results: int = 5, max_tokens_per_page: int = 350) -> dict[str, Any]:
    """Call Perplexity search endpoint and return normalized results."""
    if not PERPLEXITY_API_KEY:
        return {"ok": False, "error": "PERPLEXITY_API_KEY not configured", "results": []}

    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "query": query,
        "max_results": max(1, min(max_results, 20)),
        "max_tokens_per_page": max(128, min(max_tokens_per_page, 1024)),
    }

    try:
        response = requests.post(
            PERPLEXITY_SEARCH_URL,
            headers=headers,
            json=payload,
            timeout=PERPLEXITY_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()

        results = []
        raw_results = data.get("results", []) if isinstance(data, dict) else []
        for item in raw_results:
            if not isinstance(item, dict):
                continue
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("snippet", ""),
                    "date": item.get("date", ""),
                }
            )

        return {"ok": True, "results": results}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "results": []}