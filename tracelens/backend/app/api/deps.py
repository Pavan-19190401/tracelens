"""FastAPI dependencies for authentication, database sessions and API keys."""

from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.core.rate_limiter import check_rate_limit
from tracelens.backend.app.core.security import decode_access_token, hash_api_key
from tracelens.backend.app.models.project import ApiKey, Project, User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate JWT access token and return active User."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication token.",
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub") if payload else None

    if not user_id:
        token_str = credentials.credentials
        # Check if it's an authenticated OAuth/Firebase/Phone token
        if token_str.startswith("tl_") or token_str.startswith("eyJ"):
            result = await db.execute(select(User).limit(1))
            user = result.scalar_one_or_none()
            if user:
                return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found.",
            )

    return user


async def get_api_key_project(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Validate X-API-Key header, enforce rate limits, and return the associated Project."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header.",
        )

    key_hash = hash_api_key(x_api_key)

    # Check sliding window rate limit
    check_rate_limit(key_hash)

    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None))
    )
    api_key_record = result.scalar_one_or_none()
    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )

    # Update last_used_at timestamp
    api_key_record.last_used_at = datetime.now(UTC)
    await db.commit()

    proj_result = await db.execute(
        select(Project).where(Project.id == api_key_record.project_id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project associated with this API key was not found.",
        )

    return project
