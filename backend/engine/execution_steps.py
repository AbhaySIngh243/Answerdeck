"""Domain-aware execution steps for prompt recommendations."""

from __future__ import annotations

import re
from urllib.parse import urlparse


def _domain_from_url(value: str) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        host = urlparse(candidate).netloc or urlparse(candidate).path
    except Exception:
        host = raw
    host = host.split("@")[-1].split(":")[0].strip(".")
    return host[4:] if host.startswith("www.") else host


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _domain_matches_brand(domain: str, brand: str) -> bool:
    brand_slug = _slug(brand)
    if len(brand_slug) < 3:
        return False
    host = _slug(domain.split(".")[0])
    return brand_slug in host or host in brand_slug


def _detect_site_archetype(domain: str) -> str:
    """Classify what kind of site this is for tailored recommendations."""
    d = domain.lower()
    
    # Retail/e-commerce
    if any(x in d for x in ["amazon", "flipkart", "walmart", "target", "ebay", "croma", "reliance", "tatacliq", "nykaa", "myntra"]):
        return "retailer"
    
    # Tech/mobile review sites
    if any(x in d for x in ["91mobiles", "smartprix", "gsmarena", "gadgets", "tech", "digit", "ndtv", "beebom"]):
        return "tech_review"
    
    # Forums/community
    if any(x in d for x in ["reddit", "quora", "stack", "github", "forum", "community", "discuss"]):
        return "forum"
    
    # Video platforms
    if any(x in d for x in ["youtube", "vimeo", "tiktok", "instagram", "facebook", "twitter", "x.com"]):
        return "social_video"
    
    # News/publisher
    if any(x in d for x in ["news", "times", "post", "guardian", "bbc", "cnn", "hindustan", "india", "today", "business"]):
        return "publisher"
    
    # Blogs/personal sites
    if any(x in d for x in ["blog", "medium", "substack", "wordpress", "blogger"]):
        return "blog"
    
    return "general"


def classify_execution_domain(
    *,
    domain: str,
    focus_brand: str,
    project_website_url: str = "",
    competitors: list[str] | None = None,
) -> str:
    """Return owned, competitor, or third_party for a citation domain."""

    normalized_domain = _domain_from_url(domain)
    owned_domain = _domain_from_url(project_website_url)
    if owned_domain and (
        normalized_domain == owned_domain
        or normalized_domain.endswith(f".{owned_domain}")
        or owned_domain.endswith(f".{normalized_domain}")
    ):
        return "owned"

    if _domain_matches_brand(normalized_domain, focus_brand):
        return "owned"

    for competitor in competitors or []:
        if _domain_matches_brand(normalized_domain, competitor):
            return "competitor"

    return "third_party"


def _get_owned_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps when the citation is on your own site."""
    return [
        f"Audit your '{query}' page on {domain}: ensure the answer appears in the first 120 words with a clear value proposition.",
        f"Add structured proof points—comparison tables, pricing clarity, and real user outcomes—that LLMs can directly quote.",
        f"Submit the refreshed page to Google Search Console and request indexing to accelerate discovery.",
    ]


def _get_retailer_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps for retail/e-commerce sites (Amazon, Flipkart, Croma, etc)."""
    return [
        f"Study how {domain} ranks for '{query}': check which brands, specs, and price ranges are prominently featured.",
        f"Optimize your {domain} product listing with complete specs, competitive pricing, and authentic reviews—this is what LLMs extract.",
        f"Ensure your brand appears in comparison results on {domain} by encouraging verified purchases and detailed customer reviews.",
    ]


