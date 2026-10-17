"""Alert evaluation worker checking rolling metrics and dispatching webhooks."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tracelens.backend.app.core.database import AsyncSessionLocal
from tracelens.backend.app.models.alert import AlertEvent, AlertRule
from tracelens.backend.app.models.trace import Trace

logger = logging.getLogger("tracelens.alerter")


async def dispatch_webhook(webhook_url: str, rule_name: str, metric_type: str, value: float, threshold: float) -> bool:
    """Post an alert notification card to a Slack/Discord compatible webhook."""
    if not webhook_url:
        return False

    card = {
        "text": f"🚨 *TraceLens Alert Triggered: {rule_name}*",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"🚨 TraceLens Alert: {rule_name}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Metric:* `{metric_type}`"},
                    {"type": "mrkdwn", "text": f"*Triggered Value:* `{value}`"},
                    {"type": "mrkdwn", "text": f"*Configured Threshold:* `{threshold}`"},
                    {"type": "mrkdwn", "text": f"*Timestamp:* `{datetime.now(timezone.utc).isoformat()}`"},
                ],
            },
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(webhook_url, json=card)
            return res.status_code in (200, 204)
    except Exception as e:
        logger.warning("Failed to dispatch alert webhook to %s: %s", webhook_url, e)
        return False


async def evaluate_rule(rule: AlertRule, session: AsyncSession) -> Optional[AlertEvent]:
    """Evaluate a single alert rule against its rolling time window."""
    window_minutes = rule.window_minutes or 5
    since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

    traces_res = await session.execute(
        select(Trace.status, Trace.latency_ms, Trace.cost_usd)
        .where(Trace.project_id == rule.project_id, Trace.created_at >= since)
    )
    rows = traces_res.all()
    if not rows:
        return None

    triggered = False
    metric_value = 0.0

    if rule.metric_type == "error_rate":
        errors = sum(1 for stat, _, _ in rows if stat == "ERROR")
        total = len(rows)
        metric_value = round((errors / total) * 100.0, 2)
        triggered = metric_value > rule.threshold

    elif rule.metric_type == "p95_latency":
        latencies = sorted([lat for _, lat, _ in rows if lat is not None])
        if latencies:
            n = len(latencies)
            p95 = latencies[min(int(n * 0.95), n - 1)]
            metric_value = round(p95, 2)
            triggered = metric_value > rule.threshold

    elif rule.metric_type == "cost_per_hour":
        total_cost = sum(cost for _, _, cost in rows if cost)
        # Normalize to 1 hour rate
        cost_hourly_rate = total_cost * (60.0 / window_minutes)
        metric_value = round(cost_hourly_rate, 4)
        triggered = metric_value > rule.threshold

    if triggered:
        event = AlertEvent(
            alert_rule_id=rule.id,
            project_id=rule.project_id,
            metric_value=metric_value,
            threshold_value=rule.threshold,
            status="TRIGGERED",
            details={
                "metric_type": rule.metric_type,
                "window_minutes": window_minutes,
                "sample_count": len(rows),
            },
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)

        if rule.webhook_url:
            await dispatch_webhook(
                webhook_url=rule.webhook_url,
                rule_name=rule.name,
                metric_type=rule.metric_type,
                value=metric_value,
                threshold=rule.threshold,
            )

        return event

    return None


async def run_alert_check_cycle(run_once: bool = False) -> List[AlertEvent]:
    """Execute one check cycle evaluating all enabled alert rules."""
    events = []
    async with AsyncSessionLocal() as session:
        rules_res = await session.execute(
            select(AlertRule).where(AlertRule.enabled == True)
        )
        rules = rules_res.scalars().all()
        for rule in rules:
            try:
                ev = await evaluate_rule(rule, session)
                if ev:
                    events.append(ev)
            except Exception as e:
                logger.error("Error evaluating alert rule %s: %s", rule.id, e)

    return events


async def run_alerter_loop(interval_seconds: float = 60.0) -> None:
    """Continuous loop checking alert rules every minute."""
    logger.info("TraceLens alert evaluation worker started.")
    while True:
        try:
            await run_alert_check_cycle(run_once=True)
            await asyncio.sleep(interval_seconds)
        except Exception as e:
            logger.error("Alerter loop error: %s", e)
            await asyncio.sleep(5.0)
