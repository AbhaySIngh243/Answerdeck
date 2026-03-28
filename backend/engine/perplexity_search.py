"""Web search provider integration used by analysis and deep-intel enrichment.

Backwards-compatible module name retained (`perplexity_search.py`) because other
parts of the app already import `search_web` and `is_perplexity_search_enabled`.
"""

import os
import re
from typing import Any

import requests

PERPLEXITY_SEARCH_URL = os.getenv("PERPLEXITY_SEARCH_URL", "https://api.perplexity.ai/search")
SERPER_SEARCH_URL = os.getenv("SERPER_SEARCH_URL", "https://google.serper.dev/search")
WEB_SEARCH_TIMEOUT_SECONDS = int(os.getenv("WEB_SEARCH_TIMEOUT_SECONDS", "20"))


def _perplexity_api_key() -> str:
    return os.getenv("PERPLEXITY_API_KEY", "").strip()


def _serper_api_key() -> str:
    # Support a few env aliases so users can plug in existing keys without refactoring.
    return (
        os.getenv("SERPER_API_KEY", "").strip()
        or os.getenv("GOOGLE_SEARCH_API_KEY", "").strip()
        or os.getenv("GOOGLE_SERPER_API_KEY", "").strip()
    )


def _preferred_provider() -> str:
    configured = os.getenv("RANKLORE_SEARCH_PROVIDER", "").strip().lower()
    if configured in {"serper", "perplexity", "none"}:
        return configured
    if _serper_api_key():
        return "serper"
    if _perplexity_api_key():
        return "perplexity"
    return "none"


def is_perplexity_search_enabled() -> bool:
    # Kept for backward compatibility with existing imports.
    provider = _preferred_provider()
    if provider == "serper":
        return bool(_serper_api_key())
    if provider == "perplexity":
        return bool(_perplexity_api_key())
    return False


def get_search_provider_name() -> str:
    provider = _preferred_provider()
    if provider == "serper" and _serper_api_key():
        return "serper"
    if provider == "perplexity" and _perplexity_api_key():
        return "perplexity"
    return "none"


def _normalize_snippet(text: str, limit: int = 220) -> str:
    snippet = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(snippet) <= limit:
        return snippet
    return snippet[: max(0, limit - 3)].rstrip() + "..."


def _search_serper(query: str, max_results: int) -> dict[str, Any]:
    api_key = _serper_api_key()
    if not api_key:
        return {"ok": False, "error": "SERPER_API_KEY/GOOGLE_SEARCH_API_KEY not configured", "results": [], "provider": "serper"}

    payload = {
        "q": query,
        "num": max(1, min(int(max_results or 5), 10)),
    }
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            SERPER_SEARCH_URL,
            headers=headers,
            json=payload,
            timeout=WEB_SEARCH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json() if response.content else {}
        organic = data.get("organic", []) if isinstance(data, dict) else []

        results = []
        for item in organic[: max(1, min(max_results, 10))]:
            if not isinstance(item, dict):
                continue
            url = (item.get("link") or item.get("url") or "").strip()
            title = (item.get("title") or "").strip()
            snippet = _normalize_snippet(item.get("snippet", ""))
            if not url:
                continue
            results.append(
                {
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                    "date": item.get("date", ""),
                }
            )

        return {"ok": True, "results": results, "provider": "serper"}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "results": [], "provider": "serper"}


def _search_perplexity(query: str, max_results: int, max_tokens_per_page: int) -> dict[str, Any]:
    api_key = _perplexity_api_key()
    if not api_key:
        return {"ok": False, "error": "PERPLEXITY_API_KEY not configured", "results": [], "provider": "perplexity"}

    headers = {
        "Authorization": f"Bearer {api_key}",
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
            timeout=WEB_SEARCH_TIMEOUT_SECONDS,
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
                    "snippet": _normalize_snippet(item.get("snippet", "")),
                    "date": item.get("date", ""),
                }
            )

        return {"ok": True, "results": results, "provider": "perplexity"}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "results": [], "provider": "perplexity"}


def search_web(query: str, max_results: int = 5, max_tokens_per_page: int = 350) -> dict[str, Any]:
    """Search web and return normalized results.

    Provider selection priority:
    1) RANKLORE_SEARCH_PROVIDER, if set to `serper` or `perplexity`
    2) auto: serper if key exists, else perplexity if key exists
    """
    provider = _preferred_provider()
    if provider == "none":
        return {"ok": False, "error": "No web search provider configured", "results": [], "provider": "none"}

    if provider == "serper":
        serper_result = _search_serper(query, max_results=max_results)
        if serper_result.get("ok"):
            return serper_result
        # Soft fallback to Perplexity when configured.
        if _perplexity_api_key():
            perplexity_result = _search_perplexity(query, max_results=max_results, max_tokens_per_page=max_tokens_per_page)
            if perplexity_result.get("ok"):
                perplexity_result["provider"] = "perplexity-fallback"
                return perplexity_result
        return serper_result

    return _search_perplexity(query, max_results=max_results, max_tokens_per_page=max_tokens_per_page)
