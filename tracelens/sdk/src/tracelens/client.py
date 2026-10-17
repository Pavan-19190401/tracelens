"""Client and background ingestion worker for TraceLens SDK."""

from __future__ import annotations

import atexit
import logging
import os
import queue
import threading
import time
from typing import Any

import httpx

from .models import IngestPayload, Span, Trace

logger = logging.getLogger("tracelens")

_DEFAULT_ENDPOINT = "http://localhost:8000"
_GLOBAL_CLIENT: TraceLensClient | None = None


class TraceLensClient:
    """Non-blocking TraceLens client for queuing and shipping traces and spans."""

    def __init__(
        self,
        api_key: str | None = None,
        endpoint: str | None = None,
        batch_size: int = 50,
        flush_interval_seconds: float = 1.0,
        max_queue_size: int = 10000,
        max_retries: int = 3,
        timeout_seconds: float = 5.0,
        enabled: bool = True,
    ) -> None:
        self.api_key = api_key or os.getenv("TRACELENS_API_KEY", "")
        self.endpoint = (endpoint or os.getenv("TRACELENS_ENDPOINT", _DEFAULT_ENDPOINT)).rstrip("/")
        self.batch_size = max(1, batch_size)
        self.flush_interval = max(0.1, flush_interval_seconds)
        self.max_retries = max_retries
        self.timeout = timeout_seconds
        self.enabled = enabled

        self._queue: queue.Queue[Any] = queue.Queue(maxsize=max_queue_size)
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: threading.Thread | None = None
        self._http_client: httpx.Client | None = None

        if self.enabled:
            self._start_worker()
            atexit.register(self.shutdown)

    def _start_worker(self) -> None:
        """Start the background flusher daemon thread."""
        with self._lock:
            if self._worker_thread is None or not self._worker_thread.is_alive():
                self._stop_event.clear()
                self._worker_thread = threading.Thread(
                    target=self._worker_loop,
                    name="tracelens-flusher-thread",
                    daemon=True,
                )
                self._worker_thread.start()

    def _get_http_client(self) -> httpx.Client:
        """Get or initialize the reusable HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            headers = {
                "User-Agent": "tracelens-python-sdk/0.1.0",
                "Content-Type": "application/json",
            }
            if self.api_key:
                headers["X-API-Key"] = self.api_key
            self._http_client = httpx.Client(
                timeout=self.timeout,
                headers=headers,
            )
        return self._http_client

    def enqueue(self, item: Trace | Span) -> bool:
        """Enqueue a trace or span non-blockingly.

        Returns True if enqueued, False if dropped due to full queue or disabled client.
        """
        if not self.enabled:
            return False

        try:
            self._queue.put_nowait(item)
            return True
        except queue.Full:
            logger.warning("TraceLens buffer full; dropping item to protect host app.")
            return False
        except Exception as e:
            logger.debug("Error enqueuing to TraceLens: %s", e)
            return False

    def _collect_batch(self, max_items: int) -> list[Any]:
        """Collect up to max_items from the queue."""
        batch = []
        for _ in range(max_items):
            try:
                item = self._queue.get_nowait()
                batch.append(item)
            except queue.Empty:
                break
        return batch

    def _send_batch(self, items: list[Any]) -> bool:
        """Send a batch of traces and spans to the backend /v1/ingest endpoint."""
        if not items:
            return True

        traces: list[Trace] = []
        spans: list[Span] = []

        for item in items:
            if isinstance(item, Trace):
                traces.append(item)
            elif isinstance(item, Span):
                spans.append(item)

        payload = IngestPayload(traces=traces, spans=spans)
        url = f"{self.endpoint}/v1/ingest"

        backoff = 0.5
        for attempt in range(1, self.max_retries + 1):
            try:
                client = self._get_http_client()
                response = client.post(url, content=payload.model_dump_json())
                if response.status_code in (200, 201, 202):
                    return True
                logger.warning(
                    "TraceLens ingest failed (attempt %d/%d) status %d: %s",
                    attempt,
                    self.max_retries,
                    response.status_code,
                    response.text,
                )
            except Exception as e:
                logger.warning(
                    "TraceLens ingest connection error (attempt %d/%d): %s",
                    attempt,
                    self.max_retries,
                    e,
                )

            if attempt < self.max_retries:
                time.sleep(backoff)
                backoff *= 2.0

        return False

    def _worker_loop(self) -> None:
        """Background loop continuously batching and sending data."""
        last_flush = time.time()
        while not self._stop_event.is_set():
            try:
                # Sleep briefly until flush interval or batch threshold
                time.sleep(min(0.2, self.flush_interval))
                now = time.time()
                should_flush = (
                    now - last_flush
                ) >= self.flush_interval or self._queue.qsize() >= self.batch_size
                if should_flush and not self._queue.empty():
                    batch = self._collect_batch(self.batch_size)
                    if batch:
                        self._send_batch(batch)
                        for _ in batch:
                            self._queue.task_done()
                    last_flush = time.time()
            except Exception as e:
                logger.debug("Unexpected error in TraceLens worker: %s", e)

        # Drain remaining on exit
        self._drain_remaining()

    def _drain_remaining(self) -> None:
        """Drain any remaining items in queue before shutdown."""
        while not self._queue.empty():
            batch = self._collect_batch(self.batch_size)
            if not batch:
                break
            self._send_batch(batch)
            for _ in batch:
                self._queue.task_done()

    def flush(self, timeout: float = 5.0) -> None:
        """Synchronously flush all queued events to the backend."""
        deadline = time.time() + timeout
        while not self._queue.empty() and time.time() < deadline:
            batch = self._collect_batch(self.batch_size)
            if batch:
                self._send_batch(batch)
                for _ in batch:
                    self._queue.task_done()
            else:
                break

    def shutdown(self) -> None:
        """Shut down the background flusher and close HTTP connections."""
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
        self._drain_remaining()
        with self._lock:
            if self._http_client and not self._http_client.is_closed:
                try:
                    self._http_client.close()
                except Exception:
                    pass
                self._http_client = None


def init(
    api_key: str | None = None,
    endpoint: str | None = None,
    batch_size: int = 50,
    flush_interval_seconds: float = 1.0,
    max_queue_size: int = 10000,
    enabled: bool = True,
) -> TraceLensClient:
    """Initialize the global TraceLens client."""
    global _GLOBAL_CLIENT
    if _GLOBAL_CLIENT is not None:
        _GLOBAL_CLIENT.shutdown()

    _GLOBAL_CLIENT = TraceLensClient(
        api_key=api_key,
        endpoint=endpoint,
        batch_size=batch_size,
        flush_interval_seconds=flush_interval_seconds,
        max_queue_size=max_queue_size,
        enabled=enabled,
    )
    return _GLOBAL_CLIENT


def get_client() -> TraceLensClient:
    """Get the active global TraceLens client, or create a default instance."""
    global _GLOBAL_CLIENT
    if _GLOBAL_CLIENT is None:
        _GLOBAL_CLIENT = TraceLensClient()
    return _GLOBAL_CLIENT


def flush(timeout: float = 5.0) -> None:
    """Flush pending traces on the global client."""
    client = get_client()
    client.flush(timeout=timeout)


def shutdown() -> None:
    """Shutdown the global client."""
    global _GLOBAL_CLIENT
    if _GLOBAL_CLIENT is not None:
        _GLOBAL_CLIENT.shutdown()
        _GLOBAL_CLIENT = None
