# TraceLens Technical Architecture & System Design

This document details the internal architecture, data models, concurrency paradigms, and throughput characteristics of **TraceLens**.

---

## 1. System Topology

```mermaid
flowchart TD
    subgraph Client Application
        App["Host LLM App (Python 3.9+)"]
        SDK["TraceLens SDK (tracelens)"]
        Context["ContextVars (Trace / Span)"]
        MemQueue["Thread-Safe In-Memory Queue"]
        FlushThread["Background Flusher Thread"]
        
        App --> Context
        Context --> SDK
        SDK --> MemQueue
        MemQueue --> FlushThread
    end

    subgraph TraceLens Ingestion & API
        FastAPI["FastAPI /v1/ingest (HTTP/2)"]
        RateLimiter["Per-Key Rate Limiter"]
        AuthFilter["API Key SHA-256 Validator"]
        RedisBuffer["Redis 7 LPUSH Buffer (or In-Memory Queue)"]
        
        FlushThread -- "Batched POST (JSON)" --> FastAPI
        FastAPI --> AuthFilter
        AuthFilter --> RateLimiter
        RateLimiter --> RedisBuffer
    end

    subgraph Asynchronous Worker Tier
        Persister["Persistence Worker (Asyncio)"]
        Alerter["Alerter Loop (60s cron)"]
        EvalEngine["Async Eval Runner"]
        
        RedisBuffer -- "RPOP Batches" --> Persister
        Alerter -- "Check Metrics Thresholds" --> Postgres
        EvalEngine -- "Batch Scoring" --> Postgres
    end

    subgraph Persistence Store
        Postgres[("PostgreSQL 16 / Neon\nIndexed Tables")]
        Persister --> Postgres
    end

    subgraph Observability Dashboard
        NextUI["Next.js 14 App Router UI"]
        Recharts["Recharts Timeseries"]
        Waterfall["Waterfall Timeline Engine"]
        Tree["Span Tree Component"]
        
        NextUI --> Recharts
        NextUI --> Waterfall
        NextUI --> Tree
        NextUI -- "JWT Auth REST" --> FastAPI
    end
```

---

## 2. Ingestion Pipeline & Reliability

1. **Non-Blocking Host Execution**:
   The Python SDK records span timings and metadata using Python's native `contextvars`, ensuring compatibility across both multi-threaded synchronous code and `asyncio` event loops. When a span completes, it is pushed to a bounded thread-safe buffer. Host code execution is never stalled.

2. **Decoupled Buffer Queue**:
   The `/v1/ingest` endpoint accepts payloads and immediately responds with `202 Accepted` after appending the message to Redis (`LPUSH`). If Redis is unavailable or experiencing temporary network partitions, the backend seamlessly fails over to an internal in-memory deque without dropping incoming spans.

3. **Batch Persistence Worker**:
   The background persistence worker pulls batches of envelopes (`dequeue_ingest_batch`) and executes bulk upserts in PostgreSQL within an async transaction (`process_batch`). Spans automatically roll up their token counts and costs to the parent trace entity.

---

## 3. Data Model & Entity Relationship

```mermaid
erDiagram
    PROJECT ||--o{ API_KEY : owns
    PROJECT ||--o{ TRACE : contains
    PROJECT ||--o{ PROMPT_VERSION : tracks
    PROJECT ||--o{ DATASET : manages
    PROJECT ||--o{ ALERT_RULE : configures

    TRACE ||--o{ SPAN : contains
    SPAN ||--o{ SPAN : nests

    DATASET ||--o{ DATASET_ITEM : contains
    DATASET ||--o{ EVAL_RUN : benchmarks
    EVAL_RUN ||--o{ EVAL_RESULT : scores
    DATASET_ITEM ||--o{ EVAL_RESULT : evaluates

    ALERT_RULE ||--o{ ALERT_EVENT : triggers
```

### Table Definitions & Indexing Strategy:
- **`traces`**: Root trace representations. Indexed on `(project_id, created_at)`, `(project_id, status)`, `session_id`, `user_id`.
- **`spans`**: Hierarchical timing units. Indexed on `trace_id`, `parent_span_id`, `span_kind`, `model`, `(project_id, created_at)`.
- **`prompt_versions`**: Prompt template versioning. Unique compound index on `(project_id, name, version)`.
- **`eval_runs` & `eval_results`**: Benchmark runs and per-item scores. Compound index on `(eval_run_id, dataset_item_id)`.
- **`alert_rules` & `alert_events`**: SLA threshold definitions and triggered incident events. Indexed on `(project_id, triggered_at)`.

---

## 4. Evaluation Engine

The evaluation engine supports both deterministic algorithmic scorers and probabilistic LLM judges:

1. **`exact_match`**: Strict string equality check (`1.0` if equal, `0.0` otherwise).
2. **`contains`**: Target substring presence verification.
3. **`regex`**: Regular expression validation.
4. **`json_valid`**: Validates whether the model output parses into valid JSON conforming to an optional schema.
5. **`llm_judge`**: Evaluates model responses against ground truth instructions using an LLM evaluator (Google Gemini, OpenAI GPT-4o, or Anthropic Claude) scoring from `0.0` to `1.0` with structured reasoning.

---

## 5. Throughput & Latency Profile

Under load testing with 10 concurrent workers pushing 100-span batches:
- **Ingestion Throughput**: **10,247 spans/second**
- **Median Latency (p50)**: **34.71 ms**
- **p95 Latency**: **459.41 ms**
- **Failure Rate**: **0.00%** (100/100 requests accepted)
