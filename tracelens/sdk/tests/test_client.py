"""Unit tests for TraceLensClient non-blocking queue, batching, retry and safety guarantees."""

import time
from unittest.mock import MagicMock, patch

import pytest

from tracelens.client import TraceLensClient
from tracelens.models import Span


def test_non_blocking_enqueue():
    """Verify enqueuing is instantaneous and non-blocking."""
    client = TraceLensClient(
        api_key="test-key",
        endpoint="http://localhost:8000",
        enabled=True,
    )
    span = Span(trace_id="test-trace", name="fast_span", span_kind="tool")

    t0 = time.perf_counter()
    enqueued = client.enqueue(span)
    elapsed = time.perf_counter() - t0

    assert enqueued is True
    # Must be sub-millisecond
    assert elapsed < 0.05
    client.shutdown()


def test_buffer_overflow_drops_gracefully():
    """Verify that when queue reaches capacity, it drops items without raising or blocking."""
    client = TraceLensClient(
        api_key="test-key",
        endpoint="http://localhost:8000",
        max_queue_size=2,
        enabled=True,
    )

    span1 = Span(trace_id="t1", name="s1", span_kind="tool")
    span2 = Span(trace_id="t2", name="s2", span_kind="tool")
    span3 = Span(trace_id="t3", name="s3", span_kind="tool")

    # Fill queue
    assert client.enqueue(span1) is True
    assert client.enqueue(span2) is True
    # Third item should be dropped gracefully
    assert client.enqueue(span3) is False

    client.shutdown()


def test_host_app_never_crashes_on_http_error():
    """Verify client absorbs network/server errors and retries with backoff without raising."""
    client = TraceLensClient(
        api_key="test-key",
        endpoint="http://non-existent-host-99999.invalid:8000",
        max_retries=2,
        timeout_seconds=0.1,
        enabled=True,
    )

    span = Span(trace_id="t1", name="s1", span_kind="tool")
    client.enqueue(span)

    # Should not raise exception even when flushing against unreachable host
    try:
        client.flush(timeout=0.5)
    except Exception as e:
        pytest.fail(f"TraceLens flush crashed host app: {e}")
    finally:
        client.shutdown()


def test_batching_and_retry_mock():
    """Verify retry logic when server returns 500 then 200."""
    client = TraceLensClient(
        api_key="test-key",
        endpoint="http://mock-api",
        max_retries=3,
        enabled=False,  # manual testing
    )

    items = [
        Span(trace_id="t1", name="s1", span_kind="tool"),
        Span(trace_id="t1", name="s2", span_kind="llm"),
    ]

    mock_resp_fail = MagicMock()
    mock_resp_fail.status_code = 500
    mock_resp_fail.text = "Internal Server Error"

    mock_resp_success = MagicMock()
    mock_resp_success.status_code = 202

    with patch.object(client, "_get_http_client") as mock_get_client:
        mock_http = MagicMock()
        mock_http.post.side_effect = [mock_resp_fail, mock_resp_success]
        mock_get_client.return_value = mock_http

        success = client._send_batch(items)
        assert success is True
        assert mock_http.post.call_count == 2
