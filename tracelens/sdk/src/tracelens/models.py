"""Data models for TraceLens SDK representing Spans, Traces, and Ingestion Payloads."""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

SpanKind = Literal["llm", "tool", "agent", "retrieval"]
SpanStatus = Literal["SUCCESS", "ERROR", "RUNNING"]


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class Span(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trace_id: str
    parent_span_id: str | None = None
    name: str
    span_kind: SpanKind
    start_time: str = Field(default_factory=utc_now_iso)
    end_time: str | None = None
    latency_ms: float | None = None
    status: SpanStatus = "RUNNING"
    status_message: str | None = None
    input: Any = None
    output: Any = None
    model: str | None = None
    model_provider: str | None = None
    tokens: TokenUsage | None = None
    cost_usd: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class Trace(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    session_id: str | None = None
    user_id: str | None = None
    start_time: str = Field(default_factory=utc_now_iso)
    end_time: str | None = None
    latency_ms: float | None = None
    status: SpanStatus = "RUNNING"
    status_message: str | None = None
    input: Any = None
    output: Any = None
    total_tokens: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class IngestPayload(BaseModel):
    sent_at: str = Field(default_factory=utc_now_iso)
    traces: list[Trace] = Field(default_factory=list)
    spans: list[Span] = Field(default_factory=list)
