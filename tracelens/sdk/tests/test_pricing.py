"""Unit tests for model pricing and cost calculation."""

from tracelens import calculate_cost, load_pricing


def test_pricing_loading():
    """Verify default pricing table loads correctly."""
    pricing = load_pricing()
    assert "gpt-4o" in pricing
    assert "claude-3-5-sonnet-20241022" in pricing
    assert "gemini-1.5-flash" in pricing


def test_cost_calculation_gpt4o():
    """Verify gpt-4o cost calculation with known token counts."""
    # gpt-4o: $2.50 / 1M input, $10.00 / 1M output
    # 10,000 prompt tokens = $0.025
    # 1,000 completion tokens = $0.010
    # Total = $0.035
    cost = calculate_cost("gpt-4o", prompt_tokens=10_000, completion_tokens=1_000)
    assert cost == 0.035


def test_cost_calculation_gpt4o_mini():
    """Verify gpt-4o-mini cost calculation."""
    # gpt-4o-mini: $0.15 / 1M input, $0.60 / 1M output
    cost = calculate_cost("gpt-4o-mini", prompt_tokens=1_000_000, completion_tokens=1_000_000)
    assert cost == 0.75


def test_cost_fuzzy_model_name():
    """Verify model matching with date tags and alias variations."""
    cost1 = calculate_cost("gpt-4o-2024-08-06", 1000, 1000)
    assert cost1 > 0

    cost2 = calculate_cost("claude-3-5-sonnet-latest", 1000, 1000)
    assert cost2 > 0

    cost3 = calculate_cost("gemini-1.5-flash-8b", 1000, 1000)
    assert cost3 > 0


def test_zero_or_unknown_tokens():
    """Verify zero tokens or missing models return 0.0 without errors."""
    assert calculate_cost("gpt-4o", 0, 0) == 0.0
    assert calculate_cost("non-existent-custom-llm-model-xyz", 1000, 1000) == 0.0
    assert calculate_cost("", 1000, 1000) == 0.0
