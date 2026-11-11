"""FastAPI router managing Remediation assignments, trainee self-completion, and longitudinal resolution."""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import (
    get_db,
    get_current_user,
    require_staff,
    verify_batch_access,
    verify_trainee_cohort_access,
)
from app.core.exceptions import AppException
from app.models.user import User
from app.models.trainee import Trainee
from app.models.batch_trainer import BatchTrainer
from app.schemas.remediation import (
    RemediationCreate,
    RemediationComplete,
    RemediationResolve,
    RemediationResponse,
    RemediationDetailResponse,
    BatchRemediationItem,
)
from app.services.remediation_service import RemediationService

router = APIRouter(tags=["Remediations"])

@router.post("/remediations", response_model=RemediationResponse, status_code=status.HTTP_201_CREATED)
def create_remediation(
    payload: RemediationCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Assigns an assessment remediation intervention for a trainee (Trainer or Admin only).
    Enforces object-level authorization ensuring trainers can only assign remediations to trainees in their assigned cohort.
    """
    if staff.role == "trainer":
        trainee = db.query(Trainee).filter(Trainee.id == payload.trainee_id).first()
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {payload.trainee_id} not found", status_code=404)
        is_assigned = (
            db.query(BatchTrainer)
            .filter(BatchTrainer.batch_id == trainee.batch_id, BatchTrainer.trainer_id == staff.id)
            .first()
        )
        if not is_assigned:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainer is not assigned to the trainee's cohort batch",
                status_code=403
            )

    service = RemediationService(db)
    return service.create_remediation(payload, assigned_by=staff.id)

@router.post("/remediations/{remediation_id}/complete", response_model=RemediationDetailResponse)
def complete_remediation(
    remediation_id: int,
    payload: RemediationComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allows a trainee to record their assigned practice activity as completed (pending staff re-assessment)."""
    service = RemediationService(db)
    return service.complete_remediation(remediation_id, caller=current_user, payload=payload)

@router.post("/remediations/{remediation_id}/resolve", response_model=RemediationDetailResponse)
def resolve_remediation(
    remediation_id: int,
    payload: RemediationResolve,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Allows instructional staff (trainer or admin) to evaluate re-assessment and mark remediation as resolved."""
    service = RemediationService(db)
    return service.resolve_remediation(remediation_id, caller=staff, payload=payload)

@router.get("/batches/{batch_id}/remediations", response_model=List[BatchRemediationItem])
def get_batch_remediations(
    batch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Retrieves all remediation interventions and outcome tracking for trainees in a batch (Staff only).
    Enforces object-level authorization: trainers can only list remediations for batches they are assigned to.
    """
    verify_batch_access(batch_id, staff, db)
    service = RemediationService(db)
    return service.get_batch_remediations(batch_id)

@router.get("/trainees/{trainee_id}/remediations", response_model=List[RemediationDetailResponse])
def get_trainee_remediations(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves remediation records for a trainee. Scopes to trainee owner or assigned cohort trainer."""
    verify_trainee_cohort_access(trainee_id, current_user, db)
    service = RemediationService(db)
    return service.get_trainee_remediations(trainee_id)
