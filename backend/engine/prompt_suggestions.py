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
    "its",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "this",
    "to",
    "we",
    "with",
    "you",
    "your",
}

# Tokens too generic to enforce category cohesion (avoid false positives).
_COHESION_SKIP_TOKENS = {
    "home",
    "page",
    "site",
    "web",
    "www",
    "app",
    "get",
    "new",
    "all",
    "any",
    "can",
    "now",
    "use",
    "out",
    "more",
    "here",
    "just",
    "like",
    "into",
    "over",
    "also",
    "only",
    "very",
    "when",
    "where",
    "who",
    "why",
    "way",
    "may",
    "not",
    "but",
    "has",
    "had",
    "was",
    "were",
    "been",
    "being",
    "such",
    "than",
    "then",
    "them",
    "these",
    "those",
    "some",
    "each",
    "both",
    "few",
    "other",
    "another",
    "between",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "again",
    "once",
    "there",
    "well",
    "back",
    "even",
    "still",
    "own",
    "same",
    "most",
    "much",
    "many",
    "make",
    "made",
    "making",
    "need",
    "needs",
    "want",
    "wants",
    "help",
    "helps",
    "free",
    "try",
    "sign",
    "learn",
    "see",
    "read",
    "click",
    "start",
    "today",
    "world",
    "global",
    "online",
    "digital",
    "solution",
    "solutions",
    "service",
    "services",
    "product",
    "products",
    "company",
    "business",
    "customer",
    "customers",
    "team",
    "teams",
    "platform",
    "software",
    "tool",
    "tools",
    "data",
    "cloud",
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


def _normalize_words(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _canonical_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _contains_brand(value: str, brand: str) -> bool:
    brand_clean = _canonical_text(brand)
    if not brand_clean:
        return False
    return brand_clean in _canonical_text(value)


def _word_count(value: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", value or ""))


def _is_valid_prompt(value: str, brand: str) -> bool:
    text = _normalize_words(value)
    if not text:
        return False
    if _contains_brand(text, brand):
        return False
    count = _word_count(text)
    if count < 5 or count > 8:
        return False
    if re.search(r"\b(vs|versus)\b", text, flags=re.IGNORECASE):
        return False
    return True


def _short_category(category: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9+\-/&]*", str(category or "").strip())
    if not tokens:
        return "software"
    return " ".join(tokens[:2]).lower()


def _build_fallback_prompts(project: dict[str, Any]) -> list[str]:
    category = _short_category(project.get("category") or "")
    candidates = [
        f"Which are the best {category} options",
        f"Recommended {category} tools for teams like us",
        f"Best {category} options for tight budgets",
    ]
    brand = project.get("name") or ""
    return [c for c in candidates if _is_valid_prompt(c, brand)][:3]


def _build_site_context_for_llm(snapshot: dict[str, Any]) -> str:
    hp = snapshot.get("homepage") or {}
    parts: list[str] = []
    title = _clean_text(hp.get("title") or "", 140)
    h1 = _clean_text(hp.get("h1") or "", 120)
    meta = _clean_text(hp.get("meta_description") or "", 220)
    excerpt = _clean_text(hp.get("text_excerpt") or "", 360)
    keywords = snapshot.get("keywords") or []
    kw_str = ", ".join(str(k) for k in keywords[:10] if k)

    if title:
        parts.append(f"Homepage title: {title}")
    if h1:
        parts.append(f"Primary heading: {h1}")
    if meta:
        parts.append(f"Meta description: {meta}")
    if excerpt:
        parts.append(f"Homepage text excerpt: {excerpt}")
    if kw_str:
        parts.append(f"Keywords from site headings: {kw_str}")

    for page in (snapshot.get("pages") or [])[:2]:
        bits = []
        if page.get("title"):
            bits.append(_clean_text(page["title"], 120))
        if page.get("h1"):
            bits.append(_clean_text(page["h1"], 100))
        if bits:
            parts.append("Inner page: " + " — ".join(bits))

    if not parts:
        return "No website text could be fetched; rely on category and region only."
    return "\n".join(parts)


def _cohesion_theme_tokens(project: dict[str, Any], snapshot: dict[str, Any]) -> set[str]:
    found: set[str] = set()
    category_raw = str(project.get("category") or "")
    for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+\-]{2,}", category_raw.lower()):
        if token not in _STOPWORDS and token not in _COHESION_SKIP_TOKENS:
            found.add(token)
    for kw in snapshot.get("keywords") or []:
        t = str(kw).lower().strip()
        if len(t) >= 3 and t not in _STOPWORDS and t not in _COHESION_SKIP_TOKENS:
            found.add(t)
    hp = snapshot.get("homepage") or {}
    for field in ("title", "h1", "meta_description"):
        chunk = str(hp.get(field) or "")
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+\-]{2,}", chunk.lower()):
            if token not in _STOPWORDS and token not in _COHESION_SKIP_TOKENS:
                found.add(token)
    for page in snapshot.get("pages") or []:
        for field in ("title", "h1"):
            chunk = str(page.get(field) or "")
            for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+\-]{2,}", chunk.lower()):
                if token not in _STOPWORDS and token not in _COHESION_SKIP_TOKENS:
                    found.add(token)
    if not found:
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+\-]{2,}", category_raw.lower()):
            if token not in _STOPWORDS:
                found.add(token)
    return found


