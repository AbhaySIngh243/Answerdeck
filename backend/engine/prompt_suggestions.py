"""Website-aware prompt suggestion generation for project onboarding."""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from html import unescape
from typing import Any
from urllib.parse import urljoin, urlparse

import requests

from engine.llm_clients import chat, chat_with_fallback

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
    # 5-16 words allows natural buyer language without being essay-length.
    if count < 5 or count > 16:
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
    """Context-aware fallback. Uses keywords, buyer signals and category instead of pure generics."""
    category = _short_category(project.get("category") or "")
    region = str(project.get("region") or "").strip()
    keywords = [str(k).lower() for k in (project.get("keywords") or []) if k]
    signals = [str(s).lower() for s in (project.get("buyer_signals") or []) if s]
    brand = project.get("name") or ""

    # Try to synthesize from real site language first
    ideas: list[str] = []

    # Pull concrete signals like "soc 2", "for startups", "slack", pricing hints
    for sig in signals[:4]:
        s = _clean_text(sig, 70)
        if not s:
            continue
        if "for " in s or "under" in s or "soc" in s or "compliance" in s:
            ideas.append(f"Best options {s}")
            ideas.append(f"Tools for {s}")

    # Use distinctive keywords
    strong_kws = [k for k in keywords if k not in _COHESION_SKIP_TOKENS and len(k) > 4][:5]
    for kw in strong_kws:
        ideas.append(f"Best {kw} tools for teams")
        ideas.append(f"Which {kw} solution fits {region or 'growing teams'}")

    # Reasonable defaults anchored to category + region
    region_phrase = f" in {region}" if region and region.lower() != "global" else ""
    if category and category not in ("software", ""):
        ideas.extend([
            f"Best {category} for teams that need {strong_kws[0] if strong_kws else 'reliability'}{region_phrase}",
            f"What {category} offers the best support and value{region_phrase}",
            f"Recommended {category} for startups and scaling teams",
        ])

    # Last resort category-only (still better than pure "software")
    if not ideas:
        ideas = [
            f"Which {category or 'tools'} are worth evaluating{region_phrase}",
            f"Best {category or 'platforms'} for reliability and support",
            f"What {category or 'solutions'} deliver the best value for growing teams",
        ]

    # Dedup + validate
    out: list[str] = []
    seen = set()
    for c in ideas:
        if not c or c.lower() in seen:
            continue
        if _is_valid_prompt(c, brand):
            seen.add(c.lower())
            out.append(c)
        if len(out) >= 6:
            break

    return out[:6]


def build_fallback_prompt_suggestions(project: dict[str, Any]) -> dict[str, Any]:
    # Pass through any keywords/signals we have so the fallback can be contextual.
    ctx = dict(project or {})
    # If caller passed a snapshot-style dict, merge useful bits.
    snap = ctx.pop("snapshot", None) or {}
    if isinstance(snap, dict):
        if not ctx.get("keywords"):
            ctx["keywords"] = snap.get("keywords") or []
        if not ctx.get("buyer_signals"):
            ctx["buyer_signals"] = snap.get("buyer_signals") or []

    fallback = _build_fallback_prompts(ctx)
    if len(fallback) < 3:
        # Extremely defensive last resort — still tries to use category
        cat = _short_category(ctx.get("category") or "tools")
        fallback = [
            f"Which {cat} options are worth shortlisting",
            f"Best {cat} for growing teams and reliability",
            f"Recommended {cat} with strong support and value",
        ]
    return {"prompts": fallback[:6], "source": "context-aware-fallback"}


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


