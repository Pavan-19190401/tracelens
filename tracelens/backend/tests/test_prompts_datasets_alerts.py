"""Tests for Prompts, Datasets, Alert Rules and Health check."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Verify health endpoint reports status ok."""
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] is True


@pytest.mark.asyncio
async def test_prompts_datasets_alerts_crud(client: AsyncClient):
    # Setup user & project
    reg = await client.post(
        "/v1/auth/register",
        json={"email": "eval_lead@test.com", "password": "Password123"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj = await client.post(
        "/v1/projects", json={"name": "Eval Project"}, headers=headers
    )
    project_id = proj.json()["id"]

    # 1. Prompt Versioning
    pv1_res = await client.post(
        f"/v1/prompts?project_id={project_id}",
        json={
            "name": "summarizer",
            "template": "Summarize this: {{text}}",
            "commit_message": "v1 initial",
        },
        headers=headers,
    )
    assert pv1_res.status_code == 201
    assert pv1_res.json()["version"] == 1

    pv2_res = await client.post(
        f"/v1/prompts?project_id={project_id}",
        json={
            "name": "summarizer",
            "template": "Concise summary: {{text}}",
            "commit_message": "v2 refined",
        },
        headers=headers,
    )
    assert pv2_res.status_code == 201
    assert pv2_res.json()["version"] == 2

    # 2. Dataset and Items
    ds_res = await client.post(
        f"/v1/datasets?project_id={project_id}",
        json={"name": "Summary Evaluation Set", "description": "10 golden test cases"},
        headers=headers,
    )
    assert ds_res.status_code == 201
    dataset_id = ds_res.json()["id"]

    item_res = await client.post(
        f"/v1/datasets/{dataset_id}/items",
        json={
            "input": {"text": "Long text block"},
            "expected_output": {"summary": "Short summary"},
        },
        headers=headers,
    )
    assert item_res.status_code == 201

    # 3. Alert Rule CRUD
    alert_res = await client.post(
        f"/v1/alerts/rules?project_id={project_id}",
        json={
            "name": "High Error Alert",
            "metric_type": "error_rate",
            "threshold": 10.0,
            "window_minutes": 5,
            "webhook_url": "https://hooks.slack.com/services/test/webhook",
        },
        headers=headers,
    )
    assert alert_res.status_code == 201
    rule_id = alert_res.json()["id"]

    del_alert = await client.delete(f"/v1/alerts/rules/{rule_id}", headers=headers)
    assert del_alert.status_code == 204