def _prompt_word_tokens(prompt: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z][a-zA-Z0-9+\-]*", (prompt or "").lower()))


def _prompt_coheres_with_theme(prompt: str, theme_tokens: set[str]) -> bool:
    if not theme_tokens:
        return True
    return bool(_prompt_word_tokens(prompt) & theme_tokens)


def _valid_prompt1_discovery(text: str) -> bool:
    t = text.lower()
    if any(x in t for x in ("best", "top", "which", "what", "options", "picks", "choices", "alternatives")):
        return True
    return bool(re.search(r"\b(find|discover|looking for)\b", t))


_PROMPT2_FRAMING_RE = re.compile(
    r"(?:"
    r"\brecommended\b|"
    r"\bwhich are the best\b|\bwhich is the best\b|\bwhat are the best\b|"
    r"\btop options\b|\btop picks\b|\bbest options\b|\bbest picks\b|\bbest choices\b|"
    r"\bbest .{1,40} for\b"
    r")",
    re.IGNORECASE,
)


def _valid_prompt2_framing(text: str) -> bool:
    if _PROMPT2_FRAMING_RE.search(text or ""):
        return True
    t = text.lower()
    return "best" in t and " for " in t


_PROMPT3_CONSTRAINT_RE = re.compile(
    r"(?:"
    r"\bunder\b|\$\s*[\d,.]+|\b\d{3,}\b|"
    r"\bbudgets?\b|\baffordable\b|\bcheap\b|\bpremium\b|\benterprise\b|"
    r"\btight\b|\blow[- ]cost\b|"
    r"\bsmall\s+(?:business|team|space|room|apartment|office|home)s?\b|"
    r"\bwhen\s+[a-z]|"
    r"\bfor\s+(?:home|travel|renovation|renovating|rentals|renters|students|families|apartments)\b"
    r")",
    re.IGNORECASE,
)


def _valid_prompt3_constraint(text: str) -> bool:
    return bool(_PROMPT3_CONSTRAINT_RE.search(text or ""))


def _validate_prompt_triple(prompts: list[str], theme_tokens: set[str]) -> bool:
    if len(prompts) != 3:
        return False
    p1, p2, p3 = prompts
    if len({p1.lower(), p2.lower(), p3.lower()}) < 3:
        return False
    for p in prompts:
        if not _prompt_coheres_with_theme(p, theme_tokens):
            return False
    if not _valid_prompt1_discovery(p1):
        return False
    if not _valid_prompt2_framing(p2):
        return False
    if not _valid_prompt3_constraint(p3):
        return False
    return True


