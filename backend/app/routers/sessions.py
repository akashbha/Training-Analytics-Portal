"""FastAPI router managing assessment Session entries, CSV bulk uploads, and template downloads.
Enforces score boundary business logic, creator attribution, role-based deletion rules, and trainee ownership scoping.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, status
from fastapi.responses import Response, JSONResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_staff, verify_batch_access
from app.core.exceptions import AppException
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    BulkSessionResponse,
    SessionImportResponse
)
from app.schemas.session_note import SessionNoteCreate, SessionNoteResponse
from app.schemas.common import PaginatedResponse
from app.services.session_service import SessionService
from app.services.audit_service import record_audit_log
from app.models.user import User
from app.models.session import Session as SessionModel
from app.models.session_note import SessionNote

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
    elif batch_id is not None and current_user.role == "trainer":
        verify_batch_access(batch_id, current_user, db)

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

@router.post("/practice", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def submit_practice_drill(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allows authenticated trainees to submit an interactive self-assessment practice drill."""
    if current_user.role == "trainee":
        if payload.trainee_id != current_user.trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees are restricted to recording practice drills strictly for their own profile",
                status_code=403
            )
    service = SessionService(db)
    return service.create_session(payload, created_by=current_user.id, check_db_duplicate=False)

@router.put("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    payload: SessionCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Updates an existing assessment session metrics and writes audit log (Staff only)."""
    service = SessionService(db)
    return service.update_session(session_id, payload, user=staff)

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

MAX_IMPORT_CSV_BYTES = 1 * 1024 * 1024  # 1 Megabyte

@router.post("/import", response_model=SessionImportResponse)
async def import_sessions(
    dry_run: bool = Query(False, description="If true, parse and validate without persisting records"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Imports sessions from CSV with atomic rollback on any error and dry-run preview capability."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise AppException(
            code="INVALID_FILE_TYPE",
            message="Uploaded file must be a valid .csv file format",
            status_code=400
        )

    if file.size and file.size > MAX_IMPORT_CSV_BYTES:
        raise AppException(
            code="FILE_TOO_LARGE",
            message=f"Uploaded file exceeds maximum allowed size of 1 MB ({file.size} bytes)",
            status_code=400
        )

    # Read bounded chunk (max 1 MB + 1 byte) to prevent loading large payloads into memory
    content_bytes = await file.read(MAX_IMPORT_CSV_BYTES + 1)
    if len(content_bytes) > MAX_IMPORT_CSV_BYTES:
        raise AppException(
            code="FILE_TOO_LARGE",
            message=f"Uploaded file exceeds maximum allowed size of 1 MB ({len(content_bytes)} bytes)",
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
    result = service.import_sessions(
        csv_content=csv_text,
        dry_run=dry_run,
        created_by=staff.id
    )

    if not dry_run and not result.success:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=result.model_dump())

    return result


@router.post("/{session_id}/notes", response_model=SessionNoteResponse, status_code=status.HTTP_201_CREATED)
def create_session_note(
    session_id: int,
    payload: SessionNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Adds a feedback note to an assessment session (Trainer only)."""
    if current_user.role != "trainer":
        raise AppException(
            code="FORBIDDEN_ROLE",
            message="Only trainers can create session feedback notes",
            status_code=403
        )

    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise AppException(
            code="SESSION_NOT_FOUND",
            message=f"Session with ID {session_id} not found",
            status_code=404
        )

    note = SessionNote(
        session_id=session_id,
        author_id=current_user.id,
        text=payload.text
    )
    db.add(note)
    db.flush()

    # Append-only compliance audit trail
    record_audit_log(
        db=db,
        actor_id=current_user.id,
        action="create_session_note",
        entity_type="session_note",
        entity_id=note.id,
        details={
            "session_id": session_id,
            "trainee_id": session_obj.trainee_id,
            "text_length": len(payload.text)
        }
    )
    db.commit()
    db.refresh(note)

    author_name = None
    if current_user.trainee and current_user.trainee.name:
        author_name = current_user.trainee.name
    elif current_user.email:
        author_name = current_user.email.split("@")[0].replace(".", " ").title()

    return SessionNoteResponse(
        id=note.id,
        session_id=note.session_id,
        author_id=note.author_id,
        author_email=current_user.email,
        author_name=author_name,
        author_role=current_user.role,
        text=note.text,
        created_at=note.created_at
    )


@router.get("/{session_id}/notes", response_model=list[SessionNoteResponse])
def get_session_notes(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves feedback notes for an assessment session. Trainees can view notes only for their own sessions."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise AppException(
            code="SESSION_NOT_FOUND",
            message=f"Session with ID {session_id} not found",
            status_code=404
        )

    # Scoped visibility: Trainees can inspect only their own sessions
    if current_user.role == "trainee":
        if session_obj.trainee_id != current_user.trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees can view notes only for their own assessment sessions",
                status_code=403
            )

    notes = (
        db.query(SessionNote)
        .filter(SessionNote.session_id == session_id)
        .order_by(SessionNote.created_at.desc())
        .all()
    )

    result = []
    for n in notes:
        author_name = None
        if n.author and n.author.trainee and n.author.trainee.name:
            author_name = n.author.trainee.name
        elif n.author and n.author.email:
            author_name = n.author.email.split("@")[0].replace(".", " ").title()

        result.append(
            SessionNoteResponse(
                id=n.id,
                session_id=n.session_id,
                author_id=n.author_id,
                author_email=n.author.email if n.author else None,
                author_name=author_name,
                author_role=n.author.role if n.author else None,
                text=n.text,
                created_at=n.created_at
            )
        )

    return result

