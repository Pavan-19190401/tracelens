"""Evaluation endpoints: run trigger, status inspection, and side-by-side win/loss comparison."""

import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracelens.backend.app.api.deps import get_current_user
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.models.dataset import Dataset, DatasetItem
from tracelens.backend.app.models.eval import EvalResult, EvalRun
from tracelens.backend.app.models.project import User
from tracelens.backend.app.schemas import (
    EvalCompareItem,
    EvalCompareResponse,
    EvalRunCreate,
    EvalRunResponse,
)
from tracelens.backend.app.services.evals.runner import execute_eval_run

router = APIRouter(prefix="/eval-runs", tags=["evals"])


@router.post("", response_model=EvalRunResponse, status_code=status.HTTP_201_CREATED)
async def trigger_eval_run(
    project_id: str = Query(...),
    payload: EvalRunCreate = ...,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger an asynchronous evaluation run over a dataset."""
    ds_res = await db.execute(select(Dataset).where(Dataset.id == payload.dataset_id))
    if not ds_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dataset not found.")

    eval_run = EvalRun(
        project_id=project_id,
        dataset_id=payload.dataset_id,
        prompt_version_id=payload.prompt_version_id,
        name=payload.name,
        scorer_name=payload.scorer_name,
        status="RUNNING",
    )
    db.add(eval_run)
    await db.commit()
    await db.refresh(eval_run)

    # Launch evaluation worker in background
    asyncio.create_task(execute_eval_run(eval_run.id))

    return eval_run


@router.get("", response_model=List[EvalRunResponse])
async def list_eval_runs(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all evaluation runs for a project ordered by creation time desc."""
    res = await db.execute(
        select(EvalRun).where(EvalRun.project_id == project_id).order_by(EvalRun.created_at.desc())
    )
    return res.scalars().all()


@router.get("/compare", response_model=EvalCompareResponse)
async def compare_eval_runs(
    a: str = Query(..., description="ID of baseline eval run A"),
    b: str = Query(..., description="ID of candidate eval run B"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Compare two evaluation runs side by side and compute itemized win/loss/tie outcomes."""
    res_a = await db.execute(select(EvalRun).where(EvalRun.id == a))
    run_a = res_a.scalar_one_or_none()

    res_b = await db.execute(select(EvalRun).where(EvalRun.id == b))
    run_b = res_b.scalar_one_or_none()

    if not run_a or not run_b:
        raise HTTPException(status_code=404, detail="One or both evaluation runs not found.")

    results_a_res = await db.execute(select(EvalResult).where(EvalResult.eval_run_id == a))
    results_a = {r.dataset_item_id: r for r in results_a_res.scalars().all()}

    results_b_res = await db.execute(select(EvalResult).where(EvalResult.eval_run_id == b))
    results_b = {r.dataset_item_id: r for r in results_b_res.scalars().all()}

    items_res = await db.execute(select(DatasetItem).where(DatasetItem.dataset_id == run_a.dataset_id))
    dataset_items = items_res.scalars().all()

    wins_a = 0
    wins_b = 0
    ties = 0
    comparison_items: List[EvalCompareItem] = []

    for item in dataset_items:
        score_a = results_a.get(item.id).score if item.id in results_a else None
        score_b = results_b.get(item.id).score if item.id in results_b else None

        if score_a is not None and score_b is not None:
            if score_a > score_b:
                winner = "A"
                wins_a += 1
            elif score_b > score_a:
                winner = "B"
                wins_b += 1
            else:
                winner = "TIE"
                ties += 1
        else:
            winner = "TIE"
            ties += 1

        comparison_items.append(
            EvalCompareItem(
                dataset_item_id=item.id,
                input=item.input,
                expected_output=item.expected_output,
                score_a=score_a,
                score_b=score_b,
                winner=winner,
            )
        )

    return EvalCompareResponse(
        run_a=EvalRunResponse.model_validate(run_a),
        run_b=EvalRunResponse.model_validate(run_b),
        total_items=len(dataset_items),
        wins_a=wins_a,
        wins_b=wins_b,
        ties=ties,
        items=comparison_items,
    )


@router.get("/{eval_run_id}", response_model=EvalRunResponse)
async def get_eval_run(
    eval_run_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve the status and aggregate scores of an evaluation run."""
    res = await db.execute(select(EvalRun).where(EvalRun.id == eval_run_id))
    eval_run = res.scalar_one_or_none()
    if not eval_run:
        raise HTTPException(status_code=404, detail="Evaluation run not found.")
    return eval_run
