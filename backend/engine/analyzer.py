"""Analysis helpers for response parsing, scoring, and recommendations."""

import json
import os
import re
import ipaddress
from collections import defaultdict
from typing import Any
from urllib.parse import urlparse

from engine.llm_clients import chat
from engine.perplexity_search import get_search_provider_name, search_web

POSITIVE_WORDS = {
    "best",
    "excellent",
    "great",
    "recommended",
    "reliable",
    "top",
    "strong",
    "leader",
    "popular",
}

NEGATIVE_WORDS = {
    "avoid",
    "weak",
    "poor",
    "bad",
    "expensive",
    "outdated",
    "limited",
    "problem",
    "issue",
}

BRAND_EXCLUDE_TOKENS = {
    "best", "top", "overall", "editor", "choice", "options", "option",
    "comparison", "review", "reviews", "guide", "budget", "premium",
    "features", "feature", "quality", "performance", "price", "value",
    "pros", "cons", "summary", "conclusion", "recommendation", "verdict",
    "runner", "up", "honorable", "mention", "alternative", "alternatives",
    "overview", "introduction", "note", "notes", "important", "key",
    "takeaway", "takeaways", "considerations", "factors", "criteria",
    "specifications", "specs", "design", "build", "display", "battery",
    "camera", "storage", "memory", "processor", "speed", "connectivity",
    "software", "hardware", "durability", "warranty", "support",
    "customer", "service", "pricing", "cost", "affordable", "expensive",
    "cheap", "high", "low", "mid", "range", "tier", "level", "class",
    "category", "type", "model", "series", "edition", "version",
    "generation", "update", "release", "latest", "new", "old",
    "first", "second", "third", "fourth", "fifth", "pick",
    "here", "why", "how", "what", "when", "where", "which",
    "for", "and", "or", "with", "without", "from", "by", "in", "on", "at", "to", "of",
    "vs", "versus", "most", "more", "less",
    "you", "we", "they", "he", "she", "it", "can", "could", "should", "would", "will", "may", "might", "must",
    "is", "are", "was", "were", "be", "been", "being",
    "answer", "question", "solution", "result", "results",
    "list", "ranking", "rankings", "rated", "rating", "ratings",
    "our", "my", "your", "their", "its", "this", "that", "these",
    "tv", "tvs", "oled", "qled", "uhd", "led", "4k", "8k",
    "online", "store", "stores", "shop", "shops", "retailer", "retailers",
    "marketplace", "marketplaces", "shopping", "seller", "sellers",
    "dealer", "dealers", "website", "websites",
}

DESCRIPTIVE_PHRASES = {
    "battery life", "display quality", "build quality", "sound quality",
    "image quality", "video quality", "picture quality", "audio quality",
    "processing power", "storage capacity", "screen size", "price range",
    "customer support", "user experience", "ease of use", "value for money",
    "bang for buck", "smart features", "key features", "main features",
    "top pick", "top picks", "best overall", "best value", "best budget",
    "runner up", "editors choice", "our pick", "final verdict",
    "bottom line", "quick summary", "in summary", "to summarize",
}

CHANNEL_NOUN_TOKENS = frozenset(
    {
        "online",
        "store",
        "stores",
        "shop",
        "shops",
        "retailer",
        "retailers",
        "marketplace",
        "marketplaces",
        "seller",
        "sellers",
        "dealer",
        "dealers",
        "website",
        "websites",
    }
)

RETAILER_LITERALS = frozenset(
    {
        "amazon",
        "flipkart",
        "walmart",
        "target",
        "ebay",
        "best buy",
        "costco",
        "aliexpress",
    }
)

RETAIL_CONTEXT_HINTS = frozenset(
    {
        "where to buy",
        "buy ",
        "buying",
        "available on",
        "available at",
        "shop",
        "store",
        "retailer",
        "marketplace",
        "purchase",
        "price on",
    }
)

BRAND_CANDIDATE_RE = re.compile(
    r"\b([A-Z][A-Za-z0-9&+./'-]{1,}(?:\s+[A-Z0-9][A-Za-z0-9&+./'-]{1,}){0,2})\b"
)


def _empty_analysis() -> dict[str, Any]:
    return {
        "brands_mentioned": [],
        "focus_brand_rank": None,
        "focus_brand_mentioned": False,
        "focus_brand_sentiment": "not_mentioned",
        "focus_brand_context": "",
        "all_brand_details": [],
        "sources": [],
    }


