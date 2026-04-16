"""Step-aware AI assistant used throughout the onboarding wizard.

Returns a small, strictly-typed JSON payload the UI can render as tips,
common mistakes, examples, and a crisp recommended action. Wraps the
existing `chat()` call with a tight temperature to avoid fluff.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from engine.llm_clients import chat

log = logging.getLogger(__name__)


_STEP_FOCUS = {
    1: {
        "title": "Brand identity",
        "focus": (
            "Help the user describe their brand clearly. Check that the brand name, "
            "public website, industry, and region are specific and match the business. "
            "Flag common mistakes like using a personal URL, an ambiguous industry, or a "
            "region that will not reflect the real target market."
        ),
    },
    2: {
        "title": "Competitor discovery",
        "focus": (
            "Help the user pick 4-8 real, directly-comparable competitors. Call out when "
            "they are listing parent companies, channels (Amazon/Flipkart), or aspirational "
            "benchmarks instead of real rivals customers actually compare them with."
        ),
    },
    3: {
        "title": "Prompt intent map",
        "focus": (
            "Help the user pick high-intent prompts covering awareness, consideration, and "
            "decision. Prompts must not contain the brand name, should be 5-12 words, and "
            "should read like a real search query. Flag weak or brand-biased prompts."
        ),
    },
    4: {
        "title": "Engines and search grounding",
        "focus": (
            "Explain which LLM engines matter for this brand and which search grounding "
            "(Serper vs Perplexity) fits. Flag when the user unchecks a major engine like "
            "ChatGPT without a reason."
        ),
    },
    5: {
        "title": "Review and launch",
        "focus": (
            "Give the user a final confidence check before launch: summarise what will be "
            "tracked, highlight any under-filled sections, and give a concrete first-run "
            "expectation (duration, what they'll see first)."
        ),
    },
}


def _extract_json(raw: str) -> Any:
    if not raw or not raw.strip():
        raise ValueError("Empty assistant response")
    candidate = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", raw, flags=re.DOTALL).strip()
    start_curly = candidate.find("{")
    end_curly = candidate.rfind("}")
    if start_curly != -1 and end_curly >= start_curly:
        candidate = candidate[start_curly : end_curly + 1]
    return json.loads(candidate)


def _fallback_payload(step: int) -> dict[str, Any]:
    focus = _STEP_FOCUS.get(step, _STEP_FOCUS[1])
    return {
        "tip": f"Keep this step focused on the essentials: {focus['title'].lower()}.",
        "common_mistakes": [
            "Copying marketing copy instead of how customers actually describe the brand.",
            "Skipping fields that the LLM engines rely on (industry, region).",
        ],
        "recommended_action": "Fill in the required fields with one crisp sentence each, then move on.",
        "examples": [],
        "confidence": 0.55,
        "source": "fallback",
    }


def generate_assistant_payload(step: int, context: dict, question: str = "") -> dict[str, Any]:
    focus = _STEP_FOCUS.get(step, _STEP_FOCUS[1])
    safe_context = context if isinstance(context, dict) else {}
    question_clause = (
        f"\n\nThe user has also asked: {question.strip()}\n"
        if question and str(question).strip()
        else ""
    )

    prompt = f"""You are an AI visibility strategist guiding a user through project setup.

CURRENT STEP: {step} — {focus['title']}
STEP GOAL: {focus['focus']}

USER CONTEXT (may be partial):
{json.dumps(safe_context, default=str)[:1600]}
{question_clause}
Return ONLY valid JSON matching exactly this schema:
{{
  "tip": "One crisp sentence, max 140 characters, actionable for THIS step and THIS user.",
  "common_mistakes": ["Up to 3 short strings (<= 110 chars each) specific to this step."],
  "recommended_action": "One imperative sentence telling the user what to do next right now.",
  "examples": ["0-3 short, realistic example strings if the step benefits from examples; otherwise []."],
  "confidence": 0.0-1.0
}}

