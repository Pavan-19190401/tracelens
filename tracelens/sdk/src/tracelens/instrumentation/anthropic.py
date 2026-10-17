"""Anthropic auto-instrumentation wrapper and patcher for TraceLens SDK."""

from __future__ import annotations

import functools
import inspect
import logging
from collections.abc import Callable
from typing import Any

from ..decorators import trace_span
from ..models import TokenUsage
from ..pricing import calculate_cost

logger = logging.getLogger("tracelens.anthropic")


def _extract_anthropic_usage(response: Any) -> TokenUsage | None:
    """Extract token counts from Anthropic response object or dict."""
    if hasattr(response, "usage") and response.usage is not None:
        usage = response.usage
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        return TokenUsage(
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        )
    elif isinstance(response, dict) and "usage" in response:
        usage = response["usage"]
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        return TokenUsage(
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        )
    return None


def _extract_anthropic_output(response: Any) -> Any:
    """Extract content from Anthropic response blocks."""
    if hasattr(response, "content") and isinstance(response.content, list):
        extracted: list[dict[str, Any]] = []
        for block in response.content:
            block_type = getattr(block, "type", "text")
            if block_type == "text":
                extracted.append({"type": "text", "text": getattr(block, "text", "")})
            elif block_type == "tool_use":
                extracted.append(
                    {
                        "type": "tool_use",
                        "id": getattr(block, "id", None),
                        "name": getattr(block, "name", None),
                        "input": getattr(block, "input", {}),
                    }
                )
        return extracted
    return str(response)


def wrap_anthropic_messages_create(original_create: Callable) -> Callable:
    """Wrap messages.create to record Anthropic LLM span, tokens, latency, cost, and errors."""

    if inspect.iscoroutinefunction(original_create):

        @functools.wraps(original_create)
        async def async_wrapped(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "claude-unknown")
            messages = kwargs.get("messages", [])
            span_name = f"anthropic.messages.{model}"

            ctx = trace_span(
                name=span_name,
                kind="llm",
                input_data={
                    "messages": messages,
                    "parameters": {k: v for k, v in kwargs.items() if k != "messages"},
                },
                metadata={"provider": "anthropic", "model": model},
            )
            async with ctx as span:
                span.model = model
                span.model_provider = "anthropic"
                try:
                    response = await original_create(*args, **kwargs)
                    usage = _extract_anthropic_usage(response)
                    if usage:
                        span.tokens = usage
                        span.cost_usd = calculate_cost(
                            model, usage.prompt_tokens, usage.completion_tokens
                        )
                    span.output = _extract_anthropic_output(response)
                    return response
                except Exception as exc:
                    span.status = "ERROR"
                    span.status_message = str(exc)
                    raise

        return async_wrapped

    else:

        @functools.wraps(original_create)
        def sync_wrapped(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "claude-unknown")
            messages = kwargs.get("messages", [])
            span_name = f"anthropic.messages.{model}"

            ctx = trace_span(
                name=span_name,
                kind="llm",
                input_data={
                    "messages": messages,
                    "parameters": {k: v for k, v in kwargs.items() if k != "messages"},
                },
                metadata={"provider": "anthropic", "model": model},
            )
            with ctx as span:
                span.model = model
                span.model_provider = "anthropic"
                try:
                    response = original_create(*args, **kwargs)
                    usage = _extract_anthropic_usage(response)
                    if usage:
                        span.tokens = usage
                        span.cost_usd = calculate_cost(
                            model, usage.prompt_tokens, usage.completion_tokens
                        )
                    span.output = _extract_anthropic_output(response)
                    return response
                except Exception as exc:
                    span.status = "ERROR"
                    span.status_message = str(exc)
                    raise

        return sync_wrapped


def wrap_anthropic(client: Any) -> Any:
    """Instrument an existing Anthropic client instance."""
    if hasattr(client, "messages"):
        original = client.messages.create
        if not getattr(original, "_tracelens_instrumented", False):
            wrapped = wrap_anthropic_messages_create(original)
            wrapped._tracelens_instrumented = True  # type: ignore[attr-defined]
            client.messages.create = wrapped
    return client


def instrument_anthropic() -> None:
    """Monkey-patch anthropic module globally if imported."""
    try:
        import anthropic

        if hasattr(anthropic, "Anthropic"):
            orig_init = anthropic.Anthropic.__init__

            def init_hook(self: Any, *args: Any, **kwargs: Any) -> None:
                orig_init(self, *args, **kwargs)
                wrap_anthropic(self)

            anthropic.Anthropic.__init__ = init_hook

        if hasattr(anthropic, "AsyncAnthropic"):
            orig_async_init = anthropic.AsyncAnthropic.__init__

            def async_init_hook(self: Any, *args: Any, **kwargs: Any) -> None:
                orig_async_init(self, *args, **kwargs)
                wrap_anthropic(self)

            anthropic.AsyncAnthropic.__init__ = async_init_hook

        logger.info("TraceLens Anthropic auto-instrumentation active.")
    except ImportError:
        logger.debug("Anthropic package not installed; skipping global monkey-patch.")
    except Exception as e:
        logger.warning("Failed to monkey-patch Anthropic: %s", e)
