"""Model pricing calculator for TraceLens SDK."""

import json
from pathlib import Path
from typing import Any

PRICING_FILE = Path(__file__).parent / "pricing.json"

_PRICING_CACHE: dict[str, dict[str, float]] | None = None


def load_pricing(custom_path: Path | None = None) -> dict[str, dict[str, float]]:
    """Load pricing dictionary from JSON file."""
    global _PRICING_CACHE
    if _PRICING_CACHE is not None and custom_path is None:
        return _PRICING_CACHE

    target_path = custom_path or PRICING_FILE
    if not target_path.exists():
        return {}

    with open(target_path, encoding="utf-8") as f:
        data = json.load(f)

    if custom_path is None:
        _PRICING_CACHE = data
    return data


def match_model_pricing(
    model_name: str, pricing_table: dict[str, dict[str, float]]
) -> dict[str, float] | None:
    """Find pricing for a model with exact or prefix matching."""
    norm = model_name.strip().lower()
    if norm in pricing_table:
        return pricing_table[norm]

    # Prefix or fuzzy match (e.g., 'gpt-4o-0806' -> 'gpt-4o')
    for key, val in pricing_table.items():
        if norm.startswith(key) or key.startswith(norm):
            return val

    # Claude variants
    if "claude-3-5-sonnet" in norm:
        return pricing_table.get("claude-3-5-sonnet-20241022")
    if "claude-3-5-haiku" in norm:
        return pricing_table.get("claude-3-5-haiku-20241022")
    if "gpt-4o-mini" in norm:
        return pricing_table.get("gpt-4o-mini")
    if "gpt-4o" in norm:
        return pricing_table.get("gpt-4o")
    if "gemini-1.5-flash" in norm:
        return pricing_table.get("gemini-1.5-flash")
    if "gemini-1.5-pro" in norm:
        return pricing_table.get("gemini-1.5-pro")

    return None


def calculate_cost(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    custom_pricing: dict[str, Any] | None = None,
) -> float:
    """Calculate the estimated USD cost of an LLM call.

    Prices in pricing.json are in USD per 1,000,000 tokens.
    """
    if not model or (prompt_tokens == 0 and completion_tokens == 0):
        return 0.0

    table = custom_pricing or load_pricing()
    matched = match_model_pricing(model, table)
    if not matched:
        return 0.0

    input_rate = matched.get("input_per_1m", 0.0)
    output_rate = matched.get("output_per_1m", 0.0)

    cost = (prompt_tokens * input_rate / 1_000_000.0) + (
        completion_tokens * output_rate / 1_000_000.0
    )
    return round(cost, 8)
