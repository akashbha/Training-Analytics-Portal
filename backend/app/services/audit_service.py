"""Service layer coordinating system audit logging and compliance inspection.
Records mutations on users, cohorts, curricula, trainees, and sessions with sensitive payload sanitization.
"""

from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.audit_log import AuditLog
from app.schemas.common import PaginatedResponse

def sanitize_details(details: Optional[Any]) -> Optional[Any]:
    """Ensures no sensitive credentials or password fields are ever persisted in audit logs."""
    if not isinstance(details, dict):
        return details
    sanitized: Dict[str, Any] = {}
    for key, value in details.items():
        if "password" in key.lower() or "secret" in key.lower() or "token" in key.lower():
            sanitized[key] = "[REDACTED]"
        else:
            sanitized[key] = value
    return sanitized

def create_audit_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[Any] = None
) -> AuditLog:
    """Creates and persists an audit log record within the current database transaction."""
    clean_details = sanitize_details(details)
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=clean_details
    )
    db.add(log_entry)
    db.flush()
    return log_entry

class AuditService:
    """Service providing query and filtering operations over recorded audit logs."""
    def __init__(self, db: Session):
        self.db = db

    def list_logs(
        self,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None
    ) -> PaginatedResponse:
        """Retrieves paginated, filterable audit logs in descending chronological order."""
        query = self.db.query(AuditLog)

        if user_id is not None:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)

        total = query.count()
        pages = (total + page_size - 1) // page_size if total > 0 else 1
        items = query.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size).all()

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages
        )
