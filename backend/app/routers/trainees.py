"""FastAPI router managing Trainee endpoints and cohort roster access.
Restricts global trainee roster access to staff, delete operations strictly to administrators, and scopes profile access to resource owners.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, require_staff, require_admin
from app.core.exceptions import AppException
from app.schemas.trainee import TraineeCreate, TraineeUpdate, TraineeResponse
from app.schemas.trainee_goal import TraineeGoalCreate, TraineeGoalResponse
from app.schemas.common import PaginatedResponse
from app.services.trainee_service import TraineeService
from app.services.goal_service import GoalService
from app.services.audit_service import record_audit_log, create_audit_log
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
    after_state = {"id": trainee.id, "name": trainee.name, "email": trainee.email, "batch_id": trainee.batch_id}
    record_audit_log(
        db=db,
        actor_id=staff.id,
        action="create",
        entity_type="trainee",
        entity_id=trainee.id,
        before=None,
        after=after_state
    )
    db.commit()
    return trainee

@router.put("/{trainee_id}", response_model=TraineeResponse)
def update_trainee(
    trainee_id: int,
    payload: TraineeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates trainee profile. Trainees may edit their own profile; staff may edit any trainee and reassign cohorts."""
    service = TraineeService(db)
    existing_t = service.get_trainee(trainee_id)
    before_state = {"id": existing_t.id, "name": existing_t.name, "email": existing_t.email, "batch_id": existing_t.batch_id}

    is_staff = current_user.role in ("trainer", "admin")
    if not is_staff:
        if current_user.trainee_id != trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees are restricted to editing only their own profile",
                status_code=403
            )
        # Disallow batch re-assignment for trainees
        if payload.batch_id is not None:
            if payload.batch_id != existing_t.batch_id:
                raise AppException(
                    code="FORBIDDEN_BATCH_REASSIGNMENT",
                    message="Trainees cannot reassign their own cohort batch",
                    status_code=403
                )

    trainee = service.update_trainee(trainee_id, payload)
    after_state = {"id": trainee.id, "name": trainee.name, "email": trainee.email, "batch_id": trainee.batch_id}
    record_audit_log(
        db=db,
        actor_id=current_user.id,
        action="update",
        entity_type="trainee",
        entity_id=trainee.id,
        before=before_state,
        after=after_state
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
    before_state = {"id": existing.id, "name": existing.name, "email": existing.email, "batch_id": existing.batch_id}
    service.delete_trainee(trainee_id)
    record_audit_log(
        db=db,
        actor_id=admin.id,
        action="delete",
        entity_type="trainee",
        entity_id=trainee_id,
        before=before_state,
        after=None
    )
    db.commit()
    return None

@router.get("/{trainee_id}/goals", response_model=list[TraineeGoalResponse])
def get_trainee_goals(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves target module goals and best-score progress for a trainee."""
    if current_user.role == "trainee" and current_user.trainee_id != trainee_id:
        raise AppException(
            code="FORBIDDEN_RESOURCE_ACCESS",
            message="Trainees are restricted to viewing only their own goals",
            status_code=403
        )
    return GoalService(db).get_trainee_goals(trainee_id)

@router.post("/{trainee_id}/goals", response_model=TraineeGoalResponse)
def set_trainee_goal(
    trainee_id: int,
    payload: TraineeGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates or updates a module performance goal for a trainee and records an audit log row."""
    if current_user.role == "trainee" and current_user.trainee_id != trainee_id:
        raise AppException(
            code="FORBIDDEN_RESOURCE_ACCESS",
            message="Trainees are restricted to modifying only their own goals",
            status_code=403
        )
    return GoalService(db).set_goal(trainee_id, payload, actor_id=current_user.id)

