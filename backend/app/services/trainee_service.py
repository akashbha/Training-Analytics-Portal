"""Service layer coordinating business logic for Trainee entities.
Enforces email uniqueness, cohort existence validation, and paginated searches.
"""

import math
from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.trainee_repository import TraineeRepository
from app.repositories.batch_repository import BatchRepository
from app.schemas.trainee import TraineeCreate, TraineeUpdate, TraineeResponse
from app.schemas.common import PaginatedResponse
from app.models.trainee import Trainee
from app.core.exceptions import AppException

class TraineeService:
    """Service handling trainee lifecycle, cohort assignment, and uniqueness rules."""
    def __init__(self, db: Session):
        self.repo = TraineeRepository(db)
        self.batch_repo = BatchRepository(db)

    def list_trainees(
        self,
        page: int = 1,
        page_size: int = 20,
        batch_id: Optional[int] = None,
        search: Optional[str] = None,
        sort: Optional[str] = "name"
    ) -> PaginatedResponse[TraineeResponse]:
        """Returns paginated trainees filtered by cohort and search keyword."""
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        skip = (page - 1) * page_size

        items, total = self.repo.list(
            skip=skip,
            limit=page_size,
            batch_id=batch_id,
            search=search,
            sort=sort
        )
        pages = math.ceil(total / page_size) if total > 0 else 1

        response_items = [
            TraineeResponse(
                id=t.id,
                name=t.name,
                email=t.email,
                batch_id=t.batch_id,
                batch_name=t.batch.name if t.batch else None,
                session_count=len(t.sessions) if t.sessions is not None else 0
            )
            for t in items
        ]

        return PaginatedResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages
        )

    def get_trainee(self, trainee_id: int) -> TraineeResponse:
        """Retrieves a single trainee by ID or raises 404."""
        trainee = self.repo.get_by_id(trainee_id)
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        return TraineeResponse(
            id=trainee.id,
            name=trainee.name,
            email=trainee.email,
            batch_id=trainee.batch_id,
            batch_name=trainee.batch.name if trainee.batch else None,
            session_count=len(trainee.sessions) if trainee.sessions is not None else 0
        )

    def create_trainee(self, trainee_in: TraineeCreate) -> TraineeResponse:
        """Validates email uniqueness and batch validity before creating trainee."""
        clean_email = str(trainee_in.email).lower().strip()
        existing = self.repo.get_by_email(clean_email)
        if existing:
            raise AppException(
                code="TRAINEE_EMAIL_CONFLICT",
                message=f"Trainee with email '{clean_email}' already exists",
                status_code=409
            )

        batch = self.batch_repo.get_by_id(trainee_in.batch_id)
        if not batch:
            raise AppException(
                code="BATCH_NOT_FOUND",
                message=f"Cannot associate trainee: Batch ID {trainee_in.batch_id} not found",
                status_code=404
            )

        trainee = Trainee(
            name=trainee_in.name.strip(),
            email=clean_email,
            batch_id=trainee_in.batch_id
        )
        created = self.repo.create(trainee)
        return TraineeResponse(
            id=created.id,
            name=created.name,
            email=created.email,
            batch_id=created.batch_id,
            batch_name=batch.name,
            session_count=0
        )

    def update_trainee(self, trainee_id: int, trainee_in: TraineeUpdate) -> TraineeResponse:
        """Updates trainee properties while ensuring email uniqueness."""
        trainee = self.repo.get_by_id(trainee_id)
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)

        if trainee_in.email:
            clean_email = str(trainee_in.email).lower().strip()
            if clean_email != trainee.email.lower():
                existing = self.repo.get_by_email(clean_email)
                if existing and existing.id != trainee_id:
                    raise AppException(
                        code="TRAINEE_EMAIL_CONFLICT",
                        message=f"Trainee with email '{clean_email}' already exists",
                        status_code=409
                    )
                trainee.email = clean_email

        if trainee_in.name:
            trainee.name = trainee_in.name.strip()

        if trainee_in.batch_id is not None:
            batch = self.batch_repo.get_by_id(trainee_in.batch_id)
            if not batch:
                raise AppException(
                    code="BATCH_NOT_FOUND",
                    message=f"Cannot update trainee: Batch ID {trainee_in.batch_id} not found",
                    status_code=404
                )
            trainee.batch_id = trainee_in.batch_id

        updated = self.repo.update(trainee)
        batch = self.batch_repo.get_by_id(updated.batch_id)
        return TraineeResponse(
            id=updated.id,
            name=updated.name,
            email=updated.email,
            batch_id=updated.batch_id,
            batch_name=batch.name if batch else None,
            session_count=len(updated.sessions) if updated.sessions is not None else 0
        )

    def delete_trainee(self, trainee_id: int) -> None:
        """Deletes a trainee and cascading session records."""
        trainee = self.repo.get_by_id(trainee_id)
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        self.repo.delete(trainee)
