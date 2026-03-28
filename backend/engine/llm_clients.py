"""Client wrappers for all configured LLM engines."""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

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


def _extract_openai_response_citation_urls(response: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
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
                    url = getattr(ann, "url", "") or ""
                    if not url:
                        continue
                    if url not in seen:
                        seen.add(url)
                        urls.append(url)
    except Exception:
        return []
    return urls


def _format_sources_tail(urls: list[str]) -> str:
    clean = [u.strip() for u in urls if u and u.strip()]
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


def _extract_perplexity_citation_urls(response: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    candidates = getattr(response, "citations", None)
    if not candidates and isinstance(response, dict):
        candidates = response.get("citations")
    for item in candidates or []:
        value = str(item or "").strip()
        if value and value not in seen:
            seen.add(value)
            urls.append(value)
    return urls


def chat(engine: str, prompt: str) -> str:
    engine = engine.lower()
    cfg = ENGINE_CONFIG.get(engine)
    if not cfg:
        return f"[Unknown engine: {engine}]"
    client = cfg.get("client")
    if client is None:
        return f"[{cfg.get('display_name', engine)} not configured]"

    try:
        if engine == "perplexity":
            if not PERPLEXITY_ENABLE_WEB_SEARCH and PERPLEXITY_REQUIRE_WEB_SEARCH:
                return "[Perplexity web-search required but disabled via PERPLEXITY_ENABLE_WEB_SEARCH]"
            response = client.chat.completions.create(
                model=cfg["model"],
                messages=[{"role": "user", "content": prompt}],
                temperature=RANKLORE_LLM_TEMPERATURE,
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
                temperature=RANKLORE_LLM_TEMPERATURE,
                messages=[{"role": "user", "content": prompt}],
            )
            text_parts = [block.text for block in response.content if getattr(block, "type", "") == "text"]
            return "\n".join(text_parts).strip()

        response = client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=RANKLORE_LLM_TEMPERATURE,
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
                results[engine_name] = future.result()
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
