"""Website-aware prompt suggestion generation for project onboarding."""

from __future__ import annotations

import json
import re
from collections import Counter
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse

import requests

from engine.llm_clients import chat
from engine.perplexity_search import search_web

HTTP_TIMEOUT_SECONDS = 6
MAX_PAGE_CHARS = 120_000

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "we",
    "with",
    "you",
    "your",
}

_PRIORITY_PATH_HINTS = (
    "pricing",
    "features",
    "solutions",
    "use-case",
    "usecase",
    "compare",
    "comparison",
    "integrations",
    "customers",
    "case-study",
    "docs",
    "blog",
)


def _clean_text(value: Any, limit: int = 400) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "..."


def _extract_json(raw: str) -> Any:
    if not raw or not raw.strip():
        raise ValueError("Empty model output")

    candidate = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", raw, flags=re.DOTALL).strip()
    start_curly = candidate.find("{")
    start_square = candidate.find("[")
    start = -1
    end = -1
    if start_curly != -1 and (start_square == -1 or start_curly < start_square):
        start = start_curly
        end = candidate.rfind("}")
    elif start_square != -1:
        start = start_square
        end = candidate.rfind("]")
    if start != -1 and end != -1 and end >= start:
        candidate = candidate[start : end + 1]
    return json.loads(candidate)


def _fetch_html(url: str) -> str:
    if not url:
        return ""
    try:
        response = requests.get(
            url,
            timeout=HTTP_TIMEOUT_SECONDS,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; AnswerdeckBot/1.0; +https://answerdeck.local)"
                )
            },
        )
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        if "html" not in content_type:
            return ""
        return (response.text or "")[:MAX_PAGE_CHARS]
    except Exception:
        return ""


def _strip_html(html: str) -> str:
    if not html:
        return ""
    content = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    content = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", content)
    content = re.sub(r"(?is)<noscript[^>]*>.*?</noscript>", " ", content)
    content = re.sub(r"(?s)<[^>]+>", " ", content)
    return _clean_text(unescape(content), limit=2500)


def _extract_first(pattern: str, html: str) -> str:
    match = re.search(pattern, html or "", flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return _clean_text(unescape(re.sub(r"<[^>]+>", " ", match.group(1))), limit=260)


def _extract_meta_description(html: str) -> str:
    patterns = (
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
    )
    for pattern in patterns:
        value = _extract_first(pattern, html)
        if value:
            return value
    return ""


def _normalize_url(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    with_protocol = raw if "://" in raw else f"https://{raw}"
    try:
        parsed = urlparse(with_protocol)
        if not parsed.netloc:
            return raw
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path or ''}".rstrip("/")
    except Exception:
        return raw


def _extract_internal_links(base_url: str, html: str, max_links: int = 16) -> list[str]:
    if not base_url or not html:
        return []

    base_host = (urlparse(base_url).hostname or "").lower().replace("www.", "")
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE)
    selected: list[str] = []
    seen: set[str] = set()

    def priority(link: str) -> tuple[int, int]:
        lower = link.lower()
        hit = sum(1 for token in _PRIORITY_PATH_HINTS if token in lower)
        depth = lower.count("/")
        return (-hit, depth)

    normalized_links = []
    for href in hrefs:
        href = href.strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        full = urljoin(base_url, href)
        parsed = urlparse(full)
        host = (parsed.hostname or "").lower().replace("www.", "")
        if not host or host != base_host:
            continue
        if not parsed.scheme.startswith("http"):
            continue
        clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path or ''}".rstrip("/")
        if clean == base_url:
            continue
        if clean in seen:
            continue
        seen.add(clean)
        normalized_links.append(clean)

    for link in sorted(normalized_links, key=priority):
        if len(selected) >= max_links:
            break
        selected.append(link)
    return selected


def _extract_keywords(texts: list[str], max_terms: int = 12) -> list[str]:
    joined = " ".join(texts)
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+\-]{2,}", joined.lower())
    counts = Counter(
        token for token in tokens if token not in _STOPWORDS and not token.isdigit() and len(token) <= 24
    )
    ordered = [word for word, _ in counts.most_common(max_terms * 2)]
    out: list[str] = []
    for token in ordered:
        if token in out:
            continue
        out.append(token)
        if len(out) >= max_terms:
            break
    return out


