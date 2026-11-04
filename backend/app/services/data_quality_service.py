"""Service inspecting database integrity and returning data quality audit metrics.
Audits scores above module bounds, negative values, durations exceeding limits, and duplicate sessions.
"""

from typing import List, Dict
from sqlalchemy.orm import Session as DbSession, joinedload
from sqlalchemy import func

from app.models.session import Session
from app.models.module import Module
from app.core.constants import MAX_SESSION_TIME_SECONDS
from app.schemas.admin import DataQualityResponse, DataQualityFlaggedRecord


class DataQualityService:
    """Service auditing database integrity rules and collecting flagged anomalies."""
    def __init__(self, db: DbSession):
        self.db = db

    def get_data_quality_report(self, limit: int = 20) -> DataQualityResponse:
        """Inspects all assessment sessions against data integrity rules and returns up to `limit` records."""
        flagged_records: List[DataQualityFlaggedRecord] = []

        # 1. Score exceeds module max_score
        score_exceeds_max_records = self.db.query(Session).options(
            joinedload(Session.trainee),
            joinedload(Session.module)
        ).join(Session.module).filter(Session.score > Module.max_score).all()

        for s in score_exceeds_max_records:
            max_sc = s.module.max_score if s.module else None
            flagged_records.append(
                DataQualityFlaggedRecord(
                    session_id=s.id,
                    trainee_id=s.trainee_id,
                    trainee_name=s.trainee.name if s.trainee else None,
                    module_id=s.module_id,
                    module_name=s.module.name if s.module else None,
                    rule_violated="score_exceeds_max",
                    details=f"Score {s.score} exceeds module max_score of {max_sc}",
                    score=s.score,
                    max_score=max_sc,
                    time_seconds=s.time_seconds,
                    errors=s.errors,
                    created_at=s.created_at
                )
            )

        # 2. Score negative
        negative_score_records = self.db.query(Session).options(
            joinedload(Session.trainee),
            joinedload(Session.module)
        ).filter(Session.score < 0).all()

        for s in negative_score_records:
            max_sc = s.module.max_score if s.module else None
            flagged_records.append(
                DataQualityFlaggedRecord(
                    session_id=s.id,
                    trainee_id=s.trainee_id,
                    trainee_name=s.trainee.name if s.trainee else None,
                    module_id=s.module_id,
                    module_name=s.module.name if s.module else None,
                    rule_violated="negative_score",
                    details=f"Score {s.score} is negative",
                    score=s.score,
                    max_score=max_sc,
                    time_seconds=s.time_seconds,
                    errors=s.errors,
                    created_at=s.created_at
                )
            )

        # 3. Negative errors
        negative_errors_records = self.db.query(Session).options(
            joinedload(Session.trainee),
            joinedload(Session.module)
        ).filter(Session.errors < 0).all()

        for s in negative_errors_records:
            max_sc = s.module.max_score if s.module else None
            flagged_records.append(
                DataQualityFlaggedRecord(
                    session_id=s.id,
                    trainee_id=s.trainee_id,
                    trainee_name=s.trainee.name if s.trainee else None,
                    module_id=s.module_id,
                    module_name=s.module.name if s.module else None,
                    rule_violated="negative_errors",
                    details=f"Errors count {s.errors} is negative",
                    score=s.score,
                    max_score=max_sc,
                    time_seconds=s.time_seconds,
                    errors=s.errors,
                    created_at=s.created_at
                )
            )

        # 4. Implausible duration (> 14400s or < 0s)
        implausible_duration_records = self.db.query(Session).options(
            joinedload(Session.trainee),
            joinedload(Session.module)
        ).filter(
            (Session.time_seconds > MAX_SESSION_TIME_SECONDS) | (Session.time_seconds < 0)
        ).all()

        for s in implausible_duration_records:
            max_sc = s.module.max_score if s.module else None
            flagged_records.append(
                DataQualityFlaggedRecord(
                    session_id=s.id,
                    trainee_id=s.trainee_id,
                    trainee_name=s.trainee.name if s.trainee else None,
                    module_id=s.module_id,
                    module_name=s.module.name if s.module else None,
                    rule_violated="implausible_duration",
                    details=f"Duration {s.time_seconds}s exceeds limit of {MAX_SESSION_TIME_SECONDS}s (4 hours)",
                    score=s.score,
                    max_score=max_sc,
                    time_seconds=s.time_seconds,
                    errors=s.errors,
                    created_at=s.created_at
                )
            )

        # 5. Duplicate trainee/module/date sessions
        dup_keys = self.db.query(
            Session.trainee_id,
            Session.module_id,
            func.date(Session.created_at).label("sess_date")
        ).group_by(
            Session.trainee_id,
            Session.module_id,
            func.date(Session.created_at)
        ).having(func.count(Session.id) > 1).all()

        duplicate_sessions = []
        for trainee_id, module_id, sess_date in dup_keys:
            matching = self.db.query(Session).options(
                joinedload(Session.trainee),
                joinedload(Session.module)
            ).filter(
                Session.trainee_id == trainee_id,
                Session.module_id == module_id,
                func.date(Session.created_at) == str(sess_date)
            ).order_by(Session.created_at.asc()).all()

            # The subsequent sessions in the group are duplicates
            if len(matching) > 1:
                duplicate_sessions.extend(matching[1:])

        for s in duplicate_sessions:
            max_sc = s.module.max_score if s.module else None
            sess_date = s.created_at.strftime("%Y-%m-%d") if s.created_at else "unknown"
            flagged_records.append(
                DataQualityFlaggedRecord(
                    session_id=s.id,
                    trainee_id=s.trainee_id,
                    trainee_name=s.trainee.name if s.trainee else None,
                    module_id=s.module_id,
                    module_name=s.module.name if s.module else None,
                    rule_violated="duplicate_sessions",
                    details=f"Duplicate session for trainee {s.trainee_id} and module {s.module_id} on {sess_date}",
                    score=s.score,
                    max_score=max_sc,
                    time_seconds=s.time_seconds,
                    errors=s.errors,
                    created_at=s.created_at
                )
            )

        rule_counts: Dict[str, int] = {
            "score_exceeds_max": len(score_exceeds_max_records),
            "negative_score": len(negative_score_records),
            "negative_errors": len(negative_errors_records),
            "implausible_duration": len(implausible_duration_records),
            "duplicate_sessions": len(duplicate_sessions)
        }

        total_flagged = sum(rule_counts.values())

        return DataQualityResponse(
            total_flagged=total_flagged,
            rule_counts=rule_counts,
            flagged_records=flagged_records[:limit]
        )
