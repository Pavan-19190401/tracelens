"""Unit tests for @trace decorator and trace_span context manager."""

import pytest

from tracelens import get_current_span, init, trace


@pytest.fixture(autouse=True)
def setup_test_client():
    client = init(api_key="test-key", endpoint="http://mock-endpoint", enabled=False)
    yield client
    client.shutdown()


def test_sync_trace_decorator():
    """Verify sync function decoration, argument capture and return value capture."""
    last_span = None

    @trace(name="calculate_sum", kind="tool", tags=["math", "test"])
    def add(a: int, b: int) -> int:
        nonlocal last_span
        last_span = get_current_span()
        return a + b

    result = add(10, 25)
    assert result == 35
    assert last_span is not None
    assert last_span.name == "calculate_sum"
    assert last_span.span_kind == "tool"
    assert last_span.status == "SUCCESS"
    assert last_span.tags == ["math", "test"]
    assert last_span.input == {"args": [10, 25], "kwargs": {}}
    assert last_span.output == 35


@pytest.mark.asyncio
async def test_async_trace_decorator():
    """Verify async function decoration."""
    last_span = None

    @trace(name="async_fetch", kind="retrieval")
    async def fetch_data(key: str):
        nonlocal last_span
        last_span = get_current_span()
        return {"data": f"value_for_{key}"}

    res = await fetch_data("doc_1")
    assert res == {"data": "value_for_doc_1"}
    assert last_span is not None
    assert last_span.name == "async_fetch"
    assert last_span.span_kind == "retrieval"
    assert last_span.output == {"data": "value_for_doc_1"}


def test_nested_decorators():
    """Verify that calling a decorated function from inside another creates a child span."""
    inner_parent_id = None
    outer_id = None

    @trace(name="inner_tool", kind="tool")
    def inner_tool():
        nonlocal inner_parent_id
        span = get_current_span()
        inner_parent_id = span.parent_span_id
        return "tool_output"

    @trace(name="outer_workflow", kind="agent")
    def outer_workflow():
        nonlocal outer_id
        span = get_current_span()
        outer_id = span.id
        return inner_tool()

    res = outer_workflow()
    assert res == "tool_output"
    assert inner_parent_id == outer_id
