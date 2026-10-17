"""End-to-End Integration Test for TraceLens.

Verifies the entire ingestion and query lifecycle:
1. Project & API key provisioning
2. Multi-step LLM agent execution (Agent -> Retrieval, Tool, LLM)
3. TraceLens ingestion payload submission to /v1/ingest
4. Worker persistence to PostgreSQL/SQLite
5. Verification of the complete trace tree, hierarchy, token accounting, and cost calculation via GET /v1/traces/{id}
"""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens import (
    IngestPayload,
    TokenUsage,
    calculate_cost,
)
from tracelens import (
    Span as SdkSpan,
)
from tracelens import (
    Trace as SdkTrace,
)
from tracelens.backend.app.core.security import hash_api_key
from tracelens.backend.app.models.project import ApiKey, Project
from tracelens.backend.app.workers.persister import process_batch


@pytest.mark.asyncio
async def test_end_to_end_agent_trace_integration(client: AsyncClient, db_session: AsyncSession):
    # 1. Setup Project & API Key
    project = Project(name="E2E Integration App", slug="e2e-integration-app")
    db_session.add(project)
    await db_session.commit()
    await db_session.refresh(project)

    raw_key = "tl_live_test_e2e_integration_secret_key_9999"
    api_key = ApiKey(
        project_id=project.id,
        name="e2e-key",
        key_hash=hash_api_key(raw_key),
        key_prefix="tl_live_test_e2e",
    )
    db_session.add(api_key)
    await db_session.commit()

    # 2. Simulate SDK generating a nested multi-step agent trace
    trace_id = "trc_integration_agent_001"
    sdk_trace = SdkTrace(
        id=trace_id,
        name="support_copilot_pipeline",
        user_id="usr_prod_4920",
        start_time="2026-10-17T12:00:00Z",
        end_time="2026-10-17T12:00:01Z",
        latency_ms=1000.0,
        status="SUCCESS",
        input={"query": "Can I return my item and get the 10% discount?"},
        output="Based on our policy, you are eligible for a refund. Your total with discount is $90.00.",
    )

    root_span = SdkSpan(
        id="spn_root_agent_001",
        trace_id=trace_id,
        parent_span_id=None,
        name="support_copilot_pipeline",
        span_kind="agent",
        start_time="2026-10-17T12:00:00Z",
        end_time="2026-10-17T12:00:01Z",
        latency_ms=1000.0,
        status="SUCCESS",
    )

    retrieval_span = SdkSpan(
        id="spn_retrieval_002",
        trace_id=trace_id,
        parent_span_id="spn_root_agent_001",
        name="vector_search",
        span_kind="retrieval",
        start_time="2026-10-17T12:00:00.050Z",
        end_time="2026-10-17T12:00:00.090Z",
        latency_ms=40.0,
        status="SUCCESS",
        input={"query": "return policy"},
        output=[{"title": "Refund Policy"}],
    )

    tool_span = SdkSpan(
        id="spn_tool_003",
        trace_id=trace_id,
        parent_span_id="spn_root_agent_001",
        name="calculate_discount",
        span_kind="tool",
        start_time="2026-10-17T12:00:00.100Z",
        end_time="2026-10-17T12:00:00.120Z",
        latency_ms=20.0,
        status="SUCCESS",
        input={"order_amount": 100.0, "discount_pct": 10.0},
        output=90.0,
    )

    llm_cost = calculate_cost("gpt-4o", prompt_tokens=220, completion_tokens=75)
    llm_span = SdkSpan(
        id="spn_llm_004",
        trace_id=trace_id,
        parent_span_id="spn_root_agent_001",
        name="gpt-4o-reasoning",
        span_kind="llm",
        start_time="2026-10-17T12:00:00.150Z",
        end_time="2026-10-17T12:00:00.270Z",
        latency_ms=120.0,
        status="SUCCESS",
        model="gpt-4o",
        tokens=TokenUsage(prompt_tokens=220, completion_tokens=75, total_tokens=295),
        cost_usd=llm_cost,
    )

    ingest_payload = IngestPayload(
        traces=[sdk_trace],
        spans=[root_span, retrieval_span, tool_span, llm_span],
    )

    # 3. Submit to /v1/ingest with X-API-Key header
    res = await client.post(
        "/v1/ingest",
        json=ingest_payload.model_dump(),
        headers={"X-API-Key": raw_key},
    )
    assert res.status_code in (200, 202)
    data = res.json()
    assert data["accepted"] == 5

    # 4. Trigger worker persistence directly
    envelope = json.dumps({"project_id": project.id, **ingest_payload.model_dump()})
    stored_count = await process_batch([envelope], db=db_session)
    assert stored_count == 5

    # 5. Query the trace tree detail via GET /v1/traces/{id}
    # Create an authenticated user to query the dashboard endpoint
    user_res = await client.post(
        "/v1/auth/register",
        json={"email": "tester_e2e@example.com", "password": "SecretPassword123!"},
    )
    jwt_token = user_res.json()["access_token"]

    detail_res = await client.get(
        f"/v1/traces/{trace_id}",
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert detail_res.status_code == 200
    trace_detail = detail_res.json()

    # Validate Trace Record
    assert trace_detail["id"] == trace_id
    assert trace_detail["name"] == "support_copilot_pipeline"
    assert trace_detail["status"] == "SUCCESS"
    assert trace_detail["total_tokens"] == 295
    assert trace_detail["prompt_tokens"] == 220
    assert trace_detail["completion_tokens"] == 75
    assert trace_detail["cost_usd"] > 0.0

    # Validate Hierarchical Span Tree Structure
    roots = trace_detail["spans"]
    assert len(roots) == 1
    root_node = roots[0]
    assert root_node["id"] == "spn_root_agent_001"
    assert root_node["span_kind"] == "agent"

    children = root_node["children"]
    assert len(children) == 3
    children_by_name = {c["name"]: c for c in children}
    assert "vector_search" in children_by_name
    assert "calculate_discount" in children_by_name
    assert "gpt-4o-reasoning" in children_by_name

    llm_node = children_by_name["gpt-4o-reasoning"]
    assert llm_node["model"] == "gpt-4o"
    assert llm_node["prompt_tokens"] == 220
    assert llm_node["completion_tokens"] == 75
    assert llm_node["cost_usd"] > 0.0
