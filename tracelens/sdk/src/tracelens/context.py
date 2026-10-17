"""Thread-safe and async-safe context variable management for Traces and Spans."""

from __future__ import annotations

import contextvars

from tracelens.models import Span, Trace

# ContextVar storing currently active Trace
_current_trace: contextvars.ContextVar[Trace | None] = contextvars.ContextVar(
    "tracelens_current_trace", default=None
)

# ContextVar storing currently active Span (parent for any new child spans)
_current_span: contextvars.ContextVar[Span | None] = contextvars.ContextVar(
    "tracelens_current_span", default=None
)


def get_current_trace() -> Trace | None:
    """Retrieve the active Trace in the current context."""
    return _current_trace.get()


def set_current_trace(trace: Trace | None) -> contextvars.Token:
    """Set the active Trace in the current context."""
    return _current_trace.set(trace)


def reset_current_trace(token: contextvars.Token) -> None:
    """Reset the active Trace to its prior context value."""
    _current_trace.reset(token)


def get_current_span() -> Span | None:
    """Retrieve the active Span in the current context."""
    return _current_span.get()


def set_current_span(span: Span | None) -> contextvars.Token:
    """Set the active Span in the current context."""
    return _current_span.set(span)


def reset_current_span(token: contextvars.Token) -> None:
    """Reset the active Span to its prior context value."""
    _current_span.reset(token)
