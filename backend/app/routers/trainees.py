"""FastAPI router managing Trainee endpoints and cohort roster access.
Restricts global trainee roster access to staff, delete operations strictly to administrators, and scopes profile access to resource owners.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, require_staff, require_admin
from app.core.exceptions import AppException
from app.schemas.trainee import TraineeCreate, TraineeUpdate, TraineeResponse
from app.schemas.common import PaginatedResponse
from app.services.trainee_service import TraineeService
from app.services.audit_service import create_audit_log
from app.models.user import User

router = APIRouter(prefix="/trainees", tags=["Trainees"])

@router.get("", response_model=PaginatedResponse[TraineeResponse])
def list_trainees(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    batch_id: Optional[int] = Query(None, description="Filter by batch ID"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    sort: Optional[str] = Query("name", description="Sort field (name, -name, id, -id)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves paginated trainee list. Access is restricted to staff (trainers and admins)."""
    if current_user.role not in ("trainer", "admin"):
        raise AppException(
            code="FORBIDDEN_TRAINEE_ROSTER_ACCESS",
            message="Trainees are restricted to viewing only their own performance dashboard",
            status_code=403
        )

    service = TraineeService(db)
    return service.list_trainees(
        page=page,
        page_size=page_size,
        batch_id=batch_id,
        search=search,
        sort=sort
    )

@router.get("/{trainee_id}", response_model=TraineeResponse)
def get_trainee(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves trainee details. Trainees may only view their own profile; staff may view any."""
    if current_user.role not in ("trainer", "admin"):
        if current_user.trainee_id != trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees are restricted to viewing only their own trainee record",
                status_code=403
            )

    service = TraineeService(db)
    return service.get_trainee(trainee_id)

@router.post("", response_model=TraineeResponse, status_code=status.HTTP_201_CREATED)
def create_trainee(
    payload: TraineeCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Enrolls a new trainee into a batch cohort (Staff only)."""
    service = TraineeService(db)
    trainee = service.create_trainee(payload)
    create_audit_log(
        db=db,
        user_id=staff.id,
        action="trainee_created",
        entity_type="trainee",
        entity_id=trainee.id,
        details={"name": trainee.name, "email": trainee.email, "batch_id": trainee.batch_id}
    )
    db.commit()
    return trainee

@router.put("/{trainee_id}", response_model=TraineeResponse)
def update_trainee(
    trainee_id: int,
    payload: TraineeUpdate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Updates trainee profile or reassigns batch (Staff only)."""
    service = TraineeService(db)
    trainee = service.update_trainee(trainee_id, payload)
    create_audit_log(
        db=db,
        user_id=staff.id,
        action="trainee_updated",
        entity_type="trainee",
        entity_id=trainee.id,
        details={"name": trainee.name, "email": trainee.email, "batch_id": trainee.batch_id}
    )
    db.commit()
    return trainee

@router.delete("/{trainee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trainee(
    trainee_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deletes trainee and cascades sessions (Admin only, respecting existing 409 constraints)."""
    service = TraineeService(db)
    existing = service.get_trainee(trainee_id)
    service.delete_trainee(trainee_id)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="trainee_deleted",
        entity_type="trainee",
        entity_id=trainee_id,
        details={"name": existing.name, "email": existing.email}
    )
    db.commit()
    return None
