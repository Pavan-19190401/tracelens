"""OpenAI auto-instrumentation wrapper and patcher for TraceLens SDK."""

from __future__ import annotations

import functools
import inspect
import logging
from collections.abc import Callable
from typing import Any

from tracelens.decorators import trace_span
from tracelens.models import TokenUsage
from tracelens.pricing import calculate_cost

logger = logging.getLogger("tracelens.openai")


def _extract_openai_usage(response: Any) -> TokenUsage | None:
    """Safely extract token usage from OpenAI response object or dict."""
    if hasattr(response, "usage") and response.usage is not None:
        usage = response.usage
        prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
        completion_tokens = getattr(usage, "completion_tokens", 0) or 0
        total_tokens = getattr(usage, "total_tokens", prompt_tokens + completion_tokens) or 0
        return TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )
    elif isinstance(response, dict) and "usage" in response:
        usage = response["usage"]
        return TokenUsage(
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
        )
    return None


def _extract_openai_output(response: Any) -> Any:
    """Extract readable output content from OpenAI response."""
    if hasattr(response, "choices") and response.choices:
        first_choice = response.choices[0]
        if hasattr(first_choice, "message"):
            msg = first_choice.message
            content = getattr(msg, "content", None)
            tool_calls = getattr(msg, "tool_calls", None)
            res: dict[str, Any] = {"role": getattr(msg, "role", "assistant")}
            if content is not None:
                res["content"] = content
            if tool_calls is not None:
                res["tool_calls"] = [
                    {
                        "id": getattr(tc, "id", None),
                        "type": getattr(tc, "type", "function"),
                        "function": {
                            "name": getattr(getattr(tc, "function", None), "name", None),
                            "arguments": getattr(getattr(tc, "function", None), "arguments", None),
                        },
                    }
                    for tc in tool_calls
                ]
            return res
    return str(response)


def wrap_openai_chat_create(original_create: Callable) -> Callable:
    """Wrap chat.completions.create to record LLM span, tokens, latency, cost, and errors."""

    if inspect.iscoroutinefunction(original_create):

        @functools.wraps(original_create)
        async def async_wrapped(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "unknown-model")
            messages = kwargs.get("messages", [])
            span_name = f"openai.chat.{model}"

            ctx = trace_span(
                name=span_name,
                kind="llm",
                input_data={
                    "messages": messages,
                    "parameters": {k: v for k, v in kwargs.items() if k != "messages"},
                },
                metadata={"provider": "openai", "model": model},
            )
            async with ctx as span:
                span.model = model
                span.model_provider = "openai"
                try:
                    response = await original_create(*args, **kwargs)
                    usage = _extract_openai_usage(response)
                    if usage:
                        span.tokens = usage
                        span.cost_usd = calculate_cost(
                            model, usage.prompt_tokens, usage.completion_tokens
                        )
                    span.output = _extract_openai_output(response)
                    return response
                except Exception as exc:
                    span.status = "ERROR"
                    span.status_message = str(exc)
                    raise

        return async_wrapped

    else:

        @functools.wraps(original_create)
        def sync_wrapped(*args: Any, **kwargs: Any) -> Any:
            model = kwargs.get("model", "unknown-model")
            messages = kwargs.get("messages", [])
            span_name = f"openai.chat.{model}"

            ctx = trace_span(
                name=span_name,
                kind="llm",
                input_data={
                    "messages": messages,
                    "parameters": {k: v for k, v in kwargs.items() if k != "messages"},
                },
                metadata={"provider": "openai", "model": model},
            )
            with ctx as span:
                span.model = model
                span.model_provider = "openai"
                try:
                    response = original_create(*args, **kwargs)
                    usage = _extract_openai_usage(response)
                    if usage:
                        span.tokens = usage
                        span.cost_usd = calculate_cost(
                            model, usage.prompt_tokens, usage.completion_tokens
                        )
                    span.output = _extract_openai_output(response)
                    return response
                except Exception as exc:
                    span.status = "ERROR"
                    span.status_message = str(exc)
                    raise

        return sync_wrapped


def wrap_openai(client: Any) -> Any:
    """Instrument an existing OpenAI client instance."""
    if hasattr(client, "chat") and hasattr(client.chat, "completions"):
        original = client.chat.completions.create
        # Avoid double-wrapping
        if not getattr(original, "_tracelens_instrumented", False):
            wrapped = wrap_openai_chat_create(original)
            wrapped._tracelens_instrumented = True  # type: ignore[attr-defined]
            client.chat.completions.create = wrapped
    return client


def instrument_openai() -> None:
    """Monkey-patch openai module globally if imported."""
    try:
        import openai

        if hasattr(openai, "OpenAI"):
            orig_init = openai.OpenAI.__init__

            def init_hook(self: Any, *args: Any, **kwargs: Any) -> None:
                orig_init(self, *args, **kwargs)
                wrap_openai(self)

            openai.OpenAI.__init__ = init_hook

        if hasattr(openai, "AsyncOpenAI"):
            orig_async_init = openai.AsyncOpenAI.__init__

            def async_init_hook(self: Any, *args: Any, **kwargs: Any) -> None:
                orig_async_init(self, *args, **kwargs)
                wrap_openai(self)

            openai.AsyncOpenAI.__init__ = async_init_hook

        logger.info("TraceLens OpenAI auto-instrumentation active.")
    except ImportError:
        logger.debug("OpenAI package not installed; skipping global monkey-patch.")
    except Exception as e:
        logger.warning("Failed to monkey-patch OpenAI: %s", e)
