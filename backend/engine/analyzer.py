"""Analysis helpers for response parsing, scoring, and recommendations."""

import json
import re
from collections import defaultdict
from typing import Any

from engine.llm_clients import chat

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
    # Remove thought blocks or other prefixes
    if "</think>" in raw:
        raw = raw.split("</think>")[-1].strip()
    
    # Remove markdown code fences
    raw = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", raw, flags=re.DOTALL).strip()
    
    # Try to find the first '{' or '[' and the last '}' or ']'
    try:
        start_curly = raw.find('{')
        start_bracket = raw.find('[')
        
        start = -1
        if start_curly != -1 and (start_bracket == -1 or start_curly < start_bracket):
            start = start_curly
            end = raw.rfind('}')
        elif start_bracket != -1:
            start = start_bracket
            end = raw.rfind(']')
            
        if start != -1 and end != -1:
            raw = raw[start:end+1]
            
        return json.loads(raw)
    except Exception:
        # Fallback to simple strip if extraction fails
        raw = re.sub(r"```json|```", "", raw).strip()
        return json.loads(raw)


def _extract_sources(response_text: str) -> list[str]:
    sources: set[str] = set()

    domain_matches = re.findall(r"(?:https?://)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", response_text)
    for domain in domain_matches:
        if any(blocked in domain.lower() for blocked in {"example.com", "localhost"}):
            continue
        sources.add(domain.lower())

    source_line_match = re.search(r"sources?\s*[:\-]\s*(.+)", response_text, flags=re.IGNORECASE)
    if source_line_match:
        chunks = re.split(r",|\||;", source_line_match.group(1))
        for chunk in chunks:
            value = chunk.strip(" .")
            if value:
                sources.add(value)

    return sorted(sources)[:20]


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
) -> dict[str, Any]:
    tracked = [focus_brand] + [brand for brand in competitor_brands if brand]
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
        details.append(
            {
                "brand": item["brand"],
                "rank": item["rank"],
                "sentiment": _sentiment_for_context(item["context"]),
                "context": item["context"],
            }
        )

    details.sort(key=lambda item: (item["rank"] is None, item["rank"] if item["rank"] is not None else 999))
    focus = next((d for d in details if d["brand"].lower() == focus_brand.lower()), None)

    return {
        "brands_mentioned": [d["brand"] for d in details],
        "focus_brand_rank": focus["rank"] if focus else None,
        "focus_brand_mentioned": bool(focus),
        "focus_brand_sentiment": focus["sentiment"] if focus else "not_mentioned",
        "focus_brand_context": focus["context"] if focus else "",
        "all_brand_details": details,
        "sources": _extract_sources(response_text),
    }


