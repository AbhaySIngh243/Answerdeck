"""AI visibility prompt suggestions for project onboarding.

Generates category-level tracking queries a marketing team would run across LLMs
to measure whether their brand gets mentioned and how it ranks — not consumer
deal-hunting or coupon-style shopping queries.
"""

from __future__ import annotations

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse

import requests

from engine.llm_clients import chat_with_fallback
from engine.perplexity_search import search_web

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 3
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

# Prompts that measure visibility — not bargain hunting.
_VISIBILITY_INTENT_RE = re.compile(
    r"(?:"
    r"\bbest\b|\btop\b|\bleading\b|\brecommended\b|\bmost\s+(?:reliable|popular|trusted|efficient)\b|"
    r"\bwhich\b|\bwhat\s+(?:are\s+the|is\s+the)\b|\brank(?:ed|ing)?\b|"
    r"\bbrands?\s+for\b|\boptions\s+for\b|\bworth\s+(?:buying|considering)\b"
    r")",
    re.IGNORECASE,
)

_SHOPPING_JUNK_RE = re.compile(
    r"(?:"
    r"\bdeals?\b|\bdiscounts?\b|\bcoupons?\b|\bpromo(?:tion)?s?\b|\bsales?\b|"
    r"\bholiday\b|\bblack\s+friday\b|\bexclusive\s+offers?\b|\bwhere\s+can\s+i\s+find\b|"
    r"\bcheapest\b|\blowest\s+price\b|\bsave\s+money\b|\bbargain\b|\bclearance\b|"
    r"\brebate\b|\bcashback\b|\bfree\s+shipping\b|\bprice\s+drop\b|\bmarkdown\b"
    r")",
    re.IGNORECASE,
)

_PRIORITY_PATH_HINTS = (
    "pricing",
    "features",
    "solutions",
    "use-case",
    "usecase",
    "for-",
    "for teams",
    "enterprise",
    "compare",
    "comparison",
    "integrations",
    "customers",
    "case-study",
    "case study",
    "security",
    "compliance",
    "soc",
    "gdpr",
    "docs",
    "blog",
    "product",
    "platform",
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
    # Fetch up to 4 inner pages for richer context (kept small to stay fast).
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(_fetch_html, link): link for link in links[:4]}
        for future in as_completed(futures):
            link = futures[future]
            html = future.result()
            if not html:
                continue
            pages.append(
                {
                    "url": link,
                    "title": _extract_first(r"<title[^>]*>(.*?)</title>", html),
                    "meta_description": _extract_meta_description(html),
                    "h1": _extract_first(r"<h1[^>]*>(.*?)</h1>", html),
                    "text_excerpt": _clean_text(_strip_html(html), limit=420),
                }
            )

    keyword_inputs = [homepage.get("title", ""), homepage.get("meta_description", ""), homepage.get("h1", "")]
    for page in pages:
        keyword_inputs.extend([page.get("title", ""), page.get("meta_description", ""), page.get("h1", "")])

    keywords = _extract_keywords(keyword_inputs, max_terms=18)

    # Pull some buyer-oriented phrases from the raw excerpts (e.g. "for startups", "SOC 2", "Slack integration").
    buyer_signals: list[str] = []
    for chunk in [homepage.get("text_excerpt", "")] + [p.get("text_excerpt", "") for p in pages]:
        for m in re.findall(
            r"(?i)(for\s+(?:startups?|teams?|companies?|enterprises?|smb|scaleups?|founders?)[^\.\n]{0,40}"
            r"|soc\s*2|gdpr|hipaa|iso|compliance|security|integrat\w+|slack|salesforce|hubspot|notion|"
            r"under\s+\$?\d|per\s+(?:user|month|seat)|pricing starts)",
            chunk,
        ):
            s = _clean_text(m, 80)
            if s and s not in buyer_signals:
                buyer_signals.append(s)
            if len(buyer_signals) >= 6:
                break

    return {
        "homepage": homepage,
        "pages": pages,
        "keywords": keywords,
        "buyer_signals": buyer_signals,
        "link_count": len(links),
    }


