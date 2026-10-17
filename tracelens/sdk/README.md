# TraceLens Python SDK

Official Python SDK for TraceLens: open-source observability, tracing, and evaluations for LLM applications.

## Quickstart

```python
import tracelens

# 1. Initialize client
tracelens.init(api_key="tl_live_...", endpoint="http://localhost:8000")

# 2. Add trace decorator
@tracelens.trace(kind="agent")
def run_agent(query: str):
    # Your agent logic here
    return "result"
```
