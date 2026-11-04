"""Service layer coordinating assessment Session submissions and CSV bulk ingestion.
Enforces score <= module.max_score, created_by attribution, role deletion boundaries, and audit logging.
"""

import csv
import io
from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session as DbSession

from app.repositories.session_repository import SessionRepository
from app.repositories.trainee_repository import TraineeRepository
from app.repositories.module_repository import ModuleRepository
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    BulkSessionResponse,
    BulkRowError
)
from app.schemas.common import PaginatedResponse
from app.models.session import Session
from app.models.user import User
from app.core.exceptions import AppException
from app.core.constants import MAX_SESSION_TIME_SECONDS
from app.services.notification_service import notify_session_created, notify_session_deleted
from app.services.audit_service import record_audit_log, create_audit_log

class SessionService:
    """Service encapsulating session performance recording, bulk processing, and score assertions."""
    def __init__(self, db: DbSession):
        self.db = db
        self.repo = SessionRepository(db)
        self.trainee_repo = TraineeRepository(db)
        self.module_repo = ModuleRepository(db)

    def _build_response(self, s: Session) -> SessionResponse:
        """Helper to serialize Session entity into rich SessionResponse with percentage and creator."""
        max_score = s.module.max_score if s.module else 100.0
        pct = round((s.score * 100.0) / max_score, 1) if max_score > 0 else 0.0
        return SessionResponse(
            id=s.id,
            trainee_id=s.trainee_id,
            trainee_name=s.trainee.name if s.trainee else None,
            trainee_email=s.trainee.email if s.trainee else None,
            module_id=s.module_id,
            module_name=s.module.name if s.module else None,
            module_max_score=max_score,
            score=s.score,
            score_percentage=pct,
            errors=s.errors,
            time_seconds=s.time_seconds,
            created_at=s.created_at,
            created_by=s.created_by
        )

    def list_sessions(
        self,
        page: int = 1,
        page_size: int = 20,
        trainee_id: Optional[int] = None,
        module_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> PaginatedResponse[SessionResponse]:
        """Queries database for paginated sessions with relational filtering."""
        skip = (page - 1) * page_size
        sessions, total = self.repo.list(
            skip=skip,
            limit=page_size,
            trainee_id=trainee_id,
            module_id=module_id,
            batch_id=batch_id,
            from_date=from_date,
            to_date=to_date
        )
        pages = (total + page_size - 1) // page_size if total > 0 else 1
        return PaginatedResponse(
            items=[self._build_response(s) for s in sessions],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages
        )

    def get_session(self, session_id: int) -> SessionResponse:
        """Retrieves a single session by primary key or raises 404."""
        session = self.repo.get_by_id(session_id)
        if not session:
            raise AppException(code="SESSION_NOT_FOUND", message=f"Session with ID {session_id} not found", status_code=404)
        return self._build_response(session)

    def create_session(self, session_in: SessionCreate, created_by: Optional[int] = None) -> SessionResponse:
        """Validates trainee existence, module bounds, sets created_by, and enforces score <= max_score."""
        trainee = self.trainee_repo.get_by_id(session_in.trainee_id)
        if not trainee:
            raise AppException(
                code="TRAINEE_NOT_FOUND",
                message=f"Trainee with ID {session_in.trainee_id} not found",
                status_code=404
            )

        module = self.module_repo.get_by_id(session_in.module_id)
        if not module:
            raise AppException(
                code="MODULE_NOT_FOUND",
                message=f"Module with ID {session_in.module_id} not found",
                status_code=404
            )

        # Business Rule: score must not exceed the module's max_score and must be >= 0
        if session_in.score < 0:
            raise AppException(
                code="INVALID_SCORE",
                message=f"Session score ({session_in.score}) cannot be negative",
                status_code=422
            )

        if session_in.score > module.max_score:
            raise AppException(
                code="SCORE_EXCEEDS_MAX",
                message=(
                    f"Session score ({session_in.score}) exceeds module '{module.name}' "
                    f"max_score of {module.max_score}"
                ),
                status_code=422
            )

        # Business Rule: errors must be >= 0
        if session_in.errors < 0:
            raise AppException(
                code="INVALID_ERRORS",
                message=f"Errors count ({session_in.errors}) cannot be negative",
                status_code=422
            )

        # Business Rule: time_seconds must be >= 0 and <= MAX_SESSION_TIME_SECONDS
        if session_in.time_seconds < 0:
            raise AppException(
                code="INVALID_TIME",
                message=f"Time duration ({session_in.time_seconds}s) cannot be negative",
                status_code=422
            )

        if session_in.time_seconds > MAX_SESSION_TIME_SECONDS:
            raise AppException(
                code="TIME_EXCEEDS_LIMIT",
                message=(
                    f"Session time ({session_in.time_seconds}s) exceeds maximum allowed duration "
                    f"of {MAX_SESSION_TIME_SECONDS}s (4 hours)"
                ),
                status_code=422
            )

        # Business Rule: duplicate trainee/module/date check
        session_created_at = session_in.created_at or datetime.now(timezone.utc)
        target_date = session_created_at.date()
        existing_dup = self.repo.get_by_trainee_module_date(
            trainee_id=session_in.trainee_id,
            module_id=session_in.module_id,
            target_date=target_date
        )
        if existing_dup:
            raise AppException(
                code="DUPLICATE_SESSION_DATE",
                message=(
                    f"A session for trainee {session_in.trainee_id} and module {session_in.module_id} "
                    f"already exists on {target_date.isoformat()}"
                ),
                status_code=409
            )

        session = Session(
            trainee_id=session_in.trainee_id,
            module_id=session_in.module_id,
            score=session_in.score,
            errors=session_in.errors,
            time_seconds=session_in.time_seconds,
            created_at=session_created_at,
            created_by=created_by
        )
        created = self.repo.create(session)

        # Reload relationships for rich serialization
        fresh_session = self.repo.get_by_id(created.id)

        # Audit log creation event
        after_state = {
            "id": fresh_session.id,
            "trainee_id": fresh_session.trainee_id,
            "module_id": fresh_session.module_id,
            "score": fresh_session.score,
            "errors": fresh_session.errors,
            "time_seconds": fresh_session.time_seconds,
        }
        record_audit_log(
            db=self.db,
            actor_id=created_by,
            action="create",
            entity_type="session",
            entity_id=fresh_session.id,
            before=None,
            after=after_state
        )
        self.db.commit()

        # Real-time hook
        notify_session_created(fresh_session)

        return self._build_response(fresh_session)

    def update_session(self, session_id: int, session_in: SessionCreate, user: User) -> SessionResponse:
        """Updates assessment session metrics with bounds checking, ownership guards, and audit logging."""
        session = self.repo.get_by_id(session_id)
        if not session:
            raise AppException(code="SESSION_NOT_FOUND", message=f"Session with ID {session_id} not found", status_code=404)

        if user.role == "trainer" and session.created_by != user.id:
            raise AppException(
                code="FORBIDDEN_UPDATE_SESSION",
                message="Trainers may only update assessment sessions they created",
                status_code=403
            )

        module = self.module_repo.get_by_id(session_in.module_id)
        if not module:
            raise AppException(code="MODULE_NOT_FOUND", message=f"Module with ID {session_in.module_id} not found", status_code=404)

        if session_in.score < 0:
            raise AppException(code="INVALID_SCORE", message="Session score cannot be negative", status_code=422)
        if session_in.score > module.max_score:
            raise AppException(code="SCORE_EXCEEDS_MAX", message=f"Session score ({session_in.score}) exceeds module max_score of {module.max_score}", status_code=422)
        if session_in.errors < 0:
            raise AppException(code="INVALID_ERRORS", message="Errors count cannot be negative", status_code=422)
        if session_in.time_seconds < 0:
            raise AppException(code="INVALID_TIME", message="Time duration cannot be negative", status_code=422)
        if session_in.time_seconds > MAX_SESSION_TIME_SECONDS:
            raise AppException(code="TIME_EXCEEDS_LIMIT", message=f"Session time exceeds maximum allowed duration of {MAX_SESSION_TIME_SECONDS}s", status_code=422)

        before_state = {
            "id": session.id,
            "trainee_id": session.trainee_id,
            "module_id": session.module_id,
            "score": session.score,
            "errors": session.errors,
            "time_seconds": session.time_seconds,
        }

        session.trainee_id = session_in.trainee_id
        session.module_id = session_in.module_id
        session.score = session_in.score
        session.errors = session_in.errors
        session.time_seconds = session_in.time_seconds
        if session_in.created_at:
            session.created_at = session_in.created_at
        self.db.flush()

        after_state = {
            "id": session.id,
            "trainee_id": session.trainee_id,
            "module_id": session.module_id,
            "score": session.score,
            "errors": session.errors,
            "time_seconds": session.time_seconds,
        }

        record_audit_log(
            db=self.db,
            actor_id=user.id,
            action="update",
            entity_type="session",
            entity_id=session.id,
            before=before_state,
            after=after_state
        )
        self.db.commit()

        fresh = self.repo.get_by_id(session.id)
        return self._build_response(fresh)

    def delete_session(self, session_id: int, user: User) -> None:
        """Deletes a session record with ownership/admin privilege checks and audit logging."""
        session = self.repo.get_by_id(session_id)
        if not session:
            raise AppException(code="SESSION_NOT_FOUND", message=f"Session with ID {session_id} not found", status_code=404)

        # Trainers can delete only sessions where created_by is their id; admins can delete any
        if user.role == "trainer":
            if session.created_by != user.id:
                raise AppException(
                    code="FORBIDDEN_DELETE_SESSION",
                    message="Trainers may only delete assessment sessions they created",
                    status_code=403
                )

        trainee_id = session.trainee_id
        batch_id = session.trainee.batch_id if session.trainee else None

        before_state = {
            "id": session.id,
            "trainee_id": session.trainee_id,
            "module_id": session.module_id,
            "score": session.score,
            "errors": session.errors,
            "time_seconds": session.time_seconds,
        }

        self.repo.delete(session)

        # Write audit log entry
        record_audit_log(
            db=self.db,
            actor_id=user.id,
            action="delete",
            entity_type="session",
            entity_id=session_id,
            before=before_state,
            after=None
        )
        self.db.commit()

        notify_session_deleted(trainee_id=trainee_id, batch_id=batch_id)

    def bulk_create_from_csv(self, csv_content: str, created_by: Optional[int] = None) -> BulkSessionResponse:
        """Parses and validates CSV records, attaching creator attribution to each valid row."""
        reader = csv.DictReader(io.StringIO(csv_content))
        required_headers = {"trainee_email", "module_name", "score", "errors", "time_seconds"}
        if not reader.fieldnames or not required_headers.issubset(set(h.strip() for h in reader.fieldnames)):
            raise AppException(
                code="INVALID_CSV_HEADERS",
                message="CSV must include columns: trainee_email, module_name, score, errors, time_seconds",
                status_code=400
            )

        row_errors: List[BulkRowError] = []
        valid_sessions: List[Session] = []

        # Cache lookups for high ingestion performance
        trainee_cache = {}
        module_cache = {}

        for row_index, row in enumerate(reader, start=2):  # Header is row 1
            trainee_email = row.get("trainee_email", "").strip().lower()
            module_name = row.get("module_name", "").strip()
            score_str = row.get("score", "").strip()
            errors_str = row.get("errors", "").strip()
            time_str = row.get("time_seconds", "").strip()
            created_at_str = row.get("created_at", "").strip()

            # 1. Resolve Trainee
            if not trainee_email:
                row_errors.append(BulkRowError(row=row_index, message="trainee_email is required"))
                continue
            if trainee_email not in trainee_cache:
                t = self.trainee_repo.get_by_email(trainee_email)
                trainee_cache[trainee_email] = t
            trainee = trainee_cache[trainee_email]
            if not trainee:
                row_errors.append(BulkRowError(row=row_index, message=f"Trainee with email '{trainee_email}' not found"))
                continue

            # 2. Resolve Module
            if not module_name:
                row_errors.append(BulkRowError(row=row_index, message="module_name is required"))
                continue
            if module_name.lower() not in module_cache:
                m = self.module_repo.get_by_name(module_name)
                module_cache[module_name.lower()] = m
            module = module_cache[module_name.lower()]
            if not module:
                row_errors.append(BulkRowError(row=row_index, message=f"Module '{module_name}' not found"))
                continue

            # 3. Validate Numbers
            try:
                score = float(score_str)
                if score < 0:
                    raise ValueError()
            except ValueError:
                row_errors.append(BulkRowError(row=row_index, message=f"score must be a non-negative number; got '{score_str}'"))
                continue

            if score > module.max_score:
                row_errors.append(
                    BulkRowError(
                        row=row_index,
                        message=f"Score {score} exceeds module '{module.name}' max_score of {module.max_score}"
                    )
                )
                continue

            try:
                errors = int(errors_str)
                if errors < 0:
                    raise ValueError()
            except ValueError:
                row_errors.append(BulkRowError(row=row_index, message=f"errors must be a non-negative integer; got '{errors_str}'"))
                continue

            try:
                time_seconds = int(time_str)
                if time_seconds < 0 or time_seconds > MAX_SESSION_TIME_SECONDS:
                    raise ValueError()
            except ValueError:
                row_errors.append(
                    BulkRowError(
                        row=row_index,
                        message=f"time_seconds must be between 0 and {MAX_SESSION_TIME_SECONDS} seconds; got '{time_str}'"
                    )
                )
                continue

            # 4. Parse created_at if provided
            created_at = datetime.now(timezone.utc)
            if created_at_str:
                try:
                    created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                except ValueError:
                    row_errors.append(BulkRowError(row=row_index, message=f"Invalid ISO timestamp in created_at: '{created_at_str}'"))
                    continue

            session_obj = Session(
                trainee_id=trainee.id,
                module_id=module.id,
                score=score,
                errors=errors,
                time_seconds=time_seconds,
                created_at=created_at,
                created_by=created_by
            )
            valid_sessions.append(session_obj)

        inserted_count = 0
        if valid_sessions:
            inserted_objs = self.repo.bulk_create(valid_sessions)
            inserted_count = len(inserted_objs)
            # Real-time hook
            notify_session_created(inserted_objs)

        return BulkSessionResponse(
            inserted=inserted_count,
            failed=len(row_errors),
            errors=row_errors
        )
