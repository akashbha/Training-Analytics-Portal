"""Service layer managing remediation records, audit logging, and longitudinal before/after session analytics."""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session as DbSession, joinedload

from app.models.remediation import Remediation
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session
from app.models.user import User
from app.schemas.remediation import RemediationCreate, RemediationResponse, RemediationDetailResponse
from app.core.exceptions import AppException
from app.services.audit_service import record_audit_log

class RemediationService:
    def __init__(self, db: DbSession):
        self.db = db

    def create_remediation(self, payload: RemediationCreate, assigned_by: Optional[int]) -> RemediationResponse:
        """Assigns a remediation record to a trainee for a specific module and records an audit log event."""
        trainee = self.db.query(Trainee).filter(Trainee.id == payload.trainee_id).first()
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {payload.trainee_id} not found", status_code=404)

        module = self.db.query(Module).filter(Module.id == payload.module_id).first()
        if not module:
            raise AppException(code="MODULE_NOT_FOUND", message=f"Module with ID {payload.module_id} not found", status_code=404)

        assigned_at = payload.assigned_at or datetime.now(timezone.utc)

        remediation = Remediation(
            trainee_id=payload.trainee_id,
            module_id=payload.module_id,
            assigned_by=assigned_by,
            assigned_at=assigned_at,
            note=payload.note
        )
        self.db.add(remediation)
        self.db.flush()

        # Audit log creation event
        after_state = {
            "id": remediation.id,
            "trainee_id": remediation.trainee_id,
            "module_id": remediation.module_id,
            "assigned_by": remediation.assigned_by,
            "assigned_at": remediation.assigned_at.isoformat(),
            "note": remediation.note
        }
        record_audit_log(
            db=self.db,
            actor_id=assigned_by,
            action="create",
            entity_type="remediation",
            entity_id=remediation.id,
            before=None,
            after=after_state
        )
        self.db.commit()

        return RemediationResponse.model_validate(remediation)

    def get_trainee_remediations(self, trainee_id: int) -> List[RemediationDetailResponse]:
        """Retrieves all remediations assigned to a trainee with exactly 3 sessions before and 3 after assigned_at."""
        trainee = self.db.query(Trainee).filter(Trainee.id == trainee_id).first()
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)

        remediations = (
            self.db.query(Remediation)
            .options(joinedload(Remediation.module), joinedload(Remediation.assigner))
            .filter(Remediation.trainee_id == trainee_id)
            .order_by(Remediation.assigned_at.desc())
            .all()
        )

        results: List[RemediationDetailResponse] = []
        for r in remediations:
            # Query up to 3 sessions strictly before assigned_at for this trainee and module
            sessions_before = (
                self.db.query(Session)
                .options(joinedload(Session.module))
                .filter(
                    Session.trainee_id == r.trainee_id,
                    Session.module_id == r.module_id,
                    Session.created_at < r.assigned_at
                )
                .order_by(Session.created_at.desc())
                .limit(3)
                .all()
            )

            # Query up to 3 sessions strictly after assigned_at for this trainee and module
            sessions_after = (
                self.db.query(Session)
                .options(joinedload(Session.module))
                .filter(
                    Session.trainee_id == r.trainee_id,
                    Session.module_id == r.module_id,
                    Session.created_at > r.assigned_at
                )
                .order_by(Session.created_at.asc())
                .limit(3)
                .all()
            )

            # Before average calculation
            if len(sessions_before) < 3:
                before_avg = None
                before_status = "not enough sessions"
            else:
                total_pct = sum(
                    (s.score / s.module.max_score * 100.0) if (s.module and s.module.max_score > 0) else s.score
                    for s in sessions_before
                )
                before_avg = round(total_pct / 3.0, 2)
                before_status = f"{before_avg}%"

            # After average calculation
            if len(sessions_after) < 3:
                after_avg = None
                after_status = "not enough sessions"
            else:
                total_pct = sum(
                    (s.score / s.module.max_score * 100.0) if (s.module and s.module.max_score > 0) else s.score
                    for s in sessions_after
                )
                after_avg = round(total_pct / 3.0, 2)
                after_status = f"{after_avg}%"

            assigner_name = r.assigner.email if r.assigner else None
            module_name = r.module.name if r.module else None

            detail = RemediationDetailResponse(
                id=r.id,
                trainee_id=r.trainee_id,
                module_id=r.module_id,
                module_name=module_name,
                assigned_by=r.assigned_by,
                assigned_by_name=assigner_name,
                assigned_at=r.assigned_at,
                note=r.note,
                before_average=before_avg,
                after_average=after_avg,
                before_status=before_status,
                after_status=after_status,
                before_sessions_count=len(sessions_before),
                after_sessions_count=len(sessions_after)
            )
            results.append(detail)

        return results
