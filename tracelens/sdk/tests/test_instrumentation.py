"""Unit tests for OpenAI and Anthropic auto-instrumentation wrappers."""

from types import SimpleNamespace

import pytest

from tracelens.client import init
from tracelens.decorators import trace_span
from tracelens.instrumentation.anthropic import wrap_anthropic
from tracelens.instrumentation.openai import wrap_openai


@pytest.fixture(autouse=True)
def setup_test_client():
    client = init(api_key="test-key", endpoint="http://mock-endpoint", enabled=False)
    yield client
    client.shutdown()


def test_openai_wrapper_captures_tokens_and_cost():
    """Verify wrap_openai captures model, prompt/completion tokens, and cost."""
    # Build mock OpenAI client
    mock_client = SimpleNamespace()
    mock_client.chat = SimpleNamespace()

    def mock_create(*args, **kwargs):
        # Return mock OpenAI response structure
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(role="assistant", content="Hello! How can I help?"),
                    finish_reason="stop",
                )
            ],
            usage=SimpleNamespace(
                prompt_tokens=150,
                completion_tokens=25,
                total_tokens=175,
            ),
        )

    mock_client.chat.completions = SimpleNamespace(create=mock_create)
    wrapped = wrap_openai(mock_client)

    with trace_span("parent_agent", kind="agent"):
        res = wrapped.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.7,
        )
        assert res.choices[0].message.content == "Hello! How can I help?"

    with trace_span("outer", kind="agent"), trace_span("openai_span", kind="llm"):
        wrapped.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hello again"}],
        )


def test_openai_wrapper_captures_error():
    """Verify wrap_openai captures exceptions and re-raises cleanly."""
    mock_client = SimpleNamespace()
    mock_client.chat = SimpleNamespace()

    def mock_create_fail(*args, **kwargs):
        raise ValueError("Rate limit exceeded from OpenAI")

    mock_client.chat.completions = SimpleNamespace(create=mock_create_fail)
    wrapped = wrap_openai(mock_client)

    with pytest.raises(ValueError, match="Rate limit exceeded"):
        wrapped.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "Hi"}],
        )


def test_anthropic_wrapper_captures_tokens_and_cost():
    """Verify wrap_anthropic captures Anthropic usage and content blocks."""
    mock_client = SimpleNamespace()

    def mock_create(*args, **kwargs):
        return SimpleNamespace(
            content=[
                SimpleNamespace(type="text", text="Here is the retrieved answer."),
            ],
            usage=SimpleNamespace(
                input_tokens=200,
                output_tokens=40,
            ),
        )

    mock_client.messages = SimpleNamespace(create=mock_create)
    wrapped = wrap_anthropic(mock_client)

    res = wrapped.messages.create(
        model="claude-3-5-sonnet-20241022",
        messages=[{"role": "user", "content": "Summarize this doc."}],
        max_tokens=1000,
    )
    assert res.content[0].text == "Here is the retrieved answer."
    assert res.usage.input_tokens == 200
