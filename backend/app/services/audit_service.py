"""Service layer coordinating system audit logging and compliance inspection.
Records mutations on users, cohorts, curricula, trainees, and sessions with sensitive payload sanitization.
Enforces append-only semantics across all administrative and operational entity lifecycles.
"""

from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.repositories.audit_repository import AuditRepository
from app.schemas.common import PaginatedResponse

def sanitize_details(details: Optional[Any]) -> Optional[Any]:
    """Ensures no sensitive credentials or password fields are ever persisted in audit logs."""
    if details is None:
        return None
    if not isinstance(details, dict):
        return details
    sanitized: Dict[str, Any] = {}
    for key, value in details.items():
        if "password" in key.lower() or "secret" in key.lower() or "token" in key.lower():
            sanitized[key] = "[REDACTED]"
        else:
            sanitized[key] = value
    return sanitized

def record_audit_log(
    db: Session,
    actor_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    before: Optional[Any] = None,
    after: Optional[Any] = None,
    details: Optional[Any] = None
) -> AuditLog:
    """Single unified helper recording an append-only audit log row for entity mutations.
    Stores actor_id, action, entity_type, entity_id, timestamp, before (JSON), after (JSON).
    """
    clean_before = sanitize_details(before)
    clean_after = sanitize_details(after)
    clean_details = sanitize_details(details) if details is not None else (clean_after or clean_before)

    now_utc = datetime.now(timezone.utc)
    entry = AuditLog(
        actor_id=actor_id,
        user_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        timestamp=now_utc,
        created_at=now_utc,
        before=clean_before,
        after=clean_after,
        details=clean_details
    )
    repo = AuditRepository(db)
    return repo.create(entry)

def create_audit_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[Any] = None,
    before: Optional[Any] = None,
    after: Optional[Any] = None
) -> AuditLog:
    """Backwards-compatible wrapper delegating to record_audit_log."""
    return record_audit_log(
        db=db,
        actor_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after if after is not None else details,
        details=details
    )

class AuditService:
    """Service providing query and filtering operations over recorded audit logs."""
    def __init__(self, db: Session):
        self.db = db
        self.repo = AuditRepository(db)

    def list_logs(
        self,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None
    ) -> PaginatedResponse:
        """Retrieves paginated, filterable audit logs in descending chronological order."""
        skip = (page - 1) * page_size
        items, total = self.repo.list(
            skip=skip,
            limit=page_size,
            user_id=user_id,
            action=action,
            entity_type=entity_type
        )
        pages = (total + page_size - 1) // page_size if total > 0 else 1
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages
        )

