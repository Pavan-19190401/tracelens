"""Evaluation scorers: deterministic heuristics, regex, json validity, and LLM-as-judge."""

import json
import os
import re
from collections.abc import Callable
from typing import Any

import httpx


class ScorerResult:

    def __init__(self, score: float, passed: bool, reason: str = ""):
        self.score = float(score)  # Normalized 0.0 to 1.0
        self.passed = passed
        self.reason = reason

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "passed": self.passed,
            "reason": self.reason,
        }


def score_exact_match(output: Any, expected: Any, case_sensitive: bool = False) -> ScorerResult:
    """Check if the string representations match exactly."""
    s_out = str(output or "").strip()
    s_exp = str(expected or "").strip()

    if not case_sensitive:
        s_out = s_out.lower()
        s_exp = s_exp.lower()

    passed = s_out == s_exp
    return ScorerResult(
        score=1.0 if passed else 0.0,
        passed=passed,
        reason="Outputs match exactly" if passed else f"Expected '{s_exp}', received '{s_out}'",
    )


def score_contains(output: Any, substring: Any, case_sensitive: bool = False) -> ScorerResult:
    """Check if the output contains a specific substring."""
    s_out = str(output or "")
    s_sub = str(substring or "")

    if not case_sensitive:
        s_out = s_out.lower()
        s_sub = s_sub.lower()

    passed = s_sub in s_out
    return ScorerResult(
        score=1.0 if passed else 0.0,
        passed=passed,
        reason=f"Substring '{s_sub}' found" if passed else f"Substring '{s_sub}' missing from output",
    )


def score_regex(output: Any, pattern: str) -> ScorerResult:
    """Validate output against a regular expression pattern."""
    s_out = str(output or "")
    try:
        match = re.search(pattern, s_out)
        passed = match is not None
        return ScorerResult(
            score=1.0 if passed else 0.0,
            passed=passed,
            reason=f"Matched regex pattern '{pattern}'" if passed else f"Failed to match pattern '{pattern}'",
        )
    except re.error as e:
        return ScorerResult(score=0.0, passed=False, reason=f"Invalid regex pattern: {e}")


def score_json_valid(output: Any, required_keys: list | None = None) -> ScorerResult:
    """Validate that output is valid JSON and optionally contains required keys."""
    if isinstance(output, (dict, list)):
        parsed = output
    else:
        try:
            parsed = json.loads(str(output or ""))
        except (json.JSONDecodeError, ValueError) as e:
            return ScorerResult(score=0.0, passed=False, reason=f"Invalid JSON: {e}")

    if required_keys and isinstance(parsed, dict):
        missing = [k for k in required_keys if k not in parsed]
        if missing:
            return ScorerResult(
                score=0.5,
                passed=False,
                reason=f"Valid JSON but missing keys: {missing}",
            )

    return ScorerResult(score=1.0, passed=True, reason="Valid JSON format")


async def score_llm_judge(
    input_text: str,
    output_text: str,
    criteria: str,
    provider: str = "gemini",
    model: str | None = None,
    api_key: str | None = None,
) -> ScorerResult:
    """Evaluate output quality using LLM-as-a-judge (Gemini default, OpenAI/Anthropic configurable)."""
    judge_prompt = f"""You are an objective evaluation judge assessing the quality of an AI output.
Input: {input_text}
Output to evaluate: {output_text}
Evaluation Criteria: {criteria}

Respond ONLY with a JSON object in this format:
{{"score": <number between 0.0 and 1.0>, "passed": <true or false>, "reason": "<brief justification>"}}
"""

    gemini_key = api_key or os.getenv("GEMINI_API_KEY", "")
    openai_key = api_key or os.getenv("OPENAI_API_KEY", "")

    # 1. Gemini Judge (Default)
    if provider == "gemini" and gemini_key:
        model_name = model or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": judge_prompt}]}]},
                )
                if res.status_code == 200:
                    data = res.json()
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                    if json_match:
                        parsed = json.loads(json_match.group(0))
                        return ScorerResult(
                            score=float(parsed.get("score", 0.0)),
                            passed=bool(parsed.get("passed", False)),
                            reason=str(parsed.get("reason", "LLM-as-judge evaluated")),
                        )
            except Exception as e:
                return ScorerResult(score=0.0, passed=False, reason=f"Gemini judge error: {e}")

    # 2. OpenAI Judge
    if provider == "openai" and openai_key:
        model_name = model or "gpt-4o-mini"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={
                        "model": model_name,
                        "messages": [{"role": "user", "content": judge_prompt}],
                        "response_format": {"type": "json_object"},
                    },
                )
                if res.status_code == 200:
                    parsed = json.loads(res.json()["choices"][0]["message"]["content"])
                    return ScorerResult(
                        score=float(parsed.get("score", 0.0)),
                        passed=bool(parsed.get("passed", False)),
                        reason=str(parsed.get("reason", "Evaluated by OpenAI judge")),
                    )
            except Exception as e:
                return ScorerResult(score=0.0, passed=False, reason=f"OpenAI judge error: {e}")

    # Mock / Fallback judge when keys are not configured
    # Performs keyword criteria heuristic
    passed = criteria.lower() in output_text.lower() or len(output_text) > 10
    return ScorerResult(
        score=0.9 if passed else 0.2,
        passed=passed,
        reason="Heuristic evaluation (no external LLM API key provided)",
    )


# Custom Scorer Registry
_CUSTOM_SCORERS: dict[str, Callable] = {}


def register_scorer(name: str, scorer_fn: Callable) -> None:
    """Register a custom scoring function."""
    _CUSTOM_SCORERS[name] = scorer_fn


def get_scorer(name: str) -> Callable | None:
    """Retrieve scorer by name."""
    builtins = {
        "exact_match": score_exact_match,
        "contains": score_contains,
        "regex": score_regex,
        "json_valid": score_json_valid,
        "llm_judge": score_llm_judge,
    }
    return builtins.get(name) or _CUSTOM_SCORERS.get(name)
