"""Redis connection and fallback in-memory ingestion buffer."""

import logging
from collections import deque

import redis.asyncio as aioredis
from tracelens.backend.app.core.config import settings

logger = logging.getLogger("tracelens.redis")

_redis_client: aioredis.Redis | None = None
_memory_queue: deque = deque()
_use_memory_fallback: bool = False


async def get_redis_client() -> aioredis.Redis | None:
    """Get or initialize async Redis client, falling back to memory queue if unavailable."""
    global _redis_client, _use_memory_fallback
    if _use_memory_fallback:
        return None

    if _redis_client is None and settings.REDIS_URL:
        try:
            client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
            )
            # Ping to verify connection
            await client.ping()
            _redis_client = client
        except Exception as e:
            logger.warning(
                "Redis unavailable (%s); using in-memory ingestion buffer.", e
            )
            _use_memory_fallback = True
            _redis_client = None

    return _redis_client


async def enqueue_ingest_item(item_json: str) -> bool:
    """Push an ingestion item onto the queue (Redis or memory buffer)."""
    client = await get_redis_client()
    if client is not None:
        try:
            await client.lpush(settings.REDIS_INGEST_KEY, item_json)
            return True
        except Exception as e:
            logger.warning("Redis lpush failed: %s; falling back to memory.", e)

    _memory_queue.append(item_json)
    return True


async def dequeue_ingest_batch(batch_size: int = 100) -> list[str]:
    """Pop up to batch_size items from queue (Redis or memory buffer)."""
    client = await get_redis_client()
    items: list[str] = []

    if client is not None:
        try:
            # Batch pop via pipeline
            pipe = client.pipeline()
            for _ in range(batch_size):
                pipe.rpop(settings.REDIS_INGEST_KEY)
            results = await pipe.execute()
            for res in results:
                if res is not None:
                    items.append(res)
            return items
        except Exception as e:
            logger.warning("Redis rpop failed: %s; draining from memory queue.", e)

    for _ in range(min(batch_size, len(_memory_queue))):
        if _memory_queue:
            items.append(_memory_queue.popleft())

    return items
