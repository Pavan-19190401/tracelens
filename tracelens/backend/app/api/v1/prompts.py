"""Prompt versioning and management endpoints."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.api.deps import get_current_user
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.models.project import User
from tracelens.backend.app.models.prompt import PromptVersion
from tracelens.backend.app.schemas import PromptVersionCreate, PromptVersionResponse

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("", response_model=list[PromptVersionResponse])
async def list_prompts(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all prompt versions for a project."""
    res = await db.execute(
        select(PromptVersion)
        .where(PromptVersion.project_id == project_id)
        .order_by(PromptVersion.name, desc(PromptVersion.version))
    )
    return res.scalars().all()


@router.post(
    "", response_model=PromptVersionResponse, status_code=status.HTTP_201_CREATED
)
async def create_prompt_version(
    project_id: str = Query(...),
    payload: PromptVersionCreate = ...,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new version for a prompt template."""
    # Find latest version for this prompt name
    res = await db.execute(
        select(PromptVersion.version)
        .where(
            PromptVersion.project_id == project_id, PromptVersion.name == payload.name
        )
        .order_by(desc(PromptVersion.version))
        .limit(1)
    )
    latest_v = res.scalar() or 0
    next_v = latest_v + 1

    prompt_ver = PromptVersion(
        project_id=project_id,
        name=payload.name,
        version=next_v,
        template=payload.template,
        variables=payload.variables or [],
        commit_message=payload.commit_message,
    )
    db.add(prompt_ver)
    await db.commit()
    await db.refresh(prompt_ver)
    return prompt_ver


@router.get("/{name}/versions", response_model=list[PromptVersionResponse])
async def get_prompt_versions(
    name: str,
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all versions of a specific prompt template."""
    res = await db.execute(
        select(PromptVersion)
        .where(PromptVersion.project_id == project_id, PromptVersion.name == name)
        .order_by(desc(PromptVersion.version))
    )
    return res.scalars().all()
