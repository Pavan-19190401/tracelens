"""Tests for ingestion endpoint, rate limiting, and persistence worker."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.core.redis import dequeue_ingest_batch
from tracelens.backend.app.workers.persister import process_batch


@pytest.mark.asyncio
async def test_ingest_and_persistence_flow(
    client: AsyncClient, db_session: AsyncSession
):
    # Setup user, project, API key
    reg = await client.post(
        "/v1/auth/register",
        json={"email": "dev@test.com", "password": "Password123"},
    )
    token = reg.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    proj = await client.post(
        "/v1/projects", json={"name": "Ingest Project"}, headers=auth_headers
    )
    project_id = proj.json()["id"]

    key_res = await client.post(
        f"/v1/projects/{project_id}/api-keys",
        json={"name": "Ingest Key"},
        headers=auth_headers,
    )
    raw_api_key = key_res.json()["raw_key"]

    # 1. Ingestion with invalid key
    bad_res = await client.post(
        "/v1/ingest",
        json={"spans": []},
        headers={"X-API-Key": "tl_live_invalid_key_xyz"},
    )
    assert bad_res.status_code == 401

    # 2. Ingestion with valid key
    trace_id = "test-trace-uuid-1234"
    span_id = "test-span-uuid-5678"

    payload = {
        "traces": [
            {
                "id": trace_id,
                "name": "root_trace",
                "start_time": "2026-10-17T06:00:00Z",
                "end_time": "2026-10-17T06:00:01Z",
                "latency_ms": 1000.0,
                "status": "SUCCESS",
                "input": {"prompt": "Hello world"},
                "output": {"reply": "Hi there"},
                "total_tokens": 100,
                "cost_usd": 0.0005,
            }
        ],
        "spans": [
            {
                "id": span_id,
                "trace_id": trace_id,
                "parent_span_id": None,
                "name": "chat_llm_span",
                "span_kind": "llm",
                "start_time": "2026-10-17T06:00:00.100Z",
                "end_time": "2026-10-17T06:00:00.900Z",
                "latency_ms": 800.0,
                "status": "SUCCESS",
                "model": "gpt-4o",
                "model_provider": "openai",
                "tokens": {
                    "prompt_tokens": 80,
                    "completion_tokens": 20,
                    "total_tokens": 100,
                },
                "cost_usd": 0.0005,
            }
        ],
    }

    ingest_res = await client.post(
        "/v1/ingest",
        json=payload,
        headers={"X-API-Key": raw_api_key},
    )
    assert ingest_res.status_code == 202
    assert ingest_res.json()["accepted"] == 2

    # 3. Drain from Redis/memory queue and persist to DB via persister
    queued_items = await dequeue_ingest_batch(batch_size=10)
    assert len(queued_items) >= 1

    persisted_count = await process_batch(queued_items, db_session)
    assert persisted_count >= 2

    # 4. Verify trace appears in query API
    trace_res = await client.get(
        f"/v1/traces/{trace_id}",
        headers=auth_headers,
    )
    assert trace_res.status_code == 200
    trace_data = trace_res.json()
    assert trace_data["id"] == trace_id
    assert trace_data["total_tokens"] == 100
    assert len(trace_data["spans"]) == 1
    assert trace_data["spans"][0]["id"] == span_id
