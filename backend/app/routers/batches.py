"""FastAPI router managing Batch cohort endpoints.
Provides paginated listings and protects all creation, update, and deletion operations behind administrator credentials.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, require_admin, require_staff
from app.schemas.batch import BatchCreate, BatchUpdate, BatchResponse
from app.schemas.common import PaginatedResponse
from app.services.batch_service import BatchService
from app.services.audit_service import create_audit_log
from app.models.user import User

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
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="batch_created",
        entity_type="batch",
        entity_id=batch.id,
        details={"name": batch.name, "start_date": str(batch.start_date), "end_date": str(batch.end_date)}
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
    batch = service.update_batch(batch_id, payload)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="batch_updated",
        entity_type="batch",
        entity_id=batch.id,
        details={"name": batch.name, "start_date": str(batch.start_date), "end_date": str(batch.end_date)}
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
    # Fetch batch details first for audit log
    existing = service.get_batch(batch_id)
    service.delete_batch(batch_id, force=force)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="batch_deleted",
        entity_type="batch",
        entity_id=batch_id,
        details={"name": existing.name}
    )
    db.commit()
    return None
