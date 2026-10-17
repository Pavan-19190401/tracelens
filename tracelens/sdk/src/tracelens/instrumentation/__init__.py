"""Auto-instrumentation modules for popular LLM providers."""

from tracelens.instrumentation.anthropic import instrument_anthropic, wrap_anthropic
from tracelens.instrumentation.openai import instrument_openai, wrap_openai

__all__ = [
    "instrument_anthropic",
    "instrument_openai",
    "wrap_anthropic",
    "wrap_openai",
]
