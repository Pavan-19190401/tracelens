# TraceLens Python SDK Guide

The `tracelens` Python SDK allows developers to instrument LLM applications with nested distributed traces, capture latency and token consumption, calculate USD model costs, and stream records to TraceLens with non-blocking background queueing.

---

## 1. Quickstart (2 Lines of Code)

Install the SDK via PyPI:
```bash
pip install tracelens
```

Add two lines to initialize and wrap your application:
```python
import tracelens

# 1. Initialize client (or set TRACELENS_API_KEY & TRACELENS_ENDPOINT env vars)
tracelens.init(api_key="tl_live_your_api_key", endpoint="http://localhost:8000")

# 2. Decorate any sync or async function
@tracelens.trace(name="customer_support_pipeline", kind="agent")
def handle_support_query(query: str):
    return "Your return request has been processed successfully."
```

---

## 2. Decorators & Context Managers

### `@trace` Decorator
The `@trace` decorator instruments entire function calls. It captures arguments, returns values, catches and records uncaught exceptions, and measures latency.

```python
from tracelens import trace

@trace(name="vector_similarity_search", kind="retrieval")
def search_embeddings(query_vector: list[float], top_k: int = 5):
    # Vector DB lookup...
    return [{"id": "doc_1", "score": 0.94}]

@trace(name="generate_sql_query", kind="llm", model="gpt-4o")
async def generate_sql(nl_prompt: str) -> str:
    # Async LLM call...
    return "SELECT * FROM users WHERE active = true;"
```

#### Parameters:
- `name` (*str*, optional): The span name in the dashboard timeline. Defaults to function name.
- `kind` (*SpanKind*, default `"agent"`): One of `"agent"`, `"llm"`, `"tool"`, `"retrieval"`.
- `model` (*str*, optional): Name of the LLM model (e.g. `"gpt-4o"`, `"claude-3-5-sonnet-20241022"`).
- `capture_input` (*bool*, default `True`): Whether to serialize arguments into the span input.
- `capture_output` (*bool*, default `True`): Whether to serialize the return value into the span output.
- `tags` (*list[str]*, optional): Categorical tags (e.g. `["production", "copilot"]`).
- `metadata` (*dict*, optional): Arbitrary key-value metadata.

---

### `trace_span` Context Manager
For fine-grained block scoping inside complex pipelines:

```python
from tracelens import trace_span

def execute_agent_loop(user_input: str):
    with trace_span("planning_phase", kind="agent") as span:
        plan = create_step_plan(user_input)
        span.set_metadata({"step_count": len(plan)})

    for step in plan:
        with trace_span(f"execute_step_{step.id}", kind="tool") as tool_span:
            result = run_tool(step)
            tool_span.output = result
```

Async contexts are also natively supported:
```python
async with trace_span("streaming_chat", kind="llm", model="gpt-4o") as span:
    response = await call_openai_stream()
    span.set_token_usage(prompt_tokens=150, completion_tokens=80)
```

---

## 3. Auto-Instrumentation (OpenAI & Anthropic)

TraceLens provides automatic instrumentation hooks that wrap LLM provider client instances without manual span creation.

### OpenAI Auto-Instrumentation
```python
import openai
from tracelens import init, wrap_openai

init(api_key="tl_live_...")
client = openai.OpenAI()
wrapped_client = wrap_openai(client)

# Every client.chat.completions.create call automatically generates an 'llm' span!
response = wrapped_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain quantum entanglement in 1 sentence."}],
)
```

### Anthropic Auto-Instrumentation
```python
import anthropic
from tracelens import init, wrap_anthropic

init(api_key="tl_live_...")
client = anthropic.Anthropic()
wrapped_client = wrap_anthropic(client)

# Automatically extracts input tokens, output tokens, latency, and cost!
message = wrapped_client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Draft a follow-up email."}],
)
```

---

## 4. Cost Calculation & Pricing Table

TraceLens ships with a local pricing database (`pricing.json`) defining input and output rates per 1,000,000 tokens across all popular models:

| Model ID | Input Price / 1M | Output Price / 1M |
| :--- | :--- | :--- |
| `gpt-4o` | \$2.50 | \$10.00 |
| `gpt-4o-mini` | \$0.15 | \$0.60 |
| `claude-3-5-sonnet-20241022` | \$3.00 | \$15.00 |
| `claude-3-haiku-20240307` | \$0.25 | \$1.25 |
| `gemini-1.5-pro` | \$3.50 | \$10.50 |
| `gemini-1.5-flash` | \$0.075 | \$0.30 |

You can calculate costs directly using:
```python
from tracelens import calculate_cost

cost_usd = calculate_cost("gpt-4o", prompt_tokens=220, completion_tokens=75)
# Returns 0.0013 ($0.0013)
```

---

## 5. Non-Blocking Delivery & Resilience

The SDK is engineered for zero latency impact on host applications:
- **In-Memory Queue**: Calls to `@trace` enqueue spans onto a thread-safe in-memory buffer in under 0.1ms.
- **Background Worker**: A daemon thread flushes batches every `flush_interval_seconds` (default: 2.0s) or when `batch_size` is reached (default: 50).
- **Exponential Backoff**: If network or backend errors occur, the SDK retries with backoff and will **never crash** or block application business logic.
- **Graceful Shutdown**: Call `tracelens.flush()` or `tracelens.shutdown()` during application teardown to guarantee all spans are delivered.
