"""Load testing script for TraceLens ingestion engine.

Simulates high-throughput production workloads by ingesting 10,000 spans in batches to /v1/ingest.
Reports:
- Total execution time
- Ingestion throughput (spans/second & requests/second)
- Latency statistics (min, p50, p90, p95, p99, max in ms)
"""

import asyncio
import os
import sys
import time

import httpx

# Ensure local packages can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tracelens.backend.app.core.database import AsyncSessionLocal, engine
from tracelens.backend.app.core.security import hash_api_key
from tracelens.backend.app.main import app
from tracelens.backend.app.models.base import Base
from tracelens.backend.app.models.project import ApiKey, Project


async def setup_load_test_project() -> str:
    """Provision a dedicated project and API key for the load check."""
    import uuid

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    raw_key = f"tl_live_load_test_{uuid.uuid4().hex[:12]}"
    async with AsyncSessionLocal() as session:
        proj = Project(name="Load Test Bench", slug=f"load-test-{int(time.time())}-{uuid.uuid4().hex[:6]}")
        session.add(proj)
        await session.commit()
        await session.refresh(proj)

        key = ApiKey(
            project_id=proj.id,
            name="load-key",
            key_hash=hash_api_key(raw_key),
            key_prefix="tl_live_load_test",
        )
        session.add(key)
        await session.commit()

    return raw_key


def generate_batch_payload(batch_index: int, spans_per_batch: int) -> dict:
    """Generate a realistic batch containing traces and spans."""
    traces = []
    spans = []

    # 1 trace per 10 spans
    traces_in_batch = max(1, spans_per_batch // 10)
    for t_idx in range(traces_in_batch):
        t_id = f"trc_load_{batch_index}_{t_idx}"
        traces.append({
            "id": t_id,
            "name": "load_benchmark_pipeline",
            "start_time": "2026-10-17T12:00:00Z",
            "status": "SUCCESS",
            "input": {"prompt": "Benchmark load test prompt"},
        })

    for s_idx in range(spans_per_batch):
        parent_t_id = f"trc_load_{batch_index}_{s_idx % traces_in_batch}"
        spans.append({
            "id": f"spn_load_{batch_index}_{s_idx}",
            "trace_id": parent_t_id,
            "name": "benchmark_llm_call",
            "span_kind": "llm",
            "start_time": "2026-10-17T12:00:00Z",
            "latency_ms": 12.5,
            "status": "SUCCESS",
            "model": "gpt-4o-mini",
            "tokens": {"prompt_tokens": 15, "completion_tokens": 10, "total_tokens": 25},
            "cost_usd": 0.000004,
        })

    return {"traces": traces, "spans": spans}


async def run_load_test(total_spans: int = 10000, spans_per_batch: int = 100, concurrency: int = 10):
    total_batches = total_spans // spans_per_batch
    print("===========================================================")
    print("  TraceLens Ingestion Engine Load Benchmark")
    print(f"  Total Spans:       {total_spans:,}")
    print(f"  Spans / Batch:     {spans_per_batch}")
    print(f"  Total Batches:     {total_batches}")
    print(f"  Concurrency:       {concurrency} concurrent workers")
    print("===========================================================")

    api_key = await setup_load_test_project()

    transport = httpx.ASGITransport(app=app)
    latencies: list[float] = []

    queue = asyncio.Queue()
    for i in range(total_batches):
        queue.put_nowait((i, generate_batch_payload(i, spans_per_batch)))

    start_wall_time = time.perf_counter()

    async def worker():
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            while not queue.empty():
                try:
                    _, payload = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                req_start = time.perf_counter()
                res = await client.post(
                    "/v1/ingest",
                    json=payload,
                    headers={"X-API-Key": api_key},
                )
                req_latency_ms = (time.perf_counter() - req_start) * 1000.0

                if res.status_code in (200, 202):
                    latencies.append(req_latency_ms)
                else:
                    print(f"Ingest error: {res.status_code} - {res.text}")

                queue.task_done()

    workers = [asyncio.create_task(worker()) for _ in range(concurrency)]
    await asyncio.gather(*workers)

    total_time_sec = time.perf_counter() - start_wall_time
    throughput_spans_sec = total_spans / total_time_sec
    throughput_reqs_sec = total_batches / total_time_sec

    latencies.sort()
    n = len(latencies)
    p50 = latencies[int(n * 0.50)] if n else 0
    p90 = latencies[int(n * 0.90)] if n else 0
    p95 = latencies[int(n * 0.95)] if n else 0
    p99 = latencies[int(n * 0.99)] if n else 0
    min_lat = latencies[0] if n else 0
    max_lat = latencies[-1] if n else 0

    print("\n---------------- LOAD TEST RESULTS ----------------")
    print(f"Successful Requests:  {len(latencies)} / {total_batches}")
    print(f"Total Spans Ingested: {total_spans:,}")
    print(f"Wall Clock Time:      {total_time_sec:.3f} seconds")
    print(f"Throughput (Spans):   {throughput_spans_sec:,.1f} spans/sec")
    print(f"Throughput (Batches): {throughput_reqs_sec:,.1f} requests/sec")
    print("\nLatency Metrics (/v1/ingest):")
    print(f"  Min:                {min_lat:.2f} ms")
    print(f"  p50 (Median):       {p50:.2f} ms")
    print(f"  p90:                {p90:.2f} ms")
    print(f"  p95:                {p95:.2f} ms")
    print(f"  p99:                {p99:.2f} ms")
    print(f"  Max:                {max_lat:.2f} ms")
    print("---------------------------------------------------\n")

    return {
        "total_spans": total_spans,
        "total_time_sec": total_time_sec,
        "throughput_spans_sec": throughput_spans_sec,
        "p50_latency_ms": p50,
        "p95_latency_ms": p95,
        "p99_latency_ms": p99,
    }


if __name__ == "__main__":
    asyncio.run(run_load_test(total_spans=10000, spans_per_batch=100, concurrency=10))