def collect_site_snapshot(website_url: str) -> dict[str, Any]:
    return _collect_site_snapshot(website_url)


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
    if count < 5 or count > 16:
        return False
    if re.search(r"\b(vs|versus)\b", text, flags=re.IGNORECASE):
        return False
    if _SHOPPING_JUNK_RE.search(text):
        return False
    if not _VISIBILITY_INTENT_RE.search(text):
        return False
    return True


def _short_category(category: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9+\-/&]*", str(category or "").strip())
    if not tokens:
        return "software"
    return " ".join(tokens[:2]).lower()


def _build_fallback_prompts(project: dict[str, Any]) -> list[str]:
    """Visibility-tracking fallbacks anchored to product categories and market segments."""
    category = _short_category(project.get("category") or "")
    region = str(project.get("region") or "").strip()
    brand = project.get("name") or ""
    profile = project.get("brand_profile") or {}
    if not isinstance(profile, dict):
        profile = {}

    categories = [
        str(c).strip()
        for c in (profile.get("product_categories") or profile.get("product_lines") or [])
        if str(c or "").strip()
    ]
    use_cases = [
        str(u).strip()
        for u in (profile.get("use_cases") or profile.get("typical_scenarios") or [])
        if str(u or "").strip()
    ]
    keywords = [str(k).lower() for k in (project.get("keywords") or []) if k]

    if not categories:
        for kw in keywords:
            if kw not in _COHESION_SKIP_TOKENS and len(kw) > 3:
                categories.append(kw)
    if not categories and category and category not in ("software", ""):
        categories = [category]

    region_suffix = f" in {region}" if region and region.lower() != "global" else ""
    ideas: list[str] = []

    for cat in categories[:5]:
        cat_clean = _clean_text(cat, 50)
        if not cat_clean:
            continue
        ideas.extend([
            f"Best {cat_clean} brands in 2025{region_suffix}",
            f"Top {cat_clean} for home and everyday use",
            f"Most recommended {cat_clean} options right now",
            f"Leading {cat_clean} for quality and reliability",
        ])

    for use_case in use_cases[:3]:
        uc = _clean_text(use_case, 60)
        if not uc:
            continue
        ideas.append(f"Best products for {uc}{region_suffix}")

    if category and category not in ("software", ""):
        ideas.extend([
            f"Best {category} brands ranked for 2025{region_suffix}",
            f"Top {category} options worth considering today",
        ])

    if not ideas:
        cat = category or "products"
        ideas = [
            f"Best {cat} brands in 2025{region_suffix}",
            f"Top {cat} for quality and reliability",
            f"Most recommended {cat} options right now",
        ]

    out: list[str] = []
    seen: set[str] = set()
    for candidate in ideas:
        key = candidate.lower()
        if key in seen:
            continue
        if _is_valid_prompt(candidate, brand):
            seen.add(key)
            out.append(candidate)
        if len(out) >= 6:
            break

    return out[:6]


def build_fallback_prompt_suggestions(project: dict[str, Any]) -> dict[str, Any]:
    ctx = dict(project or {})
    snap = ctx.pop("snapshot", None) or {}
    if isinstance(snap, dict):
        if not ctx.get("keywords"):
            ctx["keywords"] = snap.get("keywords") or []
        if not ctx.get("buyer_signals"):
            ctx["buyer_signals"] = snap.get("buyer_signals") or []

    fallback = _build_fallback_prompts(ctx)
    if len(fallback) < 3:
        cat = _short_category(ctx.get("category") or "products")
        region = str(ctx.get("region") or "").strip()
        region_suffix = f" in {region}" if region and region.lower() != "global" else ""
        fallback = [
            f"Best {cat} brands in 2025{region_suffix}",
            f"Top {cat} for quality and reliability",
            f"Most recommended {cat} options right now",
        ]
    return {"prompts": fallback[:6], "source": "brand-aware-fallback"}


