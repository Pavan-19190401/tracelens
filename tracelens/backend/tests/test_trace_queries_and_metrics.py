"""Tests for trace filters, span tree reconstruction, and metrics calculation."""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.models.trace import Span, Trace


@pytest.mark.asyncio
async def test_trace_queries_and_metrics(client: AsyncClient, db_session: AsyncSession):
    # Setup user & project
    reg = await client.post(
        "/v1/auth/register",
        json={"email": "analyst@test.com", "password": "Password123"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj = await client.post(
        "/v1/projects", json={"name": "Metrics Project"}, headers=headers
    )
    project_id = proj.json()["id"]

    now = datetime.now(UTC)
    # Insert 5 traces: 4 success, 1 error
    for i in range(5):
        is_err = i == 4
        t = Trace(
            id=f"trace-{i}",
            project_id=project_id,
            name=f"workflow_{i}",
            status="ERROR" if is_err else "SUCCESS",
            latency_ms=100.0 * (i + 1),
            total_tokens=200,
            cost_usd=0.01 * (i + 1),
            created_at=now,
            start_time=now,
        )
        db_session.add(t)

        # Add parent span and child span to test tree building
        parent_span = Span(
            id=f"span-parent-{i}",
            trace_id=f"trace-{i}",
            project_id=project_id,
            parent_span_id=None,
            name="agent_root",
            span_kind="agent",
            start_time=now,
            status="SUCCESS",
            model="gpt-4o" if i % 2 == 0 else "claude-3-5-sonnet",
        )
        child_span = Span(
            id=f"span-child-{i}",
            trace_id=f"trace-{i}",
            project_id=project_id,
            parent_span_id=f"span-parent-{i}",
            name="retrieval_step",
            span_kind="retrieval",
            start_time=now,
            status="SUCCESS",
        )
        db_session.add(parent_span)
        db_session.add(child_span)

    await db_session.commit()

    # 1. Filter by status: ERROR
    err_res = await client.get(
        f"/v1/traces?project_id={project_id}&status=ERROR", headers=headers
    )
    assert err_res.status_code == 200
    assert err_res.json()["total"] == 1
    assert err_res.json()["items"][0]["id"] == "trace-4"

    # 2. Filter by search
    search_res = await client.get(
        f"/v1/traces?project_id={project_id}&search=workflow_2", headers=headers
    )
    assert search_res.status_code == 200
    assert search_res.json()["total"] == 1
    assert search_res.json()["items"][0]["id"] == "trace-2"

    # 3. Test Trace Detail & Span Tree
    detail_res = await client.get("/v1/traces/trace-0", headers=headers)
    assert detail_res.status_code == 200
    spans_tree = detail_res.json()["spans"]
    assert len(spans_tree) == 1  # 1 root
    assert spans_tree[0]["id"] == "span-parent-0"
    assert len(spans_tree[0]["children"]) == 1
    assert spans_tree[0]["children"][0]["id"] == "span-child-0"

    # 4. Metrics Summary
    metrics_res = await client.get(
        f"/v1/metrics/summary?project_id={project_id}", headers=headers
    )
    assert metrics_res.status_code == 200
    m_data = metrics_res.json()
    assert m_data["total_traces"] == 5
    assert m_data["error_rate_pct"] == 20.0  # 1 out of 5
    assert m_data["total_tokens"] == 1000
    assert m_data["total_cost_usd"] > 0
    assert m_data["p50_latency_ms"] > 0

    # 5. Timeseries
    ts_res = await client.get(
        f"/v1/metrics/timeseries?project_id={project_id}", headers=headers
    )
    assert ts_res.status_code == 200
    assert len(ts_res.json()["points"]) >= 1
