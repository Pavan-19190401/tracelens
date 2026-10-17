"""Seed script: populates demo project with 200 realistic traces, spans, prompts, and datasets."""

import asyncio
import random
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

# Add project root to python path
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from tracelens.backend.app.core.database import AsyncSessionLocal, engine
from tracelens.backend.app.core.security import hash_api_key, hash_password
from tracelens.backend.app.models.alert import AlertRule
from tracelens.backend.app.models.base import Base
from tracelens.backend.app.models.dataset import Dataset, DatasetItem
from tracelens.backend.app.models.project import ApiKey, Project, User
from tracelens.backend.app.models.prompt import PromptVersion
from tracelens.backend.app.models.trace import Span, Trace
from tracelens.sdk.src.tracelens.pricing import calculate_cost

MODELS = [
    ("gpt-4o", "openai"),
    ("gpt-4o-mini", "openai"),
    ("claude-3-5-sonnet-20241022", "anthropic"),
    ("claude-3-5-haiku-20241022", "anthropic"),
    ("gemini-1.5-flash", "google"),
]

SAMPLE_QUERIES = [
    "How do I upgrade to the Enterprise annual billing plan?",
    "Why was my credit card charged twice this month?",
    "Can you generate an API key with read-only permissions for our staging cluster?",
    "Where do I configure webhooks for real-time alerting?",
    "What is the token limit for gpt-4o chat completions?",
    "My embeddings search is returning 429 rate limit errors.",
    "Can we self-host TraceLens in our VPC on Kubernetes?",
    "How do I export my evaluation datasets to CSV format?",
    "Does TraceLens support streaming chat completions?",
    "How to set up automated Slack notifications for high error rate alerts?",
]

SAMPLE_ERRORS = [
    "openai.RateLimitError: Rate limit exceeded (429): TPM quota reached.",
    "anthropic.APIStatusError: Overloaded error (529): Engine capacity reached.",
    "TimeoutError: Retrieval tool postgres_vector_search timed out after 3000ms.",
    "ValueError: Prompt token count 128400 exceeds context window 128000.",
]