def _build_site_context_for_llm(snapshot: dict[str, Any]) -> str:
    hp = snapshot.get("homepage") or {}
    parts: list[str] = []
    title = _clean_text(hp.get("title") or "", 140)
    h1 = _clean_text(hp.get("h1") or "", 120)
    meta = _clean_text(hp.get("meta_description") or "", 220)
    excerpt = _clean_text(hp.get("text_excerpt") or "", 420)
    keywords = snapshot.get("keywords") or []
    kw_str = ", ".join(str(k) for k in keywords[:12] if k)
    signals = snapshot.get("buyer_signals") or []

    if title:
        parts.append(f"Homepage title: {title}")
    if h1:
        parts.append(f"Primary heading: {h1}")
    if meta:
        parts.append(f"Meta description: {meta}")
    if excerpt:
        parts.append(f"Homepage excerpt: {excerpt}")
    if kw_str:
        parts.append(f"Key terms: {kw_str}")
    if signals:
        parts.append("Buyer language on site: " + " | ".join(signals[:5]))

    for page in (snapshot.get("pages") or [])[:3]:
        bits = []
        if page.get("title"):
            bits.append(_clean_text(page["title"], 110))
        if page.get("h1"):
            bits.append(_clean_text(page["h1"], 90))
        if bits:
            parts.append("Page: " + " — ".join(bits))

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
    if any(x in t for x in ("best", "top", "which", "what", "options", "picks", "choices", "alternatives", "buy")):
        return True
    return bool(re.search(r"\b(find|discover|looking for)\b", t))


_PROMPT2_FRAMING_RE = re.compile(
    r"(?:"
    r"\brecommended\b|"
    r"\bwhich (?:one|brand|option|product)\b|"
    r"\bwhich are the best\b|\bwhich is the best\b|\bwhat are the best\b|"
    r"\btop options\b|\btop picks\b|\bbest options\b|\bbest picks\b|\bbest choices\b|"
    r"\bbest .{1,60} for\b|"
    r"\bcompare\b|\balternatives?\b|\bworth buying\b|\breliable\b"
    r")",
    re.IGNORECASE,
)


def _valid_prompt2_framing(text: str) -> bool:
    if _PROMPT2_FRAMING_RE.search(text or ""):
        return True
    t = text.lower()
    return ("best" in t and " for " in t) or ("buy" in t and "which" in t)