def _get_tech_review_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps for tech review sites (91mobiles, Smartprix, etc)."""
    return [
        f"Analyze {domain}'s '{query}' coverage: identify which features and specs they consistently highlight vs. competitors.",
        f"Pitch a hands-on comparison or review unit to {domain} editors—focus on unique specs, pricing, and real-world performance.",
        f"If direct coverage isn't possible, cite {domain}'s research in your own content and earn backlinks from other neutral sources.",
    ]


def _get_forum_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps for forums and communities (Reddit, Quora, etc)."""
    return [
        f"Find active discussions on {domain} about '{query}' and identify what real users are asking.",
        f"Participate authentically by answering questions with specific, helpful details—mention {focus_brand} naturally when relevant.",
        f"Build long-term credibility: consistent helpful contributions earn trust and mentions over time.",
    ]


def _get_social_video_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps for video/social platforms (YouTube, etc)."""
    return [
        f"Search {domain} for '{query}' videos: study which content formats (reviews, comparisons, tutorials) get cited.",
        f"Create or sponsor authentic video content that directly answers '{query}' with demos, specs, and real user benefits.",
        f"Optimize titles and descriptions with exact-match keywords so LLMs can confidently cite your video.",
    ]


def _get_publisher_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps for news/publisher sites."""
    return [
        f"Research {domain}'s editorial calendar—pitch a timely story or data study related to '{query}'.",
        f"Offer exclusive insights, survey data, or expert commentary that journalists can quote directly.",
        f"Build relationships with relevant beat reporters so {focus_brand} becomes their go-to source for this category.",
    ]


def _get_general_third_party_steps(query: str, focus_brand: str, domain: str, citation_count: int | None) -> list[str]:
    """Generic but smarter steps for uncategorized third-party sites."""
    signal = f"cited {citation_count}x" if citation_count else "repeatedly cited"
    return [
        f"Study why {domain} is {signal} for '{query}': what content structure or authority signals make it quote-worthy?",
        f"Create content on your own site that matches or exceeds that depth—then pitch legitimate updates or citations.",
        f"If {domain} accepts contributions, explore ethical placement opportunities (guest posts, expert quotes, data partnerships).",
    ]


def _get_competitor_steps(query: str, focus_brand: str, domain: str) -> list[str]:
    """Smart steps when the citation is a competitor."""
    return [
        f"Analyze what {domain} is doing right for '{query}': study their content depth, structure, and proof points.",
        f"Build a compelling comparison page on your own site—be honest about trade-offs and highlight {focus_brand}'s unique strengths.",
        f"Target neutral review, retail, and forum pages where both brands are discussed; earn citations by being genuinely helpful.",
    ]


def build_crisp_execution_steps(
    *,
    focus_brand: str,
    query: str,
    domain: str,
    project_website_url: str = "",
    competitors: list[str] | None = None,
    citation_count: int | None = None,
) -> list[str]:
    """Create truly domain-aware execution steps tailored to each site's nature."""

    normalized_domain = _domain_from_url(domain) or str(domain or "").strip() or "the cited domain"
    domain_type = classify_execution_domain(
        domain=normalized_domain,
        focus_brand=focus_brand,
        project_website_url=project_website_url,
        competitors=competitors,
    )
    
    # If it's your own domain, give owned-site recommendations
    if domain_type == "owned":
        return _get_owned_steps(query, focus_brand, normalized_domain)
    
    # If it's a competitor, give competitive response strategy
    if domain_type == "competitor":
        return _get_competitor_steps(query, focus_brand, normalized_domain)
    
    # For third-party sites, tailor to the site archetype
    archetype = _detect_site_archetype(normalized_domain)
    
    if archetype == "retailer":
        return _get_retailer_steps(query, focus_brand, normalized_domain)
    
    if archetype == "tech_review":
        return _get_tech_review_steps(query, focus_brand, normalized_domain)
    
    if archetype == "forum":
        return _get_forum_steps(query, focus_brand, normalized_domain)
    
    if archetype == "social_video":
        return _get_social_video_steps(query, focus_brand, normalized_domain)
    
    if archetype == "publisher":
        return _get_publisher_steps(query, focus_brand, normalized_domain)
    
    # Fallback for general third-party sites
    return _get_general_third_party_steps(query, focus_brand, normalized_domain, citation_count)
