"""FastAPI router publishing analytical performance dashboards and trend metrics.
Enforces staff access (trainer and admin) on cohort rosters, leaderboards, and attention listings.
"""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_staff
from app.core.exceptions import AppException
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
from app.services.analytics_service import AnalyticsService
from app.repositories.trainee_repository import TraineeRepository
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])

def verify_batch_access(batch_id: int, current_user: User, db: Session) -> None:
    """Ensures trainees can only access analytics for their assigned cohort."""
    if current_user.role in ("trainer", "admin"):
        return
    if current_user.role == "trainee" and current_user.trainee_id:
        t = TraineeRepository(db).get_by_id(current_user.trainee_id)
        if t and t.batch_id == batch_id:
            return
    raise AppException(
        code="FORBIDDEN_COHORT_ACCESS",
        message="Trainees are restricted to viewing only their assigned cohort analytics",
        status_code=403
    )

def verify_trainee_access(trainee_id: int, current_user: User) -> None:
    """Ensures trainees can only access their personal performance metrics."""
    if current_user.role in ("trainer", "admin"):
        return
    if current_user.role == "trainee" and current_user.trainee_id == trainee_id:
        return
    raise AppException(
        code="FORBIDDEN_RESOURCE_ACCESS",
        message="Trainees are restricted to viewing only their own performance data",
        status_code=403
    )

@router.get("/batches/{batch_id}/summary", response_model=BatchSummaryResponse)
def get_batch_summary(
    batch_id: int,
    from_date: Optional[date] = Query(None, alias="from", description="Start date filter"),
    to_date: Optional[date] = Query(None, alias="to", description="End date filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns single-query batch summary KPI metrics."""
    verify_batch_access(batch_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_batch_summary(batch_id, from_date=from_date, to_date=to_date)

@router.get("/batches/{batch_id}/weekly", response_model=List[BatchWeeklyItem])
def get_batch_weekly(
    batch_id: int,
    weeks: int = Query(8, ge=1, le=52, description="Number of weeks to generate series for"),
    from_date: Optional[date] = Query(None, alias="from", description="Explicit start date filter"),
    to_date: Optional[date] = Query(None, alias="to", description="Explicit end date filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns exactly N weekly rows for the batch using SQL generate_series."""
    verify_batch_access(batch_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_batch_weekly(batch_id, weeks=weeks, from_date=from_date, to_date=to_date)

@router.get("/batches/{batch_id}/bands", response_model=List[ScoreBandItem])
def get_batch_bands(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns trainee breakdown across Excellent, Average, and Struggling bands."""
    verify_batch_access(batch_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_batch_bands(batch_id)

@router.get("/batches/{batch_id}/leaderboard", response_model=List[LeaderboardItem])
def get_batch_leaderboard(
    batch_id: int,
    order: str = Query("desc", pattern="^(desc|asc)$", description="Rank order: desc or asc"),
    limit: int = Query(10, ge=1, le=100, description="Max entries to return"),
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Returns cohort rankings using SQL RANK() window functions (Staff only)."""
    service = AnalyticsService(db)
    return service.get_batch_leaderboard(batch_id, order=order, limit=limit)

@router.get("/batches/{batch_id}/attention", response_model=List[AttentionItem])
def get_batch_attention(
    batch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Returns up to 5 trainees needing attention with falling trends (Staff only)."""
    service = AnalyticsService(db)
    return service.get_batch_attention(batch_id)

@router.get("/trainees/{trainee_id}/summary", response_model=TraineeSummaryResponse)
def get_trainee_summary(
    trainee_id: int,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns single trainee summary metrics and first-3 vs last-3 improvement in SQL."""
    verify_trainee_access(trainee_id, current_user)
    service = AnalyticsService(db)
    return service.get_trainee_summary(trainee_id, from_date=from_date, to_date=to_date)

@router.get("/trainees/{trainee_id}/progress", response_model=List[TraineeProgressItem])
def get_trainee_progress(
    trainee_id: int,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns chronological session timeline for a trainee."""
    verify_trainee_access(trainee_id, current_user)
    service = AnalyticsService(db)
    return service.get_trainee_progress(trainee_id, from_date=from_date, to_date=to_date)

@router.get("/trainees/{trainee_id}/errors-by-module", response_model=List[ModuleErrorItem])
def get_trainee_errors_by_module(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns error frequency per module aggregated in SQL."""
    verify_trainee_access(trainee_id, current_user)
    service = AnalyticsService(db)
    return service.get_trainee_errors_by_module(trainee_id)

@router.get("/batches/compare", response_model=List[BatchCompareItem])
def get_batches_compare(
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Compares average scores and pass rates across all cohorts (Staff only)."""
    service = AnalyticsService(db)
    return service.get_batches_compare()

@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Aggregates multi-batch performance, pass rates, and today's activity metrics (Staff only)."""
    service = AnalyticsService(db)
    return service.get_overview()
