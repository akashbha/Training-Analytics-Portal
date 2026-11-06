"""FastAPI router managing Batch cohort endpoints.
Provides paginated listings and protects all creation, update, and deletion operations behind administrator credentials.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, require_admin, require_staff
from app.core.exceptions import AppException
from app.schemas.batch import (
    BatchCreate,
    BatchUpdate,
    BatchResponse,
    BatchTrainerAssign,
    BatchTrainerResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.batch_service import BatchService
from app.services.audit_service import record_audit_log, create_audit_log
from app.models.user import User
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer

router = APIRouter(prefix="/batches", tags=["Batches"])

@router.get("", response_model=PaginatedResponse[BatchResponse])
def list_batches(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves paginated batches with enrolled trainee counts."""
    service = BatchService(db)
    return service.list_batches(page=page, page_size=page_size)

@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves single batch details by ID."""
    service = BatchService(db)
    return service.get_batch(batch_id)

@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Creates a new batch cohort with date range validation (Admin only)."""
    service = BatchService(db)
    batch = service.create_batch(payload)
    after_state = {"id": batch.id, "name": batch.name, "start_date": str(batch.start_date), "end_date": str(batch.end_date)}
    record_audit_log(
        db=db,
        actor_id=admin.id,
        action="create",
        entity_type="batch",
        entity_id=batch.id,
        before=None,
        after=after_state
    )
    db.commit()
    return batch

@router.put("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Updates batch name and scheduled dates (Admin only)."""
    service = BatchService(db)
    existing = service.get_batch(batch_id)
    before_state = {"id": existing.id, "name": existing.name, "start_date": str(existing.start_date), "end_date": str(existing.end_date)}

    batch = service.update_batch(batch_id, payload)
    after_state = {"id": batch.id, "name": batch.name, "start_date": str(batch.start_date), "end_date": str(batch.end_date)}
    record_audit_log(
        db=db,
        actor_id=admin.id,
        action="update",
        entity_type="batch",
        entity_id=batch.id,
        before=before_state,
        after=after_state
    )
    db.commit()
    return batch

@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    batch_id: int,
    force: bool = Query(False, description="Set to true to force delete batch and cascade child trainees"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deletes a batch, rejecting if trainees are enrolled unless force=true is specified (Admin only)."""
    service = BatchService(db)
    existing = service.get_batch(batch_id)
    before_state = {"id": existing.id, "name": existing.name, "start_date": str(existing.start_date), "end_date": str(existing.end_date)}
    service.delete_batch(batch_id, force=force)
    record_audit_log(
        db=db,
        actor_id=admin.id,
        action="delete",
        entity_type="batch",
        entity_id=batch_id,
        before=before_state,
        after=None
    )
    db.commit()
    return None

@router.post("/{batch_id}/trainers", response_model=BatchTrainerResponse, status_code=status.HTTP_201_CREATED)
def assign_batch_trainer(
    batch_id: int,
    payload: BatchTrainerAssign,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Assigns an instructional trainer to a batch (Admin only)."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise AppException(
            code="BATCH_NOT_FOUND",
            message=f"Batch with ID {batch_id} not found",
            status_code=404
        )

    trainer_user = db.query(User).filter(User.id == payload.trainer_id).first()
    if not trainer_user or trainer_user.role != "trainer":
        raise AppException(
            code="INVALID_TRAINER",
            message=f"User with ID {payload.trainer_id} is not a valid trainer account",
            status_code=422
        )

    existing = db.query(BatchTrainer).filter(
        BatchTrainer.batch_id == batch_id,
        BatchTrainer.trainer_id == payload.trainer_id
    ).first()
    if existing:
        email = trainer_user.email
        name = email.split("@")[0].replace(".", " ").title() if email else "Trainer"
        return BatchTrainerResponse(
            id=existing.id,
            batch_id=existing.batch_id,
            trainer_id=existing.trainer_id,
            assigned_at=existing.assigned_at,
            trainer_email=email,
            trainer_name=name
        )

    assignment = BatchTrainer(batch_id=batch_id, trainer_id=payload.trainer_id)
    db.add(assignment)
    db.flush()

    record_audit_log(
        db=db,
        actor_id=admin.id,
        action="assign_batch_trainer",
        entity_type="batch_trainer",
        entity_id=assignment.id,
        before=None,
        after={"batch_id": batch_id, "trainer_id": payload.trainer_id}
    )
    db.commit()
    db.refresh(assignment)

    email = trainer_user.email
    name = email.split("@")[0].replace(".", " ").title() if email else "Trainer"
    return BatchTrainerResponse(
        id=assignment.id,
        batch_id=assignment.batch_id,
        trainer_id=assignment.trainer_id,
        assigned_at=assignment.assigned_at,
        trainer_email=email,
        trainer_name=name
    )

@router.delete("/{batch_id}/trainers/{trainer_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_batch_trainer(
    batch_id: int,
    trainer_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Unassigns a trainer from a batch (Admin only)."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise AppException(
            code="BATCH_NOT_FOUND",
            message=f"Batch with ID {batch_id} not found",
            status_code=404
        )

    assignment = db.query(BatchTrainer).filter(
        BatchTrainer.batch_id == batch_id,
        BatchTrainer.trainer_id == trainer_id
    ).first()
    if not assignment:
        raise AppException(
            code="ASSIGNMENT_NOT_FOUND",
            message=f"Trainer with ID {trainer_id} is not assigned to batch {batch_id}",
            status_code=404
        )

    assignment_id = assignment.id
    db.delete(assignment)
    record_audit_log(
        db=db,
        actor_id=admin.id,
        action="unassign_batch_trainer",
        entity_type="batch_trainer",
        entity_id=assignment_id,
        before={"batch_id": batch_id, "trainer_id": trainer_id},
        after=None
    )
    db.commit()
    return None

@router.get("/{batch_id}/trainers", response_model=list[BatchTrainerResponse])
def list_batch_trainers(
    batch_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Lists all trainers assigned to a specific batch (Admin only)."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise AppException(
            code="BATCH_NOT_FOUND",
            message=f"Batch with ID {batch_id} not found",
            status_code=404
        )

    assignments = (
        db.query(BatchTrainer)
        .filter(BatchTrainer.batch_id == batch_id)
        .order_by(BatchTrainer.assigned_at.asc())
        .all()
    )

    result = []
    for a in assignments:
        email = a.trainer.email if a.trainer else None
        name = email.split("@")[0].replace(".", " ").title() if email else "Trainer"
        result.append(
            BatchTrainerResponse(
                id=a.id,
                batch_id=a.batch_id,
                trainer_id=a.trainer_id,
                assigned_at=a.assigned_at,
                trainer_email=email,
                trainer_name=name
            )
        )
    return result
