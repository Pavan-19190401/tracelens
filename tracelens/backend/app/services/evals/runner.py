"""Asynchronous evaluation execution runner."""

import inspect
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.core.database import AsyncSessionLocal
from tracelens.backend.app.models.dataset import DatasetItem
from tracelens.backend.app.models.eval import EvalResult, EvalRun
from tracelens.backend.app.models.prompt import PromptVersion
from tracelens.backend.app.services.evals.scorers import get_scorer

logger = logging.getLogger("tracelens.evals")


async def execute_eval_run(
    eval_run_id: str, session: AsyncSession | None = None
) -> None:
    """Asynchronously execute an evaluation run over its dataset items."""
    if session is not None:
        await _run_eval(eval_run_id, session)
    else:
        async with AsyncSessionLocal() as s:
            await _run_eval(eval_run_id, s)


async def _run_eval(eval_run_id: str, session: AsyncSession) -> None:
    run_res = await session.execute(select(EvalRun).where(EvalRun.id == eval_run_id))
    eval_run = run_res.scalar_one_or_none()
    if not eval_run:
        logger.error("EvalRun %s not found.", eval_run_id)
        return

    items_res = await session.execute(
        select(DatasetItem).where(DatasetItem.dataset_id == eval_run.dataset_id)
    )
    items = items_res.scalars().all()
    scorer = get_scorer(eval_run.scorer_name)

    if not scorer:
        eval_run.status = "FAILED"
        eval_run.summary_scores = {"error": f"Scorer '{eval_run.scorer_name}' not found."}
        await session.commit()
        return

    # Fetch prompt template if provided
    prompt_tmpl = ""
    if eval_run.prompt_version_id:
        pv_res = await session.execute(
            select(PromptVersion).where(PromptVersion.id == eval_run.prompt_version_id)
        )
        pv = pv_res.scalar_one_or_none()
        if pv:
            prompt_tmpl = pv.template

    total_score = 0.0
    passed_count = 0

    for item in items:
        t0 = time.perf_counter()
        input_val = item.input
        expected = item.expected_output or {}

        # Render prompt or simulate model response
        if prompt_tmpl:
            rendered = prompt_tmpl
            for k, v in input_val.items():
                rendered = rendered.replace(f"{{{{{k}}}}}", str(v))
            model_output = f"Response based on: {rendered[:60]}"
        else:
            model_output = input_val.get("query") or input_val.get("text") or str(input_val)

        # Score the output
        target_expected = expected.get("relevant_section") or expected.get("summary") or expected.get("output") or expected
        if inspect.iscoroutinefunction(scorer):
            res = await scorer(
                input_text=str(input_val),
                output_text=str(model_output),
                criteria=str(target_expected),
            )
        else:
            res = scorer(model_output, target_expected)

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        total_score += res.score
        if res.passed:
            passed_count += 1

        eval_res_obj = EvalResult(
            eval_run_id=eval_run.id,
            dataset_item_id=item.id,
            score=res.score,
            passed=res.passed,
            reason=res.reason,
            output={"model_output": model_output},
            latency_ms=round(elapsed_ms, 2),
        )
        session.add(eval_res_obj)

    total_items = len(items)
    avg_score = round(total_score / total_items, 4) if total_items > 0 else 0.0
    pass_rate = round((passed_count / total_items) * 100.0, 2) if total_items > 0 else 0.0

    eval_run.status = "COMPLETED"
    eval_run.completed_at = datetime.now(timezone.utc)
    eval_run.summary_scores = {
        "total_items": total_items,
        "passed_items": passed_count,
        "pass_rate_pct": pass_rate,
        "average_score": avg_score,
    }
    await session.commit()
    logger.info("Completed eval run %s: avg_score=%.2f, pass_rate=%.1f%%", eval_run_id, avg_score, pass_rate)
