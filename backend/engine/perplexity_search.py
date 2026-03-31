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
_VALID_PROVIDERS = {"serper", "perplexity", "none"}
_runtime_provider_override: str | None = None


def _perplexity_api_key() -> str:
    return os.getenv("PERPLEXITY_API_KEY", "").strip()


def _serper_api_key() -> str:
    # Support a few env aliases so users can plug in existing keys without refactoring.
    return (
        os.getenv("SERPER_API_KEY", "").strip()
        or os.getenv("GOOGLE_SEARCH_API_KEY", "").strip()
        or os.getenv("GOOGLE_SERPER_API_KEY", "").strip()
    )


def set_runtime_search_provider(provider: str | None) -> str:
    """Set in-process provider override.

    - ``None`` / ``auto`` clears override and falls back to env/auto detection.
    - ``serper`` / ``perplexity`` / ``none`` force that provider for this process.
    """
    global _runtime_provider_override
    candidate = (provider or "").strip().lower()
    if candidate in {"", "auto", "default"}:
        _runtime_provider_override = None
        return "auto"
    if candidate not in _VALID_PROVIDERS:
        raise ValueError("provider must be one of: auto, serper, perplexity, none")
    _runtime_provider_override = candidate
    return candidate


def get_runtime_search_provider() -> str:
    return _runtime_provider_override or "auto"


def _preferred_provider(provider_override: str | None = None) -> str:
    override = (provider_override or "").strip().lower()
    if override:
        if override in {"auto", "default"}:
            override = ""
        elif override in _VALID_PROVIDERS:
            return override

    if _runtime_provider_override in _VALID_PROVIDERS:
        return _runtime_provider_override

    configured = os.getenv("RANKLORE_SEARCH_PROVIDER", "").strip().lower()
    if configured in _VALID_PROVIDERS:
        return configured
    if _serper_api_key():
        return "serper"
    if _perplexity_api_key():
        return "perplexity"
    return "none"


def _strict_provider_mode() -> bool:
    return os.getenv("RANKLORE_SEARCH_PROVIDER_STRICT", "true").strip().lower() in {"1", "true", "yes"}


def is_search_provider_available(provider: str) -> bool:
    p = (provider or "").strip().lower()
    if p == "serper":
        return bool(_serper_api_key())
    if p == "perplexity":
        return bool(_perplexity_api_key())
    if p == "none":
        return False
    return False


def is_perplexity_search_enabled() -> bool:
    # Kept for backward compatibility with existing imports.
    return is_search_provider_available(_preferred_provider())


def get_search_provider_name(provider_override: str | None = None) -> str:
    provider = _preferred_provider(provider_override=provider_override)
    return provider if is_search_provider_available(provider) else "none"


def _normalize_snippet(text: str, limit: int = 220) -> str:
    snippet = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(snippet) <= limit:
        return snippet
    return snippet[: max(0, limit - 3)].rstrip() + "..."


def _infer_country_code(query: str) -> str:
    """Return a 2-letter country code when the query has a clear regional signal."""
    text = (query or "").lower()
    for phrase, code in (
        (" in india", "in"), ("india ", "in"), (" indian ", "in"),
        (" in usa", "us"), (" in us ", "us"), (" in united states", "us"),
        (" in uk", "gb"), (" in united kingdom", "gb"),
        (" in canada", "ca"), (" in australia", "au"),
        (" in germany", "de"), (" in france", "fr"), (" in japan", "jp"),
    ):
        if phrase in text or text.endswith(phrase.strip()):
            return code
    return ""


def _search_serper(query: str, max_results: int) -> dict[str, Any]:
    api_key = _serper_api_key()
    if not api_key:
        return {"ok": False, "error": "SERPER_API_KEY/GOOGLE_SEARCH_API_KEY not configured", "results": [], "provider": "serper"}

    payload: dict[str, Any] = {
        "q": query,
        "num": max(1, min(int(max_results or 8), 10)),
    }
    gl = _infer_country_code(query)
    if gl:
        payload["gl"] = gl
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
            snippet = _normalize_snippet(item.get("snippet", ""), limit=300)
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

        knowledge_graph = data.get("knowledgeGraph", {}) if isinstance(data, dict) else {}
        answer_box = data.get("answerBox", {}) if isinstance(data, dict) else {}

        return {
            "ok": True,
            "results": results,
            "knowledge_graph": knowledge_graph,
            "answer_box": answer_box,
            "provider": "serper",
        }
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


def search_web(
    query: str,
    max_results: int = 5,
    max_tokens_per_page: int = 350,
    provider_override: str | None = None,
) -> dict[str, Any]:
    """Search web and return normalized results.

    Provider selection priority:
    1) RANKLORE_SEARCH_PROVIDER, if set to `serper` or `perplexity`
    2) auto: serper if key exists, else perplexity if key exists
    """
    provider = _preferred_provider(provider_override=provider_override)
    if provider == "none":
        return {"ok": False, "error": "No web search provider configured", "results": [], "provider": "none"}

    if provider == "serper":
        serper_result = _search_serper(query, max_results=max_results)
        if serper_result.get("ok"):
            return serper_result
        # When provider is explicitly overridden, never silently switch providers.
        if provider_override or _strict_provider_mode():
            return serper_result
        # Soft fallback to Perplexity when configured.
        if _perplexity_api_key():
            perplexity_result = _search_perplexity(query, max_results=max_results, max_tokens_per_page=max_tokens_per_page)
            if perplexity_result.get("ok"):
                perplexity_result["provider"] = "perplexity-fallback"
                return perplexity_result
        return serper_result

    return _search_perplexity(query, max_results=max_results, max_tokens_per_page=max_tokens_per_page)
