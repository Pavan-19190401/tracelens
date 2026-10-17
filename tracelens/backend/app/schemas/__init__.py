"""Common schemas and API contracts."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# Auth Schemas
class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    created_at: datetime


# Project & API Key Schemas
class ProjectCreate(BaseModel):
    name: str
    slug: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    created_at: datetime


class ApiKeyCreate(BaseModel):
    name: str = "Default Key"


class ApiKeyResponse(BaseModel):
    id: str
    project_id: str
    name: str
    key_prefix: str
    created_at: datetime
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None


class ApiKeyCreatedResponse(ApiKeyResponse):
    raw_key: str  # ONLY RETURNED ONCE UPON CREATION


# Trace & Span Schemas
class SpanSchema(BaseModel):
    id: str
    trace_id: str
    parent_span_id: str | None = None
    name: str
    span_kind: str
    start_time: str
    end_time: str | None = None
    latency_ms: float | None = None
    status: str
    status_message: str | None = None
    input: Any = None
    output: Any = None
    model: str | None = None
    model_provider: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class TraceListItem(BaseModel):
    id: str
    project_id: str
    name: str
    session_id: str | None = None
    user_id: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    latency_ms: float | None = None
    status: str
    status_message: str | None = None
    total_tokens: int
    cost_usd: float
    span_count: int = 0
    created_at: datetime


class TraceDetailResponse(BaseModel):
    id: str
    project_id: str
    name: str
    session_id: str | None = None
    user_id: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    latency_ms: float | None = None
    status: str
    status_message: str | None = None
    input: Any = None
    output: Any = None
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    spans: list[dict[str, Any]] = Field(default_factory=list)


# Metrics Schemas
class MetricsSummaryResponse(BaseModel):
    total_traces: int
    error_rate_pct: float
    p50_latency_ms: float
    p95_latency_ms: float
    total_cost_usd: float
    total_tokens: int


class TimeseriesPoint(BaseModel):
    timestamp: str
    trace_count: int
    error_count: int
    avg_latency_ms: float
    cost_usd: float


class MetricsTimeseriesResponse(BaseModel):
    points: list[TimeseriesPoint]


# Prompt Schemas
class PromptVersionCreate(BaseModel):
    name: str
    template: str
    variables: list[str] | None = None
    commit_message: str | None = None


class PromptVersionResponse(BaseModel):
    id: str
    project_id: str
    name: str
    version: int
    template: str
    variables: list[str] | None = None
    commit_message: str | None = None
    created_at: datetime


# Dataset Schemas
class DatasetCreate(BaseModel):
    name: str
    description: str | None = None


class DatasetItemCreate(BaseModel):
    input: dict[str, Any]
    expected_output: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class DatasetItemResponse(BaseModel):
    id: str
    dataset_id: str
    input: dict[str, Any]
    expected_output: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime


class DatasetResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    item_count: int = 0
    created_at: datetime


# Eval Schemas
class EvalRunCreate(BaseModel):
    name: str
    dataset_id: str
    prompt_version_id: str | None = None
    scorer_name: str  # exact_match, contains, regex, json_valid, llm_judge


class EvalRunResponse(BaseModel):
    id: str
    project_id: str
    dataset_id: str
    prompt_version_id: str | None = None
    name: str
    scorer_name: str
    status: str
    summary_scores: dict[str, Any] | None = None
    started_at: datetime
    completed_at: datetime | None = None


class EvalCompareItem(BaseModel):
    dataset_item_id: str
    input: Any
    expected_output: Any
    score_a: float | None = None
    score_b: float | None = None
    winner: str  # "A", "B", "TIE"


class EvalCompareResponse(BaseModel):
    run_a: EvalRunResponse
    run_b: EvalRunResponse
    total_items: int
    wins_a: int
    wins_b: int
    ties: int
    items: list[EvalCompareItem]


# Alert Schemas
class AlertRuleCreate(BaseModel):
    name: str
    metric_type: str  # cost_per_hour, error_rate, p95_latency
    threshold: float
    window_minutes: int = 5
    webhook_url: str | None = None
    enabled: bool = True


class AlertRuleResponse(BaseModel):
    id: str
    project_id: str
    name: str
    metric_type: str
    threshold: float
    window_minutes: int
    webhook_url: str | None = None
    enabled: bool
    created_at: datetime


class AlertEventResponse(BaseModel):
    id: str
    alert_rule_id: str
    project_id: str
    metric_value: float
    threshold_value: float
    status: str
    details: dict[str, Any] | None = None
    triggered_at: datetime
