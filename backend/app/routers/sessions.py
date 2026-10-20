"""FastAPI router managing assessment Session entries, CSV bulk uploads, and template downloads.
Enforces score boundary business logic, creator attribution, role-based deletion rules, and trainee ownership scoping.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_staff
from app.core.exceptions import AppException
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    BulkSessionResponse
)
from app.schemas.common import PaginatedResponse
from app.services.session_service import SessionService
from app.models.user import User

router = APIRouter(prefix="/sessions", tags=["Sessions"])

MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 Megabytes

@router.get("/template")
def download_csv_template():
    """Returns a sample CSV template with standard column headers for bulk upload."""
    sample_content = (
        "trainee_email,module_name,score,errors,time_seconds,created_at\n"
        "alice.walker@test.internal,Python Fundamentals,85.5,2,1200,2026-03-01T10:00:00Z\n"
        "bob.davis@test.internal,FastAPI & RESTful APIs,42.0,5,1850,\n"
    )
    return Response(
        content=sample_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sessions_bulk_template.csv"}
    )

@router.get("", response_model=PaginatedResponse[SessionResponse])
def list_sessions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    trainee_id: Optional[int] = Query(None, description="Filter by trainee ID"),
    module_id: Optional[int] = Query(None, description="Filter by module ID"),
    batch_id: Optional[int] = Query(None, description="Filter by batch ID"),
    from_date: Optional[date] = Query(None, alias="from", description="Filter from date (inclusive)"),
    to_date: Optional[date] = Query(None, alias="to", description="Filter to date (inclusive)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves paginated sessions. Trainees are constrained strictly to their own session records."""
    if current_user.role not in ("trainer", "admin"):
        if trainee_id is not None and trainee_id != current_user.trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees are restricted to querying only their own session records",
                status_code=403
            )
        trainee_id = current_user.trainee_id

    service = SessionService(db)
    return service.list_sessions(
        page=page,
        page_size=page_size,
        trainee_id=trainee_id,
        module_id=module_id,
        batch_id=batch_id,
        from_date=from_date,
        to_date=to_date
    )

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves single session details. Scoped to the session owner if requester is a trainee."""
    service = SessionService(db)
    session = service.get_session(session_id)

    if current_user.role not in ("trainer", "admin") and session.trainee_id != current_user.trainee_id:
        raise AppException(
            code="FORBIDDEN_RESOURCE_ACCESS",
            message="Trainees are restricted to viewing only their own session records",
            status_code=403
        )

    return session

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Submits a single assessment session. Enforces score <= module.max_score and sets created_by (Staff only)."""
    service = SessionService(db)
    return service.create_session(payload, created_by=staff.id)

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Deletes session. Trainers can delete only sessions they created; Admins can delete any."""
    service = SessionService(db)
    service.delete_session(session_id, user=staff)
    return None

@router.post("/bulk", response_model=BulkSessionResponse, status_code=status.HTTP_200_OK)
async def bulk_upload_sessions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Parses and validates CSV session records, setting created_by to current staff user (Staff only)."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise AppException(
            code="INVALID_FILE_TYPE",
            message="Uploaded file must be a valid .csv file format",
            status_code=400
        )

    content_bytes = await file.read()
    if len(content_bytes) > MAX_CSV_BYTES:
        raise AppException(
            code="FILE_TOO_LARGE",
            message=f"Uploaded file exceeds the maximum allowed size of 5 MB ({len(content_bytes)} bytes)",
            status_code=400
        )

    try:
        csv_text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppException(
            code="INVALID_ENCODING",
            message="CSV file must be encoded in UTF-8 format",
            status_code=400
        )

    service = SessionService(db)
    return service.bulk_create_from_csv(csv_text, created_by=staff.id)
