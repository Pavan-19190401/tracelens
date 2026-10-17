"""Trace and Span query endpoints with multi-dimensional filtering and tree reconstruction."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.api.deps import get_current_user
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.models.project import User
from tracelens.backend.app.models.trace import Span, Trace
from tracelens.backend.app.schemas import TraceDetailResponse, TraceListItem

router = APIRouter(prefix="/traces", tags=["traces"])


class TraceListResponse(BaseModel):
    items: list[TraceListItem]
    total: int
    limit: int
    offset: int


def _build_span_tree(spans: list[Span]) -> list[dict[str, Any]]:
    """Transform a flat list of Spans into a nested hierarchical tree with waterfall timing."""
    span_map: dict[str, dict[str, Any]] = {}
    roots: list[dict[str, Any]] = []

    # Calculate earliest start time for waterfall offset
    earliest_ts: float | None = None
    for s in spans:
        if s.start_time:
            ts = s.start_time.timestamp()
            if earliest_ts is None or ts < earliest_ts:
                earliest_ts = ts

    for s in spans:
        start_ts = s.start_time.timestamp() if s.start_time else 0.0
        offset_ms = round((start_ts - (earliest_ts or start_ts)) * 1000.0, 2)
        node = {
            "id": s.id,
            "trace_id": s.trace_id,
            "parent_span_id": s.parent_span_id,
            "name": s.name,
            "span_kind": s.span_kind,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time": s.end_time.isoformat() if s.end_time else None,
            "latency_ms": s.latency_ms or 0.0,
            "offset_ms": offset_ms,
            "status": s.status,
            "status_message": s.status_message,
            "input": s.input,
            "output": s.output,
            "model": s.model,
            "model_provider": s.model_provider,
            "prompt_tokens": s.prompt_tokens,
            "completion_tokens": s.completion_tokens,
            "total_tokens": s.total_tokens,
            "cost_usd": s.cost_usd,
            "metadata": s.metadata_ or {},
            "tags": s.tags or [],
            "children": [],
        }
        span_map[s.id] = node

    for s in spans:
        node = span_map[s.id]
        if s.parent_span_id and s.parent_span_id in span_map:
            span_map[s.parent_span_id]["children"].append(node)
        else:
            roots.append(node)

    return roots


@router.get("", response_model=TraceListResponse)
async def list_traces(
    project_id: str = Query(..., description="Project ID to query traces for"),
    status: str | None = Query(None, description="Filter by status (SUCCESS, ERROR)"),
    model: str | None = Query(None, description="Filter by LLM model used in trace"),
    min_cost: float | None = Query(None, description="Minimum cost in USD"),
    max_cost: float | None = Query(None, description="Maximum cost in USD"),
    search: str | None = Query(
        None, description="Text search on trace name or status message"
    ),
    start_time: datetime | None = Query(None, description="Start of time window"),
    end_time: datetime | None = Query(None, description="End of time window"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Query traces with multi-dimensional filtering, pagination, and sorting."""
    query = select(Trace).where(Trace.project_id == project_id)

    if status:
        query = query.where(Trace.status == status.upper())
    if min_cost is not None:
        query = query.where(Trace.cost_usd >= min_cost)
    if max_cost is not None:
        query = query.where(Trace.cost_usd <= max_cost)
    if start_time:
        query = query.where(Trace.start_time >= start_time)
    if end_time:
        query = query.where(Trace.start_time <= end_time)
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Trace.name.ilike(search_pattern),
                Trace.status_message.ilike(search_pattern),
            )
        )
    if model:
        # Join spans to filter traces that have spans with this model
        query = query.join(Span, Span.trace_id == Trace.id).where(
            Span.model.ilike(f"%{model}%")
        )

    # Count total
    subq = query.subquery()
    count_query = select(func.count()).select_from(subq)
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    # Paginate
    query = query.order_by(desc(Trace.created_at)).offset(offset).limit(limit)
    res = await db.execute(query)
    traces = res.scalars().all()

    items = [
        TraceListItem(
            id=t.id,
            project_id=t.project_id,
            name=t.name,
            session_id=t.session_id,
            user_id=t.user_id,
            start_time=t.start_time,
            end_time=t.end_time,
            latency_ms=t.latency_ms,
            status=t.status,
            status_message=t.status_message,
            total_tokens=t.total_tokens,
            cost_usd=t.cost_usd,
            created_at=t.created_at,
        )
        for t in traces
    ]

    return TraceListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{trace_id}", response_model=TraceDetailResponse)
async def get_trace_detail(
    trace_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve complete trace detail with full hierarchical span tree and timeline waterfall offsets."""
    t_res = await db.execute(select(Trace).where(Trace.id == trace_id))
    trace_record = t_res.scalar_one_or_none()
    if not trace_record:
        raise HTTPException(status_code=404, detail="Trace not found.")

    spans_res = await db.execute(
        select(Span).where(Span.trace_id == trace_id).order_by(Span.start_time)
    )
    spans = spans_res.scalars().all()
    span_tree = _build_span_tree(list(spans))

    return TraceDetailResponse(
        id=trace_record.id,
        project_id=trace_record.project_id,
        name=trace_record.name,
        session_id=trace_record.session_id,
        user_id=trace_record.user_id,
        start_time=trace_record.start_time,
        end_time=trace_record.end_time,
        latency_ms=trace_record.latency_ms,
        status=trace_record.status,
        status_message=trace_record.status_message,
        input=trace_record.input,
        output=trace_record.output,
        total_tokens=trace_record.total_tokens,
        prompt_tokens=trace_record.prompt_tokens,
        completion_tokens=trace_record.completion_tokens,
        cost_usd=trace_record.cost_usd,
        metadata=trace_record.metadata_ or {},
        tags=trace_record.tags or [],
        spans=span_tree,
    )
