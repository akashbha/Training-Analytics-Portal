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
from app.models.trainee import Trainee
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
    BatchCompareItem,
    BatchHeatmapResponse,
    ModuleHotspotItem
)
from app.core.exceptions import AppException
from app.core.constants import PASS_THRESHOLD

class AnalyticsService:
    """Service layer coordinating SQL analytics retrieval and schema serialization."""
    def __init__(self, db: Session):
        self.db = db
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

    def get_batch_heatmap(self, batch_id: int) -> BatchHeatmapResponse:
        """Retrieves Student x Module performance heatmap matrix or raises 404."""
        result = self.repo.get_batch_heatmap(batch_id)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return BatchHeatmapResponse(**result)

    def get_batch_hotspots(self, batch_id: int) -> List[ModuleHotspotItem]:
        """Retrieves module failure hotspots ranked by failure rate (< 60%) or raises 404."""
        result = self.repo.get_batch_hotspots(batch_id)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)
        return [ModuleHotspotItem(**item) for item in result]

    def export_batch_at_risk_csv(self, batch_id: int) -> str:
        """Generates a CSV string containing at-risk trainees, ML/Rule risk method, and detailed flag reason text."""
        import csv
        import io
        result = self.repo.get_batch_at_risk_list(batch_id)
        if result is None:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)

        # Retrieve ML predictions if available
        ml_preds = {}
        try:
            from app.ml.predictor import predict_trainee_attention
            for item in result:
                try:
                    pred = predict_trainee_attention(self.repo.db, item["trainee_id"])
                    ml_preds[item["trainee_id"]] = pred
                except Exception:
                    pass
        except Exception:
            pass

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["trainee_id", "trainee_name", "trainee_email", "batch_name", "average_score_pct", "session_count", "risk_method", "risk_probability", "flag_reason"])
        for item in result:
            score_str = f"{item['avg_score_pct']:.1f}%" if item["avg_score_pct"] is not None else "N/A"
            tid = item["trainee_id"]
            pred = ml_preds.get(tid)
            if pred and not pred.get("is_cold_start") and pred.get("model_type"):
                method_str = f"ML Model ({pred.get('model_type')})"
                prob_str = f"{pred.get('attention_probability', 0.0):.1f}%"
            else:
                method_str = "Rule Fallback"
                prob_str = "N/A"

            writer.writerow([
                item["trainee_id"],
                item["name"],
                item["email"],
                item["batch_name"],
                score_str,
                item["session_count"],
                method_str,
                prob_str,
                item["flag_reason"]
            ])
        return output.getvalue()

    def export_batch_weekly_summary(self, batch_id: int) -> str:
        """Generates a plain, deterministic weekly cohort summary report built strictly from real session data."""
        from datetime import datetime, timezone
        from app.models.batch import Batch
        from app.models.user import User

        batch = self.repo.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise AppException(code="BATCH_NOT_FOUND", message=f"Batch with ID {batch_id} not found", status_code=404)

        summary = self.get_batch_summary(batch_id)
        hotspots = self.get_batch_hotspots(batch_id)
        weekly = self.get_batch_weekly(batch_id)
        attention = self.get_batch_attention(batch_id)

        # Retrieve assigned trainers for this batch
        from app.models.batch_trainer import BatchTrainer
        assignments = (
            self.repo.db.query(BatchTrainer)
            .filter(BatchTrainer.batch_id == batch_id)
            .order_by(BatchTrainer.assigned_at.asc())
            .all()
        )
        trainer_names = (
            ", ".join([bt.trainer.email for bt in assignments if bt.trainer])
            if assignments
            else "Unassigned"
        )

        # Check for ML predictions for attention queue
        ml_preds = {}
        try:
            from app.ml.predictor import predict_trainee_attention
            for att in attention:
                try:
                    pred = predict_trainee_attention(self.repo.db, att.trainee_id)
                    ml_preds[att.trainee_id] = pred
                except Exception:
                    pass
        except Exception:
            pass

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        sep_double = "=" * 80
        sep_single = "-" * 80

        lines = [
            sep_double,
            "TRAINER COHORT WEEKLY PERFORMANCE & RISK SUMMARY",
            sep_double,
            f"Cohort Name:       {batch.name} (Batch ID: {batch.id})",
            f"Assigned Trainers: {trainer_names}",
            f"Report Generated:  {now_str}",
            "Provenance:        Compiled deterministically from operational session records.",
            "Integrity Note:    Strictly real database metrics. Zero synthetic or generated AI content.",
            sep_double,
            "",
            "1. COHORT TRIAGE KEY PERFORMANCE INDICATORS",
            sep_single,
            f"• Mean Score:              {summary.avg_score_pct:.1f}% (Sample size: {summary.session_count} evaluated sessions)",
            f"• Benchmark Pass Rate:     {summary.pass_rate_pct:.1f}% (Standard cutoff: >= 60.0%; sample size: {summary.trainee_count} trainees)",
            f"• Total Graded Sessions:   {summary.session_count} session evaluations recorded",
            f"• Active Enrolled Cohort:  {summary.trainee_count} trainees",
            "",
            "2. EARLY-WARNING AT-RISK QUEUE (NEEDS ATTENTION)",
            sep_single,
            f"Total Candidates Flagged: {len(attention)} trainees prioritized for intervention",
            "",
        ]

        if not attention:
            lines.append("  No trainees currently flagged below risk thresholds.")
        else:
            for idx, att in enumerate(attention, start=1):
                pred = ml_preds.get(att.trainee_id)
                if pred and not pred.get("is_cold_start") and pred.get("model_type"):
                    method_str = f"ML Model ({pred.get('model_type')})"
                    prob_str = f"{pred.get('attention_probability', 0.0):.1f}%"
                else:
                    method_str = "Rule Fallback (Cold start / Deterministic heuristic)"
                    prob_str = "N/A"

                sess_info = f" ({pred.get('session_count')} sessions recorded)" if pred and pred.get("session_count") is not None else ""
                score_info = f"{att.avg_score_pct:.1f}%" if att.avg_score_pct is not None else "N/A"
                flag_str = pred.get("top_risk_factors", [None])[0] if pred and pred.get("top_risk_factors") else f"Score trajectory flagged as {att.trend.replace('_', ' ')}"
                lines.extend([
                    f"[{idx}] {att.name} (Trainee ID: {att.trainee_id})",
                    f"    - Risk Method:        {method_str}",
                    f"    - Risk Probability:   {prob_str}",
                    f"    - Average Score:      {score_info}{sess_info}",
                    f"    - Primary Flag:       {flag_str}",
                    "",
                ])

        lines.extend([
            "3. MODULE FAILURE HOTSPOTS (< 60.0% PASSING BENCHMARK)",
            sep_single,
            "Curriculum modules ranked by share of attempts below the 60.0% cutoff:",
            "",
        ])

        hotspot_fails = [h for h in hotspots if h.failure_rate_pct > 0]
        if not hotspot_fails:
            lines.append("  No curriculum modules have recorded failure rates.")
        else:
            for idx, h in enumerate(hotspot_fails[:8], start=1):
                lines.append(
                    f"[{idx}] {h.module_name} (Module ID: {h.module_id})\n"
                    f"    - Failure Rate:       {h.failure_rate_pct:.1f}% ({h.failed_attempts} failed of {h.total_attempts} total attempts)\n"
                    f"    - Module Mean Score:  {h.avg_score_pct:.1f}%\n"
                )

        lines.extend([
            "4. WEEKLY PROGRESSION TIMELINE",
            sep_single,
            "Chronological weekly cohort performance vs. the 60.0% passing benchmark:",
            "",
        ])

        if not weekly:
            lines.append("  No weekly historical trends recorded yet.")
        else:
            for w in weekly:
                if w.avg_score_pct is not None:
                    diff = w.avg_score_pct - 60.0
                    sign = "+" if diff >= 0 else ""
                    lines.append(
                        f"• Cycle Starting {w.week_start}: {w.avg_score_pct:.1f}% mean score | "
                        f"{w.session_count} sessions evaluated (Benchmark Delta: {sign}{diff:.1f}%)"
                    )
                else:
                    lines.append(
                        f"• Cycle Starting {w.week_start}: No graded scores recorded | "
                        f"{w.session_count} sessions evaluated"
                    )

        lines.extend([
            "",
            sep_double,
            "END OF REPORT - CONFIDENTIAL & AUDITED COHORT METRICS",
            sep_double,
        ])

        return "\n".join(lines)

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

    def get_trainee_standing(self, trainee_id: int) -> Dict[str, Any]:
        """Retrieves cohort batch ranking and percentile standing for a trainee or raises 404."""
        result = self.repo.get_trainee_standing(trainee_id)
        if result is None:
            raise AppException(code="TRAINEE_NOT_FOUND", message=f"Trainee with ID {trainee_id} not found", status_code=404)
        return result

    def get_batches_compare(self) -> List[BatchCompareItem]:
        """Compares all cohort statistics in SQL (Trainer only)."""
        result = self.repo.get_batches_compare()
        return [BatchCompareItem(**item) for item in result]

    def get_overview(self) -> Dict[str, Any]:
        """Calculates global analytics metrics across all cohorts and today's session activity."""
        compare_items = self.repo.get_batches_compare()
        total_batches = len(compare_items)
        batches_below_target = sum(1 for b in compare_items if b["avg_score_pct"] is not None and b["avg_score_pct"] < PASS_THRESHOLD)

        valid_pass_rates = [b["pass_rate_pct"] for b in compare_items if b["pass_rate_pct"] is not None]
        mean_cohort_pass_rate_pct = round(sum(valid_pass_rates) / len(valid_pass_rates), 1) if valid_pass_rates else None
        overall_pass_rate_pct = mean_cohort_pass_rate_pct if mean_cohort_pass_rate_pct is not None else 0.0

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        sessions_today = self.db.query(SessionModel).filter(SessionModel.created_at >= today_start).count()
        total_trainees = self.db.query(Trainee).count()
        total_sessions = self.db.query(SessionModel).count()

        users = self.db.query(User).all()
        active_users_count = 0
        inactive_users_count = 0
        roles_count = {"admin": 0, "trainer": 0, "trainee": 0}
        for u in users:
            if u.is_active:
                active_users_count += 1
                if u.role in roles_count:
                    roles_count[u.role] += 1
            else:
                inactive_users_count += 1

        weekly_series = self.repo.get_global_weekly(weeks=8)

        return {
            "total_batches": total_batches,
            "batches_below_target": batches_below_target,
            "mean_cohort_pass_rate_pct": mean_cohort_pass_rate_pct,
            "overall_pass_rate_pct": overall_pass_rate_pct,
            "sessions_today": sessions_today,
            "total_trainees": total_trainees,
            "total_sessions": total_sessions,
            "active_users": active_users_count,
            "inactive_users": inactive_users_count,
            "role_breakdown": roles_count,
            "weekly": weekly_series,
            "batches": compare_items
        }
