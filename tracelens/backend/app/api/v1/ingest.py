"""Ingestion endpoint for receiving traces and spans from the Python SDK."""

import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from tracelens.backend.app.api.deps import get_api_key_project
from tracelens.backend.app.core.redis import enqueue_ingest_item
from tracelens.backend.app.models.project import Project

router = APIRouter(prefix="/ingest", tags=["ingest"])


class IngestResponse(BaseModel):
    accepted: int
    project_id: str
    queued_at: str


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=IngestResponse)
async def ingest_batch(
    payload: dict[str, Any],
    project: Project = Depends(get_api_key_project),
):
    """Receive batched traces and spans from SDK, append project_id, and enqueue to Redis buffer."""
    traces = payload.get("traces", [])
    spans = payload.get("spans", [])

    # Enrich with verified project_id
    for t in traces:
        t["project_id"] = project.id
    for s in spans:
        s["project_id"] = project.id

    envelope = {
        "project_id": project.id,
        "traces": traces,
        "spans": spans,
        "received_at": datetime.now(UTC).isoformat(),
    }

    await enqueue_ingest_item(json.dumps(envelope))
    total_accepted = len(traces) + len(spans)

    return IngestResponse(
        accepted=total_accepted,
        project_id=project.id,
        queued_at=envelope["received_at"],
    )
