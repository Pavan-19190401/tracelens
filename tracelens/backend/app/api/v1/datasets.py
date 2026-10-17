"""Dataset and Dataset Items management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from tracelens.backend.app.api.deps import get_current_user
from tracelens.backend.app.core.database import get_db
from tracelens.backend.app.models.dataset import Dataset, DatasetItem
from tracelens.backend.app.models.project import User
from tracelens.backend.app.schemas import (
    DatasetCreate,
    DatasetItemCreate,
    DatasetItemResponse,
    DatasetResponse,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(
    project_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all datasets in a project with item counts."""
    res = await db.execute(select(Dataset).where(Dataset.project_id == project_id))
    datasets = res.scalars().all()

    output = []
    for d in datasets:
        cnt_res = await db.execute(
            select(func.count(DatasetItem.id)).where(DatasetItem.dataset_id == d.id)
        )
        count = cnt_res.scalar() or 0
        output.append(
            DatasetResponse(
                id=d.id,
                project_id=d.project_id,
                name=d.name,
                description=d.description,
                item_count=count,
                created_at=d.created_at,
            )
        )
    return output


@router.post("", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    project_id: str = Query(...),
    payload: DatasetCreate = ...,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new evaluation dataset."""
    dataset = Dataset(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return DatasetResponse(
        id=dataset.id,
        project_id=dataset.project_id,
        name=dataset.name,
        description=dataset.description,
        item_count=0,
        created_at=dataset.created_at,
    )


@router.get("/{dataset_id}/items", response_model=list[DatasetItemResponse])
async def list_dataset_items(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all items in a dataset."""
    res = await db.execute(
        select(DatasetItem)
        .where(DatasetItem.dataset_id == dataset_id)
        .order_by(DatasetItem.created_at)
    )
    items = res.scalars().all()
    return [
        DatasetItemResponse(
            id=i.id,
            dataset_id=i.dataset_id,
            input=i.input,
            expected_output=i.expected_output,
            metadata=i.metadata_,
            created_at=i.created_at,
        )
        for i in items
    ]


@router.post(
    "/{dataset_id}/items",
    response_model=DatasetItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_dataset_item(
    dataset_id: str,
    payload: DatasetItemCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a new test item (input/expected_output) to a dataset."""
    d_res = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    if not d_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dataset not found.")

    item = DatasetItem(
        dataset_id=dataset_id,
        input=payload.input,
        expected_output=payload.expected_output,
        metadata_=payload.metadata,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return DatasetItemResponse(
        id=item.id,
        dataset_id=item.dataset_id,
        input=item.input,
        expected_output=item.expected_output,
        metadata=item.metadata_,
        created_at=item.created_at,
    )
