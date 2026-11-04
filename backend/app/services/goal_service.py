"""Service managing trainee personal goals, progress computations, and audit logs."""

from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session as DbSession, joinedload

from app.models.trainee_goal import TraineeGoal
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session as AssessmentSession
from app.schemas.trainee_goal import TraineeGoalCreate, TraineeGoalResponse
from app.core.exceptions import AppException
from app.services.audit_service import record_audit_log


class GoalService:
    def __init__(self, db: DbSession):
        self.db = db

    def set_goal(self, trainee_id: int, payload: TraineeGoalCreate, actor_id: Optional[int]) -> TraineeGoalResponse:
        """Creates or updates a module performance goal for a trainee and records an audit log row."""
        trainee = self.db.query(Trainee).filter(Trainee.id == trainee_id).first()
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)

        module = self.db.query(Module).filter(Module.id == payload.module_id).first()
        if not module:
            raise AppException(code="MODULE_NOT_FOUND", message=f"Module with ID {payload.module_id} not found", status_code=404)

        if payload.target_score < 0.0 or payload.target_score > 100.0:
            raise AppException(code="INVALID_TARGET_SCORE", message="Target score must be between 0.0% and 100.0%", status_code=422)

        existing = (
            self.db.query(TraineeGoal)
            .filter(TraineeGoal.trainee_id == trainee_id, TraineeGoal.module_id == payload.module_id)
            .first()
        )

        now = datetime.now(timezone.utc)
        if existing:
            action = "update"
            before_state = {
                "id": existing.id,
                "trainee_id": existing.trainee_id,
                "module_id": existing.module_id,
                "target_score": existing.target_score
            }
            existing.target_score = payload.target_score
            existing.updated_at = now
            goal = existing
        else:
            action = "create"
            before_state = None
            goal = TraineeGoal(
                trainee_id=trainee_id,
                module_id=payload.module_id,
                target_score=payload.target_score,
                created_at=now,
                updated_at=now
            )
            self.db.add(goal)

        self.db.flush()

        after_state = {
            "id": goal.id,
            "trainee_id": goal.trainee_id,
            "module_id": goal.module_id,
            "target_score": goal.target_score
        }

        record_audit_log(
            db=self.db,
            actor_id=actor_id,
            action=action,
            entity_type="goal",
            entity_id=goal.id,
            before=before_state,
            after=after_state
        )
        self.db.commit()

        return self._build_goal_response(goal)

    def get_trainee_goals(self, trainee_id: int) -> List[TraineeGoalResponse]:
        """Retrieves all goals for a trainee with calculated progress against best historical score."""
        trainee = self.db.query(Trainee).filter(Trainee.id == trainee_id).first()
        if not trainee:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)

        goals = (
            self.db.query(TraineeGoal)
            .options(joinedload(TraineeGoal.module))
            .filter(TraineeGoal.trainee_id == trainee_id)
            .order_by(TraineeGoal.created_at.asc())
            .all()
        )

        return [self._build_goal_response(g) for g in goals]

    def _build_goal_response(self, goal: TraineeGoal) -> TraineeGoalResponse:
        """Computes best score and capped progress percentage for a single goal."""
        sessions = (
            self.db.query(AssessmentSession, Module.max_score)
            .join(Module, Module.id == AssessmentSession.module_id)
            .filter(
                AssessmentSession.trainee_id == goal.trainee_id,
                AssessmentSession.module_id == goal.module_id
            )
            .all()
        )

        if not sessions:
            best_score = None
            progress_pct = 0.0
        else:
            scores = [
                (s.score * 100.0 / max_s) if (max_s and max_s > 0) else s.score
                for s, max_s in sessions
            ]
            best_score = round(max(scores), 1)
            if goal.target_score <= 0.0:
                progress_pct = 100.0
            else:
                raw_progress = (best_score / goal.target_score) * 100.0
                progress_pct = min(100.0, round(raw_progress, 1))

        return TraineeGoalResponse(
            id=goal.id,
            trainee_id=goal.trainee_id,
            module_id=goal.module_id,
            module_name=goal.module.name if goal.module else None,
            target_score=goal.target_score,
            best_score=best_score,
            progress_pct=progress_pct,
            created_at=goal.created_at,
            updated_at=goal.updated_at
        )

