"""Service layer managing remediation records, audit logging, and longitudinal before/after session analytics."""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session as DbSession, joinedload

from app.models.remediation import Remediation
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session
from app.models.user import User
from app.models.batch_trainer import BatchTrainer
from app.schemas.remediation import (
    RemediationCreate,
    RemediationComplete,
    RemediationResolve,
    RemediationResponse,
    RemediationDetailResponse,
    BatchRemediationItem,
)
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
            note=payload.note,
            status="Pending"
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
            "note": remediation.note,
            "status": remediation.status
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

    def complete_remediation(self, remediation_id: int, caller: User, payload: RemediationComplete) -> RemediationDetailResponse:
        """Allows a trainee to mark their assigned practice activity as completed (pending trainer reassessment)."""
        remediation = (
            self.db.query(Remediation)
            .options(joinedload(Remediation.module), joinedload(Remediation.assigner), joinedload(Remediation.trainee))
            .filter(Remediation.id == remediation_id)
            .first()
        )
        if not remediation:
            raise AppException(code="REMEDIATION_NOT_FOUND", message=f"Remediation with ID {remediation_id} not found", status_code=404)

        if caller.role == "trainee" and caller.trainee_id != remediation.trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees can only mark their own remediations as completed",
                status_code=403
            )

        before_state = {
            "id": remediation.id,
            "status": remediation.status,
            "completed_at": remediation.completed_at.isoformat() if remediation.completed_at else None,
            "completion_notes": remediation.completion_notes
        }

        remediation.status = "Completed"
        remediation.completed_at = datetime.now(timezone.utc)
        if payload.completion_notes:
            remediation.completion_notes = payload.completion_notes

        self.db.flush()

        after_state = {
            "id": remediation.id,
            "status": remediation.status,
            "completed_at": remediation.completed_at.isoformat() if remediation.completed_at else None,
            "completion_notes": remediation.completion_notes
        }
        record_audit_log(
            db=self.db,
            actor_id=caller.id,
            action="update",
            entity_type="remediation",
            entity_id=remediation.id,
            before=before_state,
            after=after_state
        )
        self.db.commit()

        return self._format_remediation_detail(remediation)

    def resolve_remediation(self, remediation_id: int, caller: User, payload: RemediationResolve) -> RemediationDetailResponse:
        """Allows instructional staff to record re-assessment outcome and evaluate resolution threshold."""
        remediation = (
            self.db.query(Remediation)
            .options(joinedload(Remediation.module), joinedload(Remediation.assigner), joinedload(Remediation.trainee))
            .filter(Remediation.id == remediation_id)
            .first()
        )
        if not remediation:
            raise AppException(code="REMEDIATION_NOT_FOUND", message=f"Remediation with ID {remediation_id} not found", status_code=404)

        if caller.role == "trainer":
            # Verify trainer is assigned to trainee's batch cohort
            trainee_batch_id = remediation.trainee.batch_id if remediation.trainee else None
            is_assigned = (
                self.db.query(BatchTrainer)
                .filter(BatchTrainer.batch_id == trainee_batch_id, BatchTrainer.trainer_id == caller.id)
                .first()
            )
            if not is_assigned:
                raise AppException(
                    code="FORBIDDEN_RESOURCE_ACCESS",
                    message="Trainer is not assigned to the trainee's cohort batch",
                    status_code=403
                )

        before_state = {
            "id": remediation.id,
            "status": remediation.status,
            "reassessment_score": remediation.reassessment_score,
            "resolved_at": remediation.resolved_at.isoformat() if remediation.resolved_at else None
        }

        now_utc = datetime.now(timezone.utc)
        score_val = payload.reassessment_score

        if score_val is not None:
            remediation.reassessment_score = score_val
            if payload.log_session:
                new_session = Session(
                    trainee_id=remediation.trainee_id,
                    module_id=remediation.module_id,
                    score=score_val,
                    errors=0 if score_val >= 80 else (1 if score_val >= 70 else 3),
                    time_seconds=900,
                    created_at=now_utc
                )
                self.db.add(new_session)
                self.db.flush()

        # Resolution rule: score >= 70.0 passes benchmark and resolves drill; below 70 remains In Progress
        if score_val is not None:
            if score_val >= 70.0:
                remediation.status = "Resolved"
                remediation.resolved_at = now_utc
                remediation.resolved_by = caller.id
            else:
                remediation.status = "In Progress"
        else:
            remediation.status = "Resolved"
            remediation.resolved_at = now_utc
            remediation.resolved_by = caller.id

        if payload.resolution_note:
            note_str = f"[Resolution: {payload.resolution_note}]"
            remediation.note = f"{remediation.note}\n{note_str}" if remediation.note else note_str

        self.db.flush()

        after_state = {
            "id": remediation.id,
            "status": remediation.status,
            "reassessment_score": remediation.reassessment_score,
            "resolved_at": remediation.resolved_at.isoformat() if remediation.resolved_at else None,
            "resolved_by": remediation.resolved_by
        }
        record_audit_log(
            db=self.db,
            actor_id=caller.id,
            action="update",
            entity_type="remediation",
            entity_id=remediation.id,
            before=before_state,
            after=after_state
        )
        self.db.commit()

        return self._format_remediation_detail(remediation)

    def _format_remediation_detail(self, r: Remediation) -> RemediationDetailResponse:
        """Helper to format a single remediation into RemediationDetailResponse."""
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

        if len(sessions_after) < 3:
            after_avg = r.reassessment_score if (r.reassessment_score is not None and not sessions_after) else None
            after_status = f"{r.reassessment_score}%" if after_avg is not None else "not enough sessions"
        else:
            total_pct = sum(
                (s.score / s.module.max_score * 100.0) if (s.module and s.module.max_score > 0) else s.score
                for s in sessions_after
            )
            after_avg = round(total_pct / 3.0, 2)
            after_status = f"{after_avg}%"

        assigner_name = r.assigner.email if r.assigner else None
        module_name = r.module.name if r.module else None

        return RemediationDetailResponse(
            id=r.id,
            trainee_id=r.trainee_id,
            module_id=r.module_id,
            module_name=module_name,
            assigned_by=r.assigned_by,
            assigned_by_name=assigner_name,
            assigned_at=r.assigned_at,
            note=r.note,
            status=r.status or "Pending",
            completed_at=r.completed_at,
            completion_notes=r.completion_notes,
            reassessment_score=r.reassessment_score,
            resolved_at=r.resolved_at,
            resolved_by=r.resolved_by,
            before_average=before_avg,
            after_average=after_avg,
            before_status=before_status,
            after_status=after_status,
            before_sessions_count=len(sessions_before),
            after_sessions_count=len(sessions_after)
        )

    def get_trainee_remediations(self, trainee_id: int) -> List[RemediationDetailResponse]:
        """Retrieves all remediations assigned to a trainee with longitudinal session tracking."""
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

        return [self._format_remediation_detail(r) for r in remediations]

    def get_batch_remediations(self, batch_id: int) -> List[BatchRemediationItem]:
        """Retrieves all remediation interventions assigned to trainees in a specific batch with outcome tracking."""
        remediations = (
            self.db.query(Remediation)
            .join(Trainee, Trainee.id == Remediation.trainee_id)
            .options(
                joinedload(Remediation.trainee),
                joinedload(Remediation.module),
                joinedload(Remediation.assigner),
            )
            .filter(Trainee.batch_id == batch_id)
            .order_by(Remediation.assigned_at.desc())
            .all()
        )

        results: List[BatchRemediationItem] = []
        for r in remediations:
            sessions_before = (
                self.db.query(Session)
                .join(Module, Module.id == Session.module_id)
                .filter(
                    Session.trainee_id == r.trainee_id,
                    Session.module_id == r.module_id,
                    Session.created_at < r.assigned_at,
                )
                .order_by(Session.created_at.desc())
                .limit(3)
                .all()
            )

            sessions_after = (
                self.db.query(Session)
                .join(Module, Module.id == Session.module_id)
                .filter(
                    Session.trainee_id == r.trainee_id,
                    Session.module_id == r.module_id,
                    Session.created_at > r.assigned_at,
                )
                .order_by(Session.created_at.asc())
                .all()
            )

            before_avg = None
            if sessions_before:
                total_pct = sum(
                    (s.score / s.module.max_score * 100.0) if (s.module and s.module.max_score > 0) else s.score
                    for s in sessions_before
                )
                before_avg = round(total_pct / len(sessions_before), 1)

            after_avg = None
            if sessions_after:
                total_pct = sum(
                    (s.score / s.module.max_score * 100.0) if (s.module and s.module.max_score > 0) else s.score
                    for s in sessions_after
                )
                after_avg = round(total_pct / len(sessions_after), 1)
            elif r.reassessment_score is not None:
                after_avg = round(r.reassessment_score, 1)

            score_delta = None
            if before_avg is not None and after_avg is not None:
                score_delta = round(after_avg - before_avg, 1)

            # Determine dynamic status based on model status and session performance
            if r.status in ("Resolved", "Completed"):
                status_str = r.status
            elif not sessions_after and r.reassessment_score is None:
                status_str = r.status or "Pending"
            elif after_avg is not None and after_avg >= 70.0:
                status_str = "Resolved"
            else:
                status_str = "In Progress"

            assigner_name = r.assigner.email if r.assigner else "Trainer"
            trainee_name = r.trainee.name if r.trainee else f"Trainee #{r.trainee_id}"
            trainee_email = r.trainee.email if r.trainee else ""
            module_name = r.module.name if r.module else f"Module #{r.module_id}"

            item = BatchRemediationItem(
                id=r.id,
                trainee_id=r.trainee_id,
                trainee_name=trainee_name,
                trainee_email=trainee_email,
                module_id=r.module_id,
                module_name=module_name,
                assigned_by=r.assigned_by,
                assigned_by_name=assigner_name,
                assigned_at=r.assigned_at,
                note=r.note,
                status=status_str,
                completed_at=r.completed_at,
                completion_notes=r.completion_notes,
                reassessment_score=r.reassessment_score,
                resolved_at=r.resolved_at,
                before_average=before_avg,
                after_average=after_avg,
                score_delta=score_delta,
                before_sessions_count=len(sessions_before),
                after_sessions_count=len(sessions_after),
            )
            results.append(item)

        return results
