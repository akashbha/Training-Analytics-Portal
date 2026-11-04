"""Repository managing append-only persistence and queries for AuditLog entities.
Strictly disallows update and delete operations to preserve compliance invariants.
"""

from typing import Optional, List, Tuple
from sqlalchemy.orm import Session as DbSession, joinedload
from sqlalchemy import desc

from app.models.audit_log import AuditLog


class AuditRepository:
    """Repository managing append-only audit trail logs."""
    def __init__(self, db: DbSession):
        self.db = db

    def create(self, audit_log: AuditLog) -> AuditLog:
        """Appends a new audit log record to the ledger."""
        self.db.add(audit_log)
        self.db.flush()
        return audit_log

    def get_by_id(self, log_id: int) -> Optional[AuditLog]:
        """Retrieves an audit log record by its identifier."""
        return self.db.query(AuditLog).options(
            joinedload(AuditLog.user)
        ).filter(AuditLog.id == log_id).first()

    def list(
        self,
        skip: int = 0,
        limit: int = 20,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None
    ) -> Tuple[List[AuditLog], int]:
        """Queries paginated audit logs with multi-attribute filtering."""
        query = self.db.query(AuditLog).options(joinedload(AuditLog.user))

        if user_id is not None:
            query = query.filter((AuditLog.actor_id == user_id) | (AuditLog.user_id == user_id))
        if action:
            query = query.filter(AuditLog.action == action)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)

        total = query.count()
        items = query.order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit).all()
        return items, total

    def update(self, *args, **kwargs):
        """Append-only protection: update is strictly forbidden."""
        raise NotImplementedError("Audit logs are append-only: updates are forbidden.")

    def delete(self, *args, **kwargs):
        """Append-only protection: deletion is strictly forbidden."""
        raise NotImplementedError("Audit logs are append-only: deletions are forbidden.")