def _synthesize_offering_brief(
    snapshot: dict[str, Any], category: str, brand_name: str
) -> dict[str, Any]:
    """Use a fast LLM pass to turn raw site text into a crisp, specific understanding of what this product is.

    This is the key to non-generic prompts: we need to know the *actual* thing being sold and who buys it.
    """
    site_context = _build_site_context_for_llm(snapshot)
    if not site_context or site_context.startswith("No website"):
        return {
            "product_what": category or "software",
            "buyer_personas": [],
            "jobs_to_be_done": [],
            "decision_factors": [],
            "typical_scenarios": [],
            "site_language": [],
        }

    prompt = f"""You are a sharp B2B researcher. Read the website context and produce a tight JSON brief describing the offering.

Brand (for context only, never put in prompts): {brand_name}
Broad category hint: {category}

Website context:
{site_context}

Return ONLY this JSON (no extra text):
{{
  "product_what": "one specific sentence: what the product actually is and who it serves",
  "buyer_personas": ["2-4 short personas or roles, e.g. 'ops lead at 30-200 person SaaS'"],
  "jobs_to_be_done": ["2-4 real jobs/problems buyers have, in natural language"],
  "decision_factors": ["price", "compliance", "integrations", "support", "speed", "security", ... up to 6],
  "typical_scenarios": ["2-4 concrete buying situations or constraints mentioned or implied, e.g. 'SOC 2 for Series A', 'Slack + Notion stack', 'under $99/mo for a 10 person team'"],
  "site_language": ["5-10 exact or close phrases buyers would use from the site (lowercase ok)"]
}}"""

    try:
        raw = chat_with_fallback(prompt, temperature=0.15, json_mode=True)
        parsed = _extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("brief not a dict")
        return {
            "product_what": _clean_text(parsed.get("product_what") or category, 160),
            "buyer_personas": [ _clean_text(p, 70) for p in (parsed.get("buyer_personas") or []) if p ][:4],
            "jobs_to_be_done": [ _clean_text(j, 70) for j in (parsed.get("jobs_to_be_done") or []) if j ][:4],
            "decision_factors": [ _clean_text(d, 40) for d in (parsed.get("decision_factors") or []) if d ][:6],
            "typical_scenarios": [ _clean_text(s, 80) for s in (parsed.get("typical_scenarios") or []) if s ][:4],
            "site_language": [ str(x).lower().strip() for x in (parsed.get("site_language") or []) if x ][:12],
        }
    except Exception:
        # Best effort: fall back to keywords we already extracted.
        kws = snapshot.get("keywords") or []
        sigs = snapshot.get("buyer_signals") or []
        return {
            "product_what": category or "software",
            "buyer_personas": [],
            "jobs_to_be_done": [],
            "decision_factors": [],
            "typical_scenarios": sigs[:3],
            "site_language": [k.lower() for k in kws[:8]],
        }


def _build_rich_candidate_prompt(
    project_name: str,
    category: str,
    region: str,
    brief: dict[str, Any],
    site_context: str,
) -> str:
    """A much richer prompt that gives the LLM a real understanding of the offering instead of generic category + rules."""
    what = brief.get("product_what") or category
    personas = ", ".join(brief.get("buyer_personas") or []) or "various professional buyers"
    jobs = "\n- ".join(brief.get("jobs_to_be_done") or ["evaluating options in this category"])
    factors = ", ".join(brief.get("decision_factors") or ["fit", "price", "support", "reliability"])
    scenarios = "\n- ".join(brief.get("typical_scenarios") or [])
    language = ", ".join(brief.get("site_language") or [])

    return f"""You are helping a brand understand how AI engines portray them vs competitors.

The brand sells: {what}
Typical buyers: {personas}
Region: {region or "global"}

What buyers are actually trying to solve (from the site):
- {jobs}

Common decision factors buyers care about: {factors}

Real scenarios or constraints that come up:
- {scenarios or "standard evaluation scenarios in the category"}

Natural language buyers use on or about this site: {language or "(none extracted)"}

Task:
Write 8-10 short, natural questions a buyer would type into ChatGPT, Perplexity, Gemini or Claude when they are in the market for something like this — BEFORE they have a shortlist and without knowing this brand's name.

Rules:
- NEVER mention the brand name "{project_name}".
- Sound like a real human with a job to do (ops lead, founder, procurement, marketer, etc.), not SEO copy.
- Be specific to the product described above. Use the jobs, scenarios, and language.
- Mix stages: some broad discovery ("best options for..."), some persona/use-case, some with concrete constraints (team size, compliance, stack, budget, support, timeline).
- 5-16 words each. Conversational. No "vs" brand comparisons.
- Avoid ultra-generic "best X for Y" that could apply to any software. Anchor to what this actually is.

Return ONLY a JSON array of strings:
["question one here", "question two here", "..."]"""


def _score_prompt_specificity(prompt: str, brief: dict[str, Any], keywords: list[str]) -> float:
    """Higher is better. Looks for overlap with the actual offering, not generic filler."""
    p = (prompt or "").lower()
    score = 0.0

    site_lang = [str(x).lower() for x in (brief.get("site_language") or [])]
    scenarios = [str(x).lower() for x in (brief.get("typical_scenarios") or [])]
    jobs = [str(x).lower() for x in (brief.get("jobs_to_be_done") or [])]
    factors = [str(x).lower() for x in (brief.get("decision_factors") or [])]

    # Strong signal: uses language that actually appears on the site or in the brief
    for token in site_lang + keywords:
        if token and len(token) >= 4 and token in p:
            score += 1.8

    for s in scenarios:
        if s and any(w in p for w in re.findall(r"[a-z0-9]{4,}", s)):
            score += 1.2

    for j in jobs:
        if j and any(w in p for w in re.findall(r"[a-z0-9]{4,}", j)):
            score += 1.0

    for f in factors:
        if f and f in p:
            score += 0.9

    # Reward concrete constraints that buyers actually have
    if re.search(r"\b(for\s+\d|team|users?|seats?|month|year|under\s+\$|soc|gdpr|compliance|integrat|slack|startup|scale)", p):
        score += 1.3

    # Penalize ultra-bland patterns
    bland = ["best software", "best tools", "recommended software", "top options for business", "best solution"]
    if any(b in p for b in bland):
        score -= 2.5

    # Slight bonus for natural question words that real buyers use
    if any(w in p for w in ("which", "what", "how", "for a ", "that works with", "with good", "under ")):
        score += 0.4

    return max(0.0, score)


