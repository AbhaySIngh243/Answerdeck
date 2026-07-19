"""Full project export: payload assembly, PDF, and CSV rendering.

The PDF renderer produces an executive-grade, visually rich report designed
to look like output from a premium $150/mo AI visibility platform.
"""

from __future__ import annotations

import ast
import csv
import io
import json
import re
from datetime import datetime, timezone
from typing import Any


# ── Brand palette ────────────────────────────────────────────────────────────
BRAND_BLUE = "#2563EB"
BRAND_BLUE_DARK = "#1E40AF"
COVER_BG = "#0F172A"
COVER_ACCENT = "#3B82F6"
SECTION_BG = "#F8FAFC"
SLATE_900 = "#0F172A"
SLATE_700 = "#334155"
SLATE_500 = "#64748B"
SLATE_400 = "#94A3B8"
SLATE_200 = "#E2E8F0"
SLATE_100 = "#F1F5F9"
SLATE_50 = "#F8FAFC"
WHITE = "#FFFFFF"
GREEN_600 = "#16A34A"
GREEN_50 = "#F0FDF4"
GREEN_100 = "#DCFCE7"
AMBER_600 = "#D97706"
AMBER_50 = "#FFFBEB"
AMBER_100 = "#FEF3C7"
RED_600 = "#DC2626"
RED_50 = "#FEF2F2"
RED_100 = "#FEE2E2"
FOOTER_TEXT = "Answrdeck AI Visibility Report  \u2022  Confidential"


# ── Helpers ──────────────────────────────────────────────────────────────────
def _safe(value: Any, limit: int = 500) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "\u2026"


def _pdf_safe(value: Any) -> str:
    """Normalize text to glyphs ReportLab's built-in fonts render cleanly."""
    text = str(value or "")
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",
        "\u2192": "->",
        "\u25b6": ">",
        "\u00d7": "x",
        "\u00a0": " ",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    text = "".join(
        ch if ch in "\n\r\t" or (ord(ch) >= 32 and ord(ch) != 127) else " "
        for ch in text
    )
    text = text.encode("cp1252", "replace").decode("cp1252")
    text = re.sub(r"\?{3,}", "[non-Latin text]", text)
    return text


