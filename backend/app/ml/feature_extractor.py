# app/ml/feature_extractor.py
"""Feature extraction pipeline for trainee performance prediction.
Transforms raw assessment sessions into standardized temporal, behavioral,
and consistency features matching the Project Synopsis specification.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session
from app.models.session import Session as AssessmentSession
from app.models.module import Module


FEATURE_COLUMNS = [
    "overall_avg_score",
    "recent_avg_score",
    "score_trend_slope",
    "avg_error_rate",
    "recent_error_rate",
    "avg_time_seconds",
    "performance_consistency",
    "session_count"
]


def extract_trainee_features(db: Session, trainee_id: int) -> Dict[str, Any]:
    """Extracts analytical and temporal features for a single trainee.
    
    Returns a dictionary with raw values, a feature vector, and a cold_start flag
    indicating if sessions < 3 (as specified in Project Synopsis Section 10).
    """
    sessions = (
        db.query(AssessmentSession, Module.max_score)
        .join(Module, Module.id == AssessmentSession.module_id)
        .filter(AssessmentSession.trainee_id == trainee_id)
        .order_by(AssessmentSession.created_at.asc())
        .all()
    )

    session_count = len(sessions)

    # Cold-Start Detection (Synopsis Section 10: < 3 sessions requires rule-based fallback)
    if session_count < 3:
        if session_count == 0:
            return {
                "trainee_id": trainee_id,
                "is_cold_start": True,
                "session_count": 0,
                "features": None,
                "reason": "No assessment sessions recorded yet."
            }
        
        # 1 or 2 sessions
        scores = [(s.score / max_score * 100.0) for s, max_score in sessions]
        errors = [s.errors for s, _ in sessions]
        avg_score = float(np.mean(scores))
        avg_errors = float(np.mean(errors))
        return {
            "trainee_id": trainee_id,
            "is_cold_start": True,
            "session_count": session_count,
            "features": {
                "overall_avg_score": round(avg_score, 2),
                "recent_avg_score": round(avg_score, 2),
                "score_trend_slope": 0.0,
                "avg_error_rate": round(avg_errors, 2),
                "recent_error_rate": round(avg_errors, 2),
                "avg_time_seconds": round(float(np.mean([s.time_seconds for s, _ in sessions])), 1),
                "performance_consistency": 0.0,
                "session_count": session_count
            },
            "reason": f"Only {session_count} session(s) recorded. Minimum 3 sessions required for reliable temporal trends."
        }

    # Sufficient history: compute complete feature vector
    scores = [(s.score / max_score * 100.0) for s, max_score in sessions]
    errors = [s.errors for s, _ in sessions]
    times = [s.time_seconds for s, _ in sessions]

    # Temporal feature: first 3 vs last 3 sessions
    initial_3_avg = float(np.mean(scores[:3]))
    recent_3_avg = float(np.mean(scores[-3:]))
    score_trend_slope = recent_3_avg - initial_3_avg

    recent_3_errors = float(np.mean(errors[-3:]))
    overall_avg_errors = float(np.mean(errors))
    overall_avg_score = float(np.mean(scores))
    performance_consistency = float(np.std(scores))

    features = {
        "overall_avg_score": round(overall_avg_score, 2),
        "recent_avg_score": round(recent_3_avg, 2),
        "score_trend_slope": round(score_trend_slope, 2),
        "avg_error_rate": round(overall_avg_errors, 2),
        "recent_error_rate": round(recent_3_errors, 2),
        "avg_time_seconds": round(float(np.mean(times)), 1),
        "performance_consistency": round(performance_consistency, 2),
        "session_count": session_count
    }

    return {
        "trainee_id": trainee_id,
        "is_cold_start": False,
        "session_count": session_count,
        "features": features,
        "feature_vector": [features[col] for col in FEATURE_COLUMNS]
    }
