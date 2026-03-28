"""Client wrappers for all configured LLM engines."""

import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

from anthropic import Anthropic
from dotenv import load_dotenv
from openai import OpenAI

from engine.perplexity_search import get_search_provider_name, is_perplexity_search_enabled, search_web

load_dotenv(override=True)


def _eager_load_openai_sdk() -> None:
    """Load OpenAI SDK resource modules on the main thread before any worker threads run.

    query_engines() uses ThreadPoolExecutor; lazy imports of ``openai.resources.chat`` (and
    ``responses`` for web search) from multiple workers can deadlock on Python's import lock.
    """
    try:
        import openai.resources.chat  # noqa: F401
        import openai.resources.chat.completions  # noqa: F401
        import openai.resources.responses  # noqa: F401
    except Exception:
        pass


_eager_load_openai_sdk()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
OPENAI_ENABLE_WEB_SEARCH = os.getenv("OPENAI_ENABLE_WEB_SEARCH", "true").lower() in {"1", "true", "yes"}
OPENAI_WEB_SEARCH_MODEL = os.getenv("OPENAI_WEB_SEARCH_MODEL", os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
OPENAI_REQUIRE_WEB_SEARCH = os.getenv("OPENAI_REQUIRE_WEB_SEARCH", "false").lower() in {"1", "true", "yes"}
PERPLEXITY_ENABLE_WEB_SEARCH = os.getenv("PERPLEXITY_ENABLE_WEB_SEARCH", "true").lower() in {"1", "true", "yes"}
PERPLEXITY_REQUIRE_WEB_SEARCH = os.getenv("PERPLEXITY_REQUIRE_WEB_SEARCH", "false").lower() in {"1", "true", "yes"}
CLAUDE_REQUIRE_WEB_SEARCH = os.getenv("CLAUDE_REQUIRE_WEB_SEARCH", "false").lower() in {"1", "true", "yes"}
GEMINI_REQUIRE_WEB_SEARCH = os.getenv("GEMINI_REQUIRE_WEB_SEARCH", "false").lower() in {"1", "true", "yes"}
DEEPSEEK_REQUIRE_WEB_SEARCH = os.getenv("DEEPSEEK_REQUIRE_WEB_SEARCH", "false").lower() in {"1", "true", "yes"}
RANKLORE_EXTERNAL_PARITY_MODE = os.getenv("RANKLORE_EXTERNAL_PARITY_MODE", "true").lower() in {"1", "true", "yes"}
RANKLORE_LLM_TEMPERATURE = float(os.getenv("RANKLORE_LLM_TEMPERATURE", "0.0"))
RANKLORE_SEARCH_AUGMENT_ENABLED = os.getenv("RANKLORE_SEARCH_AUGMENT_ENABLED", "true").lower() in {"1", "true", "yes"}
RANKLORE_SEARCH_AUGMENT_MAX_RESULTS = max(1, min(int(os.getenv("RANKLORE_SEARCH_AUGMENT_MAX_RESULTS", "5")), 8))
RANKLORE_SEARCH_AUGMENT_SNIPPET_CHARS = max(80, min(int(os.getenv("RANKLORE_SEARCH_AUGMENT_SNIPPET_CHARS", "200")), 320))
URL_PATTERN = re.compile(r"https?://[^\s<>\"')\]]+")

def _build_client(api_key: str, base_url: str | None = None) -> OpenAI | None:
    if not api_key:
        return None
    if base_url:
        return OpenAI(base_url=base_url, api_key=api_key)
    return OpenAI(api_key=api_key)


def _build_anthropic_client(api_key: str) -> Anthropic | None:
    if not api_key:
        return None
    return Anthropic(api_key=api_key)


ENGINE_CONFIG: dict[str, dict[str, Any]] = {
    "chatgpt": {
        "client": _build_client(OPENAI_API_KEY),
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "display_name": "ChatGPT",
    },
    "deepseek": {
        "client": _build_client(DEEPSEEK_API_KEY, "https://api.deepseek.com"),
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        "display_name": "DeepSeek",
    },
    "perplexity": {
        "client": _build_client(PERPLEXITY_API_KEY, "https://api.perplexity.ai"),
        "model": os.getenv("PERPLEXITY_MODEL", "sonar"),
        "display_name": "Perplexity",
    },
    "gemini": {
        "client": _build_client(
            GEMINI_API_KEY,
            "https://generativelanguage.googleapis.com/v1beta/openai/",
        ),
        "model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "display_name": "Gemini",
    },
    "claude": {
        "client": _build_anthropic_client(CLAUDE_API_KEY),
        "model": os.getenv("CLAUDE_MODEL", "claude-3-5-haiku-latest"),
        "display_name": "Claude",
        "provider": "anthropic",
    },
}

# Backward compatibility alias.
ENGINE_CONFIG["openai"] = ENGINE_CONFIG["chatgpt"]

DEFAULT_ENGINE_ORDER = ["chatgpt", "deepseek", "perplexity", "claude"]


def _selected_engine_order() -> list[str]:
    configured = os.getenv("RANKLORE_ENGINE_ORDER", ",".join(DEFAULT_ENGINE_ORDER))
    values = [item.strip().lower() for item in configured.split(",") if item.strip()]
    if not values:
        values = DEFAULT_ENGINE_ORDER
    return [engine for engine in values if engine in ENGINE_CONFIG and engine != "openai"]


def get_enabled_engines(selected_models: list[str] | None = None) -> dict[str, dict[str, Any]]:
    selected = _selected_engine_order()
    if selected_models:
        requested = {m.strip().lower() for m in selected_models if m and m.strip()}
        selected = [engine for engine in selected if engine in requested]
    return {engine: ENGINE_CONFIG[engine] for engine in selected if ENGINE_CONFIG[engine].get("client") is not None}


def _normalize_url(url: str) -> str:
    cleaned = str(url or "").strip().rstrip(".,;:!?)")
    return cleaned if cleaned.startswith("http://") or cleaned.startswith("https://") else ""


def _extract_urls_from_text(text: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for match in URL_PATTERN.findall(str(text or "")):
        normalized = _normalize_url(match)
        if normalized and normalized not in seen:
            seen.add(normalized)
            urls.append(normalized)
    return urls


def _collect_urls_from_any(payload: Any, urls: list[str], seen: set[str], visited: set[int], depth: int = 0) -> None:
    if payload is None or depth > 8:
        return
    pid = id(payload)
    if pid in visited:
        return
    visited.add(pid)

    if isinstance(payload, str):
        for value in _extract_urls_from_text(payload):
            if value not in seen:
                seen.add(value)
                urls.append(value)
        return

    if isinstance(payload, dict):
        for key, value in payload.items():
            key_lower = str(key).lower()
            if key_lower in {"url", "uri", "href", "link", "source"} and isinstance(value, str):
                normalized = _normalize_url(value)
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    urls.append(normalized)
            _collect_urls_from_any(value, urls, seen, visited, depth + 1)
        return

    if isinstance(payload, (list, tuple, set)):
        for value in payload:
            _collect_urls_from_any(value, urls, seen, visited, depth + 1)
        return

    for attr in ("model_dump", "to_dict", "dict"):
        fn = getattr(payload, attr, None)
        if callable(fn):
            try:
                dumped = fn() if attr != "model_dump" else fn(mode="python")
                _collect_urls_from_any(dumped, urls, seen, visited, depth + 1)
                return
            except Exception:
                pass

    if hasattr(payload, "__dict__"):
        try:
            _collect_urls_from_any(vars(payload), urls, seen, visited, depth + 1)
        except Exception:
            pass


def _extract_openai_response_citation_urls(response: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    # Preferred path: structured annotations.
    try:
        output_items = getattr(response, "output", []) or []
        for output_item in output_items:
            content_items = getattr(output_item, "content", []) or []
            for content in content_items:
                annotations = getattr(content, "annotations", []) or []
                for ann in annotations:
                    ann_type = getattr(ann, "type", "")
                    if ann_type != "url_citation":
                        continue
                    normalized = _normalize_url(getattr(ann, "url", "") or "")
                    if normalized and normalized not in seen:
                        seen.add(normalized)
                        urls.append(normalized)
    except Exception:
        pass

    # Fallback: recursively scan the full object for URL-like fields.
    _collect_urls_from_any(response, urls, seen, visited=set())
    output_text = getattr(response, "output_text", "") or ""
    _collect_urls_from_any(output_text, urls, seen, visited=set())
    return urls[:20]


def _format_sources_tail(urls: list[str]) -> str:
    clean: list[str] = []
    seen: set[str] = set()
    for raw in urls:
        normalized = _normalize_url(raw)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        clean.append(normalized)
    if not clean:
        return ""
    lines = "\n".join(f"- {url}" for url in clean[:12])
    return f"\n\nSources:\n{lines}"


def _infer_web_search_country(prompt: str) -> str | None:
    text = (prompt or "").lower()
    if " in india" in text or "india " in text or text.endswith("india"):
        return "IN"
    if " in united states" in text or " in usa" in text or " in us " in text:
        return "US"
    if " in united kingdom" in text or " in uk" in text:
        return "GB"
    if " in canada" in text:
        return "CA"
    if " in australia" in text:
        return "AU"
    return None


def _clip_prompt_text(value: str, limit: int) -> str:
    clean = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 3)].rstrip() + "..."


def _domain_label(url: str) -> str:
    try:
        host = (urlparse(url).hostname or "").strip().lower()
        return host.replace("www.", "") if host else url
    except Exception:
        return url


def _build_search_grounding_context(query: str) -> dict[str, Any]:
    context: dict[str, Any] = {
        "enabled": RANKLORE_SEARCH_AUGMENT_ENABLED,
        "provider": get_search_provider_name(),
        "available": is_perplexity_search_enabled(),
        "ok": False,
        "error": "",
        "block": "",
        "urls": [],
    }
    if not context["enabled"]:
        context["error"] = "search augmentation disabled"
        return context
    if not context["available"]:
        context["error"] = "no web search provider configured"
        return context

    result = search_web(query=query, max_results=RANKLORE_SEARCH_AUGMENT_MAX_RESULTS, max_tokens_per_page=320)
    context["provider"] = result.get("provider") or context["provider"]
    if not result.get("ok"):
        context["error"] = str(result.get("error") or "search failed")
        return context

    rows = result.get("results", []) or []
    if not rows:
        context["error"] = "search returned no results"
        return context

    lines = []
    urls: list[str] = []
    for idx, item in enumerate(rows[:RANKLORE_SEARCH_AUGMENT_MAX_RESULTS], start=1):
        title = _clip_prompt_text(item.get("title", ""), 110)
        snippet = _clip_prompt_text(item.get("snippet", ""), RANKLORE_SEARCH_AUGMENT_SNIPPET_CHARS)
        url = _normalize_url(item.get("url") or "")
        if not url:
            continue
        urls.append(url)
        lines.append(f"{idx}. {title} [{_domain_label(url)}]\n   {snippet}\n   URL: {url}")

    if not lines:
        context["error"] = "search results had no usable URLs"
        return context

    context["ok"] = True
    context["urls"] = urls
    context["block"] = (
        "Web Grounding Context (recent external search signals)\n"
        f"Provider: {context['provider']}\n"
        + "\n".join(lines)
        + "\nUse these as supporting evidence, keep ranking logic explicit, and include direct URLs under a final 'Sources:' section."
    )
    return context


def _extract_perplexity_citation_urls(response: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    candidates = getattr(response, "citations", None)
    if not candidates and isinstance(response, dict):
        candidates = response.get("citations")
    for item in candidates or []:
        normalized = _normalize_url(str(item or "").strip())
        if normalized and normalized not in seen:
            seen.add(normalized)
            urls.append(normalized)

    # Some Perplexity payloads place citations under choices[].message.
    try:
        choices = getattr(response, "choices", None)
        if choices:
            _collect_urls_from_any(choices, urls, seen, visited=set())
    except Exception:
        pass

    _collect_urls_from_any(response, urls, seen, visited=set())
    return urls[:20]


def chat(engine: str, prompt: str, temperature: float | None = None) -> str:
    engine = engine.lower()
    cfg = ENGINE_CONFIG.get(engine)
    if not cfg:
        return f"[Unknown engine: {engine}]"
    client = cfg.get("client")
    if client is None:
        return f"[{cfg.get('display_name', engine)} not configured]"
    try:
        effective_temperature = RANKLORE_LLM_TEMPERATURE if temperature is None else float(temperature)
    except Exception:
        effective_temperature = RANKLORE_LLM_TEMPERATURE

    try:
        if engine == "perplexity":
            if not PERPLEXITY_ENABLE_WEB_SEARCH and PERPLEXITY_REQUIRE_WEB_SEARCH:
                return "[Perplexity web-search required but disabled via PERPLEXITY_ENABLE_WEB_SEARCH]"
            response = client.chat.completions.create(
                model=cfg["model"],
                messages=[{"role": "user", "content": prompt}],
                temperature=effective_temperature,
                extra_body={"return_citations": True},
            )
            text = (response.choices[0].message.content or "").strip()
            citations = _extract_perplexity_citation_urls(response)
            if PERPLEXITY_REQUIRE_WEB_SEARCH and not citations:
                return "[Perplexity web-search required but no citations were returned]"
            return f"{text}{_format_sources_tail(citations)}"

        if engine == "claude" and CLAUDE_REQUIRE_WEB_SEARCH:
            return "[Claude web-search required but not supported by current API integration]"

        if engine == "gemini" and GEMINI_REQUIRE_WEB_SEARCH:
            return "[Gemini web-search required but not supported by current API integration]"

        if engine == "deepseek" and DEEPSEEK_REQUIRE_WEB_SEARCH:
            return "[DeepSeek web-search required but not supported by current API integration]"

        if engine == "chatgpt" and OPENAI_ENABLE_WEB_SEARCH:
            # Align API behavior more closely with ChatGPT app results by enabling web grounding.
            try:
                country = _infer_web_search_country(prompt)
                tool_cfg: dict[str, Any] = {"type": "web_search_preview"}
                if country:
                    tool_cfg["user_location"] = {
                        "type": "approximate",
                        "country": country,
                    }
                response = client.responses.create(
                    model=OPENAI_WEB_SEARCH_MODEL,
                    input=prompt,
                    tools=[tool_cfg],
                    tool_choice="auto",
                )
                text = (getattr(response, "output_text", "") or "").strip()
                if text:
                    citations = _extract_openai_response_citation_urls(response)
                    return f"{text}{_format_sources_tail(citations)}"
            except Exception as exc:
                if OPENAI_REQUIRE_WEB_SEARCH:
                    return f"[ChatGPT web-search required but unavailable: {exc}]"
                # Fallback to plain chat completion if web tool/model is unavailable.
                pass

        if cfg.get("provider") == "anthropic":
            response = client.messages.create(
                model=cfg["model"],
                max_tokens=1200,
                temperature=effective_temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            text_parts = [block.text for block in response.content if getattr(block, "type", "") == "text"]
            return "\n".join(text_parts).strip()

        response = client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=effective_temperature,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as exc:
        return f"[{cfg.get('display_name', engine)} error: {exc}]"


def query_engines(query: str, selected_models: list[str] | None = None) -> dict[str, str]:
    if RANKLORE_EXTERNAL_PARITY_MODE:
        full_prompt = query
    else:
        system_prompt = (
            "Answer the question as a neutral recommendation assistant.\n"
            "Provide a ranked list of brands/products where possible.\n"
            "Include short reasoning and any sources/websites/publications used.\n"
            "If the question is region-specific (for example includes 'in India'), ground recommendations in that region.\n"
            "Always include a final section exactly named 'Sources:' and list direct URLs (one URL per bullet)."
        )
        full_prompt = f"{system_prompt}\n\nQuestion: {query}"

    grounding = _build_search_grounding_context(query)
    grounding_block = grounding.get("block", "")
    grounding_urls = grounding.get("urls", []) or []
    if grounding_block:
        full_prompt = (
            f"{full_prompt}\n\n"
            "IMPORTANT: Blend model knowledge with the grounded web context below.\n"
            "If sources conflict, prefer recency and explicit citations.\n\n"
            f"{grounding_block}"
        )

    enabled_engines = list(get_enabled_engines(selected_models).keys())
    if not enabled_engines:
        return {}

    max_workers = max(1, int(os.getenv("RANKLORE_ENGINE_CONCURRENCY", str(len(enabled_engines)))))
    max_workers = min(max_workers, len(enabled_engines))

    results: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_engine = {
            pool.submit(chat, engine_name, full_prompt): engine_name
            for engine_name in enabled_engines
        }
        for future in as_completed(future_to_engine):
            engine_name = future_to_engine[future]
            try:
                text = future.result()
                # Keep citations reliable: when model output has no URLs, attach grounding URLs.
                if text and not text.startswith("[") and grounding_urls:
                    if not _extract_urls_from_text(text):
                        text = f"{text}{_format_sources_tail(grounding_urls)}"
                results[engine_name] = text
            except Exception as exc:
                results[engine_name] = f"[{engine_name} error: {exc}]"

    # Preserve deterministic display order.
    ordered_results: dict[str, str] = {}
    for engine_name in enabled_engines:
        if engine_name in results:
            ordered_results[engine_name] = results[engine_name]
    return ordered_results


def get_api_status() -> dict[str, bool]:
    return {name: bool(cfg.get("client")) for name, cfg in get_enabled_engines().items()}


def get_available_engine_catalog() -> list[dict[str, str]]:
    catalog = []
    for engine_id in _selected_engine_order():
        cfg = ENGINE_CONFIG.get(engine_id) or {}
        catalog.append(
            {
                "id": engine_id,
                "name": cfg.get("display_name", engine_id),
                "model": cfg.get("model", ""),
                "enabled": bool(cfg.get("client")),
            }
        )
    return catalog


def get_search_layer_status() -> dict[str, Any]:
    provider = get_search_provider_name()
    provider_available = is_perplexity_search_enabled()
    return {
        "search_augment_enabled": RANKLORE_SEARCH_AUGMENT_ENABLED,
        "provider": provider,
        "provider_available": provider_available,
        "openai_web_search_enabled": OPENAI_ENABLE_WEB_SEARCH and bool(OPENAI_API_KEY),
        "status": (
            "ready"
            if RANKLORE_SEARCH_AUGMENT_ENABLED and provider_available
            else ("disabled" if not RANKLORE_SEARCH_AUGMENT_ENABLED else "missing_provider")
        ),
    }