_PROMPT3_CONSTRAINT_RE = re.compile(
    r"(?:"
    r"\bunder\b|\$\s*[\d,.]+|\b\d{3,}\b|"
    r"\bbudgets?\b|\baffordable\b|\bcheap\b|\bpremium\b|\benterprise\b|"
    r"\btight\b|\blow[- ]cost\b|\bvalue for money\b|"
    r"\bsmall\s+(?:business|team|space|room|apartment|office|home)s?\b|"
    r"\bafter[- ]sales\b|\bsupport\b|\bwarranty\b|\breliable\b|\bdurable\b|"
    r"\bwhen\s+[a-z]|"
    r"\bfor\s+(?:home|travel|renovation|renovating|rentals|renters|students|families|apartments|everyday|gaming|work|teams)\b"
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


def _build_web_research_context(research: dict[str, Any]) -> str:
    parts: list[str] = []
    kg = research.get("knowledge_graph") or {}
    if isinstance(kg, dict):
        for key in ("title", "type", "description", "website"):
            val = _clean_text(kg.get(key) or "", 200)
            if val:
                parts.append(f"Knowledge graph {key}: {val}")

    for title in (research.get("search_titles") or [])[:6]:
        t = _clean_text(title, 120)
        if t:
            parts.append(f"Search result title: {t}")

    for snippet in (research.get("search_snippets") or [])[:8]:
        s = _clean_text(snippet, 220)
        if s:
            parts.append(f"Search snippet: {s}")

    if not parts:
        return "No web research results available."
    return "\n".join(parts)


def _research_brand_via_web(
    brand_name: str,
    category: str,
    region: str,
    website_url: str = "",
) -> dict[str, Any]:
    """Use Serper (or configured search provider) to learn what the brand sells."""
    brand = (brand_name or "").strip()
    if not brand:
        return {"search_snippets": [], "search_titles": [], "knowledge_graph": {}}

    region_bit = f" {region}" if region and region.lower() != "global" else ""
    category_bit = f" {category}" if category and category not in ("software", "") else ""
    queries = [
        f"{brand} company products categories what they make{category_bit}{region_bit}",
        f"what does {brand} sell market segments{category_bit}",
    ]
    if website_url:
        host = (urlparse(_normalize_url(website_url)).hostname or "").replace("www.", "")
        if host:
            queries.append(f"{brand} {host} product lines services")

    snippets: list[str] = []
    titles: list[str] = []
    knowledge_graph: dict[str, Any] = {}

    try:
        with ThreadPoolExecutor(max_workers=min(3, len(queries))) as pool:
            futures = {
                pool.submit(search_web, query, 5): query
                for query in queries[:3]
            }
            for future in as_completed(futures, timeout=7):
                try:
                    result = future.result()
                except Exception:
                    continue
                if not isinstance(result, dict) or not result.get("ok"):
                    continue
                for item in result.get("results") or []:
                    if not isinstance(item, dict):
                        continue
                    title = _clean_text(item.get("title") or "", 140)
                    snippet = _clean_text(item.get("snippet") or "", 260)
                    if title:
                        titles.append(title)
                    if snippet:
                        snippets.append(snippet)
                kg = result.get("knowledge_graph")
                if isinstance(kg, dict) and kg and not knowledge_graph:
                    knowledge_graph = kg
    except Exception as exc:
        log.info("brand web research failed for %s: %s", brand, exc)

    return {
        "search_snippets": snippets[:14],
        "search_titles": titles[:10],
        "knowledge_graph": knowledge_graph,
    }


def _synthesize_brand_intelligence_profile(
    *,
    brand_name: str,
    category: str,
    region: str,
    snapshot: dict[str, Any],
    web_research: dict[str, Any],
) -> dict[str, Any]:
    """Turn site text + Serper research into a crisp brand profile for prompt generation."""
    site_context = _build_site_context_for_llm(snapshot)
    web_context = _build_web_research_context(web_research)
    empty_profile = {
        "brand_summary": category or brand_name,
        "product_categories": [],
        "product_lines": [],
        "market_segments": [],
        "use_cases": [],
        "decision_factors": [],
        "competitive_themes": [],
        "category_language": [],
    }

    if (
        site_context.startswith("No website")
        and not (web_research.get("search_snippets") or web_research.get("knowledge_graph"))
    ):
        if category:
            empty_profile["product_categories"] = [category]
        return empty_profile

    prompt = f"""You are a brand intelligence analyst helping an AI visibility platform (like Profound).

Read the brand research below and produce a JSON profile of what this company actually sells and where it competes.

Brand (for context only — never put in tracking prompts): {brand_name}
Industry hint: {category or "unknown"}
Region focus: {region or "global"}

Website context:
{site_context}

Web search research (Serper/Google):
{web_context}

Return ONLY this JSON:
{{
  "brand_summary": "one sentence: who they are and what markets they compete in",
  "product_categories": ["3-6 specific product/service categories they are known for, e.g. 'refrigerators', 'OLED TVs', 'project management software'"],
  "product_lines": ["2-5 named product lines or business units if known"],
  "market_segments": ["2-4 market segments, e.g. 'consumer electronics', 'home appliances', 'B2B SaaS'"],
  "use_cases": ["3-5 real buyer scenarios where someone asks AI for recommendations, e.g. 'kitchen renovation', 'home theater setup', 'remote team collaboration'"],
  "decision_factors": ["quality", "reliability", "energy efficiency", "design", "price tier", ... up to 6 factors buyers weigh"],
  "competitive_themes": ["2-4 themes this brand competes on, e.g. 'smart home integration', 'premium OLED displays'"],
  "category_language": ["6-10 natural phrases people use when asking AI to recommend in this space"]
}}"""

    try:
        raw = chat_with_fallback(prompt, temperature=0.15, json_mode=True)
        parsed = _extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("brand profile not a dict")
        return {
            "brand_summary": _clean_text(parsed.get("brand_summary") or category, 180),
            "product_categories": [
                _clean_text(c, 60)
                for c in (parsed.get("product_categories") or [])
                if c
            ][:6],
            "product_lines": [_clean_text(p, 60) for p in (parsed.get("product_lines") or []) if p][:5],
            "market_segments": [
                _clean_text(m, 60) for m in (parsed.get("market_segments") or []) if m
            ][:4],
            "use_cases": [_clean_text(u, 70) for u in (parsed.get("use_cases") or []) if u][:5],
            "decision_factors": [
                _clean_text(d, 40) for d in (parsed.get("decision_factors") or []) if d
            ][:6],
            "competitive_themes": [
                _clean_text(t, 70) for t in (parsed.get("competitive_themes") or []) if t
            ][:4],
            "category_language": [
                str(x).lower().strip() for x in (parsed.get("category_language") or []) if x
            ][:12],
        }
    except Exception:
        kws = snapshot.get("keywords") or []
        cats = [category] if category else []
        for kw in kws:
            t = str(kw).strip()
            if t and t not in _COHESION_SKIP_TOKENS:
                cats.append(t)
        return {
            **empty_profile,
            "brand_summary": category or brand_name,
            "product_categories": cats[:5],
            "category_language": [k.lower() for k in kws[:8]],
        }


def _synthesize_offering_brief(
    snapshot: dict[str, Any], category: str, brand_name: str
) -> dict[str, Any]:
    """Backward-compatible alias — callers should prefer _synthesize_brand_intelligence_profile."""
    return _synthesize_brand_intelligence_profile(
        brand_name=brand_name,
        category=category,
        region="",
        snapshot=snapshot,
        web_research={},
    )


def _build_visibility_prompt_generation_prompt(
    project_name: str,
    category: str,
    region: str,
    profile: dict[str, Any],
    site_context: str,
    web_context: str,
) -> str:
    """Generate prompts a marketing team tracks to measure AI brand visibility."""
    summary = profile.get("brand_summary") or category
    categories = ", ".join(profile.get("product_categories") or []) or category
    lines = ", ".join(profile.get("product_lines") or []) or "(none identified)"
    segments = ", ".join(profile.get("market_segments") or []) or "(general market)"
    use_cases = "\n- ".join(profile.get("use_cases") or ["standard category evaluation"])
    factors = ", ".join(profile.get("decision_factors") or ["quality", "reliability", "value"])
    themes = ", ".join(profile.get("competitive_themes") or [])
    language = ", ".join(profile.get("category_language") or [])

    return f"""You help brand marketing teams set up AI visibility tracking (similar to Profound).

They will run these queries across ChatGPT, Perplexity, Gemini, and Claude to see whether their brand gets mentioned and where it ranks versus competitors.

Brand being tracked (NEVER include in prompts): {project_name}
What they do: {summary}
Product categories: {categories}
Product lines: {lines}
Market segments: {segments}
Region focus: {region or "global"}

Buyer scenarios where AI recommends brands:
- {use_cases}

Decision factors buyers weigh: {factors}
Competitive themes: {themes or "(category leadership, quality, innovation)"}
Natural category language: {language or "(none extracted)"}

Website context:
{site_context}

Web research:
{web_context}

Task: Write 10-12 short queries a marketing team would track to measure brand visibility in AI answers.

GOOD examples (for a home appliance / electronics brand):
- "best refrigerators for large families in 2025"
- "top OLED TV brands for home theater"
- "most reliable washer dryer brands right now"
- "leading smart kitchen appliances for renovation"
- "best energy efficient fridge brands"

GOOD examples (for B2B SaaS):
- "best project management tools for remote teams 2025"
- "top CRM platforms for small sales teams"
- "most recommended analytics tools for startups"

BAD — never generate these:
- "where can I find deals on smart TVs"
- "holiday discounts on appliances"
- "exclusive offers on home entertainment"
- Any coupon, sale, discount, bargain, or deal-hunting language

Rules:
- Category-level recommendation queries where AI naturally lists brand names in the answer
- Mix: category leadership ("best X 2025"), use-case ("best X for Y"), segment ("top X brands for Z")
- 5-16 words each, natural language, like a real person asking an AI assistant
- NEVER mention "{project_name}" or close variants
- No "vs" direct head-to-head comparisons
- Anchor to THIS brand's actual categories and use cases from the research above
- Do not repeat the same category with tiny wording changes

Return ONLY a JSON array of strings:
["prompt one", "prompt two", "..."]"""


def _build_rich_candidate_prompt(
    project_name: str,
    category: str,
    region: str,
    brief: dict[str, Any],
    site_context: str,
) -> str:
    """Backward-compatible wrapper."""
    return _build_visibility_prompt_generation_prompt(
        project_name,
        category,
        region,
        brief,
        site_context,
        "See website context above.",
    )


def _score_prompt_specificity(prompt: str, profile: dict[str, Any], keywords: list[str]) -> float:
    """Higher is better. Rewards category-specific visibility prompts, penalizes junk."""
    p = (prompt or "").lower()
    score = 0.0

    if _SHOPPING_JUNK_RE.search(p):
        return 0.0

    category_terms = [
        str(x).lower()
        for x in (
            (profile.get("product_categories") or [])
            + (profile.get("product_lines") or [])
            + (profile.get("category_language") or [])
            + (profile.get("use_cases") or [])
            + (profile.get("competitive_themes") or [])
        )
    ]
    factors = [str(x).lower() for x in (profile.get("decision_factors") or [])]

    for token in category_terms + keywords:
        token = str(token).lower().strip()
        if token and len(token) >= 4 and token in p:
            score += 2.0

    for factor in factors:
        if factor and factor in p:
            score += 0.8

    if _VISIBILITY_INTENT_RE.search(p):
        score += 1.5

    if re.search(r"\b20\d{2}\b", p):
        score += 0.8

    if re.search(r"\bfor\s+(?:home|families|teams|business|enterprise|kitchen|office|travel)", p):
        score += 1.0

    bland = [
        "best products",
        "top products",
        "best options",
        "recommended options",
        "best software",
        "best tools",
    ]
    if any(b in p for b in bland):
        score -= 2.0

    return max(0.0, score)


def _is_overly_generic_prompt(prompt: str) -> bool:
    """Reject interchangeable prompts that could apply to any brand."""
    p = (prompt or "").lower().strip()
    if _SHOPPING_JUNK_RE.search(p):
        return True
    generic_patterns = (
        r"^where can i find\b",
        r"^are there .+ deals\b",
        r"^can i get a discount\b",
        r"^how to upgrade my .+ with\b",
        r"^which are the best .+ options$",
        r"^best software options",
        r"^recommended software tools",
        r"^best software for ",
        r"^recommended software for ",
        r"^top software options",
        r"^which software should",
    )
    return any(re.search(pat, p) for pat in generic_patterns)


def _select_diverse_prompts(candidates: list[str], profile: dict[str, Any], keywords: list[str], max_n: int = 8) -> list[str]:
    """Pick a diverse set of high-signal visibility prompts."""
    if not candidates:
        return []

    has_brand_signal = bool(
        profile.get("product_categories")
        or profile.get("category_language")
        or profile.get("use_cases")
        or keywords
    )
    min_score = 1.5 if has_brand_signal else 0.5

    scored = []
    for candidate in candidates:
        if not _is_valid_prompt(candidate, ""):
            continue
        if _is_overly_generic_prompt(candidate):
            continue
        score = _score_prompt_specificity(candidate, profile, keywords)
        if score < min_score:
            continue
        scored.append((score, candidate))

    scored.sort(key=lambda x: x[0], reverse=True)

    selected: list[str] = []
    seen_norm: set[str] = set()

    def kind(prompt: str) -> str:
        pl = prompt.lower()
        if re.search(r"\b20\d{2}\b", pl) or "brands" in pl or "leading" in pl:
            return "category_leadership"
        if any(x in pl for x in (" for ", "home", "families", "teams", "business", "kitchen", "office")):
            return "use_case"
        if any(x in pl for x in ("reliable", "efficient", "premium", "enterprise", "energy", "smart")):
            return "segment"
        return "category_leadership"

    buckets = {"category_leadership": [], "use_case": [], "segment": []}
    for score, prompt in scored:
        buckets[kind(prompt)].append((score, prompt))

    order = [
        "category_leadership",
        "use_case",
        "segment",
        "category_leadership",
        "use_case",
        "segment",
        "category_leadership",
        "use_case",
    ]
    for bucket in order:
        for score, prompt in buckets[bucket]:
            norm = prompt.lower()
            if norm in seen_norm:
                continue
            seen_norm.add(norm)
            selected.append(prompt)
            if len(selected) >= max_n:
                break
        if len(selected) >= max_n:
            break

    if len(selected) < max_n:
        for score, prompt in scored:
            norm = prompt.lower()
            if norm in seen_norm:
                continue
            seen_norm.add(norm)
            selected.append(prompt)
            if len(selected) >= max_n:
                break

    return selected[:max_n]


def _dedupe_competitor_names(
    names: list[Any],
    *,
    project_name: str,
    existing: list[str],
    max_items: int,
) -> list[str]:
    existing_lower = {e.lower() for e in existing}
    existing_lower.add(project_name.lower())
    results: list[str] = []
    for item in names:
        name = str(item or "").strip()
        if not name or name.lower() in existing_lower or len(name) >= 60:
            continue
        results.append(name)
        existing_lower.add(name.lower())
        if len(results) >= max_items:
            break
    return results


def _parse_competitor_names_from_llm(raw: str) -> list[str]:
    parsed = _extract_json(raw)
    if isinstance(parsed, dict):
        for key in ("competitors", "names", "brands", "items"):
            value = parsed.get(key)
            if isinstance(value, list):
                return [str(item or "").strip() for item in value if str(item or "").strip()]
    if isinstance(parsed, list):
        return [str(item or "").strip() for item in parsed if str(item or "").strip()]
    return []


def generate_competitor_suggestions(
    project: dict[str, Any],
    max_items: int = 6,
    snapshot: dict[str, Any] | None = None,
) -> list[str]:
    """Use LLM + website context to suggest competitors when no Mention data exists."""
    project_name = str(project.get("name") or "").strip()
    category = _short_category(project.get("category") or "")
    region = str(project.get("region") or "").strip()
    existing = [str(c).strip() for c in (project.get("competitors") or []) if c]

    snapshot = snapshot if isinstance(snapshot, dict) else _collect_site_snapshot(project.get("website_url") or "")
    site_context = _build_site_context_for_llm(snapshot)

    existing_clause = ""
    if existing:
        existing_clause = f"\nAlready known competitors (do not repeat): {', '.join(existing[:8])}"

    prompt = f"""List {max_items} real competitor brand names in the same market.
Given the brand and site context:

Brand: {project_name}
Category: {category}
Region: {region or "global"}
{existing_clause}

Website context:
{site_context or "No website context available."}

Rules:
- Return only real brand/company names that compete in the same market segment.
- Do not include the brand itself.
- Short names only (1-3 words each, the brand name people search for).

Return ONLY valid JSON: {{"competitors": ["Competitor A", "Competitor B"]}}"""

    try:
        raw = chat_with_fallback(prompt, temperature=0.3, json_mode=True)
        parsed_names = _parse_competitor_names_from_llm(raw)
        results = _dedupe_competitor_names(
            parsed_names,
            project_name=project_name,
            existing=existing,
            max_items=max_items,
        )
        if results:
            return results
    except Exception:
        pass

    return []


def suggest_industry_label(project: dict[str, Any], snapshot: dict[str, Any] | None = None) -> str:
    """
    Best-effort industry inference for onboarding.
    Preference:
    - Keep existing category if provided
    - Otherwise infer from website snapshot via a short LLM classification
    """
    category = _clean_text(project.get("category") or "", limit=80).strip()
    if category:
        return category

    snapshot = snapshot if isinstance(snapshot, dict) else _collect_site_snapshot(project.get("website_url") or "")
    site_context = _build_site_context_for_llm(snapshot)
    if not site_context:
        return ""

    prompt = f"""From the text below, reply with a short industry label only (2–5 words, plain English).
No quotes, no explanation, no list.

Website context:
{site_context}

Return ONLY the label text."""

    try:
        raw = chat_with_fallback(prompt, temperature=0.1)
        label = _clean_text(raw, limit=80).strip()
        label = re.sub(r"^[-*\u2022\s]+", "", label).strip()
        # Guardrails: avoid empty / overly verbose outputs.
        if not label or len(label.split()) > 8:
            return ""
        return label
    except Exception:
        return ""


def generate_project_prompt_suggestions(
    project: dict[str, Any],
    max_prompts: int = 10,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    project_name = str(project.get("name") or "").strip()
    category = _short_category(project.get("category") or "")
    region = str(project.get("region") or "").strip()
    website_url = str(project.get("website_url") or "").strip()
    try:
        want = max(3, min(12, int(max_prompts or 8)))
    except (TypeError, ValueError):
        want = 8

    snapshot = snapshot if isinstance(snapshot, dict) else _collect_site_snapshot(website_url)
    site_context = _build_site_context_for_llm(snapshot)

    # Step 1: Research the brand via Serper.
    web_research: dict[str, Any] = {"search_snippets": [], "search_titles": [], "knowledge_graph": {}}
    with ThreadPoolExecutor(max_workers=1) as pool:
        web_future = pool.submit(
            _research_brand_via_web,
            project_name,
            category,
            region,
            website_url,
        )
        try:
            web_research = web_future.result(timeout=8)
        except Exception as exc:
            log.info("web research timed out for %s: %s", project_name, exc)

    web_context = _build_web_research_context(web_research)

    # Step 2: Synthesize brand intelligence from research + site.
    profile = _synthesize_brand_intelligence_profile(
        brand_name=project_name,
        category=category,
        region=region,
        snapshot=snapshot,
        web_research=web_research,
    )

    # Step 3: Generate visibility-tracking prompt candidates.
    gen_prompt = _build_visibility_prompt_generation_prompt(
        project_name,
        category,
        region,
        profile,
        site_context,
        web_context,
    )

    candidates: list[str] = []
    try:
        raw = chat_with_fallback(gen_prompt, temperature=0.35, json_mode=True)
        parsed = _extract_json(raw)
        if isinstance(parsed, list):
            candidates = [_normalize_words(str(x)) for x in parsed if x]
        elif isinstance(parsed, dict):
            for key in ("prompts", "candidates", "questions", "items"):
                if isinstance(parsed.get(key), list):
                    candidates = [_normalize_words(str(x)) for x in parsed[key] if x]
                    break
            if not candidates:
                for value in parsed.values():
                    if isinstance(value, str):
                        candidates.append(_normalize_words(value))
    except Exception as exc:
        log.info("visibility prompt generation failed for %s: %s", project_name, exc)
        candidates = []

    cleaned: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if not candidate or not _is_valid_prompt(candidate, project_name):
            continue
        norm = candidate.lower()
        if norm in seen:
            continue
        seen.add(norm)
        cleaned.append(candidate)

    keywords = list(snapshot.get("keywords") or [])
    selected = _select_diverse_prompts(cleaned, profile, keywords, max_n=want)

    if selected:
        return {"prompts": selected, "source": "brand-research-llm"}

    fb_ctx = {
        **(project or {}),
        "keywords": keywords or (snapshot or {}).get("keywords", []),
        "buyer_signals": (snapshot or {}).get("buyer_signals", []),
        "brand_profile": profile,
    }
    return build_fallback_prompt_suggestions(fb_ctx)
