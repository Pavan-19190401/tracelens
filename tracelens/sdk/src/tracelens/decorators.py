"""Decorators and context managers for tracing functions, tools, and agent workflows."""

from __future__ import annotations

import functools
import inspect
import time
import traceback
import uuid
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager, AbstractContextManager
from typing import Any

from .client import get_client
from .context import (
    get_current_span,
    get_current_trace,
    reset_current_span,
    reset_current_trace,
    set_current_span,
    set_current_trace,
)
from .models import Span, SpanKind, Trace, utc_now_iso


class TraceSpanContext(AbstractContextManager, AbstractAsyncContextManager):
    """Context manager for tracing code blocks both synchronously and asynchronously."""

    def __init__(
        self,
        name: str,
        kind: SpanKind = "agent",
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        input_data: Any = None,
        model: str | None = None,
    ) -> None:
        self.name = name
        self.kind = kind
        self.tags = list(tags) if tags else []
        self.metadata = dict(metadata) if metadata else {}
        self.input_data = input_data
        self.model = model

        self.span: Span | None = None
        self.created_trace: Trace | None = None
        self._start_perf: float = 0.0
        self._trace_token: Any = None
        self._span_token: Any = None

    def _start(self) -> Span:
        self._start_perf = time.perf_counter()
        now_iso = utc_now_iso()

        current_trace = get_current_trace()
        if current_trace is None:
            # Create a new root trace for this context
            self.created_trace = Trace(
                id=str(uuid.uuid4()),
                name=self.name,
                start_time=now_iso,
                input=self.input_data,
                tags=self.tags,
                metadata=self.metadata,
            )
            self._trace_token = set_current_trace(self.created_trace)
            trace_id = self.created_trace.id
        else:
            trace_id = current_trace.id

        parent_span = get_current_span()
        parent_span_id = parent_span.id if parent_span else None

        self.span = Span(
            id=str(uuid.uuid4()),
            trace_id=trace_id,
            parent_span_id=parent_span_id,
            name=self.name,
            span_kind=self.kind,
            start_time=now_iso,
            input=self.input_data,
            tags=self.tags,
            metadata=self.metadata,
            model=self.model,
        )
        self._span_token = set_current_span(self.span)
        return self.span

    def _finish(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.span is None:
            return

        elapsed_ms = (time.perf_counter() - self._start_perf) * 1000.0
        self.span.end_time = utc_now_iso()
        self.span.latency_ms = round(elapsed_ms, 2)

        if exc_val is not None:
            self.span.status = "ERROR"
            self.span.status_message = "".join(
                traceback.format_exception(exc_type, exc_val, exc_tb)
            )
        else:
            if self.span.status == "RUNNING":
                self.span.status = "SUCCESS"

        client = get_client()
        client.enqueue(self.span)

        if self.created_trace is not None:
            self.created_trace.end_time = self.span.end_time
            self.created_trace.latency_ms = self.span.latency_ms
            self.created_trace.status = self.span.status
            self.created_trace.status_message = self.span.status_message
            if self.span.output is not None:
                self.created_trace.output = self.span.output
            if self.span.tokens:
                self.created_trace.total_tokens = self.span.tokens.total_tokens
                self.created_trace.prompt_tokens = self.span.tokens.prompt_tokens
                self.created_trace.completion_tokens = self.span.tokens.completion_tokens
            if self.span.cost_usd:
                self.created_trace.cost_usd = self.span.cost_usd
            client.enqueue(self.created_trace)

        if self._span_token is not None:
            reset_current_span(self._span_token)
        if self._trace_token is not None:
            reset_current_trace(self._trace_token)

    def __enter__(self) -> Span:
        return self._start()

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self._finish(exc_type, exc_val, exc_tb)

    async def __aenter__(self) -> Span:
        return self._start()

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self._finish(exc_type, exc_val, exc_tb)


def trace_span(
    name: str,
    kind: SpanKind = "agent",
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
    input_data: Any = None,
    model: str | None = None,
) -> TraceSpanContext:
    """Create a context manager for tracing a block of execution.

    Supports both sync `with trace_span(...)` and async `async with trace_span(...)`.
    """
    return TraceSpanContext(
        name=name,
        kind=kind,
        tags=tags,
        metadata=metadata,
        input_data=input_data,
        model=model,
    )


def _safe_serialize(value: Any) -> Any:
    """Safely serialize inputs or outputs for tracing."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_safe_serialize(x) for x in value]
    if isinstance(value, dict):
        return {str(k): _safe_serialize(v) for k, v in value.items()}
    if hasattr(value, "model_dump"):
        try:
            return value.model_dump()
        except Exception:
            pass
    if hasattr(value, "dict"):
        try:
            return value.dict()
        except Exception:
            pass
    return repr(value)


def trace(
    name: str | None = None,
    kind: SpanKind = "agent",
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
    capture_input: bool = True,
    capture_output: bool = True,
    model: str | None = None,
) -> Callable:
    """Decorator to trace function executions (sync and async).

    Args:
        name: Name of the trace/span. Defaults to the decorated function name.
        kind: Span kind: 'llm', 'tool', 'agent', or 'retrieval'.
        tags: Optional tags for categorization.
        metadata: Optional custom metadata attributes.
        capture_input: Whether to serialize arguments into the span input.
        capture_output: Whether to serialize the return value into the span output.
        model: Optional model name (e.g. 'gpt-4o', 'claude-3-5-sonnet-20241022').
    """

    def decorator(fn: Callable) -> Callable:
        span_name = name or fn.__name__

        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                input_data = None
                if capture_input:
                    input_data = _safe_serialize({"args": args, "kwargs": kwargs})

                ctx = trace_span(
                    name=span_name,
                    kind=kind,
                    tags=tags,
                    metadata=metadata,
                    input_data=input_data,
                    model=model,
                )
                async with ctx as span:
                    result = await fn(*args, **kwargs)
                    if capture_output:
                        span.output = _safe_serialize(result)
                    return result

            return async_wrapper
        else:

            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                input_data = None
                if capture_input:
                    input_data = _safe_serialize({"args": args, "kwargs": kwargs})

                ctx = trace_span(
                    name=span_name,
                    kind=kind,
                    tags=tags,
                    metadata=metadata,
                    input_data=input_data,
                    model=model,
                )
                with ctx as span:
                    result = fn(*args, **kwargs)
                    if capture_output:
                        span.output = _safe_serialize(result)
                    return result

            return sync_wrapper

    return decorator