Rules:
- Be specific to the user's brand/industry when context is available.
- Never include the literal brand name in example prompts when step == 3.
- No emojis, no marketing fluff, no hedging like "you might consider".
- If the user has a question, the tip must answer it directly."""

    try:
        raw = chat("chatgpt", prompt, temperature=0.2)
        parsed = _extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("Assistant returned non-dict")
        tip = str(parsed.get("tip") or "").strip()
        if not tip:
            raise ValueError("Missing tip")
        mistakes = parsed.get("common_mistakes") or []
        if not isinstance(mistakes, list):
            mistakes = []
        cleaned_mistakes = [str(item).strip() for item in mistakes if str(item or "").strip()][:3]

        examples = parsed.get("examples") or []
        if not isinstance(examples, list):
            examples = []
        cleaned_examples = [str(item).strip() for item in examples if str(item or "").strip()][:3]

        try:
            confidence = float(parsed.get("confidence") or 0.7)
        except (TypeError, ValueError):
            confidence = 0.7
        confidence = max(0.0, min(1.0, confidence))

        return {
            "tip": tip[:220],
            "common_mistakes": [m[:160] for m in cleaned_mistakes],
            "recommended_action": str(parsed.get("recommended_action") or "").strip()[:220]
            or "Fill in the required fields and continue.",
            "examples": [e[:220] for e in cleaned_examples],
            "confidence": round(confidence, 2),
            "source": "ai_generated",
        }
    except Exception as exc:
        log.info("onboarding assistant fallback for step %s: %s", step, exc)
        return _fallback_payload(step)


def rewrite_prompt(
    prompt_text: str,
    focus_brand: str = "",
    industry: str = "",
    funnel_stage: str = "",
) -> dict[str, Any]:
    """Return a rewritten/crisper version of a tracking prompt with reasoning."""
    brand = (focus_brand or "").strip()
    ind = (industry or "").strip()
    stage = (funnel_stage or "").strip().lower()
    original = (prompt_text or "").strip()

    if not original:
        return {
            "rewritten_prompt": "",
            "reasoning": "No prompt text provided.",
            "alternative_angles": [],
            "quality_score": 0,
            "source": "fallback",
        }

    system = f"""You are a Generative Engine Optimization (GEO) prompt engineer.
Rewrite the user's tracking prompt so it performs better as a real user query for
AI visibility research.

Hard rules:
- Keep the intent of the original prompt.
- Prompts MUST be 5-12 words.
- Prompts MUST NOT include the brand name "{brand or 'N/A'}" or an obvious variant.
- Prompts must read like a natural user query (no "best of 2026 list ranked") .
- Prefer discovery/recommendation/constraint phrasing by funnel stage.
- No emojis, no marketing fluff, no hedging.

Funnel stage hint: {stage or 'any'}
Industry hint: {ind or 'general'}

Return ONLY valid JSON:
{{
  "rewritten_prompt": "string, 5-12 words",
  "reasoning": "one sentence, max 160 chars, explaining why the new version is stronger",
  "alternative_angles": ["0-3 alternate prompt strings (5-12 words each)"],
  "quality_score": 0-100
}}

Original prompt: "{original}"
"""

    try:
        raw = chat("chatgpt", system, temperature=0.25)
        parsed = _extract_json(raw)
        if not isinstance(parsed, dict):
            raise ValueError("rewrite returned non-dict")
        rewritten = str(parsed.get("rewritten_prompt") or "").strip()
        if not rewritten:
            raise ValueError("missing rewritten_prompt")
        alts = parsed.get("alternative_angles") or []
        if not isinstance(alts, list):
            alts = []
        cleaned_alts = [str(a).strip() for a in alts if str(a or "").strip()][:3]
        try:
            quality = float(parsed.get("quality_score") or 0)
        except (TypeError, ValueError):
            quality = 0
        quality = max(0, min(100, int(round(quality))))
        return {
            "rewritten_prompt": rewritten[:160],
            "reasoning": str(parsed.get("reasoning") or "").strip()[:220] or "Improved clarity and intent.",
            "alternative_angles": [a[:160] for a in cleaned_alts],
            "quality_score": quality,
            "source": "ai_generated",
        }
    except Exception as exc:
        log.info("prompt rewrite fallback: %s", exc)
        return {
            "rewritten_prompt": original,
            "reasoning": "AI rewrite unavailable; keeping original prompt.",
            "alternative_angles": [],
            "quality_score": 55,
            "source": "fallback",
        }