def _collect_site_snapshot(website_url: str) -> dict[str, Any]:
    url = _normalize_url(website_url)
    if not url:
        return {"homepage": {}, "pages": [], "keywords": [], "link_count": 0}

    homepage_html = _fetch_html(url)
    homepage = {
        "url": url,
        "title": _extract_first(r"<title[^>]*>(.*?)</title>", homepage_html),
        "meta_description": _extract_meta_description(homepage_html),
        "h1": _extract_first(r"<h1[^>]*>(.*?)</h1>", homepage_html),
        "text_excerpt": _clean_text(_strip_html(homepage_html), limit=520),
    }

    links = _extract_internal_links(url, homepage_html, max_links=12)
    pages: list[dict[str, str]] = []
    for link in links[:3]:
        html = _fetch_html(link)
        if not html:
            continue
        pages.append(
            {
                "url": link,
                "title": _extract_first(r"<title[^>]*>(.*?)</title>", html),
                "meta_description": _extract_meta_description(html),
                "h1": _extract_first(r"<h1[^>]*>(.*?)</h1>", html),
                "text_excerpt": _clean_text(_strip_html(html), limit=340),
            }
        )

    keyword_inputs = [homepage.get("title", ""), homepage.get("meta_description", ""), homepage.get("h1", "")]
    for page in pages:
        keyword_inputs.extend([page.get("title", ""), page.get("meta_description", ""), page.get("h1", "")])

    keywords = _extract_keywords(keyword_inputs, max_terms=14)
    return {
        "homepage": homepage,
        "pages": pages,
        "keywords": keywords,
        "link_count": len(links),
    }


def _build_fallback_prompts(project: dict[str, Any], snapshot: dict[str, Any], max_prompts: int) -> list[str]:
    brand = project.get("name") or "our brand"
    industry = project.get("category") or "our category"
    region = project.get("region") or "global"
    competitors = [c for c in (project.get("competitors") or []) if isinstance(c, str) and c.strip()]
    kws = snapshot.get("keywords", []) or []
    top_kw = kws[0] if kws else industry
    second_kw = kws[1] if len(kws) > 1 else "teams"

    prompts = [
        f"Best {industry} software for {region}",
        f"{brand} alternatives and competitors",
        f"{brand} pricing vs competitors",
        f"How does {brand} compare for {top_kw}?",
        f"Is {brand} good for {second_kw} use cases?",
        f"{brand} reviews and user feedback",
        f"Top {industry} tools with {top_kw}",
        f"{brand} integration options and setup",
    ]
    if competitors:
        for competitor in competitors[:2]:
            prompts.append(f"{brand} vs {competitor} comparison")

    out: list[str] = []
    seen: set[str] = set()
    for prompt in prompts:
        normalized = prompt.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(prompt.strip())
        if len(out) >= max_prompts:
            break
    return out


def _search_signal_rows(project: dict[str, Any]) -> list[dict[str, str]]:
    brand = (project.get("name") or "").strip()
    category = (project.get("category") or "").strip()
    region = (project.get("region") or "").strip()
    if not brand and not category:
        return []

    query = " ".join(
        part
        for part in (
            brand,
            category,
            "software alternatives pricing comparison review",
            region,
        )
        if part
    )
    result = search_web(query=query, max_results=6, max_tokens_per_page=320)
    if not result.get("ok"):
        return []

    rows = []
    for item in result.get("results", [])[:6]:
        rows.append(
            {
                "title": _clean_text(item.get("title", ""), 120),
                "url": str(item.get("url") or "").strip(),
                "snippet": _clean_text(item.get("snippet", ""), 180),
            }
        )
    return rows


def generate_project_prompt_suggestions(project: dict[str, Any], max_prompts: int = 10) -> dict[str, Any]:
    max_prompts = max(3, min(int(max_prompts or 10), 20))
    snapshot = _collect_site_snapshot(project.get("website_url", ""))
    search_rows = _search_signal_rows(project)

    prompt = f"""You are an AI visibility strategist creating prompt ideas for a brand project.

PROJECT:
{json.dumps(project)}

WEBSITE SNAPSHOT:
{json.dumps(snapshot)}

SEARCH SIGNALS:
{json.dumps(search_rows)}

Create {max_prompts} high-quality prompts to track AI visibility and growth.
Output requirements:
1. Prompts must be specific to this website's offering and likely buyer intent.
2. Include a mix: alternatives/comparisons, pricing, use-cases, implementation, and trust-proof queries.
3. Keep each prompt concise (8-14 words).
4. Avoid generic placeholders and duplicate phrasing.
5. At least 3 prompts must clearly include the brand name.

Return ONLY valid JSON:
{{
  "prompts": ["prompt 1", "prompt 2"]
}}"""

    try:
        raw = chat("chatgpt", prompt, temperature=0.35)
        parsed = _extract_json(raw)
        model_prompts = parsed.get("prompts", []) if isinstance(parsed, dict) else []
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in model_prompts:
            text = _clean_text(item, 120)
            normalized = text.lower()
            if not text or normalized in seen:
                continue
            seen.add(normalized)
            cleaned.append(text)
            if len(cleaned) >= max_prompts:
                break
        if cleaned:
            return {"prompts": cleaned, "source": "website+search+llm", "snapshot": snapshot}
    except Exception:
        pass

    fallback = _build_fallback_prompts(project, snapshot, max_prompts=max_prompts)
    return {"prompts": fallback, "source": "website+fallback", "snapshot": snapshot}
