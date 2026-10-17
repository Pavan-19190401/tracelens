"""Metrics aggregation endpoints for summary KPIs and timeseries graphs."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.api.deps import get_current_user
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.models.project import User
from tracelens.backend.app.models.trace import Trace
from tracelens.backend.app.schemas import (
    MetricsSummaryResponse,
    MetricsTimeseriesResponse,
    TimeseriesPoint,
)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/summary", response_model=MetricsSummaryResponse)
async def get_metrics_summary(
    project_id: str = Query(...),
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Calculate KPI metrics summary: total traces, error rate %, p50/p95 latency, total cost, total tokens."""
    since = datetime.now(UTC) - timedelta(hours=hours)

    traces_res = await db.execute(
        select(
            Trace.latency_ms, Trace.status, Trace.cost_usd, Trace.total_tokens
        ).where(Trace.project_id == project_id, Trace.created_at >= since)
    )
    rows = traces_res.all()

    total_traces = len(rows)
    if total_traces == 0:
        return MetricsSummaryResponse(
            total_traces=0,
            error_rate_pct=0.0,
            p50_latency_ms=0.0,
            p95_latency_ms=0.0,
            total_cost_usd=0.0,
            total_tokens=0,
        )

    errors = 0
    total_cost = 0.0
    total_tokens = 0
    latencies: list[float] = []

    for lat, stat, cost, tok in rows:
        if stat == "ERROR":
            errors += 1
        if cost:
            total_cost += cost
        if tok:
            total_tokens += tok
        if lat is not None:
            latencies.append(lat)

    latencies.sort()
    n = len(latencies)
    p50 = latencies[int(n * 0.50)] if n > 0 else 0.0
    p95 = latencies[min(int(n * 0.95), n - 1)] if n > 0 else 0.0
    error_rate = round((errors / total_traces) * 100.0, 2)

    return MetricsSummaryResponse(
        total_traces=total_traces,
        error_rate_pct=error_rate,
        p50_latency_ms=round(p50, 2),
        p95_latency_ms=round(p95, 2),
        total_cost_usd=round(total_cost, 6),
        total_tokens=total_tokens,
    )


@router.get("/timeseries", response_model=MetricsTimeseriesResponse)
async def get_metrics_timeseries(
    project_id: str = Query(...),
    hours: int = Query(24, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve bucketed timeseries data for latency, cost, volume, and error rates."""
    since = datetime.now(UTC) - timedelta(hours=hours)

    traces_res = await db.execute(
        select(Trace.created_at, Trace.latency_ms, Trace.status, Trace.cost_usd)
        .where(Trace.project_id == project_id, Trace.created_at >= since)
        .order_by(Trace.created_at.asc())
    )
    rows = traces_res.all()

    # Bucket by hour
    buckets = {}
    for created_at, lat, stat, cost in rows:
        if created_at is None:
            continue
        hour_key = created_at.strftime("%Y-%m-%d %H:00")
        if hour_key not in buckets:
            buckets[hour_key] = {"traces": 0, "errors": 0, "latencies": [], "cost": 0.0}

        b = buckets[hour_key]
        b["traces"] += 1
        if stat == "ERROR":
            b["errors"] += 1
        if lat is not None:
            b["latencies"].append(lat)
        if cost:
            b["cost"] += cost

    points = []
    for ts, data in sorted(buckets.items()):
        avg_lat = (
            sum(data["latencies"]) / len(data["latencies"])
            if data["latencies"]
            else 0.0
        )
        points.append(
            TimeseriesPoint(
                timestamp=ts,
                trace_count=data["traces"],
                error_count=data["errors"],
                avg_latency_ms=round(avg_lat, 2),
                cost_usd=round(data["cost"], 6),
            )
        )

    return MetricsTimeseriesResponse(points=points)
