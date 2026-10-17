"""TraceLens: Open-source tracing and evaluation platform for LLM applications."""

from .client import (
    TraceLensClient,
    flush,
    get_client,
    init,
    shutdown,
)
from .context import (
    get_current_span,
    get_current_trace,
)
from .decorators import (
    trace,
    trace_span,
)
from .instrumentation import (
    instrument_anthropic,
    instrument_openai,
    wrap_anthropic,
    wrap_openai,
)
from .models import (
    IngestPayload,
    Span,
    SpanKind,
    SpanStatus,
    TokenUsage,
    Trace,
)
from .pricing import (
    calculate_cost,
    load_pricing,
)

__version__ = "0.1.0"

__all__ = [
    "TraceLensClient",
    "init",
    "get_client",
    "flush",
    "shutdown",
    "trace",
    "trace_span",
    "get_current_trace",
    "get_current_span",
    "wrap_openai",
    "instrument_openai",
    "wrap_anthropic",
    "instrument_anthropic",
    "calculate_cost",
    "load_pricing",
    "Span",
    "Trace",
    "TokenUsage",
    "SpanKind",
    "SpanStatus",
    "IngestPayload",
]
