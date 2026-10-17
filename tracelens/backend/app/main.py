"""FastAPI main application entrypoint for TraceLens backend."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from tracelens.backend.app.api.v1.alerts import router as alerts_router
from tracelens.backend.app.api.v1.auth import router as auth_router
from tracelens.backend.app.api.v1.datasets import router as datasets_router
from tracelens.backend.app.api.v1.evals import router as evals_router
from tracelens.backend.app.api.v1.ingest import router as ingest_router
from tracelens.backend.app.api.v1.metrics import router as metrics_router
from tracelens.backend.app.api.v1.projects import router as projects_router
from tracelens.backend.app.api.v1.prompts import router as prompts_router
from tracelens.backend.app.api.v1.traces import router as traces_router
from tracelens.backend.app.core.config import settings
from tracelens.backend.app.core.database import AsyncSessionLocal, engine
from tracelens.backend.app.core.redis import get_redis_client
from tracelens.backend.app.models.base import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tracelens.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("TraceLens backend started with tables verified.")
    yield
    # Shutdown
    await engine.dispose()
    logger.info("TraceLens backend stopped.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Open-source tracing and evaluation platform for LLM applications.",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint checking DB and Redis connectivity."""
    db_ok = False
    redis_ok = False

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception as e:
        logger.error("DB health check failed: %s", e)

    try:
        redis_client = await get_redis_client()
        if redis_client is not None:
            await redis_client.ping()
            redis_ok = True
        else:
            redis_ok = True  # Fallback in-memory active
    except Exception as e:
        logger.error("Redis health check failed: %s", e)

    return {
        "status": "healthy" if db_ok else "unhealthy",
        "database": db_ok,
        "redis": redis_ok,
        "version": "0.1.0",
    }


# Include V1 Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(ingest_router, prefix=settings.API_V1_STR)
app.include_router(traces_router, prefix=settings.API_V1_STR)
app.include_router(metrics_router, prefix=settings.API_V1_STR)
app.include_router(prompts_router, prefix=settings.API_V1_STR)
app.include_router(datasets_router, prefix=settings.API_V1_STR)
app.include_router(evals_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
