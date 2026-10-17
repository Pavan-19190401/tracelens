"""TraceLens: Open-source tracing and evaluation platform for LLM applications."""

from tracelens.client import (
    TraceLensClient,
    flush,
    get_client,
    init,
    shutdown,
)
from tracelens.context import (
    get_current_span,
    get_current_trace,
)
from tracelens.decorators import (
    trace,
    trace_span,
)
from tracelens.instrumentation import (
    instrument_anthropic,
    instrument_openai,
    wrap_anthropic,
    wrap_openai,
)
from tracelens.models import (
    IngestPayload,
    Span,
    SpanKind,
    SpanStatus,
    TokenUsage,
    Trace,
)
from tracelens.pricing import (
    calculate_cost,
    load_pricing,
)

__version__ = "0.1.0"

__all__ = [
    "IngestPayload",
    "Span",
    "SpanKind",
    "SpanStatus",
    "TokenUsage",
    "Trace",
    "TraceLensClient",
    "calculate_cost",
    "flush",
    "get_client",
    "get_current_span",
    "get_current_trace",
    "init",
    "instrument_anthropic",
    "instrument_openai",
    "load_pricing",
    "shutdown",
    "trace",
    "trace_span",
    "wrap_anthropic",
    "wrap_openai",
]