def _as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _as_labels(value: Any) -> list[str]:
    """Normalize list / JSON / CSV / python-repr adjective fields into labels."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(x).strip() for x in value if str(x).strip()]
    text = str(value).strip()
    if not text or text in {"[]", "None", "null"}:
        return []
    if text.startswith("["):
        parsed: Any = None
        try:
            parsed = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            try:
                parsed = ast.literal_eval(text)
            except (ValueError, SyntaxError, TypeError):
                parsed = None
        if isinstance(parsed, (list, tuple, set)):
            return [str(x).strip() for x in parsed if str(x).strip()]
    # comma / pipe / semicolon separated
    parts = [p.strip(" \t\r\n\"'") for p in text.replace("|", ",").replace(";", ",").split(",")]
    return [p for p in parts if p]


def _fmt_labels(value: Any, limit: int = 8) -> str:
    labels = _as_labels(value)[:limit]
    return ", ".join(labels) if labels else "\u2014"


def _pct(value: Any) -> str:
    if value is None:
        return "\u2014"
    try:
        return f"{float(value):.1f}%"
    except (ValueError, TypeError):
        return str(value)


def _rank(value: Any) -> str:
    if value is None or value == "":
        return "\u2014"
    try:
        n = float(value)
        if n == int(n):
            return f"#{int(n)}"
        return f"#{n:.1f}"
    except (ValueError, TypeError):
        return str(value)


def _pick_rank(*values: Any) -> str:
    for value in values:
        if value is None or value == "":
            continue
        return _rank(value)
    return "\u2014"


def _trend_rows(trend: list) -> list[list[str]]:
    """Normalize prompt-detail trend points into printable table rows.

    Prompt detail trends are stored as
    ``{timestamp, engine, mentioned, rank}`` — not date/mentions charts.
    """
    rows: list[list[str]] = []
    for t in trend:
        if not isinstance(t, dict):
            continue
        ts = str(t.get("timestamp") or t.get("date") or t.get("x") or "")[:19].replace("T", " ")
        engine = str(t.get("engine") or "\u2014")
        if "mentioned" in t or "rank" in t:
            mentioned = "Yes" if t.get("mentioned") else "No"
            rows.append([ts or "\u2014", engine, mentioned, _pick_rank(t.get("rank"))])
        else:
            # Fallback for aggregated {date, mentions/score} series
            metric = t.get("mentions", t.get("y", t.get("score", t.get("visibility"))))
            rows.append([ts or "\u2014", engine, str(metric if metric is not None else "\u2014"), _pick_rank(t.get("rank"))])
    return rows


def _aggregate_mention_trend(trend: list) -> list[list[str]]:
    """Roll per-response trend points into per-day mention rate + avg rank."""
    buckets: dict[str, dict[str, Any]] = {}
    for t in trend:
        if not isinstance(t, dict):
            continue
        day = str(t.get("timestamp") or t.get("date") or t.get("x") or "")[:10]
        if not day:
            continue
        bucket = buckets.setdefault(day, {"total": 0, "mentioned": 0, "ranks": []})
        bucket["total"] += 1
        if t.get("mentioned"):
            bucket["mentioned"] += 1
        if t.get("rank") is not None and t.get("rank") != "":
            try:
                bucket["ranks"].append(float(t.get("rank")))
            except (TypeError, ValueError):
                pass
    rows: list[list[str]] = []
    for day in sorted(buckets.keys()):
        b = buckets[day]
        rate = round((b["mentioned"] / b["total"]) * 100, 1) if b["total"] else 0.0
        avg = round(sum(b["ranks"]) / len(b["ranks"]), 1) if b["ranks"] else None
        rows.append([day, _num(b["mentioned"]), _num(b["total"]), _pct(rate), _pick_rank(avg)])
    return rows


def _num(value: Any) -> str:
    if value is None or value == "":
        return "\u2014"
    try:
        n = int(value)
        return f"{n:,}"
    except (ValueError, TypeError):
        try:
            return f"{float(value):.1f}"
        except (ValueError, TypeError):
            return str(value)


def _float_or(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _pick_num(*values: Any) -> str:
    """First non-empty numeric-looking value among alternate payload keys."""
    for value in values:
        if value is None or value == "":
            continue
        return _num(value)
    return "\u2014"


def _prompt_analysis_rows(payload: dict[str, Any]) -> list:
    """Normalize prompt_analysis whether export stored rows or a bare list."""
    raw = payload.get("prompt_analysis")
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    if isinstance(raw, dict):
        return [r for r in _as_list(raw.get("rows")) if isinstance(r, dict)]
    return []


def _health_color(label: str) -> tuple[str, str]:
    """Return (bg, fg) hex for health label."""
    lbl = (label or "").strip().lower()
    if lbl == "strong":
        return "#EFF6FF", BRAND_BLUE_DARK
    if lbl == "critical":
        return AMBER_50, AMBER_600
    return SLATE_50, SLATE_700


def _priority_color(label: str) -> tuple[str, str]:
    lbl = (label or "").strip().lower()
    if lbl == "high":
        return AMBER_100, AMBER_600
    if lbl == "low":
        return SLATE_100, SLATE_700
    return "#EFF6FF", BRAND_BLUE


def _filter_by_date(
    rows: list[dict],
    date_from: str | None,
    date_to: str | None,
    key: str = "date",
) -> list[dict]:
    if not date_from and not date_to:
        return rows
    out: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        d = str(row.get(key) or row.get("x") or "")[:10]
        if date_from and d and d < date_from:
            continue
        if date_to and d and d > date_to:
            continue
        out.append(row)
    return out


# ── Payload Builder ──────────────────────────────────────────────────────────
def build_full_export_payload(
    project_id: int,
    user_id: str,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """Aggregate all dashboard/report data for export (uses cached builders)."""
    from engine.analyzer import generate_project_summary
    from models import DisplacementRecord, Project, Prompt
    from routes.reports import (
        _build_citation_economics_payload,
        _build_competitor_visibility,
        _build_project_synthesis_summary,
        _build_prompt_detail_payload,
        _cache_get,
        _compute_overall_health,
        _get_or_build_dashboard_payload,
        _get_or_build_deep_analysis_payload,
        _get_or_build_global_audit_payload,
        _get_or_build_movement_feed,
        _get_or_build_prompt_analysis_payload,
        _get_or_build_sources_payload,
        _project_competitor_framings,
    )

    project = Project.query.filter_by(id=project_id, user_id=user_id).first()
    if not project:
        raise ValueError("Project not found")

    dashboard = _get_or_build_dashboard_payload(project_id)
    prompt_analysis = _get_or_build_prompt_analysis_payload(project_id)
    deep_analysis = _get_or_build_deep_analysis_payload(project_id)
    sources = _get_or_build_sources_payload(project_id, project)
    global_audit = _get_or_build_global_audit_payload(project_id, project)
    citation_economics = _build_citation_economics_payload(project_id, user_id)
    competitor_framings = _project_competitor_framings(project_id)
    movements = _get_or_build_movement_feed(project_id)
    project_synthesis = _build_project_synthesis_summary(project_id, user_id)

    prompt_rows_for_ids = Prompt.query.filter_by(project_id=project_id).all()
    prompt_ids = [p.id for p in prompt_rows_for_ids]
    prompt_text_by_id = {p.id: p.prompt_text for p in prompt_rows_for_ids}
    displacement_rows: list[dict] = []
    if prompt_ids:
        for row in (
            DisplacementRecord.query.filter(DisplacementRecord.prompt_id.in_(prompt_ids))
            .order_by(DisplacementRecord.timestamp.desc())
            .limit(80)
            .all()
        ):
            displacement_rows.append(
                {
                    "prompt_text": prompt_text_by_id.get(row.prompt_id, ""),
                    "engine": row.engine or "",
                    "competitor_brand": row.competitor_brand or "",
                    "displacement_context": row.displacement_context or "",
                    "displacement_reason": row.displacement_reason or "",
                    "rank_of_competitor": row.rank_of_competitor,
                    "rank_of_focus": row.rank_of_focus,
                    "cited_url": row.cited_url or "",
                    "timestamp": row.timestamp or "",
                }
            )

    competitor_bundle = _build_competitor_visibility(project_id)
    competitors_raw = (
        competitor_bundle.get("rows", [])
        if isinstance(competitor_bundle, dict)
        else []
    )
    mention_totals = sum(int(item.get("mentions") or 0) for item in competitors_raw)
    competitors: list[dict] = []
    for item in competitors_raw:
        mentions = int(item.get("mentions") or 0)
        share = round((mentions / mention_totals) * 100, 2) if mention_totals else None
        competitors.append({**item, "share_of_voice": share, "ai_share": share})

    cache_key = f"intel-summary:v2:{project_id}"
    intel = _cache_get(cache_key)
    if intel is None:
        prompt_rankings = dashboard.get("prompt_rankings", [])
        analyzed = sum(
            1 for row in prompt_rankings if (row.get("engines_analyzed") or 0) > 0
        )
        coverage = dashboard.get("coverage") or {}
        if analyzed == 0:
            intel = {
                "overall_health": "No data",
                "executive_summary": "Awaiting the first measured prompt run. Once answers are collected, this section will summarize visibility, rank, competitors, citations, and next moves from real model evidence.",
                "executive_bullets": [],
                "strategic_roadmap": [],
                "competitive_threats": [],
                "top_priority_prompts": [],
                "has_data": False,
            }
        else:
            project_meta = {
                "name": project.name,
                "category": project.category,
                "region": project.region,
                "n_responses": int((coverage or {}).get("n_responses") or 0),
                "tracked_prompts": [
                    str(r.get("prompt_text") or "").strip()
                    for r in prompt_rankings
                    if r.get("prompt_text")
                ],
                "competitors": competitors[:8],
                "engine_visibility": _as_list(dashboard.get("engine_visibility"))[:8],
                "visibility_pct_current": dashboard.get("visibility_pct_current"),
                "official_site_cited_pct": dashboard.get("official_site_cited_pct"),
            }
            intel = generate_project_summary(
                project.name, project_meta, prompt_rankings, skip_llm=True
            )
            if not isinstance(intel, dict):
                intel = {}
            intel["overall_health"] = _compute_overall_health(prompt_rankings)
            intel["has_data"] = True

    prompts = (
        Prompt.query.filter_by(project_id=project_id)
        .order_by(Prompt.created_at.asc())
        .all()
    )
    prompt_details: list[dict] = []
    for prompt in prompts:
        try:
            prompt_details.append(_build_prompt_detail_payload(prompt.id))
        except Exception:
            prompt_details.append(
                {
                    "prompt_id": prompt.id,
                    "prompt_text": prompt.prompt_text,
                    "analysis_brief": {},
                    "audit": [],
                    "recommended_actions": [],
                    "brand_ranking": [],
                    "sources": [],
                    "raw_responses": [],
                }
            )

    visibility_trend = _filter_by_date(
        _as_list(
            dashboard.get("visibility_trend") or dashboard.get("quality_score_trend")
        ),
        date_from,
        date_to,
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "date_from": date_from,
        "date_to": date_to,
        "project": dashboard.get("project") or {},
        "dashboard": {
            **dashboard,
            "visibility_trend": visibility_trend,
            "quality_score_trend": visibility_trend,
        },
        "intel": intel,
        "prompt_analysis": prompt_analysis,
        "deep_analysis": deep_analysis,
        "sources": sources,
        "global_audit": global_audit,
        "citation_economics": citation_economics,
        "competitors": competitors,
        "competitor_framings": competitor_framings,
        "prompt_details": prompt_details,
        "movements": movements,
        "project_synthesis": project_synthesis,
        "displacements": displacement_rows,
    }


# ── CSV Renderer (unchanged) ────────────────────────────────────────────────
def render_full_report_csv(payload: dict[str, Any]) -> str:
    """Multi-section CSV export from full payload."""
    output = io.StringIO()
    writer = csv.writer(output)

    def section(title: str) -> None:
        writer.writerow([])
        writer.writerow([f"=== {title} ==="])

    project = payload.get("project") or {}
    dashboard = payload.get("dashboard") or {}
    intel = payload.get("intel") or {}

    section("Overview")
    writer.writerow(["Field", "Value"])
    writer.writerow(["Project", project.get("name", "")])
    writer.writerow(["Category", project.get("category", "")])
    writer.writerow(["Region", project.get("region", "")])
    writer.writerow(["Website", project.get("website_url", "")])
    writer.writerow(["Generated At", payload.get("generated_at", "")])
    if payload.get("date_from") or payload.get("date_to"):
        writer.writerow(["Date Range", f"{payload.get('date_from') or '\u2014'} to {payload.get('date_to') or '\u2014'}"])
    writer.writerow(["Visibility %", dashboard.get("visibility_pct_current", "")])
    writer.writerow(["Quality Score", dashboard.get("quality_score_current", dashboard.get("current_visibility_score", ""))])
    writer.writerow(["Official Site Cited %", dashboard.get("official_site_cited_pct", "")])
    writer.writerow(["Overall Health", intel.get("overall_health", "")])
    cov = dashboard.get("coverage") or {}
    writer.writerow(["Sample Prompts", cov.get("n_prompts", "")])
    writer.writerow(["Sample Engines", cov.get("n_engines", "")])
    writer.writerow(["Sample Responses", cov.get("n_responses", "")])
    writer.writerow(["Confidence Tier", cov.get("tier", "")])

    section("Executive Summary")
    writer.writerow(["Summary", intel.get("executive_summary", "")])
    for bullet in _as_list(intel.get("executive_bullets")):
        writer.writerow(["Bullet", bullet])
    for threat in _as_list(intel.get("competitive_threats")):
        writer.writerow(["Threat", threat])
    for item in _as_list(intel.get("strategic_roadmap")):
        if isinstance(item, dict):
            writer.writerow(["Roadmap", f"{item.get('phase', '')}: {item.get('action', '')}"])
        else:
            writer.writerow(["Roadmap", item])
    for p in _as_list(intel.get("top_priority_prompts")):
        writer.writerow(["Priority Prompt", p])

    insight = dashboard.get("project_insight") or {}
    section("Cross-Prompt Insight")
    writer.writerow(["Insight", insight.get("insight_text", "")])
    writer.writerow(["Framing Pattern", insight.get("framing_pattern", "")])
    writer.writerow(["Recurring Adjectives", _fmt_labels(insight.get("recurring_adjectives"), 20)])
    writer.writerow(["Consistent Competitors", _fmt_labels(insight.get("consistent_competitors"), 20)])

    section("Visibility Trend")
    writer.writerow(["Date", "Score"])
    for row in _as_list(dashboard.get("visibility_trend")):
        writer.writerow([row.get("date", row.get("x", "")), row.get("score", row.get("y", ""))])

    section("Prompt Mentions & Rank Trends")
    writer.writerow(["Prompt", "Timestamp", "Engine", "Mentioned", "Rank"])
    for detail in _as_list(payload.get("prompt_details")):
        prompt_text = detail.get("prompt_text", "")
        for t in _as_list(detail.get("trend")):
            if isinstance(t, dict):
                writer.writerow([
                    prompt_text,
                    t.get("timestamp", t.get("date", "")),
                    t.get("engine", ""),
                    "Yes" if t.get("mentioned") else "No",
                    t.get("rank", ""),
                ])

    trend = dashboard.get("competitor_visibility_trend") or {}
    if isinstance(trend, dict) and trend.get("series"):
        section("Competitor Visibility Trend")
        brands = _as_list(trend.get("brands"))
        writer.writerow(["Date"] + brands)
        if brands and trend.get("series"):
            series_map = {s.get("id"): s.get("data") or [] for s in _as_list(trend.get("series")) if isinstance(s, dict)}
            max_len = max((len(series_map.get(b, [])) for b in brands), default=0)
            for i in range(max_len):
                row = [""]
                for b in brands:
                    pts = series_map.get(b, [])
                    row.append(pts[i].get("y", "") if i < len(pts) else "")
                date_pt = series_map.get(brands[0], [])
                row[0] = date_pt[i].get("x", "") if i < len(date_pt) else ""
                writer.writerow(row)

    section("Engine Breakdown")
    writer.writerow(["Engine", "Visibility %", "Avg Rank", "Responses", "Mentions"])
    for row in _as_list(dashboard.get("engine_visibility")):
        writer.writerow([row.get("engine", ""), row.get("visibility_pct", ""), row.get("avg_rank", ""), row.get("responses", ""), row.get("mentions", "")])

    section("Prompt Performance")
    writer.writerow(["Prompt", "Visibility %", "Quality Score", "Avg Rank", "Sentiment", "Engines", "Type", "Active"])
    for row in _prompt_analysis_rows(payload):
        writer.writerow([row.get("prompt_text", ""), row.get("visibility_pct", row.get("visibility", "")), row.get("quality_score", ""), row.get("avg_rank", ""), row.get("sentiment", ""), row.get("engines_analyzed", ""), row.get("prompt_type", ""), row.get("is_active", "")])

    section("Competitor Intelligence")
    writer.writerow(["Brand", "Visibility %", "Share of Voice", "Quality Score", "Mentions", "Avg Rank", "Focus", "Target"])
    for row in _as_list(payload.get("competitors")):
        writer.writerow([row.get("brand", ""), row.get("visibility_pct", row.get("visibility_score", "")), row.get("share_of_voice", ""), row.get("quality_score", ""), row.get("mentions", ""), row.get("avg_rank", ""), "Yes" if row.get("is_focus") else "No", "Yes" if row.get("is_target_competitor") else "No"])

    section("Competitor Framing Quotes")
    writer.writerow(["Competitor", "Engine", "Quote", "Adjectives"])
    for row in _as_list(payload.get("competitor_framings")):
        writer.writerow([row.get("competitor_brand", ""), row.get("engine", ""), row.get("verbatim_sentence", ""), _fmt_labels(row.get("framing_adjectives"), 12)])

    trajectory = dashboard.get("trajectory") or {}
    section("Trajectory and Displacement")
    writer.writerow(["Summary", trajectory.get("summary_sentence", "")])
    for d in _as_list(trajectory.get("new_displacers")):
        writer.writerow(["New Displacer", d])
    for shift in _as_list(trajectory.get("framing_shifts")):
        if isinstance(shift, dict):
            writer.writerow(["Framing Shift", f"{shift.get('engine', '')}: {shift.get('old_framing', '')} \u2192 {shift.get('new_framing', '')}"])
    for engine, trend_row in (trajectory.get("engine_trends") or {}).items():
        if isinstance(trend_row, dict):
            writer.writerow(["Engine Trend", engine, trend_row.get("direction", ""), trend_row.get("rank_delta", "")])

    section("Sources and Domains")
    writer.writerow(["Domain", "Source Mentions", "Brand Mentions", "Query"])
    for row in _as_list((payload.get("sources") or {}).get("domains")):
        writer.writerow([row.get("domain", ""), row.get("source_mentions", ""), row.get("brand_mentions", ""), row.get("query", "")])

    section("Classified Sources")
    writer.writerow(["Class", "Domain", "Why It Matters", "Action", "Priority"])
    for row in _as_list((payload.get("sources") or {}).get("sources")):
        writer.writerow([row.get("source_class", ""), row.get("domain", row.get("source", "")), row.get("why_it_matters", ""), row.get("action", ""), row.get("priority", "")])

    ce = payload.get("citation_economics") or {}
    section("Citation Economics")
    writer.writerow(["Metric", "Value"])
    rollup = ce.get("rollup_focus_mentions") or ce.get("rollup") or ce
    for key in ("responses_measured", "focus_mentions", "focus_with_any_source_url", "focus_without_source_url", "focus_with_brand_domain_citation", "focus_with_competitor_named_domain"):
        if key in rollup:
            writer.writerow([key, rollup.get(key)])

    section("Global Visibility Audit")
    writer.writerow(["Title", "Priority", "Root Cause", "Solution", "Avoid", "Evidence", "Queries"])
    for item in _as_list((payload.get("global_audit") or {}).get("items")):
        writer.writerow([item.get("title", ""), item.get("priority", ""), item.get("root_cause", ""), item.get("solution", ""), item.get("avoid", ""), item.get("evidence_quote", ""), "; ".join(_as_list(item.get("queries_supporting")))])

    recs = dashboard.get("recommendations") or {}
    section("Recommendations")
    writer.writerow(["Text", recs.get("recommendation_text", "")])
    for item in _as_list(recs.get("recommendation_items")):
        if isinstance(item, dict):
            writer.writerow(["Item", item.get("action", ""), item.get("engine", ""), item.get("priority", ""), item.get("evidence", "")])

    section("Action Plan and Opportunities")
    for item in _as_list((payload.get("deep_analysis") or {}).get("action_plan")):
        writer.writerow(["Title", item.get("title", "")])
        writer.writerow(["Trigger", item.get("trigger_signal", "")])
        writer.writerow(["Priority", item.get("priority", "")])
        writer.writerow(["Evidence", item.get("evidence_quote", "")])
        writer.writerow(["Confidence", item.get("confidence", "")])
        for step in _as_list(item.get("action_plan")):
            writer.writerow(["Step", step])
        writer.writerow([])

    section("Prompt x Engine Matrix")
    writer.writerow(["Prompt", "Engine", "Mentioned", "Rank", "Sentiment", "Sources"])
    for prompt_row in _as_list((payload.get("deep_analysis") or {}).get("prompt_matrix")):
        prompt_text = prompt_row.get("prompt_text", "")
        engines = prompt_row.get("engines") or {}
        if isinstance(engines, dict):
            for engine, cell in engines.items():
                if isinstance(cell, dict):
                    writer.writerow([prompt_text, engine, cell.get("mentioned", ""), cell.get("rank", ""), cell.get("sentiment", ""), "; ".join(_as_list(cell.get("sources"))[:5])])

    section("Per-Prompt Deep Dives")
    for detail in _as_list(payload.get("prompt_details")):
        brief = detail.get("analysis_brief") or {}
        writer.writerow(["Prompt", detail.get("prompt_text", "")])
        writer.writerow(["What Happened", brief.get("what_happened", "")])
        writer.writerow(["Why It Matters", brief.get("why_it_matters", "")])
        writer.writerow(["Next Move", brief.get("next_move", "")])
        for pt in _as_list(brief.get("evidence_points")):
            writer.writerow(["Evidence", pt])
        for rank in _as_list(detail.get("brand_ranking")):
            writer.writerow(["Brand Rank", rank.get("name", ""), rank.get("mentions", ""), rank.get("avg_rank", "")])
        for audit in _as_list(detail.get("audit")):
            writer.writerow(["Audit", audit.get("title", audit.get("issue", "")), audit.get("root_cause", ""), audit.get("solution", audit.get("fix_steps", ""))])
        for action in _as_list(detail.get("recommended_actions")):
            writer.writerow(["Recommended Action", action.get("title", ""), action.get("detail", "")])
        writer.writerow([])

    section("Movements")
    mov = payload.get("movements") or {}
    mov_sum = mov.get("summary") or {}
    for key in ("gains", "drops", "net_rank_delta", "events_count", "last_checked", "previous_check", "runs_recorded"):
        if key in mov_sum:
            writer.writerow([key, mov_sum.get(key)])
    writer.writerow(["Severity", "Direction", "Engine", "Headline", "Detail", "From", "To"])
    for e in _as_list(mov.get("events")):
        if isinstance(e, dict):
            writer.writerow([e.get("severity", ""), e.get("direction", ""), e.get("engine", ""), e.get("headline", ""), e.get("detail", ""), e.get("from", ""), e.get("to", "")])

    section("Project Synthesis")
    synth = payload.get("project_synthesis") or {}
    writer.writerow(["Engines Mentioning", ", ".join(_as_list(synth.get("engines_mentioning")))])
    writer.writerow(["Engines Not Mentioning", ", ".join(_as_list(synth.get("engines_not_mentioning")))])
    for d in _as_list(synth.get("top_displacement_competitors")):
        if isinstance(d, dict):
            writer.writerow(["Displacer", d.get("brand", ""), d.get("count", "")])
    for r in _as_list(synth.get("recurring_displacement_reasons")):
        writer.writerow(["Displacement Reason", r])

    section("Displacement Log")
    writer.writerow(["Prompt", "Engine", "Competitor", "Comp Rank", "Focus Rank", "Reason", "Context", "Cited URL", "Timestamp"])
    for d in _as_list(payload.get("displacements")):
        writer.writerow([
            d.get("prompt_text", ""), d.get("engine", ""), d.get("competitor_brand", ""),
            d.get("rank_of_competitor", ""), d.get("rank_of_focus", ""),
            d.get("displacement_reason", ""), d.get("displacement_context", ""),
            d.get("cited_url", ""), d.get("timestamp", ""),
        ])

    deep = payload.get("deep_analysis") or {}
    section("Content Gaps")
    for m in _as_list(deep.get("missing_prompts")):
        writer.writerow(["Missing Prompt", m])
    for u in _as_list(deep.get("upload_targets")):
        if isinstance(u, dict):
            writer.writerow(["Upload Target", u.get("source", ""), u.get("count", "")])

    section("LLM Summary")
    writer.writerow(["Engine", "Mention Rate", "Avg Rank", "Responses", "Positive", "Neutral", "Negative", "Not Mentioned"])
    for r in _as_list(deep.get("llm_summary")):
        writer.writerow([
            r.get("llm", ""), r.get("mention_rate", ""), r.get("avg_rank", ""), r.get("response_count", ""),
            r.get("positive", ""), r.get("neutral", ""), r.get("negative", ""), r.get("not_mentioned", ""),
        ])

    ce = payload.get("citation_economics") or {}
    moat = ce.get("citation_moat") or {}
    section("Citation Moat")
    for key in ("score", "status", "summary", "focus_cited_pct", "owned_cited_pct", "competitor_cited_pct"):
        if key in moat:
            writer.writerow([key, moat.get(key)])
    for r in _as_list(moat.get("recommendations")):
        writer.writerow(["Recommendation", r])

    section("Appendix \u2014 Raw Model Answers")
    writer.writerow(["Prompt", "Engine", "Timestamp", "Response Text", "Sources"])
    for detail in _as_list(payload.get("prompt_details")):
        prompt_text = detail.get("prompt_text", "")
        for resp in _as_list(detail.get("raw_responses")):
            sources_list = resp.get("sources") or []
            src_str = "; ".join(str(s) for s in sources_list[:10])
            writer.writerow([prompt_text, resp.get("engine", ""), resp.get("timestamp", ""), resp.get("display_response_text") or resp.get("response_text", ""), src_str])

    return output.getvalue()


# ══════════════════════════════════════════════════════════════════════════════
#  PDF RENDERER — Executive-grade visual report
# ══════════════════════════════════════════════════════════════════════════════


def render_full_report_pdf(payload: dict[str, Any]) -> bytes:
    """Render a visually stunning, detail-dense multi-section PDF using ReportLab."""
    try:
        from reportlab.lib import colors as rl_colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            BaseDocTemplate,
            CondPageBreak,
            Flowable,
            Frame,
            KeepTogether,
            NextPageTemplate,
            PageBreak,
            PageTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError as exc:
        raise RuntimeError("reportlab is required for PDF export") from exc

    W, H = letter
    MARGIN = 0.55 * inch
    CONTENT_W = W - 2 * MARGIN

    project = payload.get("project") or {}
    dashboard = payload.get("dashboard") or {}
    intel = payload.get("intel") or {}
    deep = payload.get("deep_analysis") or {}
    project_name = _safe(project.get("name") or "Project", 80)
    gen_date = (payload.get("generated_at") or "")[:19].replace("T", " ")
    C = rl_colors.HexColor

    styles = getSampleStyleSheet()

    S_COVER_TITLE = ParagraphStyle(
        "CoverTitle", parent=styles["Title"],
        fontSize=30, leading=36, textColor=C(WHITE),
        alignment=TA_CENTER, spaceAfter=0, fontName="Helvetica-Bold",
    )
    S_COVER_SUB = ParagraphStyle(
        "CoverSub", parent=styles["Normal"],
        fontSize=12, leading=17, textColor=C("#CBD5E1"),
        alignment=TA_CENTER, spaceAfter=4,
    )
    S_COVER_SMALL = ParagraphStyle(
        "CoverSmall", parent=styles["Normal"],
        fontSize=9, leading=12, textColor=C("#94A3B8"),
        alignment=TA_CENTER,
    )
    S_SECTION = ParagraphStyle(
        "SectionHead", parent=styles["Heading1"],
        fontSize=18, leading=22, textColor=C(BRAND_BLUE_DARK),
        spaceBefore=4, spaceAfter=2, fontName="Helvetica-Bold",
    )
    S_SECTION_DESC = ParagraphStyle(
        "SectionDesc", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=C(SLATE_500), spaceAfter=10,
    )
    S_SUB = ParagraphStyle(
        "SubHead", parent=styles["Heading2"],
        fontSize=11.5, leading=15, textColor=C(BRAND_BLUE),
        spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold",
    )
    S_BODY = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, leading=13.5, textColor=C(SLATE_900), spaceAfter=4,
    )
    S_BODY_ITALIC = ParagraphStyle(
        "BodyItalic", parent=S_BODY, textColor=C(SLATE_700), fontName="Helvetica-Oblique",
    )
    S_SMALL = ParagraphStyle(
        "Small", parent=styles["Normal"],
        fontSize=8, leading=11, textColor=C(SLATE_500), spaceAfter=2,
    )
    S_BULLET = ParagraphStyle(
        "Bullet", parent=S_BODY, leftIndent=14, bulletIndent=0, spaceBefore=1, spaceAfter=1,
    )
    S_TOC = ParagraphStyle(
        "TOC", parent=styles["Normal"],
        fontSize=10.5, leading=18, textColor=C(SLATE_700), leftIndent=8,
    )
    S_TABLE_HEAD = ParagraphStyle(
        "THead", parent=styles["Normal"],
        fontSize=7.5, leading=10, textColor=C(WHITE), fontName="Helvetica-Bold",
    )
    S_TABLE_CELL = ParagraphStyle(
        "TCell", parent=styles["Normal"],
        fontSize=7.5, leading=10.5, textColor=C(SLATE_900),
    )
    S_TABLE_CELL_SMALL = ParagraphStyle(
        "TCellSmall", parent=styles["Normal"],
        fontSize=7, leading=9.5, textColor=C(SLATE_700),
    )
    S_QUOTE = ParagraphStyle(
        "Quote", parent=S_BODY_ITALIC,
        leftIndent=10, rightIndent=6, textColor=C(SLATE_700),
        borderPadding=4, spaceBefore=2, spaceAfter=4,
    )
    S_CALLOUT = ParagraphStyle(
        "CalloutPara", parent=styles["Normal"],
        fontSize=8, leading=11.5, textColor=C(SLATE_900),
    )
    S_CALLOUT_TITLE = ParagraphStyle(
        "CalloutTitle", parent=styles["Normal"],
        fontSize=8.5, leading=11, textColor=C(BRAND_BLUE), fontName="Helvetica-Bold",
        spaceAfter=3,
    )

    def esc(text: str) -> str:
        return (
            _pdf_safe(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    def P(text: str, style=S_BODY) -> Paragraph:
        return Paragraph(esc(text).replace("\n", "<br/>"), style)

    def PB(text: str) -> Paragraph:
        return Paragraph(f"\u2022 {esc(text)}", S_BULLET)

    def PH(html: str, style=S_BODY) -> Paragraph:
        return Paragraph(html, style)

    # ── Custom Flowables ─────────────────────────────────────────────────

    class AccentLine(Flowable):
        def __init__(self, color=BRAND_BLUE, width_pct=1.0, thickness=2):
            super().__init__()
            self._color = color
            self._width_pct = width_pct
            self._thickness = thickness

        def wrap(self, aW, aH):
            self.width = aW
            self.height = self._thickness + 4
            return self.width, self.height

        def draw(self):
            self.canv.setStrokeColor(C(self._color))
            self.canv.setLineWidth(self._thickness)
            self.canv.line(0, 2, self.width * self._width_pct, 2)

    class KPIStrip(Flowable):
        def __init__(self, items: list[tuple[str, str]], height=56):
            super().__init__()
            self._items = items
            self._h = height

        def wrap(self, aW, aH):
            self.width = aW
            self.height = self._h
            return self.width, self.height

        def draw(self):
            n = len(self._items)
            if n == 0:
                return
            gap = 7
            card_w = (self.width - gap * (n - 1)) / n
            x = 0
            for value, label in self._items:
                self.canv.setFillColor(C(SLATE_50))
                self.canv.setStrokeColor(C(SLATE_200))
                self.canv.setLineWidth(0.5)
                self.canv.roundRect(x, 0, card_w, self._h, 5, fill=1, stroke=1)
                self.canv.setStrokeColor(C(BRAND_BLUE))
                self.canv.setLineWidth(2)
                self.canv.line(x + 4, self._h - 1, x + card_w - 4, self._h - 1)
                val = str(value)[:18]
                fs = 16 if len(val) <= 8 else 12
                self.canv.setFont("Helvetica-Bold", fs)
                self.canv.setFillColor(C(BRAND_BLUE_DARK))
                self.canv.drawCentredString(x + card_w / 2, self._h / 2 + 3, val)
                self.canv.setFont("Helvetica", 6.5)
                self.canv.setFillColor(C(SLATE_500))
                self.canv.drawCentredString(x + card_w / 2, self._h / 2 - 12, str(label)[:28])
                x += card_w + gap

    class ScoreBar(Flowable):
        """Horizontal score bar 0–100 with label."""

        def __init__(self, label: str, value: Any, height=18):
            super().__init__()
            self._label = label
            try:
                self._value = max(0.0, min(100.0, float(value)))
            except (TypeError, ValueError):
                self._value = None
            self._h = height

        def wrap(self, aW, aH):
            self.width = aW
            self.height = self._h
            return self.width, self.height

        def draw(self):
            label_w = min(140, self.width * 0.32)
            bar_x = label_w + 6
            bar_w = self.width - bar_x - 36
            self.canv.setFont("Helvetica", 8)
            self.canv.setFillColor(C(SLATE_700))
            self.canv.drawString(0, 4, str(self._label)[:28])
            self.canv.setFillColor(C(SLATE_100))
            self.canv.roundRect(bar_x, 3, bar_w, 10, 3, fill=1, stroke=0)
            if self._value is not None:
                filled = max(2, bar_w * (self._value / 100.0))
                self.canv.setFillColor(C(BRAND_BLUE))
                self.canv.roundRect(bar_x, 3, filled, 10, 3, fill=1, stroke=0)
                self.canv.setFont("Helvetica-Bold", 8)
                self.canv.setFillColor(C(SLATE_900))
                self.canv.drawRightString(self.width, 4, f"{self._value:.0f}")
            else:
                self.canv.setFont("Helvetica", 8)
                self.canv.setFillColor(C(SLATE_400))
                self.canv.drawRightString(self.width, 4, "\u2014")

    class Sparkline(Flowable):
        """Simple line chart for visibility trend."""

        def __init__(self, points: list[float], height=72, color=BRAND_BLUE):
            super().__init__()
            self._points = [float(p) for p in points if p is not None]
            self._h = height
            self._color = color

        def wrap(self, aW, aH):
            self.width = aW
            self.height = self._h
            return self.width, self.height

        def draw(self):
            if len(self._points) < 2:
                self.canv.setFont("Helvetica", 8)
                self.canv.setFillColor(C(SLATE_400))
                self.canv.drawCentredString(self.width / 2, self._h / 2, "Not enough trend points yet")
                return
            pad_l, pad_r, pad_t, pad_b = 28, 8, 10, 16
            plot_w = self.width - pad_l - pad_r
            plot_h = self._h - pad_t - pad_b
            lo = min(self._points)
            hi = max(self._points)
            if hi <= lo:
                hi = lo + 1
            self.canv.setStrokeColor(C(SLATE_200))
            self.canv.setLineWidth(0.4)
            for i in range(5):
                y = pad_b + plot_h * i / 4
                self.canv.line(pad_l, y, pad_l + plot_w, y)
                val = lo + (hi - lo) * i / 4
                self.canv.setFont("Helvetica", 6)
                self.canv.setFillColor(C(SLATE_400))
                self.canv.drawRightString(pad_l - 3, y - 2, f"{val:.0f}")
            xs, ys = [], []
            n = len(self._points)
            for i, v in enumerate(self._points):
                x = pad_l + (plot_w * i / (n - 1))
                y = pad_b + plot_h * ((v - lo) / (hi - lo))
                xs.append(x)
                ys.append(y)
            self.canv.setStrokeColor(C(self._color))
            self.canv.setLineWidth(2)
            p = self.canv.beginPath()
            p.moveTo(xs[0], ys[0])
            for x, y in zip(xs[1:], ys[1:]):
                p.lineTo(x, y)
            self.canv.drawPath(p, stroke=1, fill=0)
            self.canv.setFillColor(C(self._color))
            for x, y in zip(xs, ys):
                self.canv.circle(x, y, 2.2, fill=1, stroke=0)
            self.canv.setFont("Helvetica", 6.5)
            self.canv.setFillColor(C(SLATE_500))
            self.canv.drawString(pad_l, 2, f"Start {self._points[0]:.1f}")
            self.canv.drawRightString(pad_l + plot_w, 2, f"Latest {self._points[-1]:.1f}")

    class SectionNumber(Flowable):
        def __init__(self, number: int, title: str):
            super().__init__()
            self._num = number
            self._title = title

        def wrap(self, aW, aH):
            self.width = aW
            self.height = 34
            return self.width, self.height

        def draw(self):
            badge = 22
            self.canv.setFillColor(C(BRAND_BLUE))
            self.canv.roundRect(0, self.height - badge - 2, badge, badge, 4, fill=1, stroke=0)
            self.canv.setFont("Helvetica-Bold", 10)
            self.canv.setFillColor(C(WHITE))
            self.canv.drawCentredString(badge / 2, self.height - badge + 4, f"{self._num:02d}")
            self.canv.setFont("Helvetica-Bold", 14)
            self.canv.setFillColor(C(BRAND_BLUE_DARK))
            self.canv.drawString(badge + 10, self.height - badge + 3, self._title[:78])
            self.canv.setStrokeColor(C(SLATE_200))
            self.canv.setLineWidth(0.5)
            self.canv.line(0, 0, self.width, 0)

    class HealthBadge(Flowable):
        def __init__(self, label: str):
            super().__init__()
            self._label = label or "\u2014"

        def wrap(self, aW, aH):
            self.width = aW
            self.height = 28
            return self.width, self.height

        def draw(self):
            bg, fg = _health_color(self._label)
            pill_w = min(170, self.width)
            x = (self.width - pill_w) / 2
            self.canv.setFillColor(C(bg))
            self.canv.roundRect(x, 2, pill_w, 24, 12, fill=1, stroke=0)
            self.canv.setFont("Helvetica-Bold", 11)
            self.canv.setFillColor(C(fg))
            self.canv.drawCentredString(self.width / 2, 9, self._label.upper())

    class HBarChart(Flowable):
        """Horizontal bar comparison chart."""

        def __init__(self, rows: list[tuple[str, float]], height=None, max_val=100.0):
            super().__init__()
            self._rows = rows[:12]
            self._max = max_val if max_val > 0 else 100.0
            self._row_h = 16
            self._h = height or max(40, len(self._rows) * self._row_h + 8)

        def wrap(self, aW, aH):
            self.width = aW
            self.height = self._h
            return self.width, self.height

        def draw(self):
            if not self._rows:
                return
            label_w = min(120, self.width * 0.28)
            bar_area = self.width - label_w - 40
            y = self.height - 14
            for name, val in self._rows:
                self.canv.setFont("Helvetica", 7.5)
                self.canv.setFillColor(C(SLATE_700))
                self.canv.drawString(0, y, str(name)[:22])
                self.canv.setFillColor(C(SLATE_100))
                self.canv.roundRect(label_w, y - 1, bar_area, 9, 2, fill=1, stroke=0)
                filled = max(1.5, bar_area * (float(val) / self._max))
                color = BRAND_BLUE if "focus" not in str(name).lower() else BRAND_BLUE_DARK
                self.canv.setFillColor(C(color))
                self.canv.roundRect(label_w, y - 1, filled, 9, 2, fill=1, stroke=0)
                self.canv.setFont("Helvetica-Bold", 7)
                self.canv.setFillColor(C(SLATE_900))
                self.canv.drawRightString(self.width, y, f"{float(val):.1f}%")
                y -= self._row_h

    def make_callout(lines: list[str], bg=SLATE_50, accent=BRAND_BLUE, title="") -> Table:
        """Wrapped callout using a Paragraph table (no truncation)."""
        parts = []
        if title:
            parts.append(Paragraph(esc(title), ParagraphStyle(
                "CT", parent=S_CALLOUT_TITLE, textColor=C(accent),
            )))
        for line in lines:
            parts.append(Paragraph(esc(str(line)), S_CALLOUT))
        if not parts:
            parts = [Paragraph("\u2014", S_CALLOUT)]
        inner = Table([[parts]], colWidths=[CONTENT_W - 12])
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), C(bg)),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("BOX", (0, 0), (-1, -1), 0, C(bg)),
            ("LINEBEFORE", (0, 0), (0, -1), 3.5, C(accent)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        return inner

    def make_table(
        headers: list[str],
        rows: list[list[str]],
        col_widths: list[float] | None = None,
        highlight_focus: bool = False,
    ) -> Table:
        header_cells = [Paragraph(esc(h), S_TABLE_HEAD) for h in headers]
        data = [header_cells]
        for row in rows:
            style_to_use = S_TABLE_CELL if len(str(row[0] if row else "")) < 70 else S_TABLE_CELL_SMALL
            data.append([Paragraph(esc(str(c)), style_to_use) for c in row])
        tbl = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        cmds: list = [
            ("BACKGROUND", (0, 0), (-1, 0), C(BRAND_BLUE_DARK)),
            ("TEXTCOLOR", (0, 0), (-1, 0), C(WHITE)),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C(WHITE), C(SLATE_50)]),
            ("LINEBELOW", (0, 0), (-1, 0), 1.5, C(BRAND_BLUE)),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, C(SLATE_200)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("TOPPADDING", (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ]
        if highlight_focus:
            for i, row in enumerate(rows, start=1):
                if row and str(row[-1]).strip().lower() == "yes":
                    cmds.append(("BACKGROUND", (0, i), (-1, i), C("#EFF6FF")))
                    cmds.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))
        tbl.setStyle(TableStyle(cmds))
        return tbl

    def advisory_panel(title: str, lines: list[str], *, accent=BRAND_BLUE, bg=SLATE_50) -> Table:
        clean = [str(line).strip() for line in lines if str(line or "").strip()]
        if not clean:
            clean = ["This signal is not populated yet. Use the measured sections above as the current source of truth."]
        return make_callout(clean, bg=bg, accent=accent, title=title)

    # ── Story assembly ───────────────────────────────────────────────────
    story: list = []
    cov = dashboard.get("coverage") or {}
    vis = dashboard.get("visibility_pct_current")
    score = dashboard.get("quality_score_current", dashboard.get("current_visibility_score"))
    health = intel.get("overall_health", "\u2014")
    site_pct = dashboard.get("official_site_cited_pct")
    movements = payload.get("movements") or {}
    synthesis = payload.get("project_synthesis") or {}
    displacements = _as_list(payload.get("displacements"))
    ce = payload.get("citation_economics") or {}
    moat = ce.get("citation_moat") or {}
    prompt_rankings_for_readout = _as_list(dashboard.get("prompt_rankings"))
    engine_rows_for_readout = _as_list(dashboard.get("engine_visibility"))
    low_visibility_rows = prompt_rankings_for_readout or _prompt_analysis_rows(payload)
    low_visibility_count = sum(
        1
        for row in low_visibility_rows
        if isinstance(row, dict) and _float_or(row.get("visibility_pct", row.get("visibility")), 0.0) < 25
    )
    weak_engine_names = [
        str(row.get("engine"))
        for row in engine_rows_for_readout
        if isinstance(row, dict) and _float_or(row.get("visibility_pct"), 0.0) < 50 and row.get("engine")
    ][:4]

    def _cover_page(canvas_obj, doc_obj):
        canvas_obj.saveState()
        canvas_obj.setFillColor(C(COVER_BG))
        canvas_obj.rect(0, 0, W, H, fill=1, stroke=0)
        # subtle accent band
        canvas_obj.setFillColor(C("#1E293B"))
        canvas_obj.rect(0, H - 120, W, 120, fill=1, stroke=0)
        canvas_obj.setStrokeColor(C(COVER_ACCENT))
        canvas_obj.setLineWidth(3)
        canvas_obj.line(MARGIN, H - 48, W - MARGIN, H - 48)
        canvas_obj.setFillColor(C(COVER_ACCENT))
        canvas_obj.rect(0, 0, W, 6, fill=1, stroke=0)
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(C(SLATE_400))
        canvas_obj.drawCentredString(W / 2, 22, FOOTER_TEXT)
        canvas_obj.restoreState()

    def _normal_page(canvas_obj, doc_obj):
        canvas_obj.saveState()
        canvas_obj.setFillColor(C(SLATE_50))
        canvas_obj.rect(0, H - 40, W, 40, fill=1, stroke=0)
        canvas_obj.setStrokeColor(C(BRAND_BLUE))
        canvas_obj.setLineWidth(2)
        canvas_obj.line(0, H - 40, W, H - 40)
        canvas_obj.setFont("Helvetica-Bold", 7.5)
        canvas_obj.setFillColor(C(BRAND_BLUE))
        canvas_obj.drawString(MARGIN, H - 26, "ANSWRDECK")
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(C(SLATE_400))
        canvas_obj.drawRightString(W - MARGIN, H - 26, f"{project_name}  |  AI Visibility Intelligence Report")
        canvas_obj.setStrokeColor(C(SLATE_200))
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(MARGIN, 36, W - MARGIN, 36)
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(C(SLATE_400))
        canvas_obj.drawString(MARGIN, 22, FOOTER_TEXT)
        canvas_obj.drawRightString(W - MARGIN, 22, f"Page {doc_obj.page}")
        canvas_obj.restoreState()

    buffer = io.BytesIO()
    frame_cover = Frame(MARGIN, MARGIN, CONTENT_W, H - 2 * MARGIN, id="cover")
    frame_body = Frame(MARGIN, 48, CONTENT_W, H - 48 - 44, id="body")
    doc = BaseDocTemplate(buffer, pagesize=letter, title=f"Answrdeck Report \u2014 {project_name}")
    doc.addPageTemplates([
        PageTemplate(id="cover_tpl", frames=[frame_cover], onPage=_cover_page),
        PageTemplate(id="normal_tpl", frames=[frame_body], onPage=_normal_page),
    ])

    # ── COVER ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.4 * inch))
    story.append(P("ANSWRDECK", ParagraphStyle(
        "BrandMark", parent=S_COVER_SUB, fontSize=11, textColor=C(COVER_ACCENT),
        fontName="Helvetica-Bold",
    )))
    story.append(Spacer(1, 4))
    story.append(P("AI Visibility Intelligence Report", S_COVER_SUB))
    story.append(P("Board-ready competitive analysis across ChatGPT, Gemini, Claude & Perplexity",
                    ParagraphStyle("CoverTag", parent=S_COVER_SMALL, fontSize=9)))
    story.append(Spacer(1, 0.4 * inch))
    story.append(P(project_name, S_COVER_TITLE))
    story.append(Spacer(1, 6))
    meta_parts = [_safe(project.get("category") or "Uncategorized")]
    if project.get("region"):
        meta_parts.append(str(project["region"]))
    if project.get("website_url"):
        meta_parts.append(str(project["website_url"]))
    story.append(P("  \u2022  ".join(meta_parts), S_COVER_SUB))
    story.append(Spacer(1, 0.45 * inch))
    story.append(KPIStrip([
        (_pct(vis), "VISIBILITY SCORE"),
        (str(score) if score is not None else "\u2014", "QUALITY SCORE"),
        (str(health).upper(), "HEALTH STATUS"),
        (str(cov.get("tier", "\u2014")).upper(), "CONFIDENCE TIER"),
    ], height=58))
    story.append(Spacer(1, 0.18 * inch))
    story.append(KPIStrip([
        (_pct(site_pct), "OWNED SITE CITED"),
        (_num(cov.get("n_prompts")), "PROMPTS TRACKED"),
        (_num(cov.get("n_engines")), "ENGINES MEASURED"),
        (_num(cov.get("n_responses")), "RESPONSES SAMPLED"),
    ], height=46))
    if moat.get("score") is not None:
        story.append(Spacer(1, 0.15 * inch))
        story.append(KPIStrip([
            (str(moat.get("score")), "CITATION MOAT"),
            (str(moat.get("status", "\u2014")).upper(), "MOAT STATUS"),
            (_pct(moat.get("owned_cited_pct")), "OWNED CITE RATE"),
            (_pct(moat.get("competitor_cited_pct")), "COMPETITOR CITE"),
        ], height=46))
    story.append(Spacer(1, 0.45 * inch))
    story.append(P(f"Generated {gen_date} UTC", S_COVER_SMALL))
    if payload.get("date_from") or payload.get("date_to"):
        story.append(P(
            f"Trend window: {payload.get('date_from') or 'start'} \u2192 {payload.get('date_to') or 'now'}",
            S_COVER_SMALL,
        ))
    story.append(P("Confidential  \u2022  For internal strategy use", S_COVER_SMALL))

    story.append(NextPageTemplate("normal_tpl"))
    story.append(PageBreak())

    # ── TOC ──────────────────────────────────────────────────────────────
    story.append(P("Report Contents", S_SECTION))
    story.append(AccentLine(BRAND_BLUE, 0.28))
    story.append(Spacer(1, 10))
    toc_items = [
        ("01", "Executive Summary & Scorecard"),
        ("02", "Brand Profile & Methodology"),
        ("03", "Visibility Trends & Trajectory"),
        ("04", "Momentum & Run-over-Run Movements"),
        ("05", "AI Engine Performance"),
        ("06", "Prompt Performance Analysis"),
        ("07", "Content Gaps & Opportunity Surface"),
        ("08", "Competitive Intelligence"),
        ("09", "Displacement Intelligence"),
        ("10", "Source, Citation & Moat Analysis"),
        ("11", "Visibility Audit \u2014 What\u2019s Lacking"),
        ("12", "Strategic Recommendations & Action Plan"),
        ("13", "Per-Prompt Deep Dives"),
        ("14", "Prompt \u00d7 Engine Matrix"),
        ("15", "Appendix: Raw AI Model Responses"),
    ]
    for num, title in toc_items:
        story.append(PH(
            f'<font name="Helvetica-Bold" color="{BRAND_BLUE}">{num}</font>'
            f'&#160;&#160;&#160;{esc(title)}',
            S_TOC,
        ))
    story.append(Spacer(1, 16))
    story.append(make_callout(
        [
            "How to read this report: Visibility = share of measured answers naming your brand. "
            "Quality blends mention rate, average rank, and sentiment. Citation moat measures whether "
            "mentions are backed by owned-domain sources versus competitor or third-party URLs.",
        ],
        bg=SLATE_50,
        accent=BRAND_BLUE,
        title="READING GUIDE",
    ))
    story.append(PageBreak())

    sec_counter = [0]

    def start_section(title: str, description: str = "", *, force_page: bool = False):
        """Flow sections onto the same page; only force_page starts fresh."""
        sec_counter[0] += 1
        if force_page:
            story.append(PageBreak())
        elif sec_counter[0] > 1:
            story.append(Spacer(1, 8))
            story.append(AccentLine(SLATE_200, 1.0, 0.5))
            story.append(Spacer(1, 4))
            # Break only when there isn't even room for the header (~0.9")
            story.append(CondPageBreak(0.9 * inch))
        # Keep header + blurb together so a title never sits alone at page bottom
        story.append(KeepTogether([
            SectionNumber(sec_counter[0], title),
            Spacer(1, 4),
            *([P(description, S_SECTION_DESC)] if description else []),
        ]))

    # ═════════════════════════════════════════════════════════════════════
    # 01 — EXECUTIVE SUMMARY
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Executive Summary & Scorecard",
        "Board-level posture of your brand across every tracked buyer prompt and AI engine.",
    )
    story.append(HealthBadge(str(health)))
    story.append(Spacer(1, 10))

    # Scorecard bars
    story.append(P("Visibility Scorecard", S_SUB))
    try:
        story.append(ScoreBar("Visibility %", vis))
    except Exception:
        pass
    try:
        story.append(ScoreBar("Quality score", score))
    except Exception:
        pass
    if moat.get("score") is not None:
        story.append(ScoreBar("Citation moat", moat.get("score")))
    if site_pct is not None:
        story.append(ScoreBar("Owned site cited %", site_pct))
    story.append(Spacer(1, 8))

    tier_label = str(cov.get("tier") or "\u2014").upper()
    readout_lines = [
        f"Current measured answer visibility is {_pct(vis)} across {_num(cov.get('n_responses'))} sampled answers.",
        f"The report is based on {_num(cov.get('n_prompts'))} tracked prompt(s) across {_num(cov.get('n_engines'))} engine(s), with confidence tier {tier_label}.",
    ]
    if low_visibility_count:
        readout_lines.append(
            f"{low_visibility_count} tracked prompt(s) are below 25% answer visibility and should be treated as near-term content gaps."
        )
    if weak_engine_names:
        readout_lines.append(
            "Weakest engine coverage: " + ", ".join(weak_engine_names) + "."
        )
    if site_pct is not None:
        readout_lines.append(
            f"Owned-site citation rate is {_pct(site_pct)}, which indicates how often model answers lean on the brand's own domain as evidence."
        )
    story.append(advisory_panel("MANAGEMENT READOUT", readout_lines, accent=BRAND_BLUE, bg="#EFF6FF"))
    story.append(Spacer(1, 8))

    # Focus brand ranking snapshot from competitors + engines
    focus_comp = next(
        (c for c in _as_list(payload.get("competitors")) if isinstance(c, dict) and c.get("is_focus")),
        None,
    )
    eng_data_early = _as_list(dashboard.get("engine_visibility"))
    rank_bits = []
    if focus_comp:
        rank_bits.append(
            f"Brand avg rank {_pick_rank(focus_comp.get('avg_rank'), focus_comp.get('rank'))} "
            f"across {_num(focus_comp.get('mentions'))} mentions "
            f"({_pct(focus_comp.get('share_of_voice'))} SOV)."
        )
    if eng_data_early:
        eng_rank_bits = [
            f"{r.get('engine')}: {_pick_rank(r.get('avg_rank'), r.get('rank'))}"
            for r in eng_data_early
            if isinstance(r, dict)
        ]
        if eng_rank_bits:
            rank_bits.append("Engine ranks — " + "  |  ".join(eng_rank_bits[:6]))
    if rank_bits:
        story.append(make_callout(rank_bits, bg=SLATE_50, accent=BRAND_BLUE, title="RANKING SNAPSHOT"))
        story.append(Spacer(1, 8))

    exec_summary = intel.get("executive_summary", "")
    if exec_summary:
        story.append(make_callout([exec_summary], bg=SLATE_50, accent=BRAND_BLUE, title="EXECUTIVE NARRATIVE"))
        story.append(Spacer(1, 8))

    bullets = _as_list(intel.get("executive_bullets"))
    if bullets:
        story.append(P("Key Findings", S_SUB))
        for b in bullets:
            story.append(PB(str(b)))

    threats = _as_list(intel.get("competitive_threats"))
    if threats:
        story.append(Spacer(1, 6))
        story.append(make_callout(
            [str(t) for t in threats[:8]],
            bg=AMBER_50, accent=AMBER_600, title="COMPETITIVE THREATS",
        ))

    roadmap = _as_list(intel.get("strategic_roadmap"))
    if roadmap:
        story.append(P("Strategic Roadmap", S_SUB))
        for item in roadmap:
            if isinstance(item, dict):
                story.append(PB(f"{item.get('phase', '')}: {item.get('action', '')}"))
            else:
                story.append(PB(str(item)))

    priority_prompts = _as_list(intel.get("top_priority_prompts"))
    if priority_prompts:
        story.append(Spacer(1, 6))
        story.append(make_callout(
            [str(p) for p in priority_prompts[:6]],
            bg=AMBER_50, accent=AMBER_600, title="TOP PRIORITY PROMPTS",
        ))

    insight = dashboard.get("project_insight") or {}
    if insight.get("insight_text") or insight.get("consistent_competitors"):
        story.append(P("Cross-Prompt Intelligence", S_SUB))
        if insight.get("insight_text"):
            story.append(P(insight["insight_text"], S_BODY_ITALIC))
        if insight.get("framing_pattern"):
            story.append(P(f"Dominant framing pattern: {insight['framing_pattern']}", S_SMALL))
        adjs = _as_labels(insight.get("recurring_adjectives"))
        if adjs:
            story.append(P(f"Recurring adjectives: {', '.join(adjs[:14])}", S_SMALL))
        cons = _as_labels(insight.get("consistent_competitors"))
        if cons:
            story.append(P(f"Competitors consistently named alongside you: {', '.join(cons[:10])}", S_BODY))

    # Synthesis snapshot
    if synthesis.get("top_displacement_competitors") or synthesis.get("recurring_displacement_reasons"):
        story.append(P("Displacement Snapshot", S_SUB))
        top_disp = _as_list(synthesis.get("top_displacement_competitors"))
        if top_disp:
            story.append(P(
                "Top displacing brands: "
                + ", ".join(
                    f"{d.get('brand')} ({d.get('count')})"
                    for d in top_disp[:6]
                    if isinstance(d, dict)
                ),
                S_BODY,
            ))
        reasons = _as_list(synthesis.get("recurring_displacement_reasons"))
        if reasons:
            for r in reasons[:5]:
                story.append(PB(str(r)))


    # ═════════════════════════════════════════════════════════════════════
    # 02 — METHODOLOGY
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Brand Profile & Methodology",
        "Configuration, sample coverage, and how scores in this report are calculated.",
    )
    meta_rows = [
        ["Brand name", project.get("name", "")],
        ["Category", project.get("category", "")],
        ["Region", project.get("region", "")],
        ["Website", project.get("website_url", "")],
        ["Configured competitors", ", ".join(_as_list(project.get("competitors"))[:14]) or "\u2014"],
        ["Onboarding / ICP context", "Complete" if project.get("context_ready") else "Incomplete"],
        ["Report generated (UTC)", gen_date],
    ]
    if payload.get("date_from") or payload.get("date_to"):
        meta_rows.append([
            "Trend filter",
            f"{payload.get('date_from') or 'start'} \u2192 {payload.get('date_to') or 'now'}",
        ])
    story.append(make_table(["Parameter", "Value"], meta_rows, [2.1 * inch, CONTENT_W - 2.1 * inch]))
    story.append(Spacer(1, 12))

    story.append(P("Data Coverage", S_SUB))
    coverage_rows = [
        ["Prompts tracked", _num(cov.get("n_prompts"))],
        ["AI engines measured", _num(cov.get("n_engines"))],
        ["Responses sampled", _num(cov.get("n_responses"))],
        ["Queries with responses", _num(cov.get("n_queries_with_responses"))],
        ["Confidence tier", str(cov.get("tier", "\u2014")).upper()],
        [
            "Official site cited",
            f"{_pct(site_pct)} ({_num(dashboard.get('official_site_cited_count'))}/"
            f"{_num(dashboard.get('official_site_responses_total'))})",
        ],
    ]
    story.append(make_table(["Metric", "Value"], coverage_rows, [2.1 * inch, CONTENT_W - 2.1 * inch]))
    story.append(Spacer(1, 10))
    story.append(make_callout(
        [
            "Visibility % = answers naming your brand \u00f7 total measured answers.",
            "Quality score = mention-rate component + rank component + sentiment component (capped at 100).",
            "Avg rank = mean position when mentioned (lower is better).",
            "Citation moat = whether brand mentions are backed by owned URLs vs competitor/third-party sources.",
            "Scope = latest response per prompt per engine unless a trend window is applied.",
            "Engines covered typically include ChatGPT, Gemini, Claude, and Perplexity (based on prompt config).",
        ],
        bg=SLATE_50, accent=BRAND_BLUE, title="SCORING METHODOLOGY",
    ))

    # ═════════════════════════════════════════════════════════════════════
    # 03 — TRENDS
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Visibility Trends & Trajectory",
        "Historical visibility scores and competitive positioning over time.",
    )
    vis_trend = _as_list(dashboard.get("visibility_trend"))
    spark_vals = []
    for r in vis_trend:
        try:
            spark_vals.append(float(r.get("score", r.get("y"))))
        except (TypeError, ValueError):
            continue
    if spark_vals:
        story.append(P("Visibility Trajectory", S_SUB))
        story.append(Sparkline(spark_vals, height=78))
        story.append(Spacer(1, 8))
        if len(spark_vals) >= 2:
            delta = spark_vals[-1] - spark_vals[0]
            direction = "improved" if delta > 0 else ("declined" if delta < 0 else "held flat")
            story.append(P(
                f"Over this window, visibility {direction} by {abs(delta):.1f} points "
                f"({spark_vals[0]:.1f} \u2192 {spark_vals[-1]:.1f}).",
                S_BODY,
            ))

    if vis_trend:
        story.append(P("Daily / Run Scores", S_SUB))
        trend_rows = [
            [str(r.get("date", r.get("x", ""))), str(r.get("score", r.get("y", "")))]
            for r in vis_trend[-40:]
        ]
        story.append(make_table(["Date", "Visibility Score"], trend_rows, [2.2 * inch, 1.6 * inch]))
        story.append(Spacer(1, 10))

    comp_trend = dashboard.get("competitor_visibility_trend") or {}
    if isinstance(comp_trend, dict) and comp_trend.get("series"):
        story.append(P("Competitor Visibility Comparison", S_SUB))
        brands = _as_list(comp_trend.get("brands"))
        series_map = {
            s.get("id"): s.get("data") or []
            for s in _as_list(comp_trend.get("series"))
            if isinstance(s, dict)
        }
        max_len = max((len(series_map.get(b, [])) for b in brands), default=0)
        ct_rows = []
        for i in range(min(max_len, 30)):
            date_val = ""
            row_vals = []
            for b in brands:
                pts = series_map.get(b, [])
                if i < len(pts):
                    if not date_val:
                        date_val = str(pts[i].get("x", ""))
                    row_vals.append(str(pts[i].get("y", "")))
                else:
                    row_vals.append("")
            ct_rows.append([date_val] + row_vals)
        if ct_rows and brands:
            widths = [1.1 * inch] + [max(0.65 * inch, (CONTENT_W - 1.1 * inch) / max(len(brands), 1))] * len(brands)
            story.append(make_table(["Date"] + [str(b) for b in brands], ct_rows, widths))
        story.append(Spacer(1, 10))

    trajectory = dashboard.get("trajectory") or {}
    if trajectory.get("summary_sentence"):
        story.append(make_callout(
            [trajectory["summary_sentence"]],
            bg=SLATE_50, accent=BRAND_BLUE, title="TRAJECTORY SUMMARY",
        ))
        story.append(Spacer(1, 8))

    new_displacers = _as_list(trajectory.get("new_displacers"))
    if new_displacers:
        story.append(P("New Displacing Competitors", S_SUB))
        for d in new_displacers:
            story.append(PB(str(d)))

    framing_shifts = _as_list(trajectory.get("framing_shifts"))
    if framing_shifts:
        story.append(P("Framing Shifts by Engine", S_SUB))
        for shift in framing_shifts:
            if isinstance(shift, dict):
                story.append(PB(
                    f"{shift.get('engine', '')}: \"{shift.get('old_framing', '')}\" "
                    f"\u2192 \"{shift.get('new_framing', '')}\""
                ))

    engine_trends = trajectory.get("engine_trends") or {}
    if engine_trends:
        story.append(P("Engine Rank Trends", S_SUB))
        et_rows = []
        for engine, t in engine_trends.items():
            if isinstance(t, dict):
                delta = t.get("rank_delta")
                et_rows.append([
                    engine,
                    str(t.get("direction", "")),
                    str(delta) if delta is not None else "\u2014",
                ])
        if et_rows:
            story.append(make_table(["Engine", "Direction", "Rank Delta"], et_rows))
    if not vis_trend:
        story.append(advisory_panel(
            "BASELINE SNAPSHOT",
            [
                f"This export has the current scorecard but no historical visibility series yet.",
                f"Current measured visibility is {_pct(vis)} across {_num(cov.get('n_responses'))} answer(s).",
                "Run the same tracked prompts again after content or citation changes to unlock trajectory, rank delta, and competitor movement charts.",
            ],
            accent=BRAND_BLUE,
            bg=SLATE_50,
        ))

    # ═════════════════════════════════════════════════════════════════════
    # 04 — MOVEMENTS
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Momentum & Run-over-Run Movements",
        "What changed since the previous measured run: gains, losses, rank moves, and new out-rankers.",
    )
    mov_summary = movements.get("summary") or {}
    if movements.get("has_data"):
        story.append(KPIStrip([
            (_num(mov_summary.get("gains")), "GAINS"),
            (_num(mov_summary.get("drops")), "DROPS"),
            (str(mov_summary.get("net_rank_delta", "\u2014")), "NET RANK DELTA"),
            (_num(mov_summary.get("events_count")), "EVENTS"),
        ], height=48))
        story.append(Spacer(1, 6))
        story.append(P(
            f"Compared {mov_summary.get('previous_check') or '\u2014'} \u2192 "
            f"{mov_summary.get('last_checked') or '\u2014'} across "
            f"{_num(mov_summary.get('runs_recorded'))} recorded runs.",
            S_SMALL,
        ))
        events = _as_list(movements.get("events"))
        if events:
            story.append(P("Movement Feed", S_SUB))
            ev_rows = [
                [
                    str(e.get("severity", "")).upper(),
                    str(e.get("direction", "")),
                    str(e.get("engine", "")),
                    _safe(e.get("headline", ""), 70),
                    _safe(e.get("detail", ""), 90),
                    f"{e.get('from', '')} \u2192 {e.get('to', '')}",
                ]
                for e in events[:25]
                if isinstance(e, dict)
            ]
            if ev_rows:
                story.append(make_table(
                    ["Severity", "Dir", "Engine", "Headline", "Detail", "Change"],
                    ev_rows,
                    [0.55 * inch, 0.45 * inch, 0.7 * inch, 1.5 * inch, 1.7 * inch, 1.1 * inch],
                ))
        elif not movements.get("has_history"):
            story.append(make_callout(
                ["Only one run is on record. Re-run analysis to unlock movement detection."],
                bg=AMBER_50, accent=AMBER_600, title="NEEDS HISTORY",
            ))
    else:
        history_line = (
            "Only one measured run is available, so Answrdeck cannot compare gains, drops, or rank movement yet."
            if not movements.get("has_history")
            else "No movement events were detected in the current comparison window."
        )
        story.append(advisory_panel(
            "MOMENTUM INTERPRETATION",
            [
                history_line,
                "Use this export as the baseline. After the next analysis run, this section will show gains, losses, new out-rankers, and rank-delta evidence.",
                "Manager takeaway: do not judge campaign movement from a single snapshot; judge it after one repeat run using the same prompt set.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))

    # ═════════════════════════════════════════════════════════════════════
    # 05 — ENGINE PERFORMANCE
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "AI Engine Performance",
        "How each model surfaces your brand — mention rate, rank, sentiment mix, and top sources.",
    )
    eng_data = _as_list(dashboard.get("engine_visibility"))
    if eng_data:
        bar_rows = []
        for r in eng_data:
            try:
                bar_rows.append((str(r.get("engine", "")), float(r.get("visibility_pct") or 0)))
            except (TypeError, ValueError):
                continue
        if bar_rows:
            story.append(P("Visibility by Engine", S_SUB))
            story.append(HBarChart(bar_rows, max_val=max(100.0, max(v for _, v in bar_rows) or 100)))
            story.append(Spacer(1, 8))
        eng_rows = [
            [
                r.get("engine", ""),
                _pct(r.get("visibility_pct")),
                _pick_rank(r.get("avg_rank"), r.get("rank")),
                _num(r.get("responses")),
                _num(r.get("mentions")),
            ]
            for r in eng_data
        ]
        story.append(make_table(
            ["Engine", "Visibility", "Avg Rank", "Responses", "Brand Mentions"],
            eng_rows,
        ))
    else:
        story.append(advisory_panel(
            "ENGINE COVERAGE STATUS",
            [
                "Per-engine visibility rows are not available in this export payload yet.",
                f"The project still reports {_num(cov.get('n_engines'))} configured engine(s) and {_num(cov.get('n_responses'))} sampled answer(s).",
                "Run or refresh prompt analysis to populate model-by-model visibility, average rank, sentiment, and source behavior.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))

    llm_summary = _as_list(deep.get("llm_summary"))
    if llm_summary:
        story.append(P("Deep Engine Sentiment & Sources", S_SUB))
        story.append(P(
            "Per-engine mention rate with positive / neutral / negative / not-mentioned counts "
            "and the domains most often cited in that engine\u2019s answers.",
            S_SECTION_DESC,
        ))
        llm_rows = []
        for r in llm_summary:
            tops = _as_list(r.get("top_sources"))
            top_str = ", ".join(
                f"{t.get('source')} ({t.get('count')})"
                for t in tops[:3]
                if isinstance(t, dict)
            )
            llm_rows.append([
                r.get("llm", ""),
                _pct(r.get("mention_rate")),
                _pick_rank(r.get("avg_rank"), r.get("rank")),
                _num(r.get("response_count")),
                f"+{_num(r.get('positive'))} / ~{_num(r.get('neutral'))} / -{_num(r.get('negative'))}",
                _num(r.get("not_mentioned")),
                _safe(top_str, 70),
            ])
        story.append(make_table(
            ["Engine", "Mention %", "Avg Rank", "N", "Sentiment +/~/-", "Absent", "Top Sources"],
            llm_rows,
            [0.85 * inch, 0.65 * inch, 0.55 * inch, 0.4 * inch, 1.15 * inch, 0.5 * inch, CONTENT_W - 4.1 * inch],
        ))

    # ═════════════════════════════════════════════════════════════════════
    # 06 — PROMPT PERFORMANCE
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Prompt Performance Analysis",
        "Visibility, quality, rank, and sentiment for every tracked buyer query.",
    )
    pa_data = _prompt_analysis_rows(payload)
    # Merge dashboard prompt_rankings avg_rank when prompt_analysis is thin
    prompt_rank_by_text = {
        str(r.get("prompt_text") or "").strip(): r
        for r in _as_list(dashboard.get("prompt_rankings"))
        if isinstance(r, dict) and r.get("prompt_text")
    }
    if pa_data:
        # Best position first (lower avg_rank wins); unranked last
        def _rank_sort_key(r: dict) -> tuple:
            raw = r.get("avg_rank")
            if raw is None and prompt_rank_by_text.get(str(r.get("prompt_text") or "").strip()):
                raw = prompt_rank_by_text[str(r.get("prompt_text") or "").strip()].get("avg_rank")
            try:
                return (0, float(raw))
            except (TypeError, ValueError):
                return (1, 999.0)

        by_rank = sorted(pa_data, key=_rank_sort_key)
        story.append(P("Prompt Ranking (by average position)", S_SUB))
        story.append(P(
            "Lower average rank is better. Position reflects how high your brand appears when mentioned.",
            S_SECTION_DESC,
        ))
        rank_board = []
        for i, r in enumerate(by_rank[:20], start=1):
            pt = str(r.get("prompt_text") or "").strip()
            dash = prompt_rank_by_text.get(pt) or {}
            rank_board.append([
                f"#{i}",
                _safe(pt, 85),
                _pick_rank(r.get("avg_rank"), dash.get("avg_rank"), r.get("rank")),
                _pct(r.get("visibility_pct", r.get("visibility"))),
                str(r.get("quality_score", "\u2014")),
                str(r.get("sentiment", "") or "\u2014"),
            ])
        story.append(make_table(
            ["Pos", "Prompt", "Avg Rank", "Visibility", "Quality", "Sentiment"],
            rank_board,
            [0.4 * inch, 2.8 * inch, 0.7 * inch, 0.75 * inch, 0.65 * inch, 0.75 * inch],
        ))
        story.append(Spacer(1, 10))

        ranked = sorted(
            pa_data,
            key=lambda r: _float_or(
                r.get("quality_score"),
                _float_or(r.get("visibility_pct", r.get("visibility")), 0.0),
            ),
            reverse=True,
        )
        story.append(P("Prompt Leaderboard (by quality)", S_SUB))
        lead_rows = [
            [
                f"#{i}",
                _safe(r.get("prompt_text", ""), 90),
                _pct(r.get("visibility_pct", r.get("visibility"))),
                str(r.get("quality_score", "\u2014")),
                _pick_rank(r.get("avg_rank"), r.get("rank")),
                str(r.get("sentiment", "")),
            ]
            for i, r in enumerate(ranked[:15], start=1)
        ]
        story.append(make_table(
            ["#", "Prompt", "Visibility", "Quality", "Avg Rank", "Sentiment"],
            lead_rows,
            [0.35 * inch, 3.0 * inch, 0.7 * inch, 0.6 * inch, 0.65 * inch, 0.7 * inch],
        ))
        story.append(Spacer(1, 10))
        story.append(P("Full Prompt Table", S_SUB))
        pa_rows = [
            [
                _safe(r.get("prompt_text", ""), 85),
                _pct(r.get("visibility_pct", r.get("visibility"))),
                str(r.get("quality_score", "\u2014")),
                _pick_rank(
                    r.get("avg_rank"),
                    (prompt_rank_by_text.get(str(r.get("prompt_text") or "").strip()) or {}).get("avg_rank"),
                    r.get("rank"),
                ),
                str(r.get("sentiment", "")),
                _num(r.get("engines_analyzed")),
                str(r.get("prompt_type", "") or "\u2014"),
                "Yes" if r.get("is_active") else "No",
            ]
            for r in pa_data
        ]
        story.append(make_table(
            ["Prompt", "Vis %", "Quality", "Avg Rank", "Sentiment", "Engines", "Type", "Active"],
            pa_rows,
            [2.2 * inch, 0.5 * inch, 0.55 * inch, 0.6 * inch, 0.7 * inch, 0.55 * inch, 0.5 * inch, 0.45 * inch],
        ))
        weak = [
            r for r in pa_data
            if _float_or(r.get("visibility_pct", r.get("visibility")), 0.0) < 25
        ]
        if weak:
            story.append(Spacer(1, 8))
            story.append(make_callout(
                [
                    f"{len(weak)} prompt(s) sit below 25% visibility \u2014 prioritize content and citations for these queries."
                ]
                + [_safe(r.get("prompt_text", ""), 120) for r in weak[:6]],
                bg=AMBER_50, accent=AMBER_600, title="LOW-VISIBILITY PROMPTS",
            ))
    else:
        brief_rows = []
        for detail in _as_list(payload.get("prompt_details")):
            if not isinstance(detail, dict):
                continue
            brief = detail.get("analysis_brief") or {}
            brief_rows.append([
                _safe(detail.get("prompt_text", ""), 110),
                _pct(brief.get("visibility_pct", detail.get("visibility_pct"))),
                _pick_rank(brief.get("avg_rank"), detail.get("avg_rank")),
                _safe(brief.get("next_move") or "Run analysis to generate prompt-level recommendations.", 130),
            ])
        if brief_rows:
            story.append(P("Prompt Readiness Snapshot", S_SUB))
            story.append(P(
                "The full prompt-analysis table is not populated, so this snapshot uses the per-prompt evidence briefs available in the export.",
                S_SECTION_DESC,
            ))
            story.append(make_table(
                ["Prompt", "Visibility", "Avg Rank", "Next Move"],
                brief_rows[:20],
                [2.4 * inch, 0.7 * inch, 0.7 * inch, CONTENT_W - 3.8 * inch],
            ))
        else:
            story.append(advisory_panel(
                "PROMPT ANALYSIS STATUS",
                [
                    "No prompt-level rows are available yet.",
                    "Add or run tracked buyer prompts to unlock visibility, average rank, sentiment, engine coverage, and action priorities for each query.",
                    "A client-ready report should include at least one answered run for every prompt you plan to discuss.",
                ],
                bg=SLATE_50, accent=BRAND_BLUE,
            ))

    # Project-level mention/rank trend rollup across all prompts
    all_trend_points: list[dict] = []
    for detail in _as_list(payload.get("prompt_details")):
        all_trend_points.extend(
            t for t in _as_list(detail.get("trend")) if isinstance(t, dict)
        )
    if all_trend_points:
        story.append(P("Project Mention Trend (daily)", S_SUB))
        story.append(P(
            "Across all tracked prompts: how often your brand was named and at what average rank.",
            S_SECTION_DESC,
        ))
        agg = _aggregate_mention_trend(all_trend_points)
        if agg:
            story.append(make_table(
                ["Date", "Mentions", "Answers", "Mention Rate", "Avg Rank"],
                agg[-30:],
                [1.2 * inch, 0.8 * inch, 0.8 * inch, 1.0 * inch, 0.8 * inch],
            ))
            # Sparkline of mention rate
            try:
                rates = [float(str(row[3]).rstrip("%")) for row in agg if row[3] not in ("\u2014", "")]
                if len(rates) >= 2:
                    story.append(Spacer(1, 6))
                    story.append(Sparkline(rates, height=60, color=BRAND_BLUE))
            except (TypeError, ValueError):
                pass

    # ═════════════════════════════════════════════════════════════════════
    # 07 — CONTENT GAPS
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Content Gaps & Opportunity Surface",
        "Prompts where you never appear, domains worth winning, and retrieval points AI models lean on.",
    )
    missing = _as_list(deep.get("missing_prompts"))
    if missing:
        story.append(P("Zero-Mention Prompts (Content Gaps)", S_SUB))
        story.append(P(
            "These buyer queries returned measured answers with no brand mention across any engine. "
            "They are the highest-leverage content opportunities.",
            S_SECTION_DESC,
        ))
        for m in missing[:20]:
            story.append(PB(str(m)))
        story.append(Spacer(1, 8))
    else:
        story.append(make_callout(
            ["No zero-mention prompts in the current sample \u2014 brand appears in at least one engine for every tracked query."],
            bg="#EFF6FF", accent=BRAND_BLUE, title="GAP STATUS",
        ))
        story.append(Spacer(1, 8))

    upload_targets = _as_list(deep.get("upload_targets"))
    if upload_targets:
        story.append(P("High-Value Domains to Win", S_SUB))
        story.append(P(
            "Domains most frequently cited across answers. Prioritize earning coverage, pages, or placements here.",
            S_SECTION_DESC,
        ))
        ut_rows = [
            [str(u.get("source", "")), _num(u.get("count"))]
            for u in upload_targets[:15]
            if isinstance(u, dict)
        ]
        if ut_rows:
            story.append(make_table(["Domain / Source", "Citation Count"], ut_rows, [4.5 * inch, 1.2 * inch]))
        story.append(Spacer(1, 10))

    search_intel = deep.get("search_intel") or {}
    retrieval = _as_list(search_intel.get("retrieval_points")) if isinstance(search_intel, dict) else []
    domains_si = _as_list(search_intel.get("domains")) if isinstance(search_intel, dict) else []
    if isinstance(search_intel, dict) and (
        search_intel.get("enabled") or retrieval or domains_si
    ):
        story.append(P("Search & Retrieval Intelligence", S_SUB))
        if search_intel.get("enabled"):
            story.append(P("Live search supplementation is enabled for this project.", S_SMALL))
        if retrieval:
            story.append(P("Retrieval Points", S_SUB))
            for pt in retrieval[:15]:
                if isinstance(pt, dict):
                    story.append(PB(
                        f"{pt.get('title') or pt.get('query') or pt.get('point') or pt}: "
                        f"{_safe(pt.get('detail') or pt.get('summary') or pt.get('why') or '', 140)}"
                    ))
                else:
                    story.append(PB(str(pt)))
        if domains_si:
            story.append(P("Research Domains", S_SUB))
            for d in domains_si[:12]:
                if isinstance(d, dict):
                    story.append(PB(f"{d.get('domain', d.get('source', ''))}: {_safe(d.get('note') or d.get('why') or '', 120)}"))
                else:
                    story.append(PB(str(d)))
        if search_intel.get("enabled") and not retrieval and not domains_si:
            story.append(advisory_panel(
                "RETRIEVAL ENRICHMENT STATUS",
                [
                    "Search enrichment is enabled, but this export does not include retrieval-point rows for the selected window.",
                    "Use the cited-domain and raw-response sections as the evidence base for now.",
                    "Refresh analysis with research enrichment enabled to populate retrieval points and external domain rationale.",
                ],
                bg=SLATE_50, accent=BRAND_BLUE,
            ))

    # ═════════════════════════════════════════════════════════════════════
    # 08 — COMPETITIVE INTELLIGENCE
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Competitive Intelligence",
        "Share of voice, quality scores, and how models frame each brand in their own words.",
    )
    comp_data = _as_list(payload.get("competitors"))
    if comp_data:
        bar_comp = []
        for r in comp_data[:10]:
            try:
                bar_comp.append((
                    str(r.get("brand", "")),
                    float(r.get("share_of_voice") or r.get("visibility_pct") or r.get("visibility_score") or 0),
                ))
            except (TypeError, ValueError):
                continue
        if bar_comp:
            story.append(P("Share of Voice", S_SUB))
            story.append(HBarChart(bar_comp, max_val=max(100.0, max(v for _, v in bar_comp) or 100)))
            story.append(Spacer(1, 8))

        # Position leaderboard — sorted by avg rank (lower better), then mentions
        def _comp_rank_key(r: dict) -> tuple:
            try:
                return (0, float(r.get("avg_rank")))
            except (TypeError, ValueError):
                return (1, 999.0)

        sorted_comps = sorted(comp_data, key=_comp_rank_key)
        story.append(P("Brand Ranking Leaderboard", S_SUB))
        story.append(P(
            "Position is ordered by average rank when mentioned (lower is better). Ties fall back to mention volume.",
            S_SECTION_DESC,
        ))
        board_rows = []
        for i, r in enumerate(sorted_comps[:15], start=1):
            board_rows.append([
                f"#{i}",
                r.get("brand", ""),
                _pick_rank(r.get("avg_rank"), r.get("rank")),
                _num(r.get("mentions")),
                _pct(r.get("visibility_pct", r.get("visibility_score"))),
                _pct(r.get("share_of_voice")),
                "Yes" if r.get("is_focus") else "",
            ])
        story.append(make_table(
            ["Pos", "Brand", "Avg Rank", "Mentions", "Visibility", "SOV", "Focus"],
            board_rows,
            highlight_focus=True,
        ))
        story.append(Spacer(1, 10))

        comp_rows = [
            [
                r.get("brand", ""),
                _pct(r.get("visibility_pct", r.get("visibility_score"))),
                _pct(r.get("share_of_voice")),
                str(r.get("quality_score", "\u2014")),
                _num(r.get("mentions")),
                _pick_rank(r.get("avg_rank"), r.get("rank")),
                "Yes" if r.get("is_target_competitor") else "",
                "Yes" if r.get("is_focus") else "",
            ]
            for r in comp_data
        ]
        story.append(P("Full Competitive Table", S_SUB))
        story.append(make_table(
            ["Brand", "Visibility", "SOV", "Quality", "Mentions", "Avg Rank", "Target", "Focus"],
            comp_rows,
            highlight_focus=True,
        ))
        # Quality component breakdown for top competitors
        story.append(Spacer(1, 10))
        story.append(P("Quality Score Components (Top Brands)", S_SUB))
        qc_rows = []
        for r in comp_data[:8]:
            qc = r.get("quality_components") or {}
            if not isinstance(qc, dict):
                qc = {}
            qc_rows.append([
                r.get("brand", ""),
                str(r.get("quality_score", "\u2014")),
                str(qc.get("mention_rate_score", qc.get("mention_score", "\u2014"))),
                str(qc.get("rank_score", "\u2014")),
                str(qc.get("sentiment_score", "\u2014")),
            ])
        if qc_rows:
            story.append(make_table(
                ["Brand", "Quality", "Mention Comp.", "Rank Comp.", "Sentiment Comp."],
                qc_rows,
            ))
            story.append(P(
                "Quality = mention-rate score + rank score + sentiment score (capped at 100). "
                "Use gaps in components to choose tactics (coverage vs ranking vs narrative).",
                S_SMALL,
            ))
        story.append(Spacer(1, 10))
    else:
        story.append(advisory_panel(
            "COMPETITOR SIGNAL STATUS",
            [
                "No competitor share-of-voice rows are available in this export payload yet.",
                f"The current brand visibility score is {_pct(vis)}; competitor ranking needs measured mentions from model answers to populate.",
                "Confirm configured competitors, then run prompt analysis so Answrdeck can compare answer visibility, average rank, and framing by brand.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))

    framings = _as_list(payload.get("competitor_framings"))
    if framings:
        story.append(P("How AI Models Frame Competitors", S_SUB))
        story.append(P(
            "Verbatim sentences and framing adjectives extracted from model answers.",
            S_SECTION_DESC,
        ))
        framing_rows = [
            [
                f.get("competitor_brand", ""),
                f.get("engine", ""),
                _safe(f.get("verbatim_sentence", ""), 160),
                _fmt_labels(f.get("framing_adjectives"), 8),
            ]
            for f in framings[:30]
        ]
        story.append(make_table(
            ["Competitor", "Engine", "Verbatim Quote", "Adjectives"],
            framing_rows,
            [1.1 * inch, 0.7 * inch, CONTENT_W - 2.9 * inch, 1.1 * inch],
        ))

    # ═════════════════════════════════════════════════════════════════════
    # 09 — DISPLACEMENT
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Displacement Intelligence",
        "Moments where a competitor is preferred or ranked above your brand — with reasons and cited URLs.",
    )
    top_disp = _as_list(synthesis.get("top_displacement_competitors"))
    if top_disp:
        story.append(P("Top Displacing Competitors", S_SUB))
        disp_sum = [
            [d.get("brand", ""), _num(d.get("count"))]
            for d in top_disp
            if isinstance(d, dict)
        ]
        story.append(make_table(["Competitor", "Displacement Events"], disp_sum, [3.0 * inch, 1.5 * inch]))
        story.append(Spacer(1, 8))

    reasons = _as_list(synthesis.get("recurring_displacement_reasons"))
    if reasons:
        story.append(P("Recurring Displacement Reasons", S_SUB))
        for r in reasons[:10]:
            story.append(PB(str(r)))
        story.append(Spacer(1, 8))

    eng_mention = _as_list(synthesis.get("engines_mentioning"))
    eng_miss = _as_list(synthesis.get("engines_not_mentioning"))
    if eng_mention or eng_miss:
        story.append(P("Engine Mention Coverage (Synthesis)", S_SUB))
        story.append(P(f"Engines mentioning focus: {', '.join(str(e) for e in eng_mention) or '\u2014'}", S_BODY))
        story.append(P(f"Engines not mentioning focus: {', '.join(str(e) for e in eng_miss) or '\u2014'}", S_BODY))
        story.append(Spacer(1, 8))

    if displacements:
        story.append(P("Displacement Event Log", S_SUB))
        d_rows = [
            [
                _safe(d.get("prompt_text", ""), 55),
                d.get("engine", ""),
                d.get("competitor_brand", ""),
                _rank(d.get("rank_of_competitor")),
                _rank(d.get("rank_of_focus")),
                _safe(d.get("displacement_reason", ""), 70),
                _safe(d.get("cited_url", ""), 50),
            ]
            for d in displacements[:40]
        ]
        story.append(make_table(
            ["Prompt", "Engine", "Competitor", "Comp Rank", "Your Rank", "Reason", "Cited URL"],
            d_rows,
            [1.4 * inch, 0.65 * inch, 0.9 * inch, 0.55 * inch, 0.55 * inch, 1.3 * inch, CONTENT_W - 5.35 * inch],
        ))
        # Context snippets
        with_context = [d for d in displacements if d.get("displacement_context")][:8]
        if with_context:
            story.append(P("Displacement Context Snippets", S_SUB))
            for d in with_context:
                story.append(P(
                    f"{d.get('competitor_brand')} on {d.get('engine')} \u2014 {_safe(d.get('prompt_text'), 60)}",
                    S_SMALL,
                ))
                story.append(P(f"\u201c{_safe(d.get('displacement_context'), 280)}\u201d", S_QUOTE))
    else:
        story.append(advisory_panel(
            "DISPLACEMENT INTERPRETATION",
            [
                "No stored displacement events are included in this export.",
                "That means the current evidence set has not captured a competitor being explicitly preferred over the focus brand, or displacement tracking has not run for this project yet.",
                "Use the competitor leaderboard and per-prompt rank tables above to spot likely displacement risk until event-level records accumulate.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))

    disp_domains = _as_list(ce.get("displacement_citation_domains"))
    if disp_domains:
        story.append(P("Domains Cited in Displacement Events", S_SUB))
        dd_rows = [
            [
                d.get("domain", ""),
                _pick_num(d.get("displacement_links"), d.get("count"), d.get("events")),
                d.get("top_competitor_on_domain")
                or d.get("top_competitor")
                or d.get("competitor")
                or "\u2014",
            ]
            for d in disp_domains[:15]
            if isinstance(d, dict)
        ]
        if dd_rows:
            story.append(make_table(["Domain", "Cite Events", "Top Competitor"], dd_rows))

    # ═════════════════════════════════════════════════════════════════════
    # 10 — SOURCES & CITATION MOAT
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Source, Citation & Moat Analysis",
        "Which domains AI models cite, how your owned site performs, and whether citations form a durable moat.",
    )
    if moat:
        story.append(P("Citation Moat", S_SUB))
        story.append(KPIStrip([
            (str(moat.get("score", "\u2014")), "MOAT SCORE"),
            (str(moat.get("status", "\u2014")).upper(), "STATUS"),
            (_pct(moat.get("focus_cited_pct")), "FOCUS CITED %"),
            (_pct(moat.get("owned_cited_pct")), "OWNED CITE %"),
        ], height=48))
        story.append(Spacer(1, 6))
        if moat.get("summary"):
            story.append(make_callout([moat["summary"]], bg=SLATE_50, accent=BRAND_BLUE, title="MOAT SUMMARY"))
        moat_recs = _as_list(moat.get("recommendations"))
        if moat_recs:
            story.append(P("Moat Recommendations", S_SUB))
            for r in moat_recs[:6]:
                if isinstance(r, dict):
                    title = str(r.get("title") or "").strip()
                    detail = str(r.get("detail") or "").strip()
                    story.append(PB(f"{title}: {detail}" if title and detail else (title or detail or "\u2014")))
                else:
                    story.append(PB(str(r)))
        story.append(Spacer(1, 8))

    rollup = ce.get("rollup_focus_mentions") or ce.get("rollup") or {}
    if rollup and (rollup.get("focus_mentions") or rollup.get("responses_measured")):
        story.append(P("Citation Economics Rollup", S_SUB))
        labels = {
            "responses_measured": "Responses measured",
            "focus_mentions": "Brand mentions (total)",
            "focus_with_any_source_url": "Mentions with any source URL",
            "focus_without_source_url": "Mentions without sources",
            "focus_with_brand_domain_citation": "Mentions citing your domain",
            "focus_with_competitor_named_domain": "Mentions citing competitor domain",
        }
        ce_rows = [[label, _num(rollup[key])] for key, label in labels.items() if key in rollup]
        if ce_rows:
            story.append(make_table(["Metric", "Count"], ce_rows, [3.8 * inch, 1.4 * inch]))
        story.append(Spacer(1, 8))

    by_engine = _as_list(ce.get("by_engine"))
    if by_engine:
        story.append(P("Citation Economics by Engine", S_SUB))
        be_rows = []
        for r in by_engine:
            if not isinstance(r, dict):
                continue
            mentions = r.get("focus_mentions", r.get("mentions"))
            owned = r.get("focus_with_brand_domain_citation", r.get("with_owned"))
            owned_pct = r.get("owned_cited_pct", r.get("owned_pct"))
            if owned_pct is None and mentions not in (None, "", 0) and owned is not None:
                try:
                    owned_pct = round((float(owned) / float(mentions)) * 100, 1)
                except (TypeError, ValueError, ZeroDivisionError):
                    owned_pct = None
            be_rows.append([
                r.get("engine", r.get("llm", "")),
                _pick_num(mentions),
                _pick_num(r.get("focus_with_any_source_url"), r.get("with_source")),
                _pick_num(owned),
                _pick_num(r.get("focus_with_competitor_named_domain"), r.get("with_competitor")),
                _pct(owned_pct if owned_pct is not None else r.get("focus_cited_pct")),
            ])
        if be_rows:
            story.append(make_table(
                ["Engine", "Mentions", "With Source", "Owned Cite", "Comp Cite", "Owned %"],
                be_rows,
            ))
        story.append(Spacer(1, 8))

    domain_kpis = ce.get("domain_kpis") or {}
    if domain_kpis:
        story.append(P("Domain Concentration KPIs", S_SUB))
        story.append(P(
            f"Unique domains: {_num(domain_kpis.get('measured_unique_domains'))}  |  "
            f"Source URL occurrences: {_num(domain_kpis.get('measured_source_url_occurrences'))}  |  "
            f"HHI (top 25): {domain_kpis.get('hhi_top25', '\u2014')}",
            S_BODY,
        ))
        signals = domain_kpis.get("signal_counts") or {}
        if isinstance(signals, dict) and signals:
            story.append(P(
                "Signal mix: " + ", ".join(f"{k}={v}" for k, v in list(signals.items())[:8]),
                S_SMALL,
            ))
        top_dom_kpi = _as_list(domain_kpis.get("top_domains"))
        if top_dom_kpi:
            td_rows = [
                [
                    d.get("domain", ""),
                    _pick_num(
                        d.get("citation_occurrences"),
                        d.get("count"),
                        d.get("occurrences"),
                        d.get("source_mentions"),
                    ),
                    _pct(d.get("share_of_measured_urls")),
                    str(d.get("signal", d.get("class", "")) or "\u2014"),
                ]
                for d in top_dom_kpi[:15]
                if isinstance(d, dict)
            ]
            if td_rows:
                story.append(make_table(
                    ["Domain", "Cite Count", "Share", "Signal"],
                    td_rows,
                    [2.2 * inch, 0.9 * inch, 0.8 * inch, 1.2 * inch],
                ))
        story.append(Spacer(1, 8))

    src = payload.get("sources") or {}
    domains = _as_list(src.get("domains"))
    if domains:
        story.append(P("Top Cited Domains", S_SUB))
        dom_rows = [
            [
                r.get("domain", ""),
                _pick_num(r.get("source_mentions"), r.get("mentions"), r.get("count"), r.get("source_count")),
                _pick_num(r.get("brand_mentions"), r.get("brand_count")),
                _safe(r.get("query", ""), 40),
            ]
            for r in domains[:25]
        ]
        story.append(make_table(
            ["Domain", "Cite Count", "Brand Mentions", "Sample Query"],
            dom_rows,
            [2.0 * inch, 0.85 * inch, 1.0 * inch, CONTENT_W - 3.85 * inch],
        ))
        story.append(Spacer(1, 10))

    classified = _as_list(src.get("sources"))
    if classified:
        story.append(P("Classified Source Analysis", S_SUB))
        story.append(P(
            "Each cited source classified as Owned, Competitor, Editorial, Social, or UGC — "
            "with cite count, why it matters, and a recommended action.",
            S_SECTION_DESC,
        ))
        cls_rows = [
            [
                r.get("source_class", ""),
                r.get("domain", r.get("source", "")),
                _pick_num(r.get("source_count"), r.get("source_mentions"), r.get("mentions"), r.get("count")),
                _safe(r.get("evidence") or r.get("why_it_matters", ""), 100),
                _safe(r.get("action", ""), 80),
                r.get("priority", ""),
            ]
            for r in classified[:25]
        ]
        story.append(make_table(
            ["Class", "Domain", "Cite Count", "Evidence / Why", "Action", "Priority"],
            cls_rows,
            [0.65 * inch, 1.1 * inch, 0.7 * inch, 1.7 * inch, 1.5 * inch, 0.55 * inch],
        ))

    official = ce.get("official_site_alignment") or {}
    if isinstance(official, dict) and official:
        story.append(P("Official Site Alignment", S_SUB))
        off_rows = [[str(k), str(v)] for k, v in list(official.items())[:12]]
        if off_rows:
            story.append(make_table(["Field", "Value"], off_rows, [2.4 * inch, CONTENT_W - 2.4 * inch]))

    if not any([moat, rollup, by_engine, domain_kpis, domains, classified, official]):
        story.append(advisory_panel(
            "CITATION DIAGNOSTICS STATUS",
            [
                "No citation-economics datasets are attached to this export yet.",
                "The primary visibility score remains based on direct model answers; citation data is a supporting diagnostic layer, not a substitute for answer visibility.",
                "Run analysis with source capture enabled to populate owned-domain citation rate, competitor-domain pressure, and top cited domains.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))

    # ═════════════════════════════════════════════════════════════════════
    # 11 — AUDIT
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Visibility Audit \u2014 What\u2019s Lacking",
        "Measured gaps and vulnerabilities with root-cause analysis and fix recommendations.",
    )
    audit_items = _as_list((payload.get("global_audit") or {}).get("items"))
    if not audit_items:
        story.append(advisory_panel(
            "AUDIT BASELINE",
            [
                "No measured global audit findings were generated for this export.",
                f"Baseline checks: {_num(cov.get('n_prompts'))} prompt(s), {_num(cov.get('n_engines'))} engine(s), {_num(cov.get('n_responses'))} answer(s), {_pct(vis)} answer visibility.",
                "Next audit pass should look for missing answer pages, weak comparison proof, unclear category positioning, and citation gaps around the lowest-visibility prompts.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))
    else:
        # Priority breakdown
        high = sum(1 for a in audit_items if str(a.get("priority", "")).lower() == "high")
        med = sum(1 for a in audit_items if str(a.get("priority", "")).lower() == "medium")
        low = sum(1 for a in audit_items if str(a.get("priority", "")).lower() == "low")
        story.append(KPIStrip([
            (_num(len(audit_items)), "FINDINGS"),
            (_num(high), "HIGH"),
            (_num(med), "MEDIUM"),
            (_num(low), "LOW"),
        ], height=44))
        story.append(Spacer(1, 10))

    for item in audit_items:
        priority = item.get("priority", "medium")
        _, p_fg = _priority_color(priority)
        title_text = item.get("title", "Audit finding")
        block = [
            PH(
                f'<font name="Helvetica-Bold">{esc(title_text)}</font>'
                f'&#160;&#160;<font name="Helvetica-Bold" size="7" color="{p_fg}">[{str(priority).upper()}]</font>',
                ParagraphStyle("AuditTitle", parent=S_BODY, fontSize=10, leading=14, textColor=C(SLATE_900)),
            )
        ]
        if item.get("root_cause"):
            block.append(P(f"Root cause: {item['root_cause']}", S_BODY))
        if item.get("solution"):
            block.append(P(f"Solution: {item['solution']}", S_BODY))
        if item.get("avoid"):
            block.append(P(f"Avoid: {item['avoid']}", S_SMALL))
        if item.get("evidence_quote"):
            block.append(P(f"\u201c{item['evidence_quote']}\u201d", S_QUOTE))
        queries = _as_list(item.get("queries_supporting"))
        if queries:
            block.append(P(f"Supporting queries: {', '.join(str(q) for q in queries[:5])}", S_SMALL))
        block.append(AccentLine(SLATE_200, 1.0, 0.5))
        block.append(Spacer(1, 4))
        story.append(KeepTogether(block))

    # ═════════════════════════════════════════════════════════════════════
    # 12 — RECOMMENDATIONS
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Strategic Recommendations & Action Plan",
        "Prioritized moves to improve AI visibility, grounded in measured evidence.",
    )
    recs = dashboard.get("recommendations") or {}
    if recs.get("recommendation_text"):
        story.append(make_callout(
            [recs["recommendation_text"]],
            bg="#EFF6FF", accent=BRAND_BLUE, title="OVERALL RECOMMENDATION",
        ))
        story.append(Spacer(1, 10))

    rec_items = _as_list(recs.get("recommendation_items"))
    if rec_items:
        story.append(P("Detailed Actions", S_SUB))
        ri_rows = [
            [
                r.get("priority", ""),
                r.get("engine", ""),
                _safe(r.get("action", ""), 150),
                _safe(r.get("evidence", ""), 110),
            ]
            for r in rec_items[:20]
            if isinstance(r, dict)
        ]
        if ri_rows:
            story.append(make_table(
                ["Priority", "Engine", "Action", "Evidence"],
                ri_rows,
                [0.6 * inch, 0.75 * inch, 2.7 * inch, CONTENT_W - 4.05 * inch],
            ))
        story.append(Spacer(1, 10))

    action_plan = _as_list(deep.get("action_plan"))
    if action_plan:
        story.append(P("Opportunity Action Plan", S_SUB))
        for item in action_plan[:16]:
            if not isinstance(item, dict):
                continue
            block = [
                PH(
                    f'<font name="Helvetica-Bold">{esc(item.get("title", ""))}</font>'
                    f'&#160;&#160;<font size="7" color="{AMBER_600}">'
                    f'[{esc(str(item.get("priority", "")).upper())}]</font>',
                    ParagraphStyle("ActionTitle", parent=S_BODY, fontSize=10, leading=14),
                )
            ]
            if item.get("trigger_signal"):
                block.append(P(f"Trigger: {item['trigger_signal']}", S_SMALL))
            if item.get("confidence") is not None:
                block.append(P(f"Confidence: {item.get('confidence')}", S_SMALL))
            for step in _as_list(item.get("action_plan"))[:8]:
                block.append(P(f"  \u2192 {step}", S_BODY))
            if item.get("evidence_quote"):
                block.append(P(f"\u201c{_safe(item['evidence_quote'], 220)}\u201d", S_QUOTE))
            block.append(Spacer(1, 6))
            story.append(KeepTogether(block))

    if not recs.get("recommendation_text") and not rec_items and not action_plan:
        fallback_actions = [
            [
                "1",
                "Evidence coverage",
                f"Re-run {_num(cov.get('n_prompts'))} tracked prompt(s) across the configured engine set to establish a complete current baseline.",
                "Required before movement, displacement, and audit deltas can be trusted.",
            ],
            [
                "2",
                "Content gaps",
                "Create or refresh pages that answer the lowest-visibility buyer prompts directly in the first section.",
                f"{low_visibility_count} prompt(s) currently sit below 25% visibility." if low_visibility_count else "No hard gap was detected, but every priority prompt still needs defensible proof.",
            ],
            [
                "3",
                "Citation support",
                "Strengthen owned-domain pages and third-party proof on sources models already cite.",
                f"Owned-site citation rate: {_pct(site_pct)}." if site_pct is not None else "Citation capture is not populated yet.",
            ],
        ]
        if weak_engine_names:
            fallback_actions.append([
                "4",
                "Engine-specific lift",
                "Use engines that already mention the brand as the message pattern, then close weak-engine gaps.",
                "Weak engines: " + ", ".join(weak_engine_names) + ".",
            ])
        story.append(P("Baseline Action Plan", S_SUB))
        story.append(make_table(
            ["Step", "Workstream", "Action", "Evidence"],
            fallback_actions,
            [0.5 * inch, 1.15 * inch, 2.6 * inch, CONTENT_W - 4.25 * inch],
        ))

    # ═════════════════════════════════════════════════════════════════════
    # 13 — PER-PROMPT DEEP DIVES
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Per-Prompt Deep Dives",
        "What happened, why it matters, sentiment mix, ranking, audits, and next moves for each prompt.",
        force_page=bool(_as_list(payload.get("prompt_details"))),
    )
    prompt_details_list = _as_list(payload.get("prompt_details"))
    if not prompt_details_list:
        story.append(advisory_panel(
            "PROMPT DETAIL STATUS",
            [
                "No per-prompt detail payloads are attached to this export.",
                "Run the tracked prompts to populate model answers, per-engine rank, sentiment, cited sources, audit findings, and next moves for each query.",
                "Until then, the executive scorecard and methodology sections are the reliable baseline.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))
    for detail in prompt_details_list:
        prompt_text = detail.get("prompt_text", "")
        brief = detail.get("analysis_brief") or {}
        sentiment = detail.get("sentiment") or {}

        header_bits = [
            PH(
                f'<font name="Helvetica-Bold" color="{BRAND_BLUE}">\u25B6</font>&#160;&#160;'
                f'<font name="Helvetica-Bold">{esc(_safe(prompt_text, 200))}</font>',
                ParagraphStyle("PromptTitle", parent=S_BODY, fontSize=10, leading=14, spaceBefore=10),
            ),
            AccentLine(BRAND_BLUE, 0.18, 1.5),
            Spacer(1, 4),
        ]

        vis_pct = brief.get("visibility_pct", detail.get("visibility_pct"))
        avg_rank = brief.get("avg_rank", detail.get("avg_rank"))
        mini_kpis = []
        if vis_pct is not None:
            mini_kpis.append((_pct(vis_pct), "VISIBILITY"))
        mini_kpis.append((_pick_rank(avg_rank, brief.get("rank"), detail.get("rank")), "AVG RANK"))
        engines_mentioned = _as_list(brief.get("engines_mentioned"))
        engines_missing = _as_list(brief.get("engines_missing"))
        if engines_mentioned:
            mini_kpis.append((_num(len(engines_mentioned)), "ENGINES HIT"))
        if engines_missing:
            mini_kpis.append((_num(len(engines_missing)), "ENGINES MISS"))
        if mini_kpis:
            header_bits.append(KPIStrip(mini_kpis, height=36))
            header_bits.append(Spacer(1, 6))

        body_bits = []
        if isinstance(sentiment, dict) and any(sentiment.values()):
            body_bits.append(P(
                "Sentiment mix: "
                + "  |  ".join(
                    f"{k}: {v}" for k, v in sentiment.items() if v
                ),
                S_SMALL,
            ))
        if engines_mentioned:
            body_bits.append(P(f"Mentioned on: {', '.join(str(e) for e in engines_mentioned)}", S_SMALL))
        if engines_missing:
            body_bits.append(P(f"Missing on: {', '.join(str(e) for e in engines_missing)}", S_SMALL))

        if brief.get("what_happened"):
            body_bits.append(P(f"What happened: {brief['what_happened']}", S_BODY))
        if brief.get("why_it_matters"):
            body_bits.append(P(f"Why it matters: {brief['why_it_matters']}", S_BODY))
        if brief.get("next_move"):
            body_bits.append(P(f"Next move: {brief['next_move']}", S_BODY))

        for pt in _as_list(brief.get("evidence_points"))[:6]:
            body_bits.append(PB(str(pt)))

        ranking = _as_list(detail.get("brand_ranking")) or _as_list(detail.get("competitors"))
        if ranking:
            body_bits.append(P("Brand Ranking for this Prompt", S_SUB))
            # Sort by avg_rank then mentions for a clear position column
            def _br_key(r: dict) -> tuple:
                try:
                    return (0, float(r.get("avg_rank")))
                except (TypeError, ValueError):
                    return (1, -float(r.get("mentions") or 0))

            sorted_ranking = sorted(ranking, key=_br_key)
            rk_rows = []
            for i, r in enumerate(sorted_ranking[:12], start=1):
                rk_rows.append([
                    f"#{i}",
                    r.get("name", r.get("brand", "")),
                    _num(r.get("mentions")),
                    _pick_rank(r.get("avg_rank"), r.get("rank")),
                    "Yes" if r.get("is_focus") else "",
                ])
            body_bits.append(Spacer(1, 4))
            body_bits.append(make_table(
                ["Pos", "Brand", "Mentions", "Avg Rank", "Focus"],
                rk_rows,
                [0.4 * inch, 2.0 * inch, 0.75 * inch, 0.75 * inch, 0.5 * inch],
                highlight_focus=True,
            ))

        # Per-engine ranks from deep-analysis matrix for this prompt
        matrix_match = next(
            (
                row for row in _as_list(deep.get("prompt_matrix"))
                if isinstance(row, dict)
                and str(row.get("prompt_text") or "").strip() == str(prompt_text or "").strip()
            ),
            None,
        )
        if matrix_match and isinstance(matrix_match.get("engines"), dict):
            body_bits.append(P("Rank by Engine", S_SUB))
            eng_rank_rows = []
            for engine, cell in sorted(matrix_match["engines"].items()):
                if not isinstance(cell, dict):
                    continue
                comps = _as_list(cell.get("top_competitors"))
                top_comp = ""
                if comps and isinstance(comps[0], dict):
                    top_comp = f"{comps[0].get('brand', '')} {_pick_rank(comps[0].get('rank'))}".strip()
                eng_rank_rows.append([
                    engine,
                    "Yes" if cell.get("mentioned") else "No",
                    _pick_rank(cell.get("rank"), cell.get("avg_rank")),
                    str(cell.get("sentiment") or "\u2014"),
                    _safe(top_comp, 40),
                ])
            if eng_rank_rows:
                body_bits.append(make_table(
                    ["Engine", "Mention", "Your Rank", "Sent.", "Top Competitor"],
                    eng_rank_rows,
                    [0.9 * inch, 0.7 * inch, 0.75 * inch, 0.8 * inch, CONTENT_W - 3.15 * inch],
                ))

        trend = _as_list(detail.get("trend"))
        if trend:
            body_bits.append(P("Mention & Rank Trend", S_SUB))
            body_bits.append(P(
                "Each measured answer: whether your brand was named and at what rank.",
                S_SECTION_DESC,
            ))
            daily = _aggregate_mention_trend(trend)
            if daily:
                body_bits.append(make_table(
                    ["Date", "Mentions", "Answers", "Mention Rate", "Avg Rank"],
                    daily[-14:],
                    [1.1 * inch, 0.75 * inch, 0.75 * inch, 1.0 * inch, 0.8 * inch],
                ))
                body_bits.append(Spacer(1, 4))
            t_rows = _trend_rows(trend)[-20:]
            if t_rows:
                # Detect whether rows are the 4-col detail format
                if t_rows and len(t_rows[0]) == 4:
                    body_bits.append(make_table(
                        ["Timestamp", "Engine", "Mentioned", "Rank"],
                        t_rows,
                        [1.6 * inch, 1.0 * inch, 0.8 * inch, 0.7 * inch],
                    ))
                else:
                    body_bits.append(make_table(
                        ["Date", "Engine", "Metric", "Rank"],
                        t_rows,
                        [1.6 * inch, 1.0 * inch, 0.9 * inch, 0.7 * inch],
                    ))

        audits = _as_list(detail.get("audit"))
        if audits:
            body_bits.append(P("Audit Findings", S_SUB))
            for a in audits[:6]:
                body_bits.append(P(
                    f"\u2022 {_safe(a.get('title', a.get('issue', '')), 140)} \u2014 "
                    f"{_safe(a.get('root_cause', ''), 110)}",
                    S_SMALL,
                ))
                if a.get("solution") or a.get("fix_steps"):
                    body_bits.append(P(
                        f"  Fix: {_safe(a.get('solution', a.get('fix_steps')), 160)}",
                        S_SMALL,
                    ))

        actions = _as_list(detail.get("recommended_actions"))
        if actions:
            body_bits.append(P("Recommended Actions", S_SUB))
            for a in actions[:5]:
                body_bits.append(P(
                    f"\u2192 {a.get('title', '')}: {_safe(a.get('detail', ''), 140)}",
                    S_BODY,
                ))

        sources_d = _as_list(detail.get("sources"))
        if sources_d:
            body_bits.append(P("Top Cited Sources", S_SUB))
            src_rows = [
                [
                    s.get("domain", ""),
                    _pick_num(s.get("mentions"), s.get("source_mentions"), s.get("source_count"), s.get("count")),
                ]
                for s in sources_d[:10]
            ]
            body_bits.append(make_table(["Domain", "Cite Count"], src_rows, [3.2 * inch, 1.0 * inch]))

        body_bits.append(Spacer(1, 14))
        story.extend(header_bits)
        story.extend(body_bits)


    # ═════════════════════════════════════════════════════════════════════
    # 14 — MATRIX
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Prompt \u00d7 Engine Matrix",
        "Complete cross-reference: mention, rank, sentiment, and top competitors per cell.",
    )
    pm_data = _as_list(deep.get("prompt_matrix"))
    if pm_data:
        matrix_rows = []
        for prompt_row in pm_data:
            pt = _safe(prompt_row.get("prompt_text", ""), 60)
            engines = prompt_row.get("engines") or {}
            if isinstance(engines, dict):
                for engine, cell in engines.items():
                    if not isinstance(cell, dict):
                        continue
                    mentioned = "Yes" if cell.get("mentioned") else "No"
                    comps = _as_list(cell.get("top_competitors"))
                    comp_str = ", ".join(
                        f"{c.get('brand')}{(' #' + str(c.get('rank'))) if c.get('rank') else ''}"
                        for c in comps[:3]
                        if isinstance(c, dict)
                    )
                    srcs = ", ".join(str(s) for s in _as_list(cell.get("sources"))[:3])
                    matrix_rows.append([
                        pt,
                        engine,
                        mentioned,
                        _pick_rank(cell.get("rank"), cell.get("avg_rank")),
                        str(cell.get("sentiment", "")),
                        _safe(comp_str, 55),
                        _safe(srcs, 45),
                    ])
        if matrix_rows:
            story.append(make_table(
                ["Prompt", "Engine", "Mention", "Your Rank", "Sent.", "Top Competitors", "Sources"],
                matrix_rows,
                [1.5 * inch, 0.7 * inch, 0.6 * inch, 0.65 * inch, 0.65 * inch, 1.2 * inch, CONTENT_W - 5.3 * inch],
            ))
    else:
        fallback_matrix_rows = []
        for detail in _as_list(payload.get("prompt_details")):
            if not isinstance(detail, dict):
                continue
            prompt_text = _safe(detail.get("prompt_text", ""), 70)
            latest_by_engine = {}
            for point in _as_list(detail.get("trend")):
                if isinstance(point, dict) and point.get("engine"):
                    latest_by_engine[point.get("engine")] = point
            for engine, point in sorted(latest_by_engine.items(), key=lambda item: str(item[0]).lower()):
                fallback_matrix_rows.append([
                    prompt_text,
                    str(engine),
                    "Yes" if point.get("mentioned") else "No",
                    _pick_rank(point.get("rank")),
                    "\u2014",
                    "\u2014",
                    "\u2014",
                ])
        if fallback_matrix_rows:
            story.append(P("Prompt x Engine Snapshot", S_SUB))
            story.append(P(
                "The full deep-analysis matrix is not attached, so this table uses the latest per-engine trend point for each prompt.",
                S_SECTION_DESC,
            ))
            story.append(make_table(
                ["Prompt", "Engine", "Mention", "Your Rank", "Sent.", "Top Competitors", "Sources"],
                fallback_matrix_rows[:80],
                [1.5 * inch, 0.7 * inch, 0.6 * inch, 0.65 * inch, 0.65 * inch, 1.2 * inch, CONTENT_W - 5.3 * inch],
            ))
        else:
            story.append(advisory_panel(
                "MATRIX STATUS",
                [
                    "No prompt-by-engine matrix is available in this export.",
                    "Run analysis across the configured engines to populate mention status, your rank, sentiment, top competitors, and cited sources for every prompt-engine pair.",
                    "This matrix is the strongest proof table for client-facing diagnosis, so it should be populated before sending a final prospect report.",
                ],
                bg=SLATE_50, accent=BRAND_BLUE,
            ))

    # ═════════════════════════════════════════════════════════════════════
    # 15 — APPENDIX
    # ═════════════════════════════════════════════════════════════════════
    start_section(
        "Appendix: Raw AI Model Responses",
        "Unedited model answers and cited sources — the evidence base for every finding above.",
        force_page=any(
            _as_list(d.get("raw_responses"))
            for d in _as_list(payload.get("prompt_details"))
            if isinstance(d, dict)
        ),
    )
    story.append(make_callout(
        [
            "Responses may be lightly truncated for print length. Full text remains available in the product and CSV export.",
        ],
        bg=SLATE_50, accent=SLATE_400, title="NOTE",
    ))
    story.append(Spacer(1, 8))

    has_raw_responses = any(
        _as_list(d.get("raw_responses"))
        for d in _as_list(payload.get("prompt_details"))
        if isinstance(d, dict)
    )
    if not has_raw_responses:
        story.append(advisory_panel(
            "EVIDENCE APPENDIX STATUS",
            [
                "No raw model responses are attached to this export.",
                "Run prompt analysis and export again to include the unedited answer evidence behind every visibility, rank, source, and audit claim.",
                "For prospect-facing reports, include raw responses whenever possible so the client can verify the diagnosis.",
            ],
            bg=SLATE_50, accent=BRAND_BLUE,
        ))

    for detail in _as_list(payload.get("prompt_details")):
        prompt_text = detail.get("prompt_text", "")
        responses = _as_list(detail.get("raw_responses"))
        if not responses:
            continue

        story.append(PH(
            f'<font name="Helvetica-Bold">{esc(_safe(prompt_text, 170))}</font>',
            ParagraphStyle(
                "AppendixPrompt", parent=S_BODY, fontSize=10, leading=14,
                spaceBefore=12, textColor=C(BRAND_BLUE_DARK),
            ),
        ))
        story.append(AccentLine(SLATE_200, 0.5, 0.5))

        for resp in responses:
            engine = resp.get("engine", "Unknown")
            ts = resp.get("timestamp", "")
            text = resp.get("display_response_text") or resp.get("response_text") or ""
            text = _safe(text, 3200)
            resp_sources = resp.get("sources") or []

            story.append(PH(
                f'<font name="Helvetica-Bold">{esc(engine)}</font>'
                f'&#160;&#160;<font size="7" color="{SLATE_400}">{esc(str(ts)[:19])}</font>',
                ParagraphStyle("EngineLabel", parent=S_BODY, fontSize=9, spaceBefore=8),
            ))
            story.append(P(text, ParagraphStyle(
                "ResponseText", parent=S_BODY,
                fontSize=7.5, leading=11, textColor=C(SLATE_700),
                leftIndent=6, rightIndent=4, spaceBefore=2, spaceAfter=2,
            )))
            if resp_sources:
                src_text = "Sources: " + " | ".join(str(s) for s in resp_sources[:10])
                story.append(P(src_text, ParagraphStyle(
                    "SourceList", parent=S_SMALL, leftIndent=6, textColor=C(BRAND_BLUE),
                )))
            story.append(Spacer(1, 5))
        story.append(Spacer(1, 8))

    story.append(Spacer(1, 20))
    story.append(AccentLine(BRAND_BLUE, 0.2, 2))
    story.append(Spacer(1, 8))
    story.append(P(
        f"End of report \u2014 {project_name}. Generated by Answrdeck on {gen_date} UTC. "
        "Re-run analysis and re-export after content changes to track movement.",
        S_SMALL,
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
