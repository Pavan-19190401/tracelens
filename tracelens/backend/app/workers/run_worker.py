"""Combined background worker runner for TraceLens (persister + alerter)."""

import asyncio
import logging

from tracelens.backend.app.workers.alerter import run_alerter_loop
from tracelens.backend.app.workers.persister import run_persister_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("tracelens.worker")


async def main():
    logger.info("Starting TraceLens combined background worker (persister + alerter)...")
    await asyncio.gather(
        run_persister_loop(),
        run_alerter_loop(interval_seconds=60.0),
    )


if __name__ == "__main__":
    asyncio.run(main())