def _extract_ordered_prompt_triple(raw: str, brand: str) -> list[str]:
    try:
        parsed = _extract_json(raw)
    except Exception:
        return []
    if not isinstance(parsed, dict):
        return []
    slot_keys: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("prompt_1", ("Prompt 1",)),
        ("prompt_2", ("Prompt 2",)),
        ("prompt_3", ("Prompt 3",)),
    )
    out: list[str] = []
    for primary, alternates in slot_keys:
        val = parsed.get(primary)
        if val in (None, ""):
            for alt in alternates:
                if parsed.get(alt) not in (None, ""):
                    val = parsed.get(alt)
                    break
        text = _normalize_words(str(val or ""))
        if not _is_valid_prompt(text, brand):
            return []
        out.append(text)
    return out


def _extract_strict_prompts(raw: str, brand: str) -> list[str]:
    """Backward-compatible loose extraction (unordered); prefer _extract_ordered_prompt_triple."""
    triple = _extract_ordered_prompt_triple(raw, brand)
    if len(triple) == 3:
        return triple
    try:
        parsed = _extract_json(raw)
    except Exception:
        return []
    candidate_values: list[str] = []
    if isinstance(parsed, dict):
        if isinstance(parsed.get("prompts"), list):
            candidate_values.extend(str(item or "") for item in parsed.get("prompts", []))
        for key in ("prompt_1", "prompt_2", "prompt_3", "Prompt 1", "Prompt 2", "Prompt 3"):
            if key in parsed:
                candidate_values.append(str(parsed.get(key) or ""))
    elif isinstance(parsed, list):
        candidate_values.extend(str(item or "") for item in parsed)

    cleaned: list[str] = []
    seen: set[str] = set()
    for candidate in candidate_values:
        text = _normalize_words(candidate)
        if not _is_valid_prompt(text, brand):
            continue
        norm = text.lower()
        if norm in seen:
            continue
        seen.add(norm)
        cleaned.append(text)
        if len(cleaned) >= 3:
            break
    return cleaned


def _build_suggestion_user_prompt(
    project_name: str,
    category: str,
    region: str,
    site_context: str,
    theme_hint: str,
) -> str:
    return f"""Generate exactly 3 real search-style prompts a buyer might type. Do not use the brand name (it's context only).

Website-derived context (may be partial if fetch failed):
{site_context}

Requirements:
- Each JSON value must be the raw query text only (no "Prompt 1:" prefixes or labels).
- Each prompt must be 5-8 words only, natural conversational language, real buying or decision intent.
- Do not mention the brand name in any prompt.
- All three prompts must stay in the SAME product or service niche implied by the site context and category. Do not jump to unrelated parent categories (example: if the site is smart lighting, do not output generic home electronics).
- Make prompts specific enough to surface competitor brands and alternatives.
- Avoid "vs" / "versus" brand comparisons.

Slot rules:
- prompt_1: discovery intent (best / top / which / what options in this niche).
- prompt_2: recommendation-style framing only. Prefer openers like: recommended, which are the best, top options, best picks, best choices, best <niche> for <audience>. Do not use a bare category pivot that ignores the site niche.
- prompt_3: must reflect a constraint or scenario: price/budget (under, affordable, budget, tight budget), audience/space (small apartment, small team), timing (when renovating), or setting (for home, for travel) — and must read differently in intent from prompt_1 and prompt_2.

Brand (do not echo): {project_name}
Category context: {category}
Region context: {region or "global"}
Theme anchor tokens (must be reflected across prompts via wording): {theme_hint}

Return ONLY valid JSON:
{{
  "prompt_1": "...",
  "prompt_2": "...",
  "prompt_3": "..."
}}"""


