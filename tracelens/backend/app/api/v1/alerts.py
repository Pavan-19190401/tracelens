"""Alert rules and event management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.api.deps import get_current_user
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.models.alert import AlertEvent, AlertRule
from tracelens.backend.app.models.project import User
from tracelens.backend.app.schemas import (
    AlertEventResponse,
    AlertRuleCreate,
    AlertRuleResponse,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List alert rules for a project."""
    res = await db.execute(
        select(AlertRule)
        .where(AlertRule.project_id == project_id)
        .order_by(AlertRule.created_at.desc())
    )
    return res.scalars().all()


@router.post(
    "/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED
)
async def create_alert_rule(
    project_id: str = Query(...),
    payload: AlertRuleCreate = ...,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new threshold alert rule (cost_per_hour, error_rate, p95_latency)."""
    rule = AlertRule(
        project_id=project_id,
        name=payload.name,
        metric_type=payload.metric_type,
        threshold=payload.threshold,
        window_minutes=payload.window_minutes,
        webhook_url=payload.webhook_url,
        enabled=payload.enabled,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete an alert rule."""
    res = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found.")
    await db.delete(rule)
    await db.commit()


@router.get("/events", response_model=list[AlertEventResponse])
async def list_alert_events(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List triggered alert events history."""
    res = await db.execute(
        select(AlertEvent)
        .where(AlertEvent.project_id == project_id)
        .order_by(desc(AlertEvent.triggered_at))
    )
    return res.scalars().all()
