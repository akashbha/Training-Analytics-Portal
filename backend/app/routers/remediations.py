"""FastAPI router managing Remediation assignments and longitudinal performance evaluation."""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_staff
from app.core.exceptions import AppException
from app.models.user import User
from app.schemas.remediation import RemediationCreate, RemediationResponse, RemediationDetailResponse
from app.services.remediation_service import RemediationService

router = APIRouter(tags=["Remediations"])

@router.post("/remediations", response_model=RemediationResponse, status_code=status.HTTP_201_CREATED)
def create_remediation(
    payload: RemediationCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Assigns an assessment remediation intervention for a trainee (Trainer or Admin only)."""
    service = RemediationService(db)
    return service.create_remediation(payload, assigned_by=staff.id)

@router.get("/trainees/{trainee_id}/remediations", response_model=List[RemediationDetailResponse])
def get_trainee_remediations(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves remediation records for a trainee. Trainees may only view their own records."""
    if current_user.role not in ("trainer", "admin"):
        if current_user.trainee_id != trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees are restricted to querying only their own remediation records",
                status_code=403
            )

    service = RemediationService(db)
    return service.get_trainee_remediations(trainee_id)
