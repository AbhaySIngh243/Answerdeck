"""Client wrappers for all configured LLM engines."""

import os
import time
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


def chat(engine: str, prompt: str) -> str:
    engine = engine.lower()
    cfg = ENGINE_CONFIG.get(engine)
    if not cfg:
        return f"[Unknown engine: {engine}]"
    client = cfg.get("client")
    if client is None:
        return f"[{cfg.get('display_name', engine)} not configured]"

    try:
        if cfg.get("provider") == "anthropic":
            response = client.messages.create(
                model=cfg["model"],
                max_tokens=1200,
                temperature=0.2,
                messages=[{"role": "user", "content": prompt}],
            )
            text_parts = [block.text for block in response.content if getattr(block, "type", "") == "text"]
            return "\n".join(text_parts).strip()

        response = client.chat.completions.create(
            model=cfg["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as exc:
        return f"[{cfg.get('display_name', engine)} error: {exc}]"


def query_engines(query: str, selected_models: list[str] | None = None) -> dict[str, str]:
    system_prompt = (
        "Answer the question as a recommendation assistant.\n"
        "Provide a ranked list of brands/products where possible.\n"
        "Include short reasoning and any sources/websites/publications used."
    )
    full_prompt = f"{system_prompt}\n\nQuestion: {query}"

    results: dict[str, str] = {}
    for engine_name in get_enabled_engines(selected_models):
        results[engine_name] = chat(engine_name, full_prompt)
        time.sleep(0.4)
    return results


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
