"""Service layer mediating analytical queries and contract mapping.
Enforces resource existence validation (404) while returning clean zero/null envelopes for empty cohorts.
"""

from datetime import date, datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.repositories.analytics_repository import AnalyticsRepository
from app.repositories.batch_repository import BatchRepository
from app.repositories.trainee_repository import TraineeRepository
from app.models.session import Session as SessionModel
from app.models.user import User
from app.schemas.analytics import (
    BatchSummaryResponse,
    BatchWeeklyItem,
    ScoreBandItem,
    LeaderboardItem,
    AttentionItem,
    TraineeSummaryResponse,
    TraineeProgressItem,
    ModuleErrorItem,
    BatchCompareItem
)
from app.core.exceptions import AppException

class AnalyticsService:
    """Service layer coordinating SQL analytics retrieval and schema serialization."""
    def __init__(self, db: Session):
        self.repo = AnalyticsRepository(db)
        self.batch_repo = BatchRepository(db)
        self.trainee_repo = TraineeRepository(db)

    def get_batch_summary(
        self,
        batch_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> BatchSummaryResponse:
        """Retrieves SQL-computed batch metrics or raises 404 for unknown batches."""
        result = self.repo.get_batch_summary(batch_id, from_date=from_date, to_date=to_date)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return BatchSummaryResponse(**result)

    def get_batch_weekly(
        self,
        batch_id: int,
        weeks: int = 8,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> List[BatchWeeklyItem]:
        """Retrieves continuous weekly progression or raises 404."""
        result = self.repo.get_batch_weekly(batch_id, weeks=weeks, from_date=from_date, to_date=to_date)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return [BatchWeeklyItem(**item) for item in result]

    def get_batch_bands(self, batch_id: int) -> List[ScoreBandItem]:
        """Retrieves score band distribution across all three tiers or raises 404."""
        result = self.repo.get_batch_bands(batch_id)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return [ScoreBandItem(**item) for item in result]

    def get_batch_leaderboard(
        self,
        batch_id: int,
        order: str = "desc",
        limit: int = 10
    ) -> List[LeaderboardItem]:
        """Retrieves cohort leaderboard ranked via SQL window functions or raises 404."""
        result = self.repo.get_batch_leaderboard(batch_id, order=order, limit=limit)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return [LeaderboardItem(**item) for item in result]

    def get_batch_attention(self, batch_id: int) -> List[AttentionItem]:
        """Retrieves up to 5 trainees needing intervention or raises 404."""
        result = self.repo.get_batch_attention(batch_id)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return [AttentionItem(**item) for item in result]

    def get_trainee_summary(
        self,
        trainee_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> TraineeSummaryResponse:
        """Retrieves trainee summary metrics or raises 404."""
        result = self.repo.get_trainee_summary(trainee_id, from_date=from_date, to_date=to_date)
        if result is None:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        return TraineeSummaryResponse(**result)

    def get_trainee_progress(
        self,
        trainee_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> List[TraineeProgressItem]:
        """Retrieves ordered session timeline for trainee or raises 404."""
        result = self.repo.get_trainee_progress(trainee_id, from_date=from_date, to_date=to_date)
        if result is None:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        return [TraineeProgressItem(**item) for item in result]

    def get_trainee_errors_by_module(self, trainee_id: int) -> List[ModuleErrorItem]:
        """Retrieves error frequency per module or raises 404."""
        result = self.repo.get_trainee_errors_by_module(trainee_id)
        if result is None:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        return [ModuleErrorItem(**item) for item in result]

    def get_batches_compare(self) -> List[BatchCompareItem]:
        """Compares all cohort statistics in SQL (Trainer only)."""
        result = self.repo.get_batches_compare()
        return [BatchCompareItem(**item) for item in result]

    def get_overview(self) -> Dict[str, Any]:
        """Calculates global analytics metrics across all cohorts and today's session activity."""
        compare_items = self.repo.get_batches_compare()
        total_batches = len(compare_items)
        batches_below_target = sum(1 for b in compare_items if b["avg_score_pct"] is not None and b["avg_score_pct"] < 60)

        valid_pass_rates = [b["pass_rate_pct"] for b in compare_items if b["pass_rate_pct"] is not None]
        overall_pass_rate_pct = round(sum(valid_pass_rates) / len(valid_pass_rates), 1) if valid_pass_rates else 0.0

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        sessions_today = self.db.query(SessionModel).filter(SessionModel.created_at >= today_start).count()

        active_users_count = self.db.query(User).filter(User.is_active.is_(True)).count()
        users = self.db.query(User).all()
        roles_count = {"admin": 0, "trainer": 0, "trainee": 0}
        for u in users:
            if u.role in roles_count:
                roles_count[u.role] += 1

        weekly_series = self.repo.get_global_weekly(weeks=8)

        return {
            "total_batches": total_batches,
            "batches_below_target": batches_below_target,
            "overall_pass_rate_pct": overall_pass_rate_pct,
            "sessions_today": sessions_today,
            "active_users": active_users_count,
            "role_breakdown": roles_count,
            "weekly": weekly_series,
            "batches": compare_items
        }