async def seed_demo_data():
    print("[Seed] Starting demo seeding...")

    async with AsyncSessionLocal() as session:
        # 1. Create Demo User
        user_res = await session.execute(
            select(User).where(User.email == "demo@tracelens.dev")
        )
        user = user_res.scalar_one_or_none()
        if not user:
            user = User(
                email="demo@tracelens.dev",
                hashed_password=hash_password("password123"),
                full_name="Demo Engineer",
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print("[Seed] Created demo user: demo@tracelens.dev")

        # 2. Create Demo Project
        proj_res = await session.execute(
            select(Project).where(Project.slug == "support-agent")
        )
        project = proj_res.scalar_one_or_none()
        if not project:
            project = Project(
                name="Customer Support & Billing Agent",
                slug="support-agent",
                description="Production LLM support agent with retrieval tools and multi-model routing.",
            )
            session.add(project)
            await session.commit()
            await session.refresh(project)
            print("[Seed] Created demo project: support-agent")

        # 3. Create Demo API Key
        raw_key = "tl_live_demo1234567890abcdef1234567890abcdef"
        key_hash = hash_api_key(raw_key)
        key_res = await session.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash)
        )
        if not key_res.scalar_one_or_none():
            api_key = ApiKey(
                project_id=project.id,
                name="Production SDK Key",
                key_prefix=raw_key[:12],
                key_hash=key_hash,
            )
            session.add(api_key)
            await session.commit()
            print("[Seed] Created demo API key")

        # 4. Create Prompt Versions
        pv_res = await session.execute(
            select(PromptVersion).where(PromptVersion.project_id == project.id)
        )
        if not pv_res.first():
            pv1 = PromptVersion(
                project_id=project.id,
                name="support_system_prompt",
                version=1,
                template="You are a helpful customer support agent. Query: {{query}}",
                variables=["query"],
                commit_message="Initial support prompt template",
            )
            pv2 = PromptVersion(
                project_id=project.id,
                name="support_system_prompt",
                version=2,
                template="You are an expert customer support agent for TraceLens. Answer concisely, verify billing facts, and suggest next steps. Query: {{query}} Context: {{context}}",
                variables=["query", "context"],
                commit_message="Add context injection and concise tone instructions",
            )
            session.add_all([pv1, pv2])

        # 5. Create Dataset & Items
        ds_res = await session.execute(
            select(Dataset).where(Dataset.project_id == project.id)
        )
        dataset = ds_res.scalar_one_or_none()
        if not dataset:
            dataset = Dataset(
                project_id=project.id,
                name="Support Q&A Benchmark",
                description="Standard test questions for billing and setup help.",
            )
            session.add(dataset)
            await session.commit()
            await session.refresh(dataset)

            for i, q in enumerate(SAMPLE_QUERIES):
                item = DatasetItem(
                    dataset_id=dataset.id,
                    input={"query": q},
                    expected_output={
                        "relevant_section": "settings/billing"
                        if "billing" in q
                        else "docs/setup"
                    },
                )
                session.add(item)

        # 6. Create Alert Rules
        ar_res = await session.execute(
            select(AlertRule).where(AlertRule.project_id == project.id)
        )
        if not ar_res.first():
            r1 = AlertRule(
                project_id=project.id,
                name="High Error Rate (> 5%)",
                metric_type="error_rate",
                threshold=5.0,
                window_minutes=5,
                webhook_url="https://hooks.slack.com/services/mock/alert",
            )
            r2 = AlertRule(
                project_id=project.id,
                name="High Latency Alert (p95 > 2500ms)",
                metric_type="p95_latency",
                threshold=2500.0,
                window_minutes=5,
            )
            session.add_all([r1, r2])

        # 7. Seed 200 Realistic Traces and Nested Spans
        existing_traces = await session.execute(
            select(Trace).where(Trace.project_id == project.id).limit(5)
        )
        if not existing_traces.first():
            now = datetime.now(UTC)
            for i in range(200):
                # Spread across last 7 days
                time_offset_hours = random.uniform(0.1, 168.0)
                start_dt = now - timedelta(hours=time_offset_hours)

                is_error = random.random() < 0.08  # 8% error rate
                query_text = random.choice(SAMPLE_QUERIES)
                model_name, provider = random.choice(MODELS)

                prompt_toks = random.randint(180, 1400)
                comp_toks = 0 if is_error else random.randint(40, 550)
                tot_toks = prompt_toks + comp_toks
                cost = calculate_cost(model_name, prompt_toks, comp_toks)

                duration_ms = (
                    random.uniform(350.0, 3200.0)
                    if not is_error
                    else random.uniform(80.0, 800.0)
                )
                end_dt = start_dt + timedelta(milliseconds=duration_ms)

                trace_id = str(uuid.uuid4())
                root_span_id = str(uuid.uuid4())
                retrieval_span_id = str(uuid.uuid4())
                llm_span_id = str(uuid.uuid4())

                trace_status = "ERROR" if is_error else "SUCCESS"
                err_msg = random.choice(SAMPLE_ERRORS) if is_error else None

                trace_obj = Trace(
                    id=trace_id,
                    project_id=project.id,
                    name="support_agent_workflow",
                    session_id=f"session-{random.randint(100, 999)}",
                    user_id=f"user-{random.randint(1000, 9999)}",
                    start_time=start_dt,
                    end_time=end_dt,
                    latency_ms=round(duration_ms, 2),
                    status=trace_status,
                    status_message=err_msg,
                    input={"query": query_text},
                    output=None
                    if is_error
                    else {"answer": f"Processed answer for: {query_text[:40]}..."},
                    total_tokens=tot_toks,
                    prompt_tokens=prompt_toks,
                    completion_tokens=comp_toks,
                    cost_usd=cost,
                    metadata_={"version": "1.2.0", "client": "web-widget"},
                    tags=["prod", "support", model_name],
                    created_at=start_dt,
                )
                session.add(trace_obj)

                # Root Agent Span
                root_span = Span(
                    id=root_span_id,
                    trace_id=trace_id,
                    parent_span_id=None,
                    project_id=project.id,
                    name="support_orchestrator",
                    span_kind="agent",
                    start_time=start_dt,
                    end_time=end_dt,
                    latency_ms=round(duration_ms, 2),
                    status=trace_status,
                    status_message=err_msg,
                    input={"query": query_text},
                    output=trace_obj.output,
                    created_at=start_dt,
                )
                session.add(root_span)

                # Retrieval Tool Child Span
                retrieval_duration = random.uniform(80.0, 350.0)
                retrieval_start = start_dt + timedelta(milliseconds=20.0)
                retrieval_end = retrieval_start + timedelta(
                    milliseconds=retrieval_duration
                )
                retrieval_span = Span(
                    id=retrieval_span_id,
                    trace_id=trace_id,
                    parent_span_id=root_span_id,
                    project_id=project.id,
                    name="knowledge_base_retriever",
                    span_kind="retrieval",
                    start_time=retrieval_start,
                    end_time=retrieval_end,
                    latency_ms=round(retrieval_duration, 2),
                    status="SUCCESS",
                    input={"search_term": query_text[:30]},
                    output={"matches": 3, "top_doc": "kb_article_419"},
                    created_at=retrieval_start,
                )
                session.add(retrieval_span)

                # LLM Call Child Span
                llm_start = retrieval_end + timedelta(milliseconds=10.0)
                llm_duration = duration_ms - (retrieval_duration + 30.0)
                llm_end = llm_start + timedelta(milliseconds=max(50.0, llm_duration))
                llm_span = Span(
                    id=llm_span_id,
                    trace_id=trace_id,
                    parent_span_id=root_span_id,
                    project_id=project.id,
                    name=f"{provider}.chat_completion",
                    span_kind="llm",
                    start_time=llm_start,
                    end_time=llm_end,
                    latency_ms=round(max(50.0, llm_duration), 2),
                    status=trace_status,
                    status_message=err_msg,
                    input={"messages": [{"role": "user", "content": query_text}]},
                    output=trace_obj.output,
                    model=model_name,
                    model_provider=provider,
                    prompt_tokens=prompt_toks,
                    completion_tokens=comp_toks,
                    total_tokens=tot_toks,
                    cost_usd=cost,
                    created_at=llm_start,
                )
                session.add(llm_span)

            await session.commit()
            print(
                "Successfully seeded 200 realistic traces with multi-level span trees!"
            )
        else:
            print("Demo data already present in database.")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