def analyze_single_response(
    response_text: str,
    focus_brand: str,
    query: str,
    competitor_brands: list[str] | None = None,
) -> dict[str, Any]:
    if not response_text or response_text.startswith("["):
        return _empty_analysis()

    competitors = competitor_brands or []

    llm_prompt = f"""You are a brand intelligence analyst.

ORIGINAL QUERY: "{query}"
FOCUS BRAND: "{focus_brand}"
COMPETITOR BRANDS: {json.dumps(competitors)}

AI RESPONSE:
{response_text}

Return only valid JSON:
{{
  "brands_mentioned": ["Brand"],
  "focus_brand_rank": <integer or null>,
  "focus_brand_mentioned": <true/false>,
  "focus_brand_sentiment": "positive|neutral|negative|not_mentioned",
  "focus_brand_context": "short quote or summary",
  "all_brand_details": [
    {{"brand": "Brand", "rank": <integer or null>, "sentiment": "positive|neutral|negative", "context": "summary"}}
  ],
  "sources": ["domain.com"]
}}"""

    raw = chat("chatgpt", llm_prompt)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, dict) and parsed.get("all_brand_details") is not None:
            if not parsed.get("sources"):
                parsed["sources"] = _extract_sources(response_text)
            return parsed
    except Exception:
        pass

    return _heuristic_analysis(response_text, focus_brand, competitors)


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
    brand_data: dict[str, dict[str, Any]] = {}

    for analysis in analyses.values():
        for detail in analysis.get("all_brand_details", []):
            brand_name = detail.get("brand", "").strip()
            if not brand_name:
                continue
            key = brand_name.lower()
            if key not in brand_data:
                brand_data[key] = {
                    "brand": brand_name,
                    "appearances": 0,
                    "total_models": len(analyses),
                    "ranks": [],
                    "sentiments": [],
                    "is_focus": key == focus_brand.strip().lower(),
                }
            
            row = brand_data[key]
            row["appearances"] += 1
            if detail.get("rank") is not None:
                row["ranks"].append(detail["rank"])
            row["sentiments"].append(detail.get("sentiment", "neutral"))

    result = []
    for row in brand_data.values():
        ranks = row["ranks"]
        avg_rank = round(sum(ranks) / len(ranks), 1) if ranks else None
        result.append(
            {
                "brand": row["brand"],
                "appearances": row["appearances"],
                "total_models": row["total_models"],
                "avg_rank": avg_rank,
                "sentiments": row["sentiments"],
                "is_focus": row["is_focus"],
            }
        )

    result.sort(
        key=lambda item: (
            not item["is_focus"],
            -item["appearances"],
            item["avg_rank"] if item["avg_rank"] is not None else 999.0,
        )
    )
    return result


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
    """Use Perplexity (search-enabled) to find where LLMs typically source data for this query.
    Returns a dict with high-citation domains and specific actionable URLs.
    """
    prompt = f"""Identify 10-15 specific 'Deep Links' (active Reddit threads, niche forum posts, specific YouTube videos, or pinpointed technical articles) that LLMs consistently use as citations or knowledge retrieval points for: "{query}"

For each retrieval point, provide:
1. domain: The site name (e.g., "Reddit", "YouTube", "Verge").
2. title: The specific title of the thread, video, or article.
3. url: The EXACT deep link or video URL (e.g., "https://www.youtube.com/watch?v=..." NOT "https://youtube.com").
4. reason: Why this specific content influences LLM responses for this prompt.

CRITICAL: Do NOT return top-level domains or homepages. ONLY return specific content URLs where discussions or reviews happen.

Return ONLY valid JSON:
{{
  "sources": [
    {{
      "domain": "Reddit",
      "title": "Best budget TVs in 2024 - Megathread",
      "url": "https://reddit.com/r/4kTV/comments/...",
      "reason": "Highest cited discussion for this intent"
    }}
  ],
  "summary": "Deep-link retrieval points identified"
}}"""

    raw = chat("perplexity", prompt)
    try:
        return _clean_json(raw)
    except Exception:
        # Fallback to basic domain list if JSON fails
        return {
            "sources": [],
            "summary": "Could not retrieve deep source research via Perplexity."
        }


def generate_recommendations(
    focus_brand: str,
    prompt_rankings: list[dict],
    competitor_sources: list[str],
) -> dict[str, Any]:
    missing = [row["prompt_text"] for row in prompt_rankings if row.get("avg_rank") is None]

    actions: list[str] = []
    if missing:
        actions.append(
            f"{focus_brand} is missing in {len(missing)} tracked prompt(s). Publish dedicated landing pages or FAQ sections for those exact prompt intents."
        )

    if competitor_sources:
        top_sources = ", ".join(competitor_sources[:5])
        actions.append(
            f"Competitors are repeatedly cited from: {top_sources}. Prioritize review-site presence, comparison-list inclusion, and expert mentions on these sources."
        )

    if not actions:
        actions.append("Visibility is stable. Keep monthly refreshes on ranking pages and continue monitoring drift.")

    return {
        "missing_from_prompts": missing,
        "competitor_sources": competitor_sources,
        "recommendation_text": " ".join(actions),
    }


def generate_detailed_audit(
    focus_brand: str,
    query: str,
    analyses: dict[str, Any],
) -> list[dict]:
    """Generate a rich, LLM-driven audit with Root Cause, Solutions, and Strategic Avoidance."""
    visibility_context = []
    for engine, data in analyses.items():
        if engine == "research_data":
            continue
        visibility_context.append({
            "engine": engine,
            "mentioned": data.get("focus_brand_mentioned", False),
            "rank": data.get("focus_brand_rank"),
            "sentiment": data.get("focus_brand_sentiment", "not_mentioned"),
            "context": data.get("focus_brand_context", "")
        })

    prompt = f"""You are a Strategic AI Visibility Auditor for the brand "{focus_brand}".
Analyze why the brand is or isn't appearing for the query "{query}" across multiple LLMs.

VISIBILITY DATA:
{json.dumps(visibility_context)}

Return ONLY valid JSON as a list of 3-5 objects.
Each object MUST have:
1. "title": A crisp, punchy heading for the audit point.
2. "root_cause": Detailed reasoning of the technical or content gap for the focus brand.
3. "solution": Exact tactical steps to fix this (where to post, what to write) specifically so the brand {focus_brand} can rank better for this query.
4. "avoid": What the user should stop doing or avoid.
5. "priority": "high" | "medium" | "low"

CRITICAL: Be extremely tactical and crisp. No generic marketing fluff. Focus on how {focus_brand} can capture the intent of "{query}" in AI search engines."""

    raw = chat("chatgpt", prompt)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, list) and parsed:
            return parsed
    except Exception:
        pass

    return [{
        "title": "Visibility Gap: Missing Intent Coverage",
        "root_cause": "The brand is not directly associated with this specific query intent in current scraped datasets.",
        "solution": f"Create a dedicated FAQ and comparison guide for '{query}' on high-authority domains.",
        "avoid": "Avoid relying solely on homepage keywords; focus on long-tail prompt intent.",
        "priority": "high"
    }]


