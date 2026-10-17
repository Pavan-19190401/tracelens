"""Tests for evaluation scorers, async eval execution, side-by-side comparison, and alert worker."""

from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tracelens.backend.app.models.alert import AlertRule
from tracelens.backend.app.models.dataset import Dataset, DatasetItem
from tracelens.backend.app.models.eval import EvalResult, EvalRun
from tracelens.backend.app.models.trace import Trace
from tracelens.backend.app.services.evals.runner import execute_eval_run
from tracelens.backend.app.services.evals.scorers import (
    score_contains,
    score_exact_match,
    score_json_valid,
    score_llm_judge,
    score_regex,
)
from tracelens.backend.app.workers.alerter import evaluate_rule


def test_deterministic_scorers():
    """Verify exact_match, contains, regex, and json_valid scorers."""
    # 1. Exact match
    res1 = score_exact_match("Hello World", "hello world", case_sensitive=False)
    assert res1.passed is True
    assert res1.score == 1.0

    res2 = score_exact_match("Hello", "World")
    assert res2.passed is False
    assert res2.score == 0.0

    # 2. Contains
    res3 = score_contains("The enterprise plan includes SSO", "enterprise")
    assert res3.passed is True

    # 3. Regex
    res4 = score_regex("Order #12345 confirmed", r"#\d{5}")
    assert res4.passed is True

    # 4. JSON valid
    res5 = score_json_valid('{"status": "ok", "count": 42}', required_keys=["status"])
    assert res5.passed is True
    assert res5.score == 1.0

    res6 = score_json_valid('{"status": "ok"}', required_keys=["status", "missing_key"])
    assert res6.passed is False


@pytest.mark.asyncio
async def test_llm_judge_fallback():
    """Verify LLM-as-a-judge heuristic fallback when no external API key is set."""
    res = await score_llm_judge(
        input_text="How do I upgrade billing?",
        output_text="Go to settings/billing page to upgrade your subscription.",
        criteria="settings/billing",
    )
    assert res.score >= 0.8
    assert res.passed is True


@pytest.mark.asyncio
async def test_eval_run_and_compare_flow(client: AsyncClient, db_session: AsyncSession):
    """Test creating an eval run, running scorers, and comparing two runs side-by-side."""
    # Setup user & project
    reg = await client.post(
        "/v1/auth/register",
        json={"email": "eval_tester@test.com", "password": "Password123"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj = await client.post(
        "/v1/projects", json={"name": "Eval Project"}, headers=headers
    )
    project_id = proj.json()["id"]

    # Create dataset with 3 items
    ds = Dataset(project_id=project_id, name="Test Benchmark")
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    item1 = DatasetItem(
        dataset_id=ds.id,
        input={"query": "billing upgrade"},
        expected_output={"relevant_section": "billing"},
    )
    item2 = DatasetItem(
        dataset_id=ds.id,
        input={"query": "api keys"},
        expected_output={"relevant_section": "api keys"},
    )
    item3 = DatasetItem(
        dataset_id=ds.id,
        input={"query": "random query"},
        expected_output={"relevant_section": "unmatched"},
    )
    db_session.add_all([item1, item2, item3])
    await db_session.commit()

    # Create Eval Run A (exact_match)
    run_a = EvalRun(
        project_id=project_id,
        dataset_id=ds.id,
        name="Run A - Exact",
        scorer_name="contains",
        status="RUNNING",
    )
    # Create Eval Run B (contains)
    run_b = EvalRun(
        project_id=project_id,
        dataset_id=ds.id,
        name="Run B - Exact Match",
        scorer_name="exact_match",
        status="RUNNING",
    )
    db_session.add_all([run_a, run_b])
    await db_session.commit()
    await db_session.refresh(run_a)
    await db_session.refresh(run_b)

    # Execute both runs
    await execute_eval_run(run_a.id, session=db_session)
    await execute_eval_run(run_b.id, session=db_session)

    # 1. Inspect Run A status
    res_a = await client.get(f"/v1/eval-runs/{run_a.id}", headers=headers)
    assert res_a.status_code == 200
    assert res_a.json()["status"] == "COMPLETED"
    assert res_a.json()["summary_scores"]["total_items"] == 3

    # 2. Compare Run A vs Run B
    comp_res = await client.get(
        f"/v1/eval-runs/compare?a={run_a.id}&b={run_b.id}", headers=headers
    )
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["total_items"] == 3
    assert comp_data["wins_a"] + comp_data["wins_b"] + comp_data["ties"] == 3


@pytest.mark.asyncio
async def test_alert_rule_evaluation(db_session: AsyncSession):
    """Verify alert rule evaluation triggers when error rate exceeds threshold."""
    now = datetime.now(timezone.utc)
    project_id = "alert-test-proj"

    # Add 4 errors and 1 success -> 80% error rate
    for i in range(5):
        t = Trace(
            id=f"alert-trace-{i}",
            project_id=project_id,
            name="workflow",
            status="ERROR" if i < 4 else "SUCCESS",
            latency_ms=500.0,
            cost_usd=0.01,
            created_at=now,
            start_time=now,
        )
        db_session.add(t)

    rule = AlertRule(
        id="test-rule-1",
        project_id=project_id,
        name="High Error Rate > 20%",
        metric_type="error_rate",
        threshold=20.0,
        window_minutes=15,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    event = await evaluate_rule(rule, db_session)
    assert event is not None
    assert event.metric_value == 80.0
    assert event.status == "TRIGGERED"