def _clean_json(raw: str) -> Any:
    if not raw or not raw.strip():
        raise ValueError("Empty JSON response")

    # Remove thought blocks (DeepSeek/Claude reasoning traces).
    for marker in ("</think>", "<|end_of_thinking|>"):
        if marker in raw:
            raw = raw.split(marker)[-1].strip()

    # Remove markdown code fences.
    raw = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", raw, flags=re.DOTALL).strip()

    # Locate the outermost JSON structure.
    start_curly = raw.find("{")
    start_bracket = raw.find("[")

    start = -1
    end = -1
    if start_curly != -1 and (start_bracket == -1 or start_curly < start_bracket):
        start = start_curly
        end = raw.rfind("}")
    elif start_bracket != -1:
        start = start_bracket
        end = raw.rfind("]")

    if start != -1 and end != -1 and end >= start:
        candidate = raw[start : end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Final fallback: strip residual markdown and try again.
    raw = re.sub(r"```json|```", "", raw).strip()
    return json.loads(raw)


def _clip_text(value: Any, limit: int = 320) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "..."


def _normalize_priority(value: Any, fallback: str = "medium") -> str:
    candidate = str(value or "").strip().lower()
    if candidate in {"high", "medium", "low"}:
        return candidate
    return fallback


def _rebalance_priority_spread(items: list[dict]) -> list[dict]:
    if len(items) < 2:
        return items
    values = {str(item.get("priority", "")).lower() for item in items}
    if len(values) > 1:
        return items
    if len(items) == 2:
        items[0]["priority"] = "high"
        items[1]["priority"] = "medium"
        return items
    for idx, item in enumerate(items):
        if idx == 0:
            item["priority"] = "high"
        elif idx == len(items) - 1:
            item["priority"] = "low"
        else:
            item["priority"] = "medium"
    return items


def _looks_like_low_quality_copy(text: Any, min_words: int = 6) -> bool:
    s = str(text or "").strip()
    if not s:
        return True
    lowered = s.lower()
    if lowered in {"n/a", "na", "none", "tbd", "todo"}:
        return True
    if "lorem ipsum" in lowered:
        return True
    words = re.findall(r"[a-zA-Z0-9]+", s)
    if len(words) < max(1, min_words):
        return True
    unique_ratio = len({w.lower() for w in words}) / max(len(words), 1)
    if unique_ratio < 0.45:
        return True
    return False


def _sanitize_audit_items(
    raw_items: Any,
    focus_brand: str,
    query: str,
    default_priority: str = "medium",
) -> list[dict]:
    if not isinstance(raw_items, list):
        return []

    cleaned: list[dict] = []
    seen: set[str] = set()
    focus_brand_text = (focus_brand or "").strip()
    query_text = (query or "").strip()

    for row in raw_items:
        if not isinstance(row, dict):
            continue

        title = _clip_text(row.get("title"), 110)
        root_cause = _clip_text(row.get("root_cause") or row.get("detail"), 520)
        solution = _clip_text(row.get("solution"), 620)
        avoid = _clip_text(row.get("avoid"), 260)
        evidence = _clip_text(row.get("evidence"), 260)

        if not title or not root_cause or not solution:
            continue
        if _looks_like_low_quality_copy(title, min_words=2) or _looks_like_low_quality_copy(root_cause) or _looks_like_low_quality_copy(solution):
            continue

        key = f"{_canonical_brand(title)}|{_canonical_brand(root_cause[:180])}"
        if not key or key in seen:
            continue
        seen.add(key)

        notes = []
        if focus_brand_text and focus_brand_text.lower() not in solution.lower():
            notes.append(f"Ensure {focus_brand_text} is named explicitly in your implementation.")
        if query_text and query_text.lower() not in (root_cause + " " + solution).lower():
            notes.append(f'Align to the exact prompt intent "{query_text}".')

        item = {
            "title": title,
            "root_cause": root_cause,
            "solution": solution,
            "avoid": avoid,
            "priority": _normalize_priority(row.get("priority"), default_priority),
        }
        if notes:
            item["note"] = " ".join(notes)
        if evidence:
            item["evidence"] = evidence
        cleaned.append(item)

    cleaned = _rebalance_priority_spread(cleaned)
    return cleaned[:5]


def _sanitize_action_items(raw_items: Any, focus_brand: str, default_priority: str = "medium") -> list[dict]:
    if not isinstance(raw_items, list):
        return []

    cleaned: list[dict] = []
    seen: set[str] = set()
    focus = (focus_brand or "").strip()

    for row in raw_items:
        if not isinstance(row, dict):
            continue
        title = _clip_text(row.get("title"), 110)
        detail = _clip_text(row.get("detail") or row.get("solution"), 620)
        if not title or not detail:
            continue
        if _looks_like_low_quality_copy(title, min_words=2) or _looks_like_low_quality_copy(detail):
            continue
        key = f"{_canonical_brand(title)}|{_canonical_brand(detail[:180])}"
        if not key or key in seen:
            continue
        seen.add(key)

        note = ""
        if focus and focus.lower() not in detail.lower():
            note = f"Apply this directly to {focus}."

        item = {
            "title": title,
            "detail": detail,
            "priority": _normalize_priority(row.get("priority"), default_priority),
        }
        if note:
            item["note"] = note
        link = str(row.get("link") or row.get("url") or "").strip().rstrip(".,;:!?)")
        if link and (link.startswith("http://") or link.startswith("https://")):
            try:
                parsed_link = urlparse(link)
                host = (parsed_link.hostname or "").strip().lower()
                if host and host not in {"localhost", "example.com"} and not host.endswith(".local") and "." in host:
                    item["link"] = link
            except Exception:
                pass
        cleaned.append(item)

    cleaned = _rebalance_priority_spread(cleaned)
    return cleaned[:6]


def _extract_sources(response_text: str) -> list[str]:
    def _is_public_http_url(url: str) -> bool:
        try:
            parsed = urlparse(str(url or "").strip())
            if parsed.scheme not in {"http", "https"}:
                return False
            host = (parsed.hostname or "").strip().lower()
            if not host:
                return False
            if host in {"localhost"} or host.endswith(".local"):
                return False
            try:
                ip = ipaddress.ip_address(host)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    return False
            except ValueError:
                pass
            return True
        except Exception:
            return False

    sources: set[str] = set()

    # Capture full URLs first (higher fidelity).
    url_matches = re.findall(r"https?://[^\s<>\"')\]]+", response_text)
    for url in url_matches:
        cleaned = url.rstrip(".,;:!?)")
        if any(blocked in cleaned.lower() for blocked in {"example.com"}):
            continue
        if not _is_public_http_url(cleaned):
            continue
        sources.add(cleaned)

    # Capture markdown links: [label](https://...)
    md_url_matches = re.findall(r"\[[^\]]+\]\((https?://[^)\s]+)\)", response_text)
    for url in md_url_matches:
        cleaned = url.rstrip(".,;:!?)")
        if any(blocked in cleaned.lower() for blocked in {"example.com"}):
            continue
        if not _is_public_http_url(cleaned):
            continue
        sources.add(cleaned)

    return sorted(sources)[:15]


def _extract_ranked_lines(response_text: str) -> list[str]:
    ranked_lines: list[str] = []
    for line in response_text.splitlines():
        stripped = line.strip()
        if re.match(r"^(\d+[\).:-]|[-*])\s+", stripped):
            ranked_lines.append(stripped)
    if ranked_lines:
        return ranked_lines

    # fallback: split paragraph into short sentences
    sentences = re.split(r"(?<=[.!?])\s+", response_text)
    return [s.strip() for s in sentences if s.strip()]


def _tokenize_lower_words(value: str) -> list[str]:
    return [token for token in re.findall(r"[a-z0-9]+", (value or "").lower()) if token]


def _clean_brand_candidate(value: str) -> str:
    cleaned = re.sub(r"^[\s\"'`*_-]+|[\s\"'`*_,.;:!?()\[\]{}-]+$", "", value or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def _normalize_detected_brand_label(value: str) -> str:
    """Collapse obvious model/category suffixes to the likely brand root."""
    cleaned = _clean_brand_candidate(value)
    if not cleaned:
        return ""
    parts = cleaned.split()
    if len(parts) >= 2:
        second = parts[1].lower()
        if re.search(r"\d", parts[1]) or second in {
            "tv",
            "tvs",
            "phone",
            "phones",
            "laptop",
            "laptops",
            "tablet",
            "tablets",
            "monitor",
            "monitors",
            "camera",
            "cameras",
            "projector",
            "projectors",
            "speaker",
            "speakers",
            "audio",
        }:
            return parts[0]
    return cleaned


def _is_channel_or_retail_noise(candidate: str, context: str) -> bool:
    tokens = _tokenize_lower_words(candidate)
    if not tokens:
        return True
    if len(tokens) <= 4 and all(token in BRAND_EXCLUDE_TOKENS or token in CHANNEL_NOUN_TOKENS for token in tokens):
        return True
    label = " ".join(tokens)
    context_lower = (context or "").lower()
    if label in RETAILER_LITERALS and any(hint in context_lower for hint in RETAIL_CONTEXT_HINTS):
        return True
    return False


def _iter_line_brand_candidates(line: str, include_lead_segment: bool = True) -> list[str]:
    """Collect likely brand tokens from one line/sentence."""
    clean_line = (line or "").strip()
    if not clean_line:
        return []

    # Strip URLs so video IDs, path segments, and query params aren't mistaken for brands.
    clean_line = re.sub(r"https?://[^\s]+", "", clean_line).strip()
    if not clean_line:
        return []

    raw_candidates: list[str] = []

    # Lead segment is useful for ranked list bullets, but noisy for regular prose.
    if include_lead_segment:
        lead_segment = re.split(r"[\u2014\u2013\-:|,(]", clean_line, maxsplit=1)[0].strip()
        if lead_segment:
            raw_candidates.append(lead_segment)

    # Capture capitalized brand phrases anywhere in the line.
    for match in BRAND_CANDIDATE_RE.finditer(clean_line):
        raw_candidates.append(match.group(1))

    out: list[str] = []
    seen: set[str] = set()
    for raw in raw_candidates:
        candidate = _normalize_detected_brand_label(raw)
        key = _canonical_brand(candidate)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(candidate)
    return out


def _extract_notable_brands_from_ranked_lines(
    ranked_lines: list[str],
    tracked_brands: list[str],
) -> list[dict[str, Any]]:
    """Heuristic extraction of additional notable brands not explicitly configured."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    tracked = [b for b in tracked_brands if b]

    def _is_tracked(candidate: str) -> bool:
        return any(_brand_matches_alias(candidate, [brand]) for brand in tracked)

    for line_idx, line in enumerate(ranked_lines, start=1):
        explicit_rank_match = re.match(r"^(\d+)\s*[\).:-]", line)
        explicit_rank = int(explicit_rank_match.group(1)) if explicit_rank_match else line_idx
        clean = re.sub(r"^(\d+[\).:-]|[-*])\s*", "", line).strip()
        line_is_ranked = bool(re.match(r"^(\d+[\).:-]|[-*])\s+", line.strip()))
        for candidate in _iter_line_brand_candidates(clean, include_lead_segment=line_is_ranked):
            if not re.match(r"^[A-Za-z0-9][A-Za-z0-9 '&+./-]{1,48}$", candidate):
                continue
            if len(candidate.split()) > 4:
                continue
            if is_spurious_brand_mention(candidate):
                continue
            if _is_channel_or_retail_noise(candidate, line):
                continue
            if _looks_like_spec_phrase(candidate):
                continue
            if _is_tracked(candidate):
                continue

            canonical = _canonical_brand(candidate)
            if not canonical or canonical in seen:
                continue
            tokenized = _tokenize_lower_words(candidate)
            if any(token in BRAND_EXCLUDE_TOKENS for token in tokenized):
                continue
            if len(tokenized) == 1 and (tokenized[0] in POSITIVE_WORDS or tokenized[0] in NEGATIVE_WORDS):
                continue
            if " ".join(tokenized) in DESCRIPTIVE_PHRASES:
                continue

            # Reject obvious URL/domain leftovers.
            candidate_lower = candidate.lower()
            if re.search(r"\b(https?://|www\.|\.com|\.in|\.org|\.net)\b", candidate_lower):
                continue
            if len(canonical) < 2:
                continue

            seen.add(canonical)
            out.append(
                {
                    "brand": candidate,
                    "rank": explicit_rank,
                    "context": line,
                    "sentiment": _sentiment_for_context(line),
                }
            )

    return out


def _canonical_brand(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


# URL / protocol fragments that must never appear as competitor rows.
_SPURIOUS_BRAND_LITERALS = frozenset(
    {
        "http",
        "https",
        "ftp",
        "ftps",
        "www",
        "html",
        "url",
        "uri",
        "src",
        "href",
        "online",
        "store",
        "stores",
        "retailer",
        "retailers",
        "marketplace",
        "marketplaces",
    }
)

NON_BRAND_SINGLE_TOKENS = frozenset(
    {
        "the", "this", "that", "those", "these", "there", "here", "where",
        "when", "then", "than", "what", "which", "whom", "whose",
        "multiple", "popularity", "availability", "specific", "native",
        "resolution", "plus", "hd", "pro", "max", "ultra", "smart",
        "android", "google", "india", "target", "focus", "rank", "share",
        "visibility", "cited", "fully", "under", "both", "only", "much",
        "very", "just", "also", "each", "even", "into", "some", "many",
        "such", "over", "come", "long", "look", "after", "about", "still",
        "since", "while",
        # Hardware specs / abbreviations
        "hdr", "ram", "rom", "os", "led", "lcd", "usb", "hdmi", "gpu",
        "cpu", "rgb", "uhd", "fhd", "nfc", "fps", "iso", "ssd", "hdd",
        "wifi", "lte", "amoled", "ansi",
        # Technology standards / formats (not product brands)
        "dolby", "dts", "dlp", "3lcd", "lcos", "bluetooth", "chromecast",
        "miracast", "airplay", "atmos", "vision",
        # Product categories
        "projector", "projectors", "speaker", "speakers", "camera",
        "cameras", "laptop", "laptops", "phone", "phones", "tablet",
        "tablets", "monitor", "monitors", "tv", "television",
        "theater", "theatre", "cinema", "screen", "lamp", "bulb", "lens",
        # Generic adjectives / nouns that get capitalised at sentence starts
        "dust", "free", "auto", "voice", "sound", "audio", "video",
        "image", "power", "light", "dark", "bright", "brightness", "color", "size",
        "weight", "built", "based", "type", "mode", "easy", "home", "entertainment",
        "automatic", "digital", "manual", "portable", "wireless", "wired",
        "mini", "compact", "slim", "full", "remote", "external", "internal",
        "indoor", "outdoor", "instant", "quick", "fast", "slow", "short",
        "throw", "laser", "keystone", "correction", "ratio", "aspect",
        "certified", "genuine", "original", "advanced", "basic", "standard",
    }
)


SPEC_UNIT_TOKENS = frozenset(
    {
        "ansi",
        "iso",
        "lumen",
        "lumens",
        "nit",
        "nits",
        "w",
        "watt",
        "watts",
        "hz",
        "inch",
        "inches",
        "cm",
        "mm",
        "mah",
        "gb",
        "tb",
        "fps",
        "contrast",
        "brightness",
        "resolution",
    }
)

PRODUCT_CATEGORY_TOKENS = frozenset(
    {
        "projector", "projectors", "tv", "tvs", "television", "televisions",
        "speaker", "speakers", "camera", "cameras", "laptop", "laptops",
        "phone", "phones", "tablet", "tablets", "monitor", "monitors",
        "soundbar", "soundbars", "headphone", "headphones", "earphone",
        "earphones", "earbuds", "display", "screen", "theater", "theatre",
        "cinema",
    }
)

_ALL_NOISE_TOKENS = (
    BRAND_EXCLUDE_TOKENS | CHANNEL_NOUN_TOKENS | NON_BRAND_SINGLE_TOKENS
    | SPEC_UNIT_TOKENS | PRODUCT_CATEGORY_TOKENS
)


def _looks_like_spec_phrase(value: str) -> bool:
    text = (value or "").strip().lower()
    if not text:
        return False

    tokens = _tokenize_lower_words(text)
    if not tokens:
        return False

    # Numeric + unit/spec patterns (e.g., "700 ISO brightness", "2600 lumens").
    if re.search(
        r"\b\d+(?:\.\d+)?\s*(?:ansi|iso|lumens?|nits?|w(?:atts?)?|hz|inch(?:es)?|cm|mm|mah|gb|tb|fps|k)\b",
        text,
    ):
        return True

    if tokens[0].isdigit() and any(token in SPEC_UNIT_TOKENS for token in tokens[1:]):
        return True

    # All tokens are generic noise/spec/category words → not a real brand.
    if len(tokens) <= 6 and all(token.isdigit() or token in _ALL_NOISE_TOKENS for token in tokens):
        return True

    # Multi-word: contains a product category and every other word is generic
    # (e.g. "Automatic Android Projector", "Portable Mini Projector").
    if len(tokens) >= 2 and any(t in PRODUCT_CATEGORY_TOKENS for t in tokens):
        non_category = [t for t in tokens if t not in PRODUCT_CATEGORY_TOKENS]
        if all(t.isdigit() or t in _ALL_NOISE_TOKENS for t in non_category):
            return True

    return False


def is_spurious_brand_mention(brand: str) -> bool:
    """Reject protocol tokens, bare schemes, URL-looking strings, random IDs, and noise words."""
    raw = (brand or "").strip()
    if not raw:
        return True
    k = raw.lower().strip()
    tokens = _tokenize_lower_words(k)
    if tokens and len(tokens) <= 4 and all(token in BRAND_EXCLUDE_TOKENS or token in CHANNEL_NOUN_TOKENS for token in tokens):
        return True
    if k in _SPURIOUS_BRAND_LITERALS:
        return True
    if re.fullmatch(r"https?", k, flags=re.I):
        return True
    if re.match(r"^https?://", raw, flags=re.I):
        return True
    if re.match(r"^www\.[a-z0-9.-]+", k):
        return True
    letters_only = re.sub(r"[^a-z]", "", k)
    if letters_only in {"http", "https", "www", "html", "url"}:
        return True
    if len(tokens) == 1 and tokens[0] in NON_BRAND_SINGLE_TOKENS:
        return True
    if _looks_like_spec_phrase(raw):
        return True

    # Reject random alphanumeric IDs (YouTube video IDs, hash fragments, etc.)
    # These are single-word tokens like "MM8DaGYIhzc" or "BdDPIANIPj8".
    clean_word = raw.strip()
    if " " not in clean_word and re.fullmatch(r"[A-Za-z0-9_-]{8,16}", clean_word):
        digit_count = sum(1 for c in clean_word if c.isdigit())
        upper_count = sum(1 for c in clean_word if c.isupper())
        lower_count = sum(1 for c in clean_word if c.islower())
        if digit_count >= 1 and upper_count >= 2 and lower_count >= 2:
            return True

    # Reject all-caps abbreviations that are hardware specs, not brands (HDR, RAM, OS, etc.)
    if re.fullmatch(r"[A-Z]{2,5}", raw):
        if k in NON_BRAND_SINGLE_TOKENS:
            return True

    return False


def _brand_matches_alias(brand: str, aliases: list[str]) -> bool:
    brand_canonical = _canonical_brand(brand)
    if not brand_canonical:
        return False
    for alias in aliases:
        alias_canonical = _canonical_brand(alias)
        if not alias_canonical:
            continue
        if brand_canonical == alias_canonical:
            return True
        shorter = min(brand_canonical, alias_canonical, key=len)
        longer = max(brand_canonical, alias_canonical, key=len)
        if len(shorter) >= 5 and longer.startswith(shorter):
            if len(shorter) / len(longer) >= 0.65:
                return True
    return False


def is_focus_brand_match(brand: str, aliases: list[str]) -> bool:
    return _brand_matches_alias(brand, aliases)


# First hostname labels that are poor brand proxies (often create false focus matches).
_GENERIC_HOSTNAME_LABELS = frozenset(
    {
        "www",
        "app",
        "apps",
        "api",
        "cdn",
        "static",
        "assets",
        "img",
        "images",
        "mail",
        "email",
        "shop",
        "store",
        "blog",
        "news",
        "support",
        "help",
        "docs",
        "status",
        "dev",
        "staging",
        "m",
        "mobile",
    }
)


def build_focus_brand_aliases(focus_brand: str, website_url: str = "") -> list[str]:
    """Derive matching strings for the focus brand: display name plus stable URL host forms.

    The full hostname (e.g. brand.com) is always included when valid. The first DNS label
    alone (e.g. app from app.brand.com) is skipped when it is short, generic, or already
    covered by the project name — those cases caused spurious focus matches.
    """
    aliases: list[str] = []
    for value in (focus_brand,):
        raw = (value or "").strip()
        if raw:
            aliases.append(raw)

    focus_key = _canonical_brand(focus_brand)

    url = (website_url or "").strip()
    if url:
        normalized = url if "://" in url else f"https://{url}"
        try:
            host = (urlparse(normalized).hostname or "").lower()
            host = host.replace("www.", "")
            if host:
                aliases.append(host)
                root = host.split(".")[0]
                root_key = _canonical_brand(root)
                include_root = (
                    root
                    and root_key != focus_key
                    and len(root_key) >= 4
                    and root not in _GENERIC_HOSTNAME_LABELS
                )
                if include_root:
                    aliases.append(root)
        except Exception:
            pass

    # Keep original ordering but remove duplicates.
    seen: set[str] = set()
    out: list[str] = []
    for item in aliases:
        key = _canonical_brand(item)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _collapse_ws(value: str) -> str:
    return " ".join((value or "").split())


def _phrase_in_response(response_text: str, phrase: str) -> bool:
    p = _collapse_ws(phrase)
    if len(p) < 6:
        return False
    return p.lower() in _collapse_ws(response_text).lower()


def _alias_appears_in_response(response_text: str, alias: str) -> bool:
    """True if alias is visibly present in the model answer (not inferred)."""
    a = (alias or "").strip()
    if not a:
        return False
    canon = _canonical_brand(a)
    if len(canon) < 2:
        return False
    rt = response_text
    lowered = rt.lower()
    # Host-style aliases: substring match (URLs, inline domains).
    if "." in a and " " not in a:
        return a.lower() in lowered
    # Very short tokens: avoid \\b on non-word chars; use explicit boundaries.
    if len(a) <= 3:
        return bool(re.search(rf"(?<![A-Za-z0-9]){re.escape(a)}(?![A-Za-z0-9])", rt, flags=re.IGNORECASE))
    return bool(re.search(rf"\b{re.escape(a)}\b", rt, flags=re.IGNORECASE))


def _focus_detail_substantiated_in_response(
    response_text: str,
    detail: dict[str, Any],
    aliases: list[str],
) -> bool:
    """Ground-truth check: focus-style rows must appear in the raw answer text."""
    brand = str(detail.get("brand") or "").strip()
    context = str(detail.get("context") or "").strip()
    if _phrase_in_response(response_text, context):
        return True
    candidates: list[str] = []
    if brand:
        candidates.append(brand)
    candidates.extend(x for x in aliases if (x or "").strip())
    seen: set[str] = set()
    for c in candidates:
        key = _canonical_brand(c)
        if not key or key in seen:
            continue
        seen.add(key)
        if _alias_appears_in_response(response_text, c):
            return True
    return False


def _recompute_focus_fields_from_details(
    details: list[dict[str, Any]],
    aliases: list[str],
) -> dict[str, Any]:
    focus = next((d for d in details if _brand_matches_alias(str(d.get("brand") or ""), aliases)), None)
    if focus:
        sentiment = str(focus.get("sentiment") or "neutral").strip().lower()
        if sentiment not in {"positive", "neutral", "negative"}:
            sentiment = "neutral"
    else:
        sentiment = "not_mentioned"
    return {
        "focus_brand_rank": focus.get("rank") if focus else None,
        "focus_brand_mentioned": bool(focus),
        "focus_brand_sentiment": sentiment,
        "focus_brand_context": str(focus.get("context") or "") if focus else "",
        "brands_mentioned": [str(d["brand"]) for d in details if d.get("brand")],
    }


def _brand_substantiated_in_response(response_text: str, detail: dict[str, Any]) -> bool:
    """True when the brand (or its verbatim context) appears in the raw answer.

    Applied to every extracted row — not only focus-matches — so models cannot
    hallucinate competitors that the underlying engine never mentioned.
    """
    brand = str(detail.get("brand") or "").strip()
    context = str(detail.get("context") or "").strip()
    if context and _phrase_in_response(response_text, context):
        return True
    if brand and _alias_appears_in_response(response_text, brand):
        return True
    return False


def _sanitize_llm_brand_details_against_text(
    parsed: dict[str, Any],
    response_text: str,
    focus_brand_aliases: list[str],
) -> dict[str, Any]:
    """Drop any brand row whose name is not actually in the underlying answer.

    This previously only validated focus-brand rows. We now apply the same
    grounding check to every extracted brand — if the LLM extractor invented a
    brand the engine never said, we refuse to persist it.
    """
    raw_details = parsed.get("all_brand_details")
    if not isinstance(raw_details, list):
        return parsed
    kept: list[dict[str, Any]] = []
    for row in raw_details:
        if not isinstance(row, dict):
            continue
        brand = str(row.get("brand") or "").strip()
        if not brand:
            continue
        if _brand_matches_alias(brand, focus_brand_aliases):
            if not _focus_detail_substantiated_in_response(response_text, row, focus_brand_aliases):
                continue
        elif not _brand_substantiated_in_response(response_text, row):
            # Hallucinated competitor — drop it so the UI never surfaces it.
            continue
        kept.append(row)
    parsed = dict(parsed)
    parsed["all_brand_details"] = kept
    parsed.update(_recompute_focus_fields_from_details(kept, focus_brand_aliases))
    parsed["sources"] = _extract_sources(response_text)
    return parsed


def _sentiment_for_context(context: str) -> str:
    lowered = context.lower()
    pos = sum(1 for token in POSITIVE_WORDS if token in lowered)
    neg = sum(1 for token in NEGATIVE_WORDS if token in lowered)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def _heuristic_analysis(
    response_text: str,
    focus_brand: str,
    competitor_brands: list[str],
    focus_brand_aliases: list[str] | None = None,
) -> dict[str, Any]:
    aliases = focus_brand_aliases or [focus_brand]
    tracked = aliases + [brand for brand in competitor_brands if brand]
    tracked_clean = []
    seen = set()
    for brand in tracked:
        b = brand.strip()
        if b and b.lower() not in seen:
            tracked_clean.append(b)
            seen.add(b.lower())

    ranked_lines = _extract_ranked_lines(response_text)
    mentions: dict[str, dict[str, Any]] = {}

    for line_idx, line in enumerate(ranked_lines, start=1):
        explicit_rank_match = re.match(r"^(\d+)\s*[\).:-]", line)
        explicit_rank = int(explicit_rank_match.group(1)) if explicit_rank_match else line_idx

        for brand in tracked_clean:
            if re.search(rf"\b{re.escape(brand)}\b", line, flags=re.IGNORECASE):
                if brand.lower() not in mentions:
                    mentions[brand.lower()] = {
                        "brand": brand,
                        "rank": explicit_rank,
                        "context": line,
                    }

    # If no structured ranks found, still detect mentions in full text.
    for brand in tracked_clean:
        if brand.lower() in mentions:
            continue
        match = re.search(rf"(.{{0,80}}\b{re.escape(brand)}\b.{{0,120}})", response_text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            context = " ".join(match.group(1).split())
            mentions[brand.lower()] = {
                "brand": brand,
                "rank": None,
                "context": context,
            }

    details = []
    for item in mentions.values():
        if is_spurious_brand_mention(item.get("brand", "")):
            continue
        details.append(
            {
                "brand": item["brand"],
                "rank": item["rank"],
                "sentiment": _sentiment_for_context(item["context"]),
                "context": item["context"],
            }
        )

    details.sort(key=lambda item: (item["rank"] is None, item["rank"] if item["rank"] is not None else 999))
    focus = next((d for d in details if _brand_matches_alias(d["brand"], aliases)), None)

    return {
        "brands_mentioned": [d["brand"] for d in details],
        "focus_brand_rank": focus["rank"] if focus else None,
        "focus_brand_mentioned": bool(focus),
        "focus_brand_sentiment": focus["sentiment"] if focus else "not_mentioned",
        "focus_brand_context": focus["context"] if focus else "",
        "all_brand_details": details,
        "sources": _extract_sources(response_text),
    }


def _llm_extract_brands(
    response_text: str,
    focus_brand: str,
    query: str,
    competitors: list[str],
) -> dict[str, Any] | None:
    """Ask a cheap LLM to extract real product/company brands from the AI response.

    Returns a fully-formed analysis dict on success, or None if the call fails.
    """
    llm_prompt = f"""Extract ONLY real product/company brand names from this AI response.

RULES:
- Return ONLY actual manufacturer or product brand names (e.g. Samsung, BenQ, Epson, Egate).
- Do NOT include technology names (Dolby, DLP, ANSI, HDR, Bluetooth).
- Do NOT include product categories (projector, TV, speaker).
- Do NOT include specifications (lumens, brightness, resolution, Ultra HD, 4K).
- Do NOT include generic descriptions (easy, automatic, portable, home entertainment).
- If a brand is listed in a numbered/ranked list, include its rank position.

QUERY: "{query}"
FOCUS BRAND: "{focus_brand}"
KNOWN COMPETITORS: {json.dumps(competitors)}

AI RESPONSE:
{response_text[:4000]}

Return ONLY valid JSON:
{{
  "brands_mentioned": ["BrandA", "BrandB"],
  "focus_brand_rank": <integer position or null if not ranked>,
  "focus_brand_mentioned": <true or false>,
  "focus_brand_sentiment": "positive|neutral|negative|not_mentioned",
  "focus_brand_context": "short quote where focus brand appears",
  "all_brand_details": [
    {{"brand": "BrandA", "rank": <integer or null>, "sentiment": "positive|neutral|negative", "context": "one-line summary"}}
  ]
}}"""

    try:
        raw = chat("chatgpt", llm_prompt)
        parsed = _clean_json(raw)
        if not isinstance(parsed, dict) or not isinstance(parsed.get("all_brand_details"), list):
            return None

        details = [
            d for d in parsed["all_brand_details"]
            if isinstance(d, dict)
            and d.get("brand", "").strip()
            and not is_spurious_brand_mention(str(d["brand"]))
        ]
        parsed["all_brand_details"] = details
        parsed["brands_mentioned"] = [d["brand"] for d in details if d.get("brand")]
        parsed["sources"] = _extract_sources(response_text)
        return parsed
    except Exception:
        return None


def analyze_single_response(
    response_text: str,
    focus_brand: str,
    query: str,
    competitor_brands: list[str] | None = None,
    focus_brand_aliases: list[str] | None = None,
) -> dict[str, Any]:
    if not response_text:
        return _empty_analysis()
    text_lower_head = response_text[:100].lower()
    if response_text.startswith("[") and ("error:" in text_lower_head or "error]" in text_lower_head):
        return _empty_analysis()
    if len(response_text.strip()) < 20:
        return _empty_analysis()

    competitors = competitor_brands or []
    aliases = focus_brand_aliases or [focus_brand]

    # Primary: LLM-based extraction — reliable, understands context.
    llm_result = _llm_extract_brands(response_text, focus_brand, query, competitors)
    if llm_result and llm_result.get("all_brand_details"):
        pre_details = llm_result.get("all_brand_details") or []
        pre_focus = any(
            _brand_matches_alias(str(d.get("brand") or ""), aliases)
            for d in pre_details
            if isinstance(d, dict)
        )
        llm_result = _sanitize_llm_brand_details_against_text(llm_result, response_text, aliases)
        post_details = llm_result.get("all_brand_details") or []
        post_focus = any(
            _brand_matches_alias(str(d.get("brand") or ""), aliases)
            for d in post_details
            if isinstance(d, dict)
        )
        # Unsubstantiated focus rows removed: prefer regex-grounded analysis if it finds the brand.
        if pre_focus and not post_focus:
            heuristic = _heuristic_analysis(
                response_text, focus_brand, competitors, focus_brand_aliases=focus_brand_aliases
            )
            if heuristic.get("focus_brand_mentioned"):
                return heuristic
        if not post_details:
            heuristic = _heuristic_analysis(
                response_text, focus_brand, competitors, focus_brand_aliases=focus_brand_aliases
            )
            if heuristic.get("all_brand_details"):
                return heuristic
            return llm_result
        return llm_result

    # Fallback: heuristic for configured brands only (no auto-discovery).
    heuristic = _heuristic_analysis(response_text, focus_brand, competitors, focus_brand_aliases=focus_brand_aliases)
    return heuristic


def calculate_visibility_score(brand_mentions: list[dict], total_engines: int) -> float:
    if total_engines <= 0:
        return 0.0

    mentioned = [m for m in brand_mentions if m.get("is_focus")]
    if not mentioned:
        return 0.0

    mention_rate = len(mentioned) / total_engines
    mention_score = mention_rate * 50

    ranks = [m["rank"] for m in mentioned if m.get("rank") is not None]
    rank_score = 0.0
    if ranks:
        avg_rank = float(sum(ranks)) / len(ranks)
        rank_score = max(0.0, 30.0 - (avg_rank - 1.0) * 5.0)

    sentiments = [m.get("sentiment", "neutral") for m in mentioned]
    pos = sentiments.count("positive")
    neg = sentiments.count("negative")
    sentiment_score = ((pos - neg) / len(sentiments)) * 10.0 + 10.0 if sentiments else 10.0

    return float(round(min(100.0, mention_score + rank_score + max(0.0, sentiment_score)), 1))


def build_competitor_comparison(analyses: dict[str, Any], focus_brand: str) -> list[dict]:
    """Aggregate brand mentions across engines and annotate consensus.

    Adds ``engines_agreeing`` (number of distinct engines that mentioned this
    brand) so the UI can filter out single-engine hallucinations. The focus
    brand is always retained regardless of agreement count.
    """
    brand_data: dict[str, dict[str, Any]] = {}
    engine_names = [e for e in analyses.keys() if e != "research_data"]
    total_engines = max(1, len(engine_names))

    for engine_name, analysis in analyses.items():
        if engine_name == "research_data":
            continue
        if not isinstance(analysis, dict):
            continue
        for detail in analysis.get("all_brand_details", []):
            brand_name = detail.get("brand", "").strip()
            if not brand_name or is_spurious_brand_mention(brand_name):
                continue
            key = brand_name.lower()
            if key not in brand_data:
                brand_data[key] = {
                    "brand": brand_name,
                    "appearances": 0,
                    "total_models": total_engines,
                    "ranks": [],
                    "sentiments": [],
                    "engines": set(),
                    "is_focus": _brand_matches_alias(brand_name, [focus_brand]),
                }
            row = brand_data[key]
            row["appearances"] += 1
            row["engines"].add(engine_name)
            if detail.get("rank") is not None:
                row["ranks"].append(detail["rank"])
            row["sentiments"].append(detail.get("sentiment", "neutral"))

    result = []
    for row in brand_data.values():
        ranks = row["ranks"]
        avg_rank = round(sum(ranks) / len(ranks), 1) if ranks else None
        engines_agreeing = len(row["engines"])
        result.append(
            {
                "brand": row["brand"],
                "appearances": row["appearances"],
                "total_models": row["total_models"],
                "avg_rank": avg_rank,
                "sentiments": row["sentiments"],
                "is_focus": row["is_focus"],
                "engines_agreeing": engines_agreeing,
                # Low confidence when only one engine mentions a non-focus brand.
                "confidence": (
                    "high"
                    if engines_agreeing >= max(2, total_engines // 2)
                    else ("medium" if engines_agreeing >= 2 else "low")
                ),
            }
        )

    # Hide non-focus brands that only a single engine mentioned (they are the
    # most common hallucination pattern). Keep the focus brand always.
    filtered = [row for row in result if row["is_focus"] or row["engines_agreeing"] >= 2]
    # If filtering removed everything non-focus, fall back to the original set
    # so small engine counts still show competitors.
    if total_engines <= 2 and len([r for r in filtered if not r["is_focus"]]) == 0:
        filtered = result

    filtered.sort(
        key=lambda item: (
            not item["is_focus"],
            -item["engines_agreeing"],
            -item["appearances"],
            item["avg_rank"] if item["avg_rank"] is not None else 999.0,
        )
    )
    return filtered[:10]


def generate_positioning_insights(
    focus_brand: str,
    query: str,
    analyses: dict[str, Any],
    competitors: list[dict],
) -> list[dict]:
    competitor_summary = "\n".join(
        f"- {c['brand']}: appears in {c['appearances']}/{c['total_models']} engines, avg rank {c['avg_rank'] if c['avg_rank'] is not None else 'unranked'}"
        for c in competitors[:8]
    )

    visibility_summary = "\n".join(
        f"- {engine}: {'mentioned' if analysis.get('focus_brand_mentioned') else 'not mentioned'}"
        for engine, analysis in analyses.items()
    )

    prompt = f"""You are an AI visibility strategist.
1. Return ONLY valid JSON as a list of 4 to 6 objects.
2. Each object MUST have: "category", "title", "detail", and "link".
3. Use the specific Research Data below to provide PRECISE 'where and what' instructions.
4. Instead of "Post an article", say "Post in this Reddit thread" or "Optimize this specific page".

Brand: {focus_brand}
Query: {query}

Brand visibility by engine:
{visibility_summary}

Competitor summary:
{competitor_summary}

RESEARCH DATA (Specific Retrieval Points):
{json.dumps(analyses.get('research_data', {}).get('sources', []))}
"""

    for engine in ("chatgpt", "deepseek"):
        # We try chatgpt first for insights for cost-efficiency
        raw = chat(engine, prompt)
        try:
            parsed = _clean_json(raw)
            if isinstance(parsed, list) and parsed:
                return parsed
        except Exception:
            continue

    return [
        {
            "category": "Content Strategy",
            "title": "Cover missed prompt intent",
            "detail": f"Create and refresh pages that directly answer '{query}' with comparison tables, pricing, and proof points so {focus_brand} appears in recommendation lists.",
        }
    ]


def research_prompt_sources(query: str) -> dict[str, Any]:
    """Find likely citation targets for this query using configured web search provider."""
    provider = get_search_provider_name()
    search = search_web(query=query, max_results=10, max_tokens_per_page=320)
    if not search.get("ok"):
        return {
            "sources": [],
            "summary": f"Could not retrieve deep source research via {provider or 'search provider'}.",
            "provider": provider or "none",
        }

    rows = []
    seen = set()
    for item in (search.get("results") or [])[:15]:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or "").strip()
        if not url:
            continue
        key = url.lower().rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        domain = ""
        try:
            domain = (urlparse(url).hostname or "").replace("www.", "").strip()
        except Exception:
            domain = ""
        if not domain:
            domain = "web"
        rows.append(
            {
                "domain": domain,
                "title": title or domain,
                "url": url,
                "reason": _clip_text(snippet or f"Frequently surfaced for query intent: {query}", 180),
            }
        )

    return {
        "sources": rows[:15],
        "summary": f"Deep-link retrieval points identified using {provider or 'configured search'}",
        "provider": provider or "none",
    }


def generate_recommendations(
    focus_brand: str,
    prompt_rankings: list[dict],
    competitor_sources: list[str],
) -> dict[str, Any]:
    analyzed_count = sum(1 for row in prompt_rankings if (row.get("engines_analyzed") or 0) > 0)
    if analyzed_count == 0:
        return {
            "missing_from_prompts": [],
            "competitor_sources": [],
            "recommendation_text": "No analysis data yet. Run prompt analysis to generate evidence-backed recommendations.",
            "recommendation_items": [],
            "has_data": False,
        }

    missing = [row["prompt_text"] for row in prompt_rankings if row.get("avg_rank") is None]
    items: list[dict[str, Any]] = []
    if missing:
        items.append(
            {
                "what_happened": f"{focus_brand} is absent in {len(missing)} tracked prompts.",
                "why": "Missing prompt-intent coverage lowers mention probability across engines.",
                "action": f"Ship intent pages for: {', '.join(missing[:3])}.",
                "evidence": f"Signals: {len(missing)} prompts with no measurable rank.",
                "priority": "high",
            }
        )
    if competitor_sources:
        top_sources = ", ".join(competitor_sources[:5])
        items.append(
            {
                "what_happened": "Competitors are repeatedly cited from a narrow source set.",
                "why": "Citation concentration often drives recommendation bias.",
                "action": f"Prioritize placements and updates on: {top_sources}.",
                "evidence": f"Top cited domains observed in response sources: {top_sources}.",
                "priority": "medium",
            }
        )
    if not items:
        items.append(
            {
                "what_happened": "Coverage is currently stable.",
                "why": "Most tracked prompts already return measurable visibility.",
                "action": "Maintain a biweekly refresh cadence for top intents and evidence pages.",
                "evidence": f"{analyzed_count} prompts have analyzable engine coverage.",
                "priority": "low",
            }
        )
    return {
        "missing_from_prompts": missing,
        "competitor_sources": competitor_sources,
        "recommendation_text": " ".join(item["action"] for item in items),
        "recommendation_items": items[:5],
        "has_data": True,
    }


def _has_evidence_anchor(text: str) -> bool:
    lowered = str(text or "").lower()
    anchors = ("prompt", "engine", "model", "domain", "mention", "rank", "citation", "source")
    return any(token in lowered for token in anchors)


def _sanitize_audit_contract(raw_items: Any, focus_brand: str, query: str, default_priority: str = "medium") -> list[dict]:
    if not isinstance(raw_items, list):
        return []
    cleaned: list[dict] = []
    seen: set[str] = set()
    for row in raw_items:
        if not isinstance(row, dict):
            continue
        issue = _clip_text(row.get("issue") or row.get("title"), 110)
        root_cause = _clip_text(row.get("root_cause") or row.get("detail"), 420)
        evidence = _clip_text(row.get("evidence"), 220)
        expected_impact = _clip_text(row.get("expected_impact") or row.get("impact"), 180)
        if not issue or not root_cause or not evidence:
            continue
        fix_steps_raw = row.get("fix_steps") or row.get("action_plan") or row.get("steps") or []
        if isinstance(fix_steps_raw, str):
            fix_steps = [_clip_text(fix_steps_raw, 140)]
        elif isinstance(fix_steps_raw, list):
            fix_steps = [_clip_text(item, 140) for item in fix_steps_raw if str(item or "").strip()]
        else:
            fix_steps = []
        fix_steps = fix_steps[:4]
        if not fix_steps:
            continue
        if _looks_like_low_quality_copy(issue, min_words=2) or _looks_like_low_quality_copy(root_cause):
            continue
        if not _has_evidence_anchor(evidence):
            continue
        key = f"{_canonical_brand(issue)}|{_canonical_brand(root_cause[:120])}"
        if key in seen:
            continue
        seen.add(key)
        priority = _normalize_priority(row.get("priority"), default_priority)
        item = {
            "issue": issue,
            "root_cause": root_cause,
            "evidence": evidence,
            "fix_steps": fix_steps,
            "expected_impact": expected_impact or f"Increase mention consistency for '{query}'.",
            "priority": priority,
            "source_type": str(row.get("source_type") or "ai_generated"),
            "confidence": float(row.get("confidence") or 0.64),
            # Backward-compatible fields used by current UI:
            "title": issue,
            "solution": " ".join(fix_steps[:2]),
            "detail": root_cause,
            "avoid": _clip_text(row.get("avoid"), 180),
        }
        if focus_brand and focus_brand.lower() not in " ".join(fix_steps).lower():
            item["fix_steps"][0] = f"For {focus_brand}: {item['fix_steps'][0]}"
        cleaned.append(item)
    cleaned = _rebalance_priority_spread(cleaned)
    return cleaned[:5]


def _sanitize_opportunity_contract(raw_items: Any, focus_brand: str, default_priority: str = "medium") -> list[dict]:
    if not isinstance(raw_items, list):
        return []
    cleaned: list[dict] = []
    seen: set[str] = set()
    for row in raw_items:
        if not isinstance(row, dict):
            continue
        title = _clip_text(row.get("title"), 110)
        trigger_signal = _clip_text(row.get("trigger_signal") or row.get("evidence") or row.get("detail"), 220)
        owner_hint = _clip_text(row.get("owner_hint") or "Content + SEO", 60)
        time_to_value = _clip_text(row.get("time_to_value") or "2-4 weeks", 40)
        if not title or not trigger_signal:
            continue
        action_plan_raw = row.get("action_plan") or row.get("fix_steps") or row.get("steps") or []
        if isinstance(action_plan_raw, str):
            action_plan = [_clip_text(action_plan_raw, 140)]
        elif isinstance(action_plan_raw, list):
            action_plan = [_clip_text(item, 140) for item in action_plan_raw if str(item or "").strip()]
        else:
            action_plan = []
        if not action_plan:
            detail = _clip_text(row.get("detail"), 280)
            if detail:
                action_plan = [detail]
        if not action_plan:
            continue
        if _looks_like_low_quality_copy(title, min_words=2):
            continue
        if not _has_evidence_anchor(trigger_signal):
            continue
        key = f"{_canonical_brand(title)}|{_canonical_brand(trigger_signal[:120])}"
        if key in seen:
            continue
        seen.add(key)
        priority = _normalize_priority(row.get("priority"), default_priority)
        cleaned.append(
            {
                "title": title,
                "trigger_signal": trigger_signal,
                "action_plan": action_plan[:4],
                "owner_hint": owner_hint,
                "time_to_value": time_to_value,
                "priority": priority,
                "source_type": str(row.get("source_type") or "ai_generated"),
                "confidence": float(row.get("confidence") or 0.66),
                # Backward compatibility:
                "detail": _clip_text(row.get("detail") or " ".join(action_plan[:2]), 320),
            }
        )
    cleaned = _rebalance_priority_spread(cleaned)
    return cleaned[:6]


def _build_detailed_audit_fallback(focus_brand: str, query: str, visibility_context: list[dict]) -> list[dict]:
    total_engines = len(visibility_context)
    mentioned_rows = [row for row in visibility_context if row.get("mentioned")]
    mention_rate = (len(mentioned_rows) / total_engines) if total_engines else 0.0
    ranks = [row.get("rank") for row in mentioned_rows if isinstance(row.get("rank"), int)]
    avg_rank = (sum(ranks) / len(ranks)) if ranks else None

    missing_engines = [row["engine"] for row in visibility_context if not row.get("mentioned")]
    weak_rank_engines = [row["engine"] for row in visibility_context if isinstance(row.get("rank"), int) and row["rank"] > 5]
    negative_engines = [row["engine"] for row in visibility_context if row.get("sentiment") == "negative"]

    fallback_items: list[dict[str, Any]] = []
    if missing_engines:
        fallback_items.append(
            {
                "issue": f"Coverage gaps for '{query}' across key models",
                "root_cause": f"{focus_brand} is not mentioned in {len(missing_engines)} engine(s): {', '.join(missing_engines[:4])}.",
                "evidence": f"Engine evidence: no mentions from {', '.join(missing_engines[:3])}.",
                "fix_steps": [
                    f"Publish a dedicated answer page for '{query}' with direct entity-first summary.",
                    "Add FAQ and comparison schema blocks on that page.",
                    "Distribute a shortened variant to at least two high-citation external domains.",
                ],
                "expected_impact": "Increase mention rate across missing engines within 2-4 weeks.",
                "avoid": "Avoid generic category pages that do not answer the exact prompt intent.",
                "priority": "high",
                "source_type": "measured",
                "confidence": 0.78,
            }
        )

    if weak_rank_engines:
        fallback_items.append(
            {
                "issue": "Mentioned but buried below decision cutoff",
                "root_cause": f"{focus_brand} appears at low rank positions in: {', '.join(weak_rank_engines[:4])}.",
                "evidence": f"Rank evidence: low positions detected in {', '.join(weak_rank_engines[:3])}.",
                "fix_steps": [
                    f"Expand proof blocks for '{query}' with pricing, tradeoffs, and alternatives.",
                    "Add concise comparison table with structured attributes.",
                    "Refresh title/meta to mirror prompt phrasing and decision intent.",
                ],
                "expected_impact": "Improve average rank depth for mentioned responses.",
                "avoid": "Avoid broad copy that lacks explicit comparisons and evidence.",
                "priority": "high" if (avg_rank is not None and avg_rank > 6) else "medium",
                "source_type": "measured",
                "confidence": 0.74,
            }
        )

    if negative_engines:
        fallback_items.append(
            {
                "issue": "Negative sentiment drag in model summaries",
                "root_cause": f"Negative context appears in {len(negative_engines)} engine(s): {', '.join(negative_engines[:4])}.",
                "evidence": f"Sentiment evidence: negative mentions on {', '.join(negative_engines[:3])}.",
                "fix_steps": [
                    f"Create rebuttal content for '{query}' with verified outcomes for {focus_brand}.",
                    "Update stale claims and add source-attributed proof snippets.",
                    "Publish changelog and trust signals to key citation destinations.",
                ],
                "expected_impact": "Reduce negative sentiment share in summaries.",
                "avoid": "Avoid leaving stale or unverified claims unaddressed.",
                "priority": "medium",
                "source_type": "measured",
                "confidence": 0.72,
            }
        )

    if mention_rate >= 0.8 and avg_rank is not None and avg_rank <= 3.0:
        fallback_items.append(
            {
                "issue": "Defend strong positioning before competitors catch up",
                "root_cause": f"{focus_brand} is visible for \"{query}\", but consistency depends on a small set of current pages.",
                "evidence": f"Performance evidence: mention rate {mention_rate:.0%}, avg rank {avg_rank:.2f}.",
                "fix_steps": [
                    "Refresh winning pages monthly with net-new proof blocks.",
                    "Syndicate concise comparisons to additional citation surfaces.",
                ],
                "expected_impact": "Sustain top visibility and reduce volatility.",
                "avoid": "Avoid long refresh gaps on currently winning intent pages.",
                "priority": "low",
                "source_type": "measured",
                "confidence": 0.69,
            }
        )

    if not fallback_items:
        fallback_items.append(
            {
                "issue": f"Intent mapping for '{query}' needs sharper execution",
                "root_cause": f"Current responses do not consistently map {focus_brand} to this exact decision intent.",
                "evidence": "Evidence: unstable prompt-to-brand mapping across engines.",
                "fix_steps": [
                    f"Create a query-specific page for '{query}' with direct answer block.",
                    "Add comparison table and FAQ schema for retrieval clarity.",
                    "Distribute summary excerpts on high-citation domains.",
                ],
                "expected_impact": "Improve intent-level mention consistency.",
                "avoid": "Avoid relying only on homepage-level messaging.",
                "priority": "medium",
                "source_type": "measured",
                "confidence": 0.65,
            }
        )

    default_priority = "high" if mention_rate < 0.4 else ("medium" if mention_rate < 0.75 else "low")
    return _sanitize_audit_contract(fallback_items, focus_brand, query, default_priority=default_priority)


def generate_detailed_audit(
    focus_brand: str,
    query: str,
    analyses: dict[str, Any],
) -> list[dict]:
    """Generate prompt-specific audit points with anti-template safeguards."""
    visibility_context: list[dict[str, Any]] = []
    for engine, data in analyses.items():
        if engine == "research_data":
            continue
        if not isinstance(data, dict):
            continue
        visibility_context.append(
            {
                "engine": engine,
                "mentioned": bool(data.get("focus_brand_mentioned", False)),
                "rank": data.get("focus_brand_rank"),
                "sentiment": data.get("focus_brand_sentiment", "not_mentioned"),
                "context": _clip_text(data.get("focus_brand_context", ""), 260),
            }
        )

    total_engines = len(visibility_context)
    mention_count = sum(1 for row in visibility_context if row.get("mentioned"))
    ranks = [row.get("rank") for row in visibility_context if isinstance(row.get("rank"), int)]
    avg_rank = round(sum(ranks) / len(ranks), 2) if ranks else None
    negative_count = sum(1 for row in visibility_context if row.get("sentiment") == "negative")
    default_priority = "high" if mention_count == 0 else ("medium" if (avg_rank is None or avg_rank > 4) else "low")

    research_points = analyses.get("research_data", {}).get("sources", [])
    brief = {
        "query": query,
        "focus_brand": focus_brand,
        "engines_analyzed": total_engines,
        "engines_with_mentions": mention_count,
        "average_rank_when_mentioned": avg_rank,
        "negative_mentions": negative_count,
        "research_points": research_points[:6] if isinstance(research_points, list) else [],
    }

    prompt = f"""You are a Strategic AI Visibility Auditor.
Brand: "{focus_brand}"
Prompt intent: "{query}"

EVIDENCE SNAPSHOT:
{json.dumps(brief)}

ENGINE CONTEXT:
{json.dumps(visibility_context)}

Return ONLY valid JSON as a list of 3-5 objects.
Required fields per object:
- "issue"
- "root_cause"
- "evidence"
- "fix_steps" (array of 2-4 short bullets)
- "expected_impact"
- "priority" ("high" | "medium" | "low")
- "source_type" ("ai_generated" or "measured")
- "confidence" (0.0 to 1.0)

Strict rules:
1. Every point must be specific to this prompt intent, not generic advice.
2. Do not repeat root-cause wording across items.
3. Each evidence must reference at least one anchor from input: engine/model/domain/mention/rank/prompt/citation.
4. Keep language tactical and concise; no fluff.
5. Keep fix_steps actionable this week."""

    corrected_prompt = f"{prompt}\n\nPrevious output failed schema/quality checks. Regenerate strictly with required fields."
    for idx, req in enumerate([prompt, corrected_prompt]):
        raw = chat("chatgpt", req, temperature=0.35 if idx == 0 else 0.2)
        try:
            parsed = _clean_json(raw)
            cleaned = _sanitize_audit_contract(parsed, focus_brand, query, default_priority=default_priority)
            if len(cleaned) >= 3:
                return cleaned
        except Exception:
            continue

    return _build_detailed_audit_fallback(focus_brand, query, visibility_context)


def _build_action_plan_fallback(
    focus_brand: str,
    missing_prompts: list[str],
    llm_rows: list[dict],
    upload_targets: list[dict],
    search_intel: dict[str, Any] | None = None,
) -> list[dict]:
    actions: list[dict[str, Any]] = []

    if missing_prompts:
        examples = ", ".join(f'"{item}"' for item in missing_prompts[:3])
        actions.append(
            {
                "title": "Publish direct-answer pages for uncovered intents",
                "trigger_signal": f"Prompt evidence: {len(missing_prompts)} prompts have no mention coverage.",
                "action_plan": [
                    f"Start with {examples} and publish dedicated intent pages.",
                    "Add FAQs, comparisons, and schema on each page.",
                    "Track mention-rate lift weekly by engine.",
                ],
                "owner_hint": "SEO + Content",
                "time_to_value": "2-4 weeks",
                "detail": f"{focus_brand} is absent for {len(missing_prompts)} prompts.",
                "priority": "high",
                "source_type": "measured",
                "confidence": 0.78,
            }
        )

    lagging = None
    if llm_rows:
        lagging = min(llm_rows, key=lambda row: float(row.get("mention_rate") or 0.0))
    if lagging:
        lagging_rate = float(lagging.get("mention_rate") or 0.0)
        actions.append(
            {
                "title": f"Recover visibility in {lagging.get('llm', 'lowest-performing model')}",
                "trigger_signal": f"Model evidence: mention rate {lagging_rate:.1f}% on {lagging.get('llm', 'this model')}.",
                "action_plan": [
                    "Prioritize prompt-to-page alignment for this model first.",
                    "Refresh top missing intents each week and retest.",
                    "Stop once model mention rate crosses 70%.",
                ],
                "owner_hint": "Growth + Content",
                "time_to_value": "1-3 weeks",
                "detail": f"{focus_brand} mention rate is {lagging_rate:.1f}% on {lagging.get('llm', 'this model')}.",
                "priority": "high" if lagging_rate < 40 else "medium",
                "source_type": "measured",
                "confidence": 0.76,
            }
        )

    top_sources = [item.get("source") for item in upload_targets if item.get("source")]
    if top_sources:
        actions.append(
            {
                "title": "Prioritize citation-heavy domains first",
                "trigger_signal": f"Citation evidence: frequent domains include {', '.join(top_sources[:4])}.",
                "action_plan": [
                    "Target these domains for review/expert placements.",
                    "Publish comparison-ready snippets mapped to top prompts.",
                ],
                "owner_hint": "PR + Content",
                "time_to_value": "2-6 weeks",
                "detail": f"LLMs keep citing: {', '.join(top_sources[:5])}.",
                "priority": "medium",
                "source_type": "measured",
                "confidence": 0.73,
            }
        )

    retrieval_points = []
    if isinstance(search_intel, dict):
        retrieval_points = search_intel.get("retrieval_points", []) or []
    if retrieval_points:
        top_point = retrieval_points[0]
        top_domain = top_point.get("domain") or "target domain"
        top_query = top_point.get("query") or "priority prompt"
        top_url = top_point.get("url") or ""
        detail = f"Use the cited page structure from {top_domain} for \"{top_query}\" to build a stronger {focus_brand} answer asset."
        if top_url:
            detail = f"{detail} {top_url}"
        actions.append(
            {
                "title": "Clone winning retrieval structures",
                "trigger_signal": f"Retrieval evidence: top point on {top_domain} for '{top_query}'.",
                "action_plan": [detail, "Replicate structure with brand-specific proof and schema."],
                "owner_hint": "Content Strategy",
                "time_to_value": "1-2 weeks",
                "detail": detail,
                "priority": "medium",
                "source_type": "measured",
                "confidence": 0.71,
            }
        )

    if not actions:
        actions.append(
            {
                "title": "Establish a weekly prompt-coverage cadence",
                "trigger_signal": "No dominant single failure signal detected; governance gap remains.",
                "action_plan": [
                    "Review top prompts weekly.",
                    "Refresh stale pages and retest by model.",
                    f"Track mention-rate lift for {focus_brand}.",
                ],
                "owner_hint": "Ops + Content",
                "time_to_value": "Ongoing",
                "detail": f"Review top prompts each week, refresh stale pages, and track mention-rate lift for {focus_brand} by model.",
                "priority": "medium",
                "source_type": "ai_generated",
                "confidence": 0.62,
            }
        )

    return _sanitize_opportunity_contract(actions, focus_brand, default_priority="medium")


def generate_strategic_action_plan(
    focus_brand: str,
    project_name: str,
    missing_prompts: list[str],
    llm_rows: list[dict],
    upload_targets: list[dict],
    search_intel: dict[str, Any] | None = None,
) -> list[dict]:
    """Generate non-repetitive opportunities based on real project evidence."""
    context = {
        "project_name": project_name,
        "focus_brand": focus_brand,
        "missing_prompts": missing_prompts[:8],
        "llm_summary": llm_rows[:6],
        "upload_targets": upload_targets[:10],
        "search_intel": {
            "enabled": bool((search_intel or {}).get("enabled")) if isinstance(search_intel, dict) else False,
            "domains": ((search_intel or {}).get("domains", []) if isinstance(search_intel, dict) else [])[:8],
            "retrieval_points": ((search_intel or {}).get("retrieval_points", []) if isinstance(search_intel, dict) else [])[:8],
        },
    }

    prompt = f"""You are a senior AI visibility strategist.
Create a project opportunity action plan for brand "{focus_brand}" (project: "{project_name}").

Use ONLY this evidence:
{json.dumps(context)}

Return ONLY valid JSON as a list of 3-6 objects.
Each object must include:
- "title"
- "trigger_signal"
- "action_plan" (array of 2-4 bullet lines)
- "owner_hint"
- "time_to_value"
- "priority" ("high" | "medium" | "low")
- "source_type" ("ai_generated" or "measured")
- "confidence" (0.0 to 1.0)

Rules:
1. Every action must reference at least one concrete signal from the evidence (a prompt, model, retrieval domain, or citation source).
2. Avoid generic advice and repeated wording.
3. Priorities must reflect severity and should not all be identical.
4. Keep each action bullet under 16 words."""

    corrected_prompt = f"{prompt}\n\nPrevious output failed schema/quality checks. Regenerate strictly."
    for idx, req in enumerate([prompt, corrected_prompt]):
        raw = chat("chatgpt", req, temperature=0.4 if idx == 0 else 0.2)
        try:
            parsed = _clean_json(raw)
            cleaned = _sanitize_opportunity_contract(parsed, focus_brand, default_priority="medium")
            if len(cleaned) >= 3:
                return cleaned
        except Exception:
            continue

    return _build_action_plan_fallback(focus_brand, missing_prompts, llm_rows, upload_targets, search_intel)


def generate_project_summary(
    focus_brand: str,
    project_metadata: dict,
    prompt_rankings: list[dict],
) -> dict[str, Any]:
    """Synthesize overall project performance into a strategic executive summary."""
    # --- Metric-driven health (kept deterministic) ---
    if not prompt_rankings:
        computed_health = "Neutral"
        coverage_ratio = 0.0
        avg_rank = None
    else:
        total = len(prompt_rankings)
        ranked = [row for row in prompt_rankings if row.get("avg_rank") is not None]
        ranked_count = len(ranked)
        coverage_ratio = ranked_count / total if total else 0.0
        avg_rank = sum(float(row["avg_rank"]) for row in ranked) / ranked_count if ranked_count else None

        if ranked_count == 0:
            computed_health = "Critical"
        elif coverage_ratio >= 0.7 and avg_rank is not None and avg_rank <= 3.0:
            computed_health = "Strong"
        elif coverage_ratio < 0.4 or (avg_rank is not None and avg_rank > 6.0):
            computed_health = "Critical"
        else:
            computed_health = "Neutral"

    # Bucket prompts for roadmap guidance.
    low_visibility_prompts = [
        p["prompt_text"]
        for p in prompt_rankings
        if p.get("prompt_text") and (p.get("avg_rank") is None or float(p.get("avg_rank")) > 5.0)
    ]
    top_visibility_prompts = [
        p["prompt_text"]
        for p in prompt_rankings
        if p.get("prompt_text") and p.get("avg_rank") is not None and float(p.get("avg_rank")) <= 3.0
    ]

    # De-dup while preserving order.
    def _dedupe(items: list[str]) -> list[str]:
        seen = set()
        out = []
        for x in items:
            if x in seen:
                continue
            seen.add(x)
            out.append(x)
        return out

    low_visibility_prompts = _dedupe(low_visibility_prompts)[:6]
    top_visibility_prompts = _dedupe(top_visibility_prompts)[:6]

    # --- LLM-driven narrative, constrained by computed_health ---
    prompt = f"""You are a Visionary Brand Intelligence Director.
You MUST base your narrative and roadmap on the metric-derived visibility health below.

COMPUTED VISIBILITY HEALTH (DO NOT CHANGE):
- overall_health: "{computed_health}"
- coverage_ratio: {coverage_ratio:.2f}
- avg_rank: {avg_rank if avg_rank is not None else "null"}

PROJECT:
- name: {project_metadata.get('name')}
- industry: {project_metadata.get('category')}
- target_region: {project_metadata.get('region')}

FOCUS BRAND:
"{focus_brand}"

PROMPT INTENT BUCKETS:
- Top (best-ranking) intents (avg_rank <= 3.0): {top_visibility_prompts}
- At-risk intents (avg_rank is null or > 5.0): {low_visibility_prompts}

Return ONLY valid JSON:
{{
  "overall_health": "{computed_health}",
  "executive_bullets": [
    "First bullet: one line, max ~120 characters, no hype, state the core visibility fact for {focus_brand}.",
    "Second bullet: one line, max ~120 characters, name the biggest coverage or rank gap.",
    "Third bullet: one line, max ~120 characters, the single most important next focus."
  ],
  "executive_summary": "Optional: one plain sentence echoing bullet 1 (or leave empty string).",
  "strategic_roadmap": [
    {{
      "phase": "Primary Action",
      "action": "Exactly ONE short sentence (max ~180 chars). Must mention intent coverage for {focus_brand} and match overall_health."
    }},
    {{
      "phase": "Next 2-4 Weeks",
      "action": "Exactly ONE short sentence (max ~180 chars). Include one measurable check (e.g. rank, coverage, mentions)."
    }}
  ],
  "competitive_threats": ["Max ~120 chars each", "Second threat, max ~120 chars"],
  "top_priority_prompts": {json.dumps(top_visibility_prompts[:2] if computed_health == 'Strong' else (low_visibility_prompts[:2] if computed_health == 'Critical' else (low_visibility_prompts[:1] + top_visibility_prompts[:1])) ) }
}}

STYLE: No marketing fluff, no numbered lists inside strings, no emojis. Crisp facts only.

CRITICAL VALIDATION RULES:
1. The "overall_health" field MUST equal "{computed_health}" exactly.
2. "executive_bullets" MUST have exactly 3 non-empty strings.
3. Do not describe recovery steps when overall_health is Strong.
4. Do not describe maintenance/defense when overall_health is Critical.
5. strategic_roadmap[0].action MUST include at least one of the prompts from "top_priority_prompts" verbatim (exact text match).
6. competitive_threats: 2 or 3 strings only; each ties to retrieval/citation or intent gaps for "{focus_brand}".
"""

    raw = chat("chatgpt", prompt, temperature=0.25)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, dict) and parsed.get("overall_health"):
            eb = parsed.get("executive_bullets")
            if not isinstance(eb, list) or len([x for x in eb if str(x).strip()]) < 3:
                es = str(parsed.get("executive_summary") or "").strip()
                parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", es) if p.strip()]
                pad = parts if parts else [es] if es else []
                while len(pad) < 3:
                    pad.append("Tighten intent coverage and citation-ready content for key prompts.")
                parsed["executive_bullets"] = [str(pad[i])[:220] for i in range(3)]
            return parsed
    except Exception:
        pass

    _tp = (
        top_visibility_prompts[:2]
        if computed_health == "Strong"
        else (low_visibility_prompts[:2] if computed_health == "Critical" else low_visibility_prompts[:1] + top_visibility_prompts[:1])
    )
    return {
        "overall_health": computed_health,
        "executive_bullets": [
            f"{focus_brand}: visibility health is {computed_health} (coverage {coverage_ratio:.0%} of prompts ranked).",
            f"Prioritize intent coverage for: {_tp[0] if _tp else 'key prompts'}.",
            "Align pages and FAQs to how LLMs retrieve and cite answers in your category.",
        ],
        "executive_summary": f"Visibility health is {computed_health}; focus on ranked intent coverage and citation-ready content.",
        "strategic_roadmap": [],
        "competitive_threats": [],
        "top_priority_prompts": _tp,
    }


def generate_content_piece(
    focus_brand: str,
    directive: str,
    content_type: str,  # "Article" | "Blog" | "Reddit Post"
    context_data: dict[str, Any],
    engine: str = "deepseek"
) -> dict[str, Any]:
    """Generate high-quality, SEO-optimized content using deepseek (reasoning focus)."""
    
    prompt = f"""You are an Expert SEO Copywriter and Brand Strategist.
Generate a high-impact {content_type} for the brand "{focus_brand}".

CORE DIRECTIVE:
{directive}

STRATEGIC CONTEXT:
- Target Intent: {context_data.get('query', 'N/A')}
- Key Competitors to displace: {', '.join(context_data.get('competitors', []))}
- Industry: {context_data.get('industry', 'N/A')}

REQUIREMENTS:
1. If {content_type} is "Article" or "Blog": Include a catchy H1, structured H2/H3 subheadings, and a natural call-to-action. Focus on deep value and long-tail SEO.
2. If {content_type} is "Reddit Post": Use a conversational, authentic "human" tone. Focus on community value, no corporate fluff.
3. Optimize for AI retrieval: Use clear entities, structured lists, and factual density.

Return ONLY valid JSON:
{{
  "title": "Proposed Title/Subject",
  "content": "Full markdown formatted content",
  "seo_tags": ["tag1", "tag2"],
  "placement_advice": "Where and how to publish for maximum AI impact"
}}"""

    # First attempt: requested engine.
    raw = chat(engine, prompt)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, dict) and parsed.get("content"):
            return parsed
    except Exception:
        pass

    # Retry once on ChatGPT with tighter constraints if the primary engine
    # returned malformed JSON or no body. This avoids ever showing the
    # "Failed to generate structured content" string to end users.
    try:
        retry_prompt = (
            prompt
            + "\n\nRegenerate strictly as valid JSON matching the schema. Do not add any "
              "prose outside the JSON object."
        )
        raw2 = chat("chatgpt", retry_prompt, temperature=0.25)
        parsed2 = _clean_json(raw2)
        if isinstance(parsed2, dict) and parsed2.get("content"):
            return parsed2
    except Exception:
        pass

    # Final graceful fallback: return a structured minimal draft the user can
    # edit, rather than an error string.
    competitors_line = ", ".join((context_data or {}).get("competitors", [])[:3]) or "top competitors"
    query = (context_data or {}).get("query", "the target search intent")
    minimal_body = (
        f"# {content_type} draft for {focus_brand}\n\n"
        f"Intent: {query}\n\n"
        f"Directive: {directive}\n\n"
        "## Why this matters\n"
        "Large language models cite pages that are entity-rich, comparison-ready, "
        "and frequently updated. This draft gives you the structure to win that "
        "citation slot.\n\n"
        "## Suggested structure\n"
        "1. One-sentence summary answering the intent verbatim.\n"
        "2. Comparison table of {focus_brand} vs {competitors_line}.\n"
        "3. Short FAQ section targeted at the intent.\n"
        "4. Clear next step / call to action.\n"
    ).format(focus_brand=focus_brand, competitors_line=competitors_line)

    return {
        "title": f"{content_type} draft for {focus_brand}",
        "content": minimal_body,
        "seo_tags": [focus_brand, query],
        "placement_advice": (
            "Publish on your highest-authority domain and submit the URL to the "
            "citation-heavy domains identified in your Sources tab."
        ),
        "source": "structured_fallback",
    }


def generate_action_playbook(
    focus_brand: str,
    action_title: str,
    action_detail: str,
    industry: str = "",
    engine: str = "chatgpt",
) -> dict[str, Any]:
    """Generate a deep, step-by-step execution playbook for a single action plan item."""

    prompt = f"""You are a Senior AI Visibility Strategist working with a paying client: "{focus_brand}" in the "{industry or 'general'}" industry.

The client has this strategic action item from their AI visibility audit:
TITLE: {action_title}
DETAIL: {action_detail}

Produce an in-depth, step-by-step execution playbook so the client can implement this action TODAY. Think like a $500/hr consultant — be specific, not generic.

REQUIREMENTS:
1. Explain briefly WHY this matters: how LLMs (ChatGPT, Perplexity, Claude, Gemini) actually decide what to cite and recommend (the retrieval & ranking mechanics relevant to this action).
2. Give 5-8 concrete numbered steps. Each step must have:
   - A short imperative title (e.g. "Audit your existing FAQ schema")
   - 2-4 sentences of detailed HOW-TO instruction (tools, exact techniques, where to click, what to write)
   - One concrete example or template specific to the brand/industry where possible
3. Include a "Quick Wins" section: 2-3 things they can do in under 30 minutes that will have immediate impact.
4. Include a "Common Mistakes" section: 2-3 pitfalls to avoid with a one-line explanation each.
5. If relevant, mention specific free/paid tools (e.g. Ahrefs, Surfer SEO, Schema.org validator, Google Search Console) and how to use them for this specific action.

Return ONLY valid JSON:
{{
  "why_it_matters": "2-3 sentence explanation of how LLMs use this signal in their retrieval/ranking",
  "steps": [
    {{
      "title": "Step title",
      "detail": "Detailed how-to instruction",
      "example": "Concrete example or template (optional, use null if not applicable)"
    }}
  ],
  "quick_wins": [
    {{ "title": "Quick win title", "detail": "What to do in under 30 min" }}
  ],
  "common_mistakes": [
    {{ "title": "Mistake title", "detail": "Why it's bad and what to do instead" }}
  ],
  "tools_mentioned": ["Tool Name 1", "Tool Name 2"]
}}"""

    raw = chat(engine, prompt)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, dict) and "steps" in parsed:
            return parsed
    except Exception:
        pass

    return {
        "why_it_matters": "LLMs prioritize structured, entity-rich content from authoritative sources when generating recommendations.",
        "steps": [
            {
                "title": "Review the action detail above",
                "detail": f"Start by understanding the specific recommendation: {action_detail[:200]}",
                "example": None,
            }
        ],
        "quick_wins": [],
        "common_mistakes": [],
        "tools_mentioned": [],
    }


def generate_global_audit(
    focus_brand: str,
    all_prompts_data: list[dict],
) -> list[dict]:
    """Aggregate audit points across all prompts into a unified project-wide audit."""
    if not all_prompts_data:
        return []

    flattened_context = []
    high_priority_count = 0
    recurring_titles: dict[str, int] = defaultdict(int)

    for prompt_row in all_prompts_data:
        prompt_text = prompt_row.get("prompt_text", "Unknown")
        for audit in prompt_row.get("audit", []):
            title = str(audit.get("title") or "").strip()
            priority = _normalize_priority(audit.get("priority"), "medium")
            if priority == "high":
                high_priority_count += 1
            if title:
                recurring_titles[title] += 1
            flattened_context.append(
                {
                    "prompt": prompt_text,
                    "title": title,
                    "priority": priority,
                    "root_cause": _clip_text(audit.get("root_cause") or audit.get("detail"), 240),
                }
            )

    recurring = [
        {"title": title, "count": count}
        for title, count in sorted(recurring_titles.items(), key=lambda item: item[1], reverse=True)[:8]
    ]
    default_priority = "high" if high_priority_count >= 4 else ("medium" if high_priority_count else "low")

    prompt = f"""You are a Lead Brand Intelligence Auditor.
Synthesize project-wide visibility patterns for "{focus_brand}".

INPUT (prompt-level audit evidence):
{json.dumps(flattened_context[:40])}

RECURRING THEMES:
{json.dumps(recurring)}

Return ONLY valid JSON as a list of 4-6 objects.
Each object must include:
- "title" (short headline, max ~12 words)
- "root_cause" (1-2 short sentences, max ~220 characters total; no fluff)
- "solution" (1-2 short sentences, max ~220 characters; concrete next steps only)
- "avoid" (one short phrase, max ~100 characters)
- "priority" ("high" | "medium" | "low")
- "evidence" (reference at least one recurring prompt pattern from input)

Rules:
1. Focus on repeated patterns, not isolated one-off issues.
2. Do not reuse the same wording across multiple items.
3. No marketing language, no bullet characters inside string values, no emojis.
4. Do not assign the same priority to every item."""

    raw = chat("chatgpt", prompt, temperature=0.35)
    try:
        parsed = _clean_json(raw)
        cleaned = _sanitize_audit_items(
            parsed,
            focus_brand,
            "project-wide prompt portfolio",
            default_priority=default_priority,
        )
        if cleaned:
            return cleaned
    except Exception:
        pass

    fallback = []
    if high_priority_count:
        fallback.append(
            {
                "title": "High-severity issues recurring across prompts",
                "root_cause": f"{high_priority_count} high-priority gaps repeat across the tracked prompt set, indicating systemic coverage weaknesses.",
                "solution": "Build a shared intent-cluster roadmap: map each prompt to a canonical page, add supporting FAQs, and track mention-rate and average-rank improvements weekly.",
                "avoid": "Avoid fixing prompts in isolation without a shared topic architecture.",
                "priority": "high",
            }
        )

    if recurring:
        top_theme = recurring[0]["title"]
        fallback.append(
            {
                "title": f"Recurring failure pattern: {top_theme}",
                "root_cause": f'The theme "{top_theme}" appears repeatedly, signaling repeated structural blind spots in how content is framed for retrieval.',
                "solution": "Create a reusable content template for this theme (entity-first intro, comparison table, proof block, FAQ) and roll it out to all affected prompt pages.",
                "avoid": "Avoid inconsistent templates that force each page to reinvent structure.",
                "priority": "medium",
            }
        )

    fallback.append(
        {
            "title": "Portfolio-level retrieval governance is missing",
            "root_cause": f"{focus_brand} lacks a coordinated refresh and distribution cadence across prompts and citation channels.",
            "solution": "Run a biweekly governance cycle: refresh top-decay pages, expand citation-domain coverage, and prune outdated claims that reduce trust in LLM summaries.",
            "avoid": "Avoid ad hoc updates with no measurable KPI targets.",
            "priority": "medium",
        }
    )

    return _sanitize_audit_items(
        fallback,
        focus_brand,
        "project-wide prompt portfolio",
        default_priority=default_priority,
    )
