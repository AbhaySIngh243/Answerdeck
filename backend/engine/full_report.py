"""Full project export: payload assembly, PDF, and CSV rendering.

The PDF renderer produces an executive-grade, visually rich report designed
to look like output from a premium $150/mo AI visibility platform.
"""

from __future__ import annotations

import csv
import io
import math
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


def _as_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _pct(value: Any) -> str:
    if value is None:
        return "\u2014"
    try:
        return f"{float(value):.1f}%"
    except (ValueError, TypeError):
        return str(value)


def _rank(value: Any) -> str:
    if value is None:
        return "\u2014"
    try:
        return f"#{float(value):.1f}"
    except (ValueError, TypeError):
        return str(value)


def _num(value: Any) -> str:
    if value is None:
        return "\u2014"
    try:
        n = int(value)
        return f"{n:,}"
    except (ValueError, TypeError):
        return str(value)


def _health_color(label: str) -> tuple[str, str]:
    """Return (bg, fg) hex for health label."""
    lbl = (label or "").strip().lower()
    if lbl == "strong":
        return GREEN_50, GREEN_600
    if lbl == "critical":
        return RED_50, RED_600
    return AMBER_50, AMBER_600


def _priority_color(label: str) -> tuple[str, str]:
    lbl = (label or "").strip().lower()
    if lbl == "high":
        return RED_100, RED_600
    if lbl == "low":
        return GREEN_100, GREEN_600
    return AMBER_100, AMBER_600


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
    from models import Project, Prompt
    from routes.reports import (
        _build_citation_economics_payload,
        _build_competitor_visibility,
        _build_prompt_detail_payload,
        _cache_get,
        _compute_overall_health,
        _get_or_build_dashboard_payload,
        _get_or_build_deep_analysis_payload,
        _get_or_build_global_audit_payload,
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
                "executive_summary": "No prompt runs yet.",
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
    writer.writerow(["Recurring Adjectives", ", ".join(_as_list(insight.get("recurring_adjectives")))])
    writer.writerow(["Consistent Competitors", ", ".join(_as_list(insight.get("consistent_competitors")))])

    section("Visibility Trend")
    writer.writerow(["Date", "Score"])
    for row in _as_list(dashboard.get("visibility_trend")):
        writer.writerow([row.get("date", row.get("x", "")), row.get("score", row.get("y", ""))])

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
    for row in _as_list((payload.get("prompt_analysis") or {}).get("rows")):
        writer.writerow([row.get("prompt_text", ""), row.get("visibility_pct", row.get("visibility", "")), row.get("quality_score", ""), row.get("avg_rank", ""), row.get("sentiment", ""), row.get("engines_analyzed", ""), row.get("prompt_type", ""), row.get("is_active", "")])

    section("Competitor Intelligence")
    writer.writerow(["Brand", "Visibility %", "Share of Voice", "Quality Score", "Mentions", "Avg Rank", "Focus", "Target"])
    for row in _as_list(payload.get("competitors")):
        writer.writerow([row.get("brand", ""), row.get("visibility_pct", row.get("visibility_score", "")), row.get("share_of_voice", ""), row.get("quality_score", ""), row.get("mentions", ""), row.get("avg_rank", ""), "Yes" if row.get("is_focus") else "No", "Yes" if row.get("is_target_competitor") else "No"])

    section("Competitor Framing Quotes")
    writer.writerow(["Competitor", "Engine", "Quote", "Adjectives"])
    for row in _as_list(payload.get("competitor_framings")):
        writer.writerow([row.get("competitor_brand", ""), row.get("engine", ""), row.get("verbatim_sentence", ""), ", ".join(_as_list(row.get("framing_adjectives")))])

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
    """Render a visually stunning multi-section PDF using ReportLab Platypus."""
    try:
        from reportlab.lib import colors as rl_colors
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch, mm
        from reportlab.platypus import (
            BaseDocTemplate,
            Flowable,
            Frame,
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
    MARGIN = 0.6 * inch
    CONTENT_W = W - 2 * MARGIN

    project = payload.get("project") or {}
    dashboard = payload.get("dashboard") or {}
    intel = payload.get("intel") or {}
    project_name = _safe(project.get("name") or "Project", 80)
    gen_date = (payload.get("generated_at") or "")[:19].replace("T", " ")

    # ── Color helper ─────────────────────────────────────────────────────
    C = rl_colors.HexColor

    # ── Styles ───────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()

    S_COVER_TITLE = ParagraphStyle(
        "CoverTitle", parent=styles["Title"],
        fontSize=32, leading=38, textColor=C(WHITE),
        alignment=TA_CENTER, spaceAfter=0,
        fontName="Helvetica-Bold",
    )
    S_COVER_SUB = ParagraphStyle(
        "CoverSub", parent=styles["Normal"],
        fontSize=13, leading=18, textColor=C("#CBD5E1"),
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
        fontSize=9, leading=13, textColor=C(SLATE_500),
        spaceAfter=10,
    )
    S_SUB = ParagraphStyle(
        "SubHead", parent=styles["Heading2"],
        fontSize=12, leading=16, textColor=C(BRAND_BLUE),
        spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold",
    )
    S_BODY = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=9, leading=13.5, textColor=C(SLATE_900),
        spaceAfter=4,
    )
    S_BODY_ITALIC = ParagraphStyle(
        "BodyItalic", parent=S_BODY,
        fontName="Helvetica-Oblique", textColor=C(SLATE_700),
    )
    S_SMALL = ParagraphStyle(
        "Small", parent=styles["Normal"],
        fontSize=8, leading=11, textColor=C(SLATE_500),
        spaceAfter=2,
    )
    S_BULLET = ParagraphStyle(
        "Bullet", parent=S_BODY,
        leftIndent=14, bulletIndent=0,
        spaceBefore=1, spaceAfter=1,
    )
    S_KPI_VALUE = ParagraphStyle(
        "KPIValue", parent=styles["Normal"],
        fontSize=22, leading=26, textColor=C(BRAND_BLUE_DARK),
        alignment=TA_CENTER, fontName="Helvetica-Bold",
    )
    S_KPI_LABEL = ParagraphStyle(
        "KPILabel", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=C(SLATE_500),
        alignment=TA_CENTER,
    )
    S_TOC = ParagraphStyle(
        "TOC", parent=styles["Normal"],
        fontSize=11, leading=20, textColor=C(SLATE_700),
        leftIndent=8,
    )
    S_FOOTER = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=7.5, textColor=C(SLATE_400),
    )
    S_TABLE_HEAD = ParagraphStyle(
        "THead", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=C(WHITE),
        fontName="Helvetica-Bold",
    )
    S_TABLE_CELL = ParagraphStyle(
        "TCell", parent=styles["Normal"],
        fontSize=8, leading=11, textColor=C(SLATE_900),
    )
    S_TABLE_CELL_SMALL = ParagraphStyle(
        "TCellSmall", parent=styles["Normal"],
        fontSize=7.5, leading=10, textColor=C(SLATE_700),
    )

    # ── XML-escape ───────────────────────────────────────────────────────
    def esc(text: str) -> str:
        return (
            str(text or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    def P(text: str, style=S_BODY) -> Paragraph:
        return Paragraph(esc(text).replace("\n", "<br/>"), style)

    def PB(text: str) -> Paragraph:
        return Paragraph(f"\u2022 {esc(text)}", S_BULLET)

    # ── Custom Flowables ─────────────────────────────────────────────────

    class AccentLine(Flowable):
        """Thin colored horizontal rule."""

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
            w = self.width * self._width_pct
            self.canv.line(0, 2, w, 2)

    class KPIStrip(Flowable):
        """Row of KPI cards with value + label, drawn as rounded boxes."""

        def __init__(self, items: list[tuple[str, str]], height=58):
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
            gap = 8
            card_w = (self.width - gap * (n - 1)) / n
            x = 0
            for value, label in self._items:
                self.canv.setFillColor(C(SLATE_50))
                self.canv.setStrokeColor(C(SLATE_200))
                self.canv.setLineWidth(0.5)
                self.canv.roundRect(x, 0, card_w, self._h, 6, fill=1, stroke=1)
                self.canv.setFont("Helvetica-Bold", 18)
                self.canv.setFillColor(C(BRAND_BLUE_DARK))
                self.canv.drawCentredString(
                    x + card_w / 2, self._h / 2 + 4, str(value)
                )
                self.canv.setFont("Helvetica", 7.5)
                self.canv.setFillColor(C(SLATE_500))
                self.canv.drawCentredString(
                    x + card_w / 2, self._h / 2 - 14, str(label)
                )
                x += card_w + gap

    class CalloutBox(Flowable):
        """Colored callout box wrapping a list of text lines."""

        def __init__(self, lines: list[str], bg=SLATE_50, accent=BRAND_BLUE, title=""):
            super().__init__()
            self._lines = lines
            self._bg = bg
            self._accent = accent
            self._title = title

        def wrap(self, aW, aH):
            self.width = aW
            line_h = 13
            self.height = (
                max(len(self._lines) * line_h + 16, 30)
                + (16 if self._title else 0)
            )
            return self.width, self.height

        def draw(self):
            self.canv.setFillColor(C(self._bg))
            self.canv.roundRect(0, 0, self.width, self.height, 5, fill=1, stroke=0)
            self.canv.setStrokeColor(C(self._accent))
            self.canv.setLineWidth(3)
            self.canv.line(0, 0, 0, self.height)
            y = self.height - 14
            if self._title:
                self.canv.setFont("Helvetica-Bold", 9)
                self.canv.setFillColor(C(self._accent))
                self.canv.drawString(12, y, self._title)
                y -= 16
            self.canv.setFont("Helvetica", 8)
            self.canv.setFillColor(C(SLATE_900))
            for line in self._lines:
                text = str(line or "")[:200]
                self.canv.drawString(12, y, text)
                y -= 13

    class SectionNumber(Flowable):
        """Section number badge + title on one line with accent underline."""

        def __init__(self, number: int, title: str):
            super().__init__()
            self._num = number
            self._title = title

        def wrap(self, aW, aH):
            self.width = aW
            self.height = 36
            return self.width, self.height

        def draw(self):
            badge_size = 22
            self.canv.setFillColor(C(BRAND_BLUE))
            self.canv.roundRect(0, self.height - badge_size - 2, badge_size, badge_size, 4, fill=1, stroke=0)
            self.canv.setFont("Helvetica-Bold", 11)
            self.canv.setFillColor(C(WHITE))
            self.canv.drawCentredString(badge_size / 2, self.height - badge_size + 4, str(self._num))
            self.canv.setFont("Helvetica-Bold", 16)
            self.canv.setFillColor(C(BRAND_BLUE_DARK))
            self.canv.drawString(badge_size + 10, self.height - badge_size + 2, self._title[:80])
            self.canv.setStrokeColor(C(SLATE_200))
            self.canv.setLineWidth(0.5)
            self.canv.line(0, 0, self.width, 0)

    class HealthBadge(Flowable):
        """Pill-shaped health status badge."""

        def __init__(self, label: str, size="large"):
            super().__init__()
            self._label = label or "\u2014"
            self._size = size

        def wrap(self, aW, aH):
            self.width = aW
            self.height = 28 if self._size == "large" else 18
            return self.width, self.height

        def draw(self):
            bg, fg = _health_color(self._label)
            pill_w = min(160, self.width)
            x = (self.width - pill_w) / 2
            self.canv.setFillColor(C(bg))
            self.canv.roundRect(x, 2, pill_w, self.height - 4, (self.height - 4) / 2, fill=1, stroke=0)
            fs = 11 if self._size == "large" else 8
            self.canv.setFont("Helvetica-Bold", fs)
            self.canv.setFillColor(C(fg))
            self.canv.drawCentredString(self.width / 2, (self.height - fs) / 2 + 1, self._label.upper())

    # ── Table builder ────────────────────────────────────────────────────

    def make_table(
        headers: list[str],
        rows: list[list[str]],
        col_widths: list[float] | None = None,
        highlight_focus: bool = False,
    ) -> Table:
        header_cells = [Paragraph(esc(h), S_TABLE_HEAD) for h in headers]
        data = [header_cells]
        for i, row in enumerate(rows):
            style_to_use = S_TABLE_CELL if len(str(row[0] if row else "")) < 60 else S_TABLE_CELL_SMALL
            data.append([Paragraph(esc(str(c)), style_to_use) for c in row])

        tbl = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        cmds: list = [
            ("BACKGROUND", (0, 0), (-1, 0), C(BRAND_BLUE_DARK)),
            ("TEXTCOLOR", (0, 0), (-1, 0), C(WHITE)),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C(WHITE), C(SLATE_50)]),
            ("GRID", (0, 0), (-1, 0), 0, C(BRAND_BLUE_DARK)),
            ("LINEBELOW", (0, 0), (-1, 0), 1.5, C(BRAND_BLUE)),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, C(SLATE_200)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, 0), 7),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
            ("TOPPADDING", (0, 1), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ]
        if highlight_focus:
            for i, row in enumerate(rows, start=1):
                if len(row) >= 6 and str(row[-1]).strip().lower() == "yes":
                    cmds.append(("BACKGROUND", (0, i), (-1, i), C("#EFF6FF")))
                    cmds.append(("FONTNAME", (0, i), (0, i), "Helvetica-Bold"))
        tbl.setStyle(TableStyle(cmds))
        return tbl

    # ── Story assembly ───────────────────────────────────────────────────
    story: list = []
    cov = dashboard.get("coverage") or {}
    vis = dashboard.get("visibility_pct_current")
    score = dashboard.get("quality_score_current", dashboard.get("current_visibility_score"))
    health = intel.get("overall_health", "\u2014")

    # ── PAGE TEMPLATES ───────────────────────────────────────────────────

    def _cover_page(canvas_obj, doc_obj):
        canvas_obj.saveState()
        canvas_obj.setFillColor(C(COVER_BG))
        canvas_obj.rect(0, 0, W, H, fill=1, stroke=0)
        canvas_obj.setStrokeColor(C(COVER_ACCENT))
        canvas_obj.setLineWidth(4)
        canvas_obj.line(MARGIN, H - 50, W - MARGIN, H - 50)
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(C(SLATE_400))
        canvas_obj.drawCentredString(W / 2, 30, FOOTER_TEXT)
        canvas_obj.restoreState()

    def _normal_page(canvas_obj, doc_obj):
        canvas_obj.saveState()
        canvas_obj.setStrokeColor(C(BRAND_BLUE))
        canvas_obj.setLineWidth(2)
        canvas_obj.line(MARGIN, H - 36, W - MARGIN, H - 36)
        canvas_obj.setFont("Helvetica-Bold", 7.5)
        canvas_obj.setFillColor(C(BRAND_BLUE))
        canvas_obj.drawString(MARGIN, H - 30, "ANSWRDECK")
        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(C(SLATE_400))
        canvas_obj.drawRightString(W - MARGIN, H - 30, f"{project_name}  |  AI Visibility Report")
        canvas_obj.setStrokeColor(C(SLATE_200))
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(MARGIN, 38, W - MARGIN, 38)
        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(C(SLATE_400))
        canvas_obj.drawString(MARGIN, 24, FOOTER_TEXT)
        canvas_obj.drawRightString(W - MARGIN, 24, f"Page {doc_obj.page}")
        canvas_obj.restoreState()

    buffer = io.BytesIO()
    frame_cover = Frame(MARGIN, MARGIN, CONTENT_W, H - 2 * MARGIN, id="cover")
    frame_body = Frame(MARGIN, 52, CONTENT_W, H - 52 - 44, id="body")

    doc = BaseDocTemplate(
        buffer, pagesize=letter,
        title=f"Answrdeck Report \u2014 {project_name}",
    )
    doc.addPageTemplates([
        PageTemplate(id="cover_tpl", frames=[frame_cover], onPage=_cover_page),
        PageTemplate(id="normal_tpl", frames=[frame_body], onPage=_normal_page),
    ])

    # ─────────────────────────────────────────────────────────────────────
    # COVER PAGE
    # ─────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1.8 * inch))
    story.append(P("ANSWRDECK", ParagraphStyle("BrandMark", parent=S_COVER_SUB, fontSize=11, textColor=C(COVER_ACCENT), fontName="Helvetica-Bold", letterSpacing=4)))
    story.append(Spacer(1, 6))
    story.append(P("AI Visibility Intelligence Report", S_COVER_SUB))
    story.append(Spacer(1, 0.5 * inch))
    story.append(P(project_name, S_COVER_TITLE))
    story.append(Spacer(1, 6))
    meta_parts = [_safe(project.get("category") or "Uncategorized")]
    if project.get("region"):
        meta_parts.append(project["region"])
    if project.get("website_url"):
        meta_parts.append(project["website_url"])
    story.append(P("  \u2022  ".join(meta_parts), S_COVER_SUB))
    story.append(Spacer(1, 0.6 * inch))
    kpi_items = [
        (_pct(vis), "VISIBILITY SCORE"),
        (str(score) if score else "\u2014", "QUALITY SCORE"),
        (health.upper(), "HEALTH STATUS"),
        (str(cov.get("tier", "\u2014")).upper(), "CONFIDENCE TIER"),
    ]
    story.append(KPIStrip(kpi_items, height=60))
    story.append(Spacer(1, 0.25 * inch))
    site_pct = dashboard.get("official_site_cited_pct")
    n_prompts = cov.get("n_prompts", 0)
    n_engines = cov.get("n_engines", 0)
    n_responses = cov.get("n_responses", 0)
    story.append(KPIStrip([
        (_pct(site_pct), "SITE CITED RATE"),
        (_num(n_prompts), "PROMPTS TRACKED"),
        (_num(n_engines), "ENGINES MEASURED"),
        (_num(n_responses), "TOTAL RESPONSES"),
    ], height=48))
    story.append(Spacer(1, 0.6 * inch))
    story.append(P(f"Generated {gen_date} UTC", S_COVER_SMALL))
    if payload.get("date_from") or payload.get("date_to"):
        story.append(P(f"Trend range: {payload.get('date_from') or 'start'} to {payload.get('date_to') or 'now'}", S_COVER_SMALL))

    story.append(NextPageTemplate("normal_tpl"))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # TABLE OF CONTENTS
    # ─────────────────────────────────────────────────────────────────────
    story.append(P("Report Contents", S_SECTION))
    story.append(AccentLine(BRAND_BLUE, 0.3))
    story.append(Spacer(1, 12))
    toc_items = [
        ("01", "Executive Summary & Health Assessment"),
        ("02", "Brand Profile & Methodology"),
        ("03", "Visibility Trends & Trajectory"),
        ("04", "AI Engine Performance"),
        ("05", "Prompt Performance Analysis"),
        ("06", "Competitive Intelligence"),
        ("07", "Source & Citation Intelligence"),
        ("08", "Visibility Audit \u2014 What's Lacking"),
        ("09", "Strategic Recommendations"),
        ("10", "Per-Prompt Deep Dives"),
        ("11", "Prompt \u00d7 Engine Matrix"),
        ("12", "Appendix: Raw AI Model Responses"),
    ]
    for num, title in toc_items:
        story.append(
            P(
                f'<font name="Helvetica-Bold" color="{BRAND_BLUE}">{num}</font>'
                f'&nbsp;&nbsp;&nbsp;{esc(title)}',
                S_TOC,
            )
        )
    story.append(PageBreak())

    # ── Helper: section start ────────────────────────────────────────────
    sec_counter = [0]

    def start_section(title: str, description: str = ""):
        sec_counter[0] += 1
        story.append(Spacer(1, 6))
        story.append(SectionNumber(sec_counter[0], title))
        story.append(Spacer(1, 8))
        if description:
            story.append(P(description, S_SECTION_DESC))

    # ─────────────────────────────────────────────────────────────────────
    # 01 — EXECUTIVE SUMMARY
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Executive Summary & Health Assessment",
        "A high-level overview of your brand's AI visibility posture, synthesized from all tracked prompts and engines.",
    )
    story.append(HealthBadge(health))
    story.append(Spacer(1, 10))
    exec_summary = intel.get("executive_summary", "")
    if exec_summary:
        story.append(P(exec_summary, S_BODY))
        story.append(Spacer(1, 6))

    bullets = _as_list(intel.get("executive_bullets"))
    if bullets:
        story.append(P("Key Findings", S_SUB))
        for b in bullets:
            story.append(PB(b))
        story.append(Spacer(1, 6))

    threats = _as_list(intel.get("competitive_threats"))
    if threats:
        story.append(
            CalloutBox(
                threats[:6],
                bg=RED_50,
                accent=RED_600,
                title="COMPETITIVE THREATS",
            )
        )
        story.append(Spacer(1, 8))

    roadmap = _as_list(intel.get("strategic_roadmap"))
    if roadmap:
        story.append(P("Strategic Roadmap", S_SUB))
        for item in roadmap:
            if isinstance(item, dict):
                story.append(PB(f"{item.get('phase', '')}: {item.get('action', '')}"))
            else:
                story.append(PB(str(item)))
        story.append(Spacer(1, 6))

    priority_prompts = _as_list(intel.get("top_priority_prompts"))
    if priority_prompts:
        story.append(
            CalloutBox(
                priority_prompts[:5],
                bg=AMBER_50,
                accent=AMBER_600,
                title="TOP PRIORITY PROMPTS",
            )
        )
        story.append(Spacer(1, 8))

    insight = dashboard.get("project_insight") or {}
    if insight.get("insight_text"):
        story.append(P("Cross-Prompt Intelligence", S_SUB))
        story.append(P(insight["insight_text"], S_BODY_ITALIC))
        if insight.get("framing_pattern"):
            story.append(P(f"Dominant framing pattern: {insight['framing_pattern']}", S_SMALL))
        adjs = _as_list(insight.get("recurring_adjectives"))
        if adjs:
            story.append(P(f"Recurring adjectives: {', '.join(adjs[:12])}", S_SMALL))

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 02 — METHODOLOGY
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Brand Profile & Methodology",
        "Configuration details, data coverage, and confidence assessment for this report.",
    )
    meta_rows = [
        ["Brand Name", project.get("name", "")],
        ["Category", project.get("category", "")],
        ["Region", project.get("region", "")],
        ["Website", project.get("website_url", "")],
        ["Configured Competitors", ", ".join(_as_list(project.get("competitors"))[:12]) or "\u2014"],
        ["Onboarding Status", "Complete" if project.get("context_ready") else "Incomplete"],
    ]
    story.append(make_table(
        ["Parameter", "Value"],
        meta_rows,
        [2.0 * inch, CONTENT_W - 2.0 * inch],
    ))
    story.append(Spacer(1, 14))
    story.append(P("Data Coverage", S_SUB))
    coverage_rows = [
        ["Prompts Tracked", _num(cov.get("n_prompts"))],
        ["AI Engines Measured", _num(cov.get("n_engines"))],
        ["Responses Sampled", _num(cov.get("n_responses"))],
        ["Queries With Responses", _num(cov.get("n_queries_with_responses"))],
        ["Confidence Tier", str(cov.get("tier", "\u2014")).upper()],
        ["Official Site Cited", f"{_pct(site_pct)} ({_num(dashboard.get('official_site_cited_count'))}/{_num(dashboard.get('official_site_responses_total'))})"],
    ]
    story.append(make_table(
        ["Metric", "Value"],
        coverage_rows,
        [2.0 * inch, CONTENT_W - 2.0 * inch],
    ))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 03 — VISIBILITY TRENDS
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Visibility Trends & Trajectory",
        "Historical visibility scores and competitive positioning over time.",
    )
    vis_trend = _as_list(dashboard.get("visibility_trend"))
    if vis_trend:
        trend_rows = [[str(r.get("date", r.get("x", ""))), str(r.get("score", r.get("y", "")))] for r in vis_trend]
        story.append(make_table(["Date", "Visibility Score"], trend_rows, [2.0 * inch, 1.5 * inch]))
        story.append(Spacer(1, 12))

    comp_trend = dashboard.get("competitor_visibility_trend") or {}
    if isinstance(comp_trend, dict) and comp_trend.get("series"):
        story.append(P("30-Day Competitor Visibility Comparison", S_SUB))
        brands = _as_list(comp_trend.get("brands"))
        series_map = {s.get("id"): s.get("data") or [] for s in _as_list(comp_trend.get("series")) if isinstance(s, dict)}
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
        if ct_rows:
            widths = [1.2 * inch] + [max(0.7 * inch, (CONTENT_W - 1.2 * inch) / max(len(brands), 1))] * len(brands)
            story.append(make_table(["Date"] + brands, ct_rows, widths))
        story.append(Spacer(1, 12))

    trajectory = dashboard.get("trajectory") or {}
    if trajectory.get("summary_sentence"):
        story.append(
            CalloutBox(
                [trajectory["summary_sentence"]],
                bg=SLATE_50,
                accent=BRAND_BLUE,
                title="TRAJECTORY SUMMARY",
            )
        )
        story.append(Spacer(1, 8))

    new_displacers = _as_list(trajectory.get("new_displacers"))
    if new_displacers:
        story.append(P("New Displacing Competitors", S_SUB))
        for d in new_displacers:
            story.append(PB(d))

    framing_shifts = _as_list(trajectory.get("framing_shifts"))
    if framing_shifts:
        story.append(P("Framing Shifts by Engine", S_SUB))
        for shift in framing_shifts:
            if isinstance(shift, dict):
                story.append(PB(f"{shift.get('engine', '')}: \"{shift.get('old_framing', '')}\" \u2192 \"{shift.get('new_framing', '')}\""))

    engine_trends = trajectory.get("engine_trends") or {}
    if engine_trends:
        story.append(P("Engine Rank Trends", S_SUB))
        et_rows = []
        for engine, t in engine_trends.items():
            if isinstance(t, dict):
                delta = t.get("rank_delta")
                direction = t.get("direction", "")
                et_rows.append([engine, direction, str(delta) if delta is not None else "\u2014"])
        if et_rows:
            story.append(make_table(["Engine", "Direction", "Rank Delta"], et_rows))

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 04 — ENGINE BREAKDOWN
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "AI Engine Performance",
        "How each AI model (ChatGPT, Gemini, Claude, Perplexity) surfaces your brand.",
    )
    eng_data = _as_list(dashboard.get("engine_visibility"))
    if eng_data:
        eng_rows = [
            [
                r.get("engine", ""),
                _pct(r.get("visibility_pct")),
                _rank(r.get("avg_rank")),
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
        story.append(P("No engine data available yet. Run prompt analysis to populate.", S_BODY_ITALIC))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 05 — PROMPT PERFORMANCE
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Prompt Performance Analysis",
        "Visibility, rank, and sentiment for each tracked buyer query across all measured engines.",
    )
    pa_data = _as_list((payload.get("prompt_analysis") or {}).get("rows"))
    if pa_data:
        pa_rows = [
            [
                _safe(r.get("prompt_text", ""), 100),
                _pct(r.get("visibility_pct", r.get("visibility"))),
                _rank(r.get("avg_rank")),
                str(r.get("sentiment", "")),
                _num(r.get("engines_analyzed")),
            ]
            for r in pa_data
        ]
        story.append(make_table(
            ["Prompt", "Visibility", "Avg Rank", "Sentiment", "Engines"],
            pa_rows,
            [3.0 * inch, 0.7 * inch, 0.6 * inch, 0.8 * inch, 0.6 * inch],
        ))
    else:
        story.append(P("No prompt analysis data yet.", S_BODY_ITALIC))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 06 — COMPETITOR INTELLIGENCE
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Competitive Intelligence",
        "How AI models rank and describe your brand relative to competitors across all tracked prompts.",
    )
    comp_data = _as_list(payload.get("competitors"))
    if comp_data:
        comp_rows = [
            [
                r.get("brand", ""),
                _pct(r.get("visibility_pct", r.get("visibility_score"))),
                _pct(r.get("share_of_voice")),
                _num(r.get("mentions")),
                _rank(r.get("avg_rank")),
                "Yes" if r.get("is_focus") else "",
            ]
            for r in comp_data
        ]
        story.append(make_table(
            ["Brand", "Visibility", "Share of Voice", "Mentions", "Avg Rank", "Focus"],
            comp_rows,
            highlight_focus=True,
        ))
        story.append(Spacer(1, 14))

    framings = _as_list(payload.get("competitor_framings"))
    if framings:
        story.append(P("How AI Models Frame Competitors", S_SUB))
        story.append(P(
            "Verbatim sentences extracted from AI model responses showing how competitors are positioned.",
            S_SECTION_DESC,
        ))
        framing_rows = [
            [
                f.get("competitor_brand", ""),
                f.get("engine", ""),
                _safe(f.get("verbatim_sentence", ""), 180),
            ]
            for f in framings[:20]
        ]
        story.append(make_table(
            ["Competitor", "Engine", "Verbatim Quote"],
            framing_rows,
            [1.2 * inch, 0.8 * inch, CONTENT_W - 2.0 * inch],
        ))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 07 — SOURCES & CITATIONS
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Source & Citation Intelligence",
        "Domains cited by AI models when answering your tracked prompts, classified by ownership type.",
    )
    src = payload.get("sources") or {}
    domains = _as_list(src.get("domains"))
    if domains:
        story.append(P("Top Cited Domains", S_SUB))
        dom_rows = [
            [r.get("domain", ""), _num(r.get("source_mentions")), _num(r.get("brand_mentions"))]
            for r in domains[:20]
        ]
        story.append(make_table(
            ["Domain", "Citations", "Brand Mentions"],
            dom_rows,
            [2.5 * inch, 1.0 * inch, 1.0 * inch],
        ))
        story.append(Spacer(1, 14))

    classified = _as_list(src.get("sources"))
    if classified:
        story.append(P("Classified Source Analysis", S_SUB))
        story.append(P(
            "Each cited source classified as Owned, Competitor, Editorial, Social, or UGC with strategic recommendation.",
            S_SECTION_DESC,
        ))
        cls_rows = [
            [
                r.get("source_class", ""),
                r.get("domain", r.get("source", "")),
                _safe(r.get("why_it_matters", ""), 120),
                _safe(r.get("action", ""), 100),
                r.get("priority", ""),
            ]
            for r in classified[:15]
        ]
        story.append(make_table(
            ["Class", "Domain", "Why It Matters", "Action", "Priority"],
            cls_rows,
            [0.7 * inch, 1.3 * inch, 1.8 * inch, 1.6 * inch, 0.6 * inch],
        ))
        story.append(Spacer(1, 14))

    ce = payload.get("citation_economics") or {}
    rollup = ce.get("rollup_focus_mentions") or ce.get("rollup") or ce
    if rollup and rollup.get("focus_mentions"):
        story.append(P("Citation Economics", S_SUB))
        ce_rows = []
        labels = {
            "focus_mentions": "Brand Mentions (total)",
            "focus_with_any_source_url": "Mentions with source URLs",
            "focus_without_source_url": "Mentions without sources",
            "focus_with_brand_domain_citation": "Mentions citing your domain",
            "focus_with_competitor_named_domain": "Mentions citing competitor domain",
        }
        for key, label in labels.items():
            if key in rollup:
                ce_rows.append([label, _num(rollup[key])])
        if ce_rows:
            story.append(make_table(["Metric", "Count"], ce_rows, [3.5 * inch, 1.5 * inch]))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 08 — VISIBILITY AUDIT
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Visibility Audit \u2014 What's Lacking",
        "Measured gaps and vulnerabilities in your AI visibility, with root-cause analysis and fix recommendations.",
    )
    audit_items = _as_list((payload.get("global_audit") or {}).get("items"))
    if not audit_items:
        story.append(
            CalloutBox(
                ["No audit findings yet. Run analysis on your tracked prompts to generate measured audit items."],
                bg=SLATE_50,
                accent=SLATE_400,
                title="NO AUDIT DATA",
            )
        )
    for item in audit_items:
        priority = item.get("priority", "medium")
        p_bg, p_fg = _priority_color(priority)
        title_text = item.get("title", "Audit finding")

        story.append(Spacer(1, 6))
        story.append(P(
            f'<font name="Helvetica-Bold">{esc(title_text)}</font>'
            f'&nbsp;&nbsp;<font name="Helvetica-Bold" size="7" color="{p_fg}">[{priority.upper()}]</font>',
            ParagraphStyle("AuditTitle", parent=S_BODY, fontSize=10, leading=14, textColor=C(SLATE_900)),
        ))
        if item.get("root_cause"):
            story.append(P(f"Root cause: {item['root_cause']}", S_BODY))
        if item.get("solution"):
            story.append(P(f"Solution: {item['solution']}", S_BODY))
        if item.get("avoid"):
            story.append(P(f"Avoid: {item['avoid']}", S_SMALL))
        if item.get("evidence_quote"):
            story.append(P(f"\u201c{item['evidence_quote']}\u201d", S_BODY_ITALIC))
        queries = _as_list(item.get("queries_supporting"))
        if queries:
            story.append(P(f"Supporting queries: {', '.join(queries[:4])}", S_SMALL))
        story.append(AccentLine(SLATE_200, 1.0, 0.5))

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 09 — RECOMMENDATIONS
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Strategic Recommendations",
        "Actionable steps to improve AI visibility, derived from measured analysis data.",
    )
    recs = dashboard.get("recommendations") or {}
    if recs.get("recommendation_text"):
        story.append(
            CalloutBox(
                [recs["recommendation_text"]],
                bg=GREEN_50,
                accent=GREEN_600,
                title="OVERALL RECOMMENDATION",
            )
        )
        story.append(Spacer(1, 10))

    rec_items = _as_list(recs.get("recommendation_items"))
    if rec_items:
        story.append(P("Detailed Actions", S_SUB))
        ri_rows = [
            [
                r.get("priority", ""),
                r.get("engine", ""),
                _safe(r.get("action", ""), 140),
                _safe(r.get("evidence", ""), 100),
            ]
            for r in rec_items[:15]
            if isinstance(r, dict)
        ]
        if ri_rows:
            story.append(make_table(
                ["Priority", "Engine", "Action", "Evidence"],
                ri_rows,
                [0.6 * inch, 0.8 * inch, 2.6 * inch, 2.0 * inch],
            ))
        story.append(Spacer(1, 12))

    deep = payload.get("deep_analysis") or {}
    action_plan = _as_list(deep.get("action_plan"))
    if action_plan:
        story.append(P("Opportunity Action Plan", S_SUB))
        for item in action_plan[:12]:
            story.append(P(
                f'<font name="Helvetica-Bold">{esc(item.get("title", ""))}</font>',
                ParagraphStyle("ActionTitle", parent=S_BODY, fontSize=10, leading=14),
            ))
            if item.get("trigger_signal"):
                story.append(P(f"Trigger: {item['trigger_signal']}", S_SMALL))
            steps = _as_list(item.get("action_plan"))
            for step in steps[:6]:
                story.append(P(f"  \u2192 {step}", S_BODY))
            if item.get("evidence_quote"):
                story.append(P(f"\u201c{_safe(item['evidence_quote'], 180)}\u201d", S_BODY_ITALIC))
            story.append(Spacer(1, 8))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 10 — PER-PROMPT DEEP DIVES
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Per-Prompt Deep Dives",
        "Detailed visibility analysis for each tracked buyer query: what happened, why, and what to do next.",
    )
    for detail in _as_list(payload.get("prompt_details")):
        prompt_text = detail.get("prompt_text", "")
        brief = detail.get("analysis_brief") or {}

        story.append(P(
            f'<font name="Helvetica-Bold" color="{BRAND_BLUE}">\u25B6</font>&nbsp;&nbsp;'
            f'<font name="Helvetica-Bold">{esc(_safe(prompt_text, 180))}</font>',
            ParagraphStyle("PromptTitle", parent=S_BODY, fontSize=10, leading=14, spaceBefore=12),
        ))
        story.append(AccentLine(BRAND_BLUE, 0.15, 1.5))
        story.append(Spacer(1, 4))

        vis_pct = brief.get("visibility_pct")
        avg_rank = brief.get("avg_rank")
        if vis_pct is not None or avg_rank is not None:
            mini_kpis = []
            if vis_pct is not None:
                mini_kpis.append((_pct(vis_pct), "VISIBILITY"))
            if avg_rank is not None:
                mini_kpis.append((_rank(avg_rank), "AVG RANK"))
            engines_mentioned = _as_list(brief.get("engines_mentioned"))
            engines_missing = _as_list(brief.get("engines_missing"))
            if engines_mentioned:
                mini_kpis.append((_num(len(engines_mentioned)), "ENGINES MENTIONING"))
            if engines_missing:
                mini_kpis.append((_num(len(engines_missing)), "ENGINES MISSING"))
            story.append(KPIStrip(mini_kpis, height=38))
            story.append(Spacer(1, 8))

        if brief.get("what_happened"):
            story.append(P(f"What happened: {brief['what_happened']}", S_BODY))
        if brief.get("why_it_matters"):
            story.append(P(f"Why it matters: {brief['why_it_matters']}", S_BODY))
        if brief.get("next_move"):
            story.append(P(f"Next move: {brief['next_move']}", S_BODY))

        evidence = _as_list(brief.get("evidence_points"))
        if evidence:
            for pt in evidence[:5]:
                story.append(PB(pt))

        ranking = _as_list(detail.get("brand_ranking"))
        if ranking:
            rk_rows = [
                [r.get("name", ""), _num(r.get("mentions")), _rank(r.get("avg_rank")), "Yes" if r.get("is_focus") else ""]
                for r in ranking[:10]
            ]
            story.append(Spacer(1, 4))
            story.append(make_table(
                ["Brand", "Mentions", "Avg Rank", "Focus"],
                rk_rows,
                [2.0 * inch, 0.8 * inch, 0.8 * inch, 0.5 * inch],
                highlight_focus=True,
            ))

        audits = _as_list(detail.get("audit"))
        if audits:
            story.append(P("Audit Findings", S_SUB))
            for a in audits[:5]:
                story.append(P(
                    f"\u2022 {_safe(a.get('title', a.get('issue', '')), 150)} \u2014 {_safe(a.get('root_cause', ''), 100)}",
                    S_SMALL,
                ))

        actions = _as_list(detail.get("recommended_actions"))
        if actions:
            story.append(P("Recommended Actions", S_SUB))
            for a in actions[:4]:
                story.append(P(f"\u2192 {a.get('title', '')}:  {_safe(a.get('detail', ''), 120)}", S_BODY))

        sources = _as_list(detail.get("sources"))
        if sources:
            story.append(P("Top Cited Sources", S_SUB))
            src_rows = [
                [s.get("domain", ""), _num(s.get("mentions", s.get("source_mentions")))]
                for s in sources[:8]
            ]
            story.append(make_table(["Domain", "Citations"], src_rows, [3.0 * inch, 1.0 * inch]))

        story.append(Spacer(1, 16))

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 11 — PROMPT × ENGINE MATRIX
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Prompt \u00d7 Engine Matrix",
        "Complete cross-reference: which engines mention your brand for which prompts, with rank and sentiment.",
    )
    pm_data = _as_list(deep.get("prompt_matrix"))
    if pm_data:
        matrix_rows = []
        for prompt_row in pm_data:
            pt = _safe(prompt_row.get("prompt_text", ""), 70)
            engines = prompt_row.get("engines") or {}
            if isinstance(engines, dict):
                for engine, cell in engines.items():
                    if isinstance(cell, dict):
                        mentioned = "\u2705" if cell.get("mentioned") else "\u274c"
                        matrix_rows.append([
                            pt, engine, mentioned,
                            _rank(cell.get("rank")),
                            str(cell.get("sentiment", "")),
                        ])
        if matrix_rows:
            story.append(make_table(
                ["Prompt", "Engine", "Mentioned", "Rank", "Sentiment"],
                matrix_rows,
                [2.4 * inch, 0.9 * inch, 0.7 * inch, 0.5 * inch, 0.7 * inch],
            ))
    else:
        story.append(P("No matrix data available yet.", S_BODY_ITALIC))
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────
    # 12 — APPENDIX: RAW RESPONSES
    # ─────────────────────────────────────────────────────────────────────
    start_section(
        "Appendix: Raw AI Model Responses",
        "Complete, unedited responses from each AI model for every tracked prompt. "
        "This is the evidence base for all findings in this report.",
    )
    for detail in _as_list(payload.get("prompt_details")):
        prompt_text = detail.get("prompt_text", "")
        responses = _as_list(detail.get("raw_responses"))
        if not responses:
            continue

        story.append(P(
            f'<font name="Helvetica-Bold">{esc(_safe(prompt_text, 160))}</font>',
            ParagraphStyle("AppendixPrompt", parent=S_BODY, fontSize=10, leading=14, spaceBefore=14, textColor=C(BRAND_BLUE_DARK)),
        ))
        story.append(AccentLine(SLATE_200, 0.5, 0.5))

        for resp in responses:
            engine = resp.get("engine", "Unknown")
            ts = resp.get("timestamp", "")
            text = resp.get("display_response_text") or resp.get("response_text") or ""
            resp_sources = resp.get("sources") or []

            story.append(P(
                f'<font name="Helvetica-Bold">{esc(engine)}</font>'
                f'&nbsp;&nbsp;<font size="7" color="{SLATE_400}">{esc(str(ts)[:19])}</font>',
                ParagraphStyle("EngineLabel", parent=S_BODY, fontSize=9, spaceBefore=8),
            ))

            story.append(P(text, ParagraphStyle(
                "ResponseText", parent=S_BODY,
                fontSize=8, leading=11.5, textColor=C(SLATE_700),
                leftIndent=8, rightIndent=8,
                spaceBefore=2, spaceAfter=2,
                borderWidth=0, borderPadding=0,
            )))

            if resp_sources:
                src_text = "Sources: " + " | ".join(str(s) for s in resp_sources[:8])
                story.append(P(src_text, ParagraphStyle(
                    "SourceList", parent=S_SMALL,
                    leftIndent=8, textColor=C(BRAND_BLUE),
                )))
            story.append(Spacer(1, 6))

        story.append(Spacer(1, 10))

    # ─────────────────────────────────────────────────────────────────────
    # BUILD
    # ─────────────────────────────────────────────────────────────────────
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
