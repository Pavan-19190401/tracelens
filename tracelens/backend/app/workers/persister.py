"""Background persistence worker: drains Redis queue and persists traces & spans to PostgreSQL."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.core.database import AsyncSessionLocal
from tracelens.backend.app.core.redis import dequeue_ingest_batch
from tracelens.backend.app.models.trace import Span, Trace

logger = logging.getLogger("tracelens.persister")


def _parse_iso(iso_str: str | None) -> datetime | None:
    if not iso_str:
        return None
    try:
        # Standardize ISO string
        clean = iso_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return datetime.utcnow()


async def process_batch(items_json: list[str], db: AsyncSession) -> int:
    """Process and persist a batch of raw JSON envelopes from the Redis queue."""
    if not items_json:
        return 0

    persisted_count = 0
    traces_to_upsert: dict[str, dict[str, Any]] = {}
    spans_to_insert: list[Span] = []

    for item_str in items_json:
        try:
            data = json.loads(item_str)
            project_id = data.get("project_id")
            traces = data.get("traces", [])
            spans = data.get("spans", [])

            for t in traces:
                t_id = t.get("id")
                if t_id:
                    traces_to_upsert[t_id] = {
                        "id": t_id,
                        "project_id": project_id,
                        "name": t.get("name", "unnamed_trace"),
                        "session_id": t.get("session_id"),
                        "user_id": t.get("user_id"),
                        "start_time": _parse_iso(t.get("start_time")),
                        "end_time": _parse_iso(t.get("end_time")),
                        "latency_ms": t.get("latency_ms"),
                        "status": t.get("status", "SUCCESS"),
                        "status_message": t.get("status_message"),
                        "input": t.get("input"),
                        "output": t.get("output"),
                        "total_tokens": t.get("total_tokens", 0),
                        "prompt_tokens": t.get("prompt_tokens", 0),
                        "completion_tokens": t.get("completion_tokens", 0),
                        "cost_usd": t.get("cost_usd", 0.0),
                        "metadata_": t.get("metadata", {}),
                        "tags": t.get("tags", []),
                    }

            for s in spans:
                s_id = s.get("id")
                t_id = s.get("trace_id")
                if s_id and t_id:
                    tokens = s.get("tokens") or {}
                    spans_to_insert.append(
                        Span(
                            id=s_id,
                            trace_id=t_id,
                            parent_span_id=s.get("parent_span_id"),
                            project_id=project_id,
                            name=s.get("name", "unnamed_span"),
                            span_kind=s.get("span_kind", "agent"),
                            start_time=_parse_iso(s.get("start_time")),
                            end_time=_parse_iso(s.get("end_time")),
                            latency_ms=s.get("latency_ms"),
                            status=s.get("status", "SUCCESS"),
                            status_message=s.get("status_message"),
                            input=s.get("input"),
                            output=s.get("output"),
                            model=s.get("model"),
                            model_provider=s.get("model_provider"),
                            prompt_tokens=tokens.get("prompt_tokens", 0),
                            completion_tokens=tokens.get("completion_tokens", 0),
                            total_tokens=tokens.get("total_tokens", 0),
                            cost_usd=s.get("cost_usd", 0.0),
                            metadata_=s.get("metadata", {}),
                            tags=s.get("tags", []),
                        )
                    )
                    # If this span is a root span and no trace was sent, prepare synthesized trace
                    if s.get("parent_span_id") is None and t_id not in traces_to_upsert:
                        traces_to_upsert[t_id] = {
                            "id": t_id,
                            "project_id": project_id,
                            "name": s.get("name", "unnamed_trace"),
                            "start_time": _parse_iso(s.get("start_time")),
                            "end_time": _parse_iso(s.get("end_time")),
                            "latency_ms": s.get("latency_ms"),
                            "status": s.get("status", "SUCCESS"),
                            "status_message": s.get("status_message"),
                            "input": s.get("input"),
                            "output": s.get("output"),
                            "total_tokens": tokens.get("total_tokens", 0),
                            "cost_usd": s.get("cost_usd", 0.0),
                            "tags": s.get("tags", []),
                        }
        except Exception as e:
            logger.error("Failed to parse raw ingest item: %s", e)

    # Roll up span tokens and costs to trace if not explicitly provided
    trace_span_tokens: dict[str, dict[str, Any]] = {}
    for s_obj in spans_to_insert:
        if s_obj.trace_id not in trace_span_tokens:
            trace_span_tokens[s_obj.trace_id] = {
                "total": 0,
                "prompt": 0,
                "completion": 0,
                "cost": 0.0,
            }
        trace_span_tokens[s_obj.trace_id]["total"] += (s_obj.total_tokens or 0)
        trace_span_tokens[s_obj.trace_id]["prompt"] += (s_obj.prompt_tokens or 0)
        trace_span_tokens[s_obj.trace_id]["completion"] += (s_obj.completion_tokens or 0)
        trace_span_tokens[s_obj.trace_id]["cost"] += (s_obj.cost_usd or 0.0)

    for t_id, roll in trace_span_tokens.items():
        if t_id in traces_to_upsert:
            t_data = traces_to_upsert[t_id]
            if not t_data.get("total_tokens"):
                t_data["total_tokens"] = roll["total"]
                t_data["prompt_tokens"] = roll["prompt"]
                t_data["completion_tokens"] = roll["completion"]
            if not t_data.get("cost_usd"):
                t_data["cost_usd"] = roll["cost"]

    # Upsert Traces
    for t_id, t_dict in traces_to_upsert.items():
        existing = await db.execute(select(Trace).where(Trace.id == t_id))
        trace_record = existing.scalar_one_or_none()
        if trace_record:
            for k, v in t_dict.items():
                if v is not None:
                    setattr(trace_record, k, v)
        else:
            trace_record = Trace(**t_dict)
            db.add(trace_record)
        persisted_count += 1

    await db.flush()

    # Insert Spans (ignoring duplicates if already present)
    for sp in spans_to_insert:
        existing = await db.execute(select(Span).where(Span.id == sp.id))
        if not existing.scalar_one_or_none():
            db.add(sp)
            persisted_count += 1

    await db.commit()
    return persisted_count


async def run_persister_loop(
    batch_size: int = 100, poll_interval: float = 0.5, run_once: bool = False
) -> None:
    """Continuous worker loop draining Redis queue into database."""
    logger.info("TraceLens persister worker started.")
    while True:
        try:
            batch = await dequeue_ingest_batch(batch_size=batch_size)
            if batch:
                async with AsyncSessionLocal() as session:
                    persisted = await process_batch(batch, session)
                    logger.debug("Persisted %d traces/spans to database.", persisted)
            elif run_once:
                break
            else:
                await asyncio.sleep(poll_interval)
        except Exception as e:
            logger.error("Persister worker encountered error: %s", e)
            if run_once:
                break
            await asyncio.sleep(1.0)
