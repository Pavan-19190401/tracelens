"""Per-API-key sliding window rate limiter."""

import time
from collections import defaultdict

from fastapi import HTTPException, status
from tracelens.backend.app.core.config import settings

_request_timestamps: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(
    key_identifier: str, limit_per_minute: int = settings.RATE_LIMIT_PER_MINUTE
) -> None:
    """Check if the given API key has exceeded its per-minute rate limit."""
    now = time.time()
    window_start = now - 60.0

    # Prune timestamps older than 60s
    timestamps = [ts for ts in _request_timestamps[key_identifier] if ts > window_start]
    if len(timestamps) >= limit_per_minute:
        retry_after = int(60.0 - (now - timestamps[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: {limit_per_minute} requests/minute.",
            headers={"Retry-After": str(max(1, retry_after))},
        )

    timestamps.append(now)
    _request_timestamps[key_identifier] = timestamps