def generate_competitor_suggestions(project: dict[str, Any], max_items: int = 6) -> list[str]:
    """Use LLM + website context to suggest competitors when no Mention data exists."""
    project_name = str(project.get("name") or "").strip()
    category = _short_category(project.get("category") or "")
    region = str(project.get("region") or "").strip()
    existing = [str(c).strip() for c in (project.get("competitors") or []) if c]

    snapshot = _collect_site_snapshot(project.get("website_url") or "")
    site_context = _build_site_context_for_llm(snapshot)

    existing_clause = ""
    if existing:
        existing_clause = f"\nAlready known competitors (do not repeat): {', '.join(existing[:8])}"

    prompt = f"""List {max_items} real competitor brand names in the same market. JSON array of strings only.
Given the brand and site context:

Brand: {project_name}
Category: {category}
Region: {region or "global"}
{existing_clause}

Website context:
{site_context}

Rules:
- Return only real brand/company names that compete in the same market segment.
- Do not include the brand itself.
- Short names only (1-3 words each, the brand name people search for).

Return ONLY a valid JSON array of strings, e.g. ["Competitor A", "Competitor B"]"""

    try:
        raw = chat("chatgpt", prompt, temperature=0.3)
        parsed = _extract_json(raw)
        if isinstance(parsed, list):
            existing_lower = {e.lower() for e in existing}
            existing_lower.add(project_name.lower())
            results = []
            for item in parsed:
                name = str(item or "").strip()
                if name and name.lower() not in existing_lower and len(name) < 60:
                    results.append(name)
                    existing_lower.add(name.lower())
            return results[:max_items]
    except Exception:
        pass
    return []


def suggest_industry_label(project: dict[str, Any]) -> str:
    """
    Best-effort industry inference for onboarding.
    Preference:
    - Keep existing category if provided
    - Otherwise infer from website snapshot via a short LLM classification
    """
    category = _clean_text(project.get("category") or "", limit=80).strip()
    if category:
        return category

    snapshot = _collect_site_snapshot(project.get("website_url") or "")
    site_context = _build_site_context_for_llm(snapshot)
    if not site_context:
        return ""

    prompt = f"""From the text below, reply with a short industry label only (2–5 words, plain English).
No quotes, no explanation, no list.

Website context:
{site_context}

Return ONLY the label text."""

    try:
        raw = chat("chatgpt", prompt, temperature=0.1)
        label = _clean_text(raw, limit=80).strip()
        label = re.sub(r"^[-*\u2022\s]+", "", label).strip()
        # Guardrails: avoid empty / overly verbose outputs.
        if not label or len(label.split()) > 8:
            return ""
        return label
    except Exception:
        return ""


def generate_project_prompt_suggestions(project: dict[str, Any], max_prompts: int = 10) -> dict[str, Any]:
    _ = max_prompts
    project_name = str(project.get("name") or "").strip()
    category = _short_category(project.get("category") or "")
    region = str(project.get("region") or "").strip()

    snapshot = _collect_site_snapshot(project.get("website_url") or "")
    site_context = _build_site_context_for_llm(snapshot)
    theme_tokens = _cohesion_theme_tokens(project, snapshot)
    theme_hint = ", ".join(sorted(theme_tokens)[:14]) if theme_tokens else category

    base_prompt = _build_suggestion_user_prompt(
        project_name, category, region, site_context, theme_hint
    )

    def attempt_llm(extra: str, temperature: float) -> list[str] | None:
        body = f"{base_prompt}{extra}"
        raw = chat("chatgpt", body, temperature=temperature)
        triple = _extract_ordered_prompt_triple(raw, brand=project_name)
        if len(triple) != 3:
            return None
        if not _validate_prompt_triple(triple, theme_tokens):
            return None
        return triple

    retry_suffix = (
        "\n\nRegenerate strictly: the previous JSON failed validation or drifted off-theme. "
        f"Keep all three prompts in this product space: {theme_hint}. "
        "Honor prompt_1 discovery, prompt_2 recommendation-style, prompt_3 constraint/scenario. "
        "Do not broaden to unrelated parent categories."
    )

    try:
        triple = attempt_llm("", 0.35)
        if triple is not None:
            return {"prompts": triple, "source": "strict-rule-llm"}
        triple = attempt_llm(retry_suffix, 0.15)
        if triple is not None:
            return {"prompts": triple, "source": "strict-rule-llm"}
    except Exception:
        pass

    fallback = _build_fallback_prompts(project)
    if len(fallback) < 3:
        fallback = [
            "Which are the best software options",
            "Recommended software tools for growing teams",
            "Best software options for tight budgets",
        ]
    return {"prompts": fallback[:3], "source": "strict-rule-fallback"}
