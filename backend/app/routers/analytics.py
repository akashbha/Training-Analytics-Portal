"""FastAPI router publishing analytical performance dashboards and trend metrics.
Enforces staff access (trainer and admin) on cohort rosters, leaderboards, and attention listings.
"""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.deps import (
    get_db,
    get_current_user,
    require_staff,
    verify_batch_access,
    verify_trainee_cohort_access,
)
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
    BatchCompareItem,
    BatchHeatmapResponse,
    ModuleHotspotItem
)
from app.schemas.misconception import MisconceptionAnalysisResponse
from app.services.misconception_service import MisconceptionService
from app.services.analytics_service import AnalyticsService
from app.repositories.trainee_repository import TraineeRepository
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def verify_trainee_access(trainee_id: int, current_user: User, db: Session) -> None:
    """Delegates trainee access checks to shared cohort-scoped authorization helper."""
    verify_trainee_cohort_access(trainee_id, current_user, db)

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
    verify_batch_access(batch_id, staff, db)
    service = AnalyticsService(db)
    return service.get_batch_leaderboard(batch_id, order=order, limit=limit)

@router.get("/batches/{batch_id}/attention", response_model=List[AttentionItem])
def get_batch_attention(
    batch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Returns up to 5 trainees needing attention with falling trends (Staff only)."""
    verify_batch_access(batch_id, staff, db)
    service = AnalyticsService(db)
    return service.get_batch_attention(batch_id)

@router.get("/batches/{batch_id}/heatmap", response_model=BatchHeatmapResponse)
def get_batch_heatmap(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns student x module performance heatmap matrix with score bands."""
    verify_batch_access(batch_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_batch_heatmap(batch_id)

@router.get("/batches/{batch_id}/hotspots", response_model=List[ModuleHotspotItem])
def get_batch_hotspots(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns curriculum modules ranked by failure rate (< 60% passing benchmark) with attempt counts and failing trainee IDs."""
    verify_batch_access(batch_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_batch_hotspots(batch_id)

@router.get("/batches/{batch_id}/at-risk/export")
def export_batch_at_risk_csv(
    batch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Exports at-risk cohort trainees with descriptive flag reasons as a downloadable CSV (Staff only)."""
    verify_batch_access(batch_id, staff, db)
    service = AnalyticsService(db)
    csv_content = service.export_batch_at_risk_csv(batch_id)
    filename = f"at_risk_batch_{batch_id}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/batches/{batch_id}/weekly-summary/export")
def export_batch_weekly_summary(
    batch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Exports a deterministic weekly cohort summary built strictly from real metrics as a downloadable text document (Staff only)."""
    verify_batch_access(batch_id, staff, db)
    service = AnalyticsService(db)
    summary_content = service.export_batch_weekly_summary(batch_id)
    filename = f"batch_{batch_id}_weekly_summary.txt"
    return Response(
        content=summary_content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/batches/{batch_id}/misconceptions", response_model=MisconceptionAnalysisResponse)
def get_batch_misconceptions(
    batch_id: int,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Computes TF-IDF semantic clusters of recurring curriculum errors and misconceptions for a batch (Staff only)."""
    verify_batch_access(batch_id, staff, db)
    service = MisconceptionService(db)
    return service.get_batch_misconceptions(batch_id)


@router.post("/batches/{batch_id}/misconceptions/{cluster_id}/approval")
def toggle_misconception_approval(
    batch_id: int,
    cluster_id: str,
    approved: bool = Query(..., description="Approval state for human-in-the-loop validation"),
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Sets trainer approval status for a generated misconception cluster label."""
    verify_batch_access(batch_id, staff, db)
    service = MisconceptionService(db)
    new_state = service.toggle_cluster_approval(cluster_id, approved)
    return {"cluster_id": cluster_id, "approved": new_state}


@router.get("/trainees/{trainee_id}/summary", response_model=TraineeSummaryResponse)
def get_trainee_summary(
    trainee_id: int,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns single trainee summary metrics and first-3 vs last-3 improvement in SQL."""
    verify_trainee_access(trainee_id, current_user, db)
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
    verify_trainee_access(trainee_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_trainee_progress(trainee_id, from_date=from_date, to_date=to_date)

@router.get("/trainees/{trainee_id}/errors-by-module", response_model=List[ModuleErrorItem])
def get_trainee_errors_by_module(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns error frequency per module aggregated in SQL."""
    verify_trainee_access(trainee_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_trainee_errors_by_module(trainee_id)

@router.get("/trainees/{trainee_id}/standing")
def get_trainee_cohort_standing(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns trainee rank within their cohort batch and peer percentile standing."""
    verify_trainee_access(trainee_id, current_user, db)
    service = AnalyticsService(db)
    return service.get_trainee_standing(trainee_id)

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

# =========================================================================
# Machine Learning Early-Warning Prediction Endpoints (Synopsis Section 10)
# =========================================================================
@router.get("/batches/{batch_id}/ml-attention")
def get_batch_ml_attention_endpoint(
    batch_id: int,
    limit: int = Query(10, ge=1, le=50, description="Max flagged trainees to return"),
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Predicts trainees requiring early trainer intervention using trained ML pipeline with cold-start fallback (Staff only)."""
    verify_batch_access(batch_id, staff, db)
    from app.ml.predictor import get_batch_ml_attention
    return get_batch_ml_attention(db, batch_id=batch_id, limit=limit)

@router.get("/trainees/{trainee_id}/ml-prediction")
def get_trainee_ml_prediction_endpoint(
    trainee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns granular ML risk score, probability, and contributing risk factors for a trainee."""
    verify_trainee_access(trainee_id, current_user, db)
    from app.ml.predictor import predict_trainee_attention
    return predict_trainee_attention(db, trainee_id=trainee_id)

@router.get("/trainees/{id}/risk")
def get_trainee_risk_endpoint(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns ML performance risk prediction with rule-based fallback and access control."""
    verify_trainee_access(id, current_user, db)
    trainee = TraineeRepository(db).get_by_id(id)
    if not trainee:
        raise AppException(
            code="TRAINEE_NOT_FOUND",
            message=f"Trainee with ID {id} not found",
            status_code=404,
        )
    from app.services.ml_client import predict_trainee_risk
    return predict_trainee_risk(db, id)


@router.get("/ml/model-info")
def get_ml_model_info(staff: User = Depends(require_staff)):
    """Returns candidate comparison, evaluation metrics (Recall, F1, Confusion Matrix), and feature importances."""
    from app.ml.predictor import get_metrics_summary
    return get_metrics_summary()
