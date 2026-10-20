"""Service layer coordinating business logic and constraints for Batch cohorts.
Enforces unique cohort naming rules and guarded cascade deletion controls.
"""

import math
from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.batch_repository import BatchRepository
from app.schemas.batch import BatchCreate, BatchUpdate, BatchResponse
from app.schemas.common import PaginatedResponse
from app.models.batch import Batch
from app.core.exceptions import AppException

class BatchService:
    """Service handling cohort creation, pagination, updates, and protected deletion."""
    def __init__(self, db: Session):
        self.repo = BatchRepository(db)

    def list_batches(self, page: int = 1, page_size: int = 20) -> PaginatedResponse[BatchResponse]:
        """Returns paginated cohorts decorated with enrolled trainee counts."""
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        skip = (page - 1) * page_size

        items, total = self.repo.list(skip=skip, limit=page_size)
        pages = math.ceil(total / page_size) if total > 0 else 1

        response_items = []
        for b in items:
            t_count = self.repo.count_trainees(b.id)
            response_items.append(
                BatchResponse(
                    id=b.id,
                    name=b.name,
                    start_date=b.start_date,
                    end_date=b.end_date,
                    trainee_count=t_count
                )
            )

        return PaginatedResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages
        )

    def get_batch(self, batch_id: int) -> BatchResponse:
        """Retrieves a single batch by ID or raises 404."""
        batch = self.repo.get_by_id(batch_id)
        if not batch:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        t_count = self.repo.count_trainees(batch.id)
        return BatchResponse(
            id=batch.id,
            name=batch.name,
            start_date=batch.start_date,
            end_date=batch.end_date,
            trainee_count=t_count
        )

    def create_batch(self, batch_in: BatchCreate) -> BatchResponse:
        """Validates cohort uniqueness and creates a new batch."""
        existing = self.repo.get_by_name(batch_in.name)
        if existing:
            raise AppException(
                code="BATCH_NAME_CONFLICT",
                message=f"Batch with name '{batch_in.name}' already exists",
                status_code=409
            )

        batch = Batch(
            name=batch_in.name.strip(),
            start_date=batch_in.start_date,
            end_date=batch_in.end_date
        )
        created = self.repo.create(batch)
        return BatchResponse(
            id=created.id,
            name=created.name,
            start_date=created.start_date,
            end_date=created.end_date,
            trainee_count=0
        )

    def update_batch(self, batch_id: int, batch_in: BatchUpdate) -> BatchResponse:
        """Applies batch updates after verifying name uniqueness."""
        batch = self.repo.get_by_id(batch_id)
        if not batch:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)

        if batch_in.name and batch_in.name.strip().lower() != batch.name.lower():
            existing = self.repo.get_by_name(batch_in.name)
            if existing and existing.id != batch_id:
                raise AppException(
                    code="BATCH_NAME_CONFLICT",
                    message=f"Batch with name '{batch_in.name}' already exists",
                    status_code=409
                )
            batch.name = batch_in.name.strip()

        if batch_in.start_date is not None:
            batch.start_date = batch_in.start_date
        if batch_in.end_date is not None:
            batch.end_date = batch_in.end_date

        updated = self.repo.update(batch)
        t_count = self.repo.count_trainees(updated.id)
        return BatchResponse(
            id=updated.id,
            name=updated.name,
            start_date=updated.start_date,
            end_date=updated.end_date,
            trainee_count=t_count
        )

    def delete_batch(self, batch_id: int, force: bool = False) -> None:
        """Guards batch deletion: rejects if trainees are enrolled unless force=true is explicitly confirmed."""
        batch = self.repo.get_by_id(batch_id)
        if not batch:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)

        trainee_count = self.repo.count_trainees(batch_id)
        if trainee_count > 0 and not force:
            raise AppException(
                code="BATCH_NOT_EMPTY",
                message=(
                    f"Cannot delete batch '{batch.name}' because it contains {trainee_count} active trainees. "
                    "To delete the batch and cascade delete all associated trainees and sessions, supply ?force=true."
                ),
                status_code=409
            )

        self.repo.delete(batch)
