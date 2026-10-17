"""Unit tests for TraceLens context management and nesting across sync and async contexts."""

import asyncio

import pytest

from tracelens import get_current_span, init, trace, trace_span


@pytest.fixture(autouse=True)
def setup_test_client():
    # Initialize with non-network client for tests
    client = init(api_key="test-key", endpoint="http://mock-endpoint", enabled=False)
    yield client
    client.shutdown()


def test_sync_nested_spans():
    """Verify parent-child span linkage in nested synchronous calls."""
    captured_spans = []

    with trace_span("parent_agent", kind="agent") as parent:
        captured_spans.append(parent)
        assert get_current_span() is parent
        assert parent.parent_span_id is None

        with trace_span("retrieval_tool", kind="retrieval") as child:
            captured_spans.append(child)
            assert get_current_span() is child
            assert child.parent_span_id == parent.id

            with trace_span("llm_call", kind="llm") as grandchild:
                captured_spans.append(grandchild)
                assert get_current_span() is grandchild
                assert grandchild.parent_span_id == child.id

        assert get_current_span() is parent

    assert get_current_span() is None
    assert captured_spans[0].name == "parent_agent"
    assert captured_spans[1].parent_span_id == captured_spans[0].id
    assert captured_spans[2].parent_span_id == captured_spans[1].id


@pytest.mark.asyncio
async def test_async_nested_spans_concurrent():
    """Verify concurrent async tasks maintain isolated span contexts without cross-talk."""
    parent_id = None
    child_spans = []

    @trace(name="child_worker", kind="tool")
    async def worker(idx: int):
        current = get_current_span()
        assert current is not None
        child_spans.append((idx, current.id, current.parent_span_id))
        await asyncio.sleep(0.01)
        return idx * 2

    async with trace_span("root_orchestrator", kind="agent") as root:
        parent_id = root.id
        results = await asyncio.gather(worker(1), worker(2), worker(3))
        assert results == [2, 4, 6]

    assert len(child_spans) == 3
    for idx, cid, pid in child_spans:
        assert pid == parent_id
        assert cid != parent_id


def test_error_capture_and_propagation():
    """Verify exceptions are captured in span status and re-raised intact."""
    captured_span = None

    class CustomDomainException(Exception):
        pass

    try:
        with trace_span("failing_tool", kind="tool") as span:
            captured_span = span
            raise CustomDomainException("Database connection timeout")
    except CustomDomainException as e:
        assert str(e) == "Database connection timeout"

    assert captured_span is not None
    assert captured_span.status == "ERROR"
    assert "Database connection timeout" in (captured_span.status_message or "")
    assert captured_span.latency_ms is not None
    assert captured_span.latency_ms >= 0