def generate_project_summary(
    focus_brand: str,
    project_metadata: dict,
    prompt_rankings: list[dict],
) -> dict[str, Any]:
    """Synthesize overall project performance into a strategic executive summary."""
    low_visibility_prompts = [p["prompt_text"] for p in prompt_rankings if p.get("avg_rank") is None or p.get("avg_rank") > 5]
    
    prompt = f"""You are a Visionary Brand Intelligence Director.
Summarize the AI Visibility health for "{focus_brand}" (Project: {project_metadata.get('name')}).

METRICS SUMMARY:
- Industry: {project_metadata.get('category')}
- Target Region: {project_metadata.get('region')}
- Active Prompts: {len(prompt_rankings)}
- At-Risk Intents (Low Visibility): {len(low_visibility_prompts)}

Return ONLY valid JSON:
{{
  "overall_health": "Critical | Neutral | Strong",
  "executive_summary": "A 2-3 sentence high-level narrative of brand dominance or displacement.",
  "strategic_roadmap": [
    {{"phase": "Immediate Fix", "action": "Specific tactic for {focus_brand} to rank higher in low visibility intents"}},
    {{"phase": "Market Gain", "action": "Specific tactic to capture more AI recommendation share"}}
  ],
  "competitive_threats": ["Brand A is eating share in X intent", "AI models favor Y type of content"],
  "top_priority_prompts": ["Prompt text 1", "Prompt text 2"]
}}

CRITICAL: The strategic_roadmap MUST provide highly specific, actionable content creation and positioning steps for {focus_brand} to actually rank better in those queries."""

    raw = chat("chatgpt", prompt)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, dict) and parsed.get("overall_health"):
            return parsed
    except Exception:
        pass

    return {
        "overall_health": "Neutral",
        "executive_summary": f"Initial analysis for {focus_brand} shows mixed visibility across {len(prompt_rankings)} intents. Coverage optimization is required.",
        "strategic_roadmap": [],
        "competitive_threats": [],
        "top_priority_prompts": low_visibility_prompts[:3]
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

    raw = chat(engine, prompt)
    try:
        return _clean_json(raw)
    except Exception:
        return {
            "title": f"{content_type} for {focus_brand}",
            "content": f"Failed to generate structured content. Raw directive: {directive}",
            "seo_tags": [],
            "placement_advice": "Check manual distribution strategy."
        }


def generate_global_audit(
    focus_brand: str,
    all_prompts_data: list[dict],
) -> list[dict]:
    """Aggregate audit points across all prompts into a unified project-wide audit."""
    if not all_prompts_data:
        return []

    # Flatten all existing audit points to provide context
    flattened_context = []
    for p in all_prompts_data:
        p_text = p.get("prompt_text", "Unknown")
        for audit in p.get("audit", []):
            flattened_context.append({
                "prompt": p_text,
                "audit_title": audit.get("title"),
                "priority": audit.get("priority")
            })

    prompt = f"""You are a Lead Brand Intelligence Auditor.
Synthesize the visibility issues across the entire project for "{focus_brand}".

INDIVIDUAL PROMPT ISSUES:
{json.dumps(flattened_context[:30])}

Return ONLY valid JSON as a list of 5-7 HIGH-LEVEL STRATEGIC AUDIT POINTS.
Each object MUST have:
1. "title": Strategic category (e.g., "Cross-Platform Sentiment Drift").
2. "root_cause": Systematic reason why {focus_brand} fails across these prompts.
3. "solution": A project-wide tactical fix, specifically detailing what content {focus_brand} needs to create or optimize to rank higher overall.
4. "avoid": Systemic mistakes to stop.
5. "priority": "high" | "medium" | "low"

Focus on patterns rather than individual prompt fixes, and ensure solutions are actionable strategies to displace competitors in LLM responses."""

    raw = chat("chatgpt", prompt)
    try:
        parsed = _clean_json(raw)
        if isinstance(parsed, list) and parsed:
            return parsed
    except Exception:
        pass

    return [{
        "title": "Global Intent Misalignment",
        "root_cause": "Brand authority is fragmented across niche intents.",
        "solution": "Implement a centralized knowledge hub covering all 10+ core intents identified.",
        "avoid": "Avoid isolated landing pages; use a linked topic cluster strategy.",
        "priority": "high"
    }]