def _is_overly_generic_prompt(prompt: str) -> bool:
    """Reject interchangeable SEO-style prompts that could apply to any product."""
    p = (prompt or "").lower().strip()
    generic_patterns = (
        r"^which are the best .+ options$",
        r"^best software options",
        r"^recommended software tools",
        r"^best software for ",
        r"^recommended software for ",
        r"^top software options",
        r"^which software should",
    )
    return any(re.search(pat, p) for pat in generic_patterns)


def _select_diverse_prompts(candidates: list[str], brief: dict[str, Any], keywords: list[str], max_n: int = 8) -> list[str]:
    """Pick a diverse, high-signal set instead of forcing a rigid triple."""
    if not candidates:
        return []

    has_site_signal = bool(keywords) or bool(brief.get("site_language")) or bool(brief.get("jobs_to_be_done"))
    min_score = 1.0 if has_site_signal else 0.0

    scored = []
    for c in candidates:
        if not _is_valid_prompt(c, ""):  # brand already stripped upstream
            continue
        if _is_overly_generic_prompt(c):
            continue
        s = _score_prompt_specificity(c, brief, keywords)
        if s < min_score:
            continue
        scored.append((s, c))

    scored.sort(key=lambda x: x[0], reverse=True)

    selected: list[str] = []
    seen_norm = set()

    # Try to get a good spread: broad discovery, use-case/persona, constraint-driven
    def kind(p: str) -> str:
        pl = p.lower()
        if any(x in pl for x in ("under ", "budget", "price", "cost", "$", "free", "affordable", "small ", "startup", "compliance", "soc", "support", "warranty", "timeline")):
            return "constraint"
        if any(x in pl for x in ("for ", "teams", "companies", "founders", "marketers", "ops", "engineers", "sales")):
            return "persona"
        return "broad"

    buckets = {"broad": [], "persona": [], "constraint": []}
    for sc, p in scored:
        k = kind(p)
        buckets[k].append((sc, p))

    # Round-robin from best across buckets
    order = ["broad", "persona", "constraint", "broad", "persona", "constraint", "broad", "persona"]
    for o in order:
        for sc, p in buckets[o]:
            norm = p.lower()
            if norm in seen_norm:
                continue
            seen_norm.add(norm)
            selected.append(p)
            if len(selected) >= max_n:
                break
        if len(selected) >= max_n:
            break

    # If we still need more, just take highest remaining
    if len(selected) < max_n:
        for sc, p in scored:
            norm = p.lower()
            if norm in seen_norm:
                continue
            seen_norm.add(norm)
            selected.append(p)
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
    try:
        want = max(3, min(12, int(max_prompts or 8)))
    except (TypeError, ValueError):
        want = 8

    snapshot = snapshot if isinstance(snapshot, dict) else _collect_site_snapshot(project.get("website_url") or "")
    site_context = _build_site_context_for_llm(snapshot)

    # The "intelligence" step: understand what they actually sell and who buys it.
    brief = _synthesize_offering_brief(snapshot, category, project_name)

    # Generate a larger set of candidates with a context-rich prompt.
    gen_prompt = _build_rich_candidate_prompt(project_name, category, region, brief, site_context)

    candidates: list[str] = []
    try:
        raw = chat_with_fallback(gen_prompt, temperature=0.45, json_mode=True)
        parsed = _extract_json(raw)
        if isinstance(parsed, list):
            candidates = [ _normalize_words(str(x)) for x in parsed if x ]
        elif isinstance(parsed, dict):
            # tolerate common wrappers
            for key in ("prompts", "candidates", "questions", "items"):
                if isinstance(parsed.get(key), list):
                    candidates = [ _normalize_words(str(x)) for x in parsed[key] if x ]
                    break
            if not candidates:
                for v in parsed.values():
                    if isinstance(v, str):
                        candidates.append(_normalize_words(v))
    except Exception:
        candidates = []

    # Clean: no brand, valid length, dedupe
    cleaned: list[str] = []
    seen = set()
    for c in candidates:
        if not c or not _is_valid_prompt(c, project_name):
            continue
        n = c.lower()
        if n in seen:
            continue
        seen.add(n)
        cleaned.append(c)

    keywords = list(snapshot.get("keywords") or [])

    # Intelligent selection for diversity + specificity to *this* offering.
    selected = _select_diverse_prompts(cleaned, brief, keywords, max_n=want)

    if selected:
        return {"prompts": selected, "source": "site-aware-llm"}

    # Only if everything failed, fall back — but make the fallback use what we know.
    fb_ctx = {
        **(project or {}),
        "keywords": keywords or (snapshot or {}).get("keywords", []),
        "buyer_signals": (snapshot or {}).get("buyer_signals", []),
    }
    return build_fallback_prompt_suggestions(fb_ctx)
