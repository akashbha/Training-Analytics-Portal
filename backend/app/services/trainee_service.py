"""Service layer coordinating business logic for Trainee entities.
Enforces email uniqueness, cohort existence validation, and profile customization.
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

def _to_response(t: Trainee, batch_name: Optional[str] = None) -> TraineeResponse:
    b_name = batch_name or (t.batch.name if t.batch else None)
    return TraineeResponse(
        id=t.id,
        name=t.name,
        email=t.email,
        batch_id=t.batch_id,
        batch_name=b_name,
        session_count=len(t.sessions) if t.sessions is not None else 0,
        phone=t.phone,
        bio=t.bio,
        specialization=t.specialization,
        avatar_url=t.avatar_url,
        github_url=t.github_url,
    )

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

        response_items = [_to_response(t) for t in items]

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
        return _to_response(trainee)

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
            batch_id=trainee_in.batch_id,
            phone=trainee_in.phone.strip() if trainee_in.phone else None,
            bio=trainee_in.bio.strip() if trainee_in.bio else None,
            specialization=trainee_in.specialization.strip() if trainee_in.specialization else None,
            avatar_url=trainee_in.avatar_url,
            github_url=trainee_in.github_url.strip() if trainee_in.github_url else None,
        )
        created = self.repo.create(trainee)
        return _to_response(created, batch.name)

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

        if trainee_in.phone is not None:
            trainee.phone = trainee_in.phone.strip() if trainee_in.phone else None

        if trainee_in.bio is not None:
            trainee.bio = trainee_in.bio.strip() if trainee_in.bio else None

        if trainee_in.specialization is not None:
            trainee.specialization = trainee_in.specialization.strip() if trainee_in.specialization else None

        if trainee_in.avatar_url is not None:
            trainee.avatar_url = trainee_in.avatar_url if trainee_in.avatar_url else None

        if trainee_in.github_url is not None:
            trainee.github_url = trainee_in.github_url.strip() if trainee_in.github_url else None

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
        return _to_response(updated, batch.name if batch else None)

    def delete_trainee(self, trainee_id: int) -> None:
        """Deletes a trainee and cascading session records."""
        trainee = self.repo.get_by_id(trainee_id)
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        self.repo.delete(trainee)
