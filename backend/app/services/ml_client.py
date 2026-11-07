"""Integration client connecting the main application to the ML prediction microservice.
Reuses feature extraction from scripts.build_ml_dataset.
Enforces a 2-second timeout and provides graceful degradation to rule-based fallback
when session history is insufficient (< 5 sessions) or the service is unavailable.
"""

import os
from typing import Any, Dict, List, Optional
import httpx
import numpy as np
from sqlalchemy.orm import Session

from app.models.session import Session as AssessmentSession
from app.models.module import Module
from app.core.constants import PASS_THRESHOLD
from scripts.build_ml_dataset import compute_decision_features

ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://127.0.0.1:8001")
REQUEST_TIMEOUT_SECONDS = 2.0


def predict_trainee_risk(db: Session, trainee_id: int) -> Dict[str, Any]:
    """Evaluates risk of failing subsequent sessions for a given trainee.
    Returns ML prediction when >= 5 sessions and service is available;
    otherwise falls back to rule-based evaluation.
    """
    sessions = (
        db.query(AssessmentSession, Module.max_score)
        .join(Module, Module.id == AssessmentSession.module_id)
        .filter(AssessmentSession.trainee_id == trainee_id)
        .order_by(AssessmentSession.created_at.asc(), AssessmentSession.id.asc())
        .all()
    )

    session_count = len(sessions)

    # 1. Fallback: insufficient session history (less than 5 sessions)
    if session_count < 5:
        if session_count == 0:
            return {
                "method": "rule",
                "reason": "Trainee has no completed assessment sessions",
                "label": 0,
                "probability": None,
                "threshold": PASS_THRESHOLD,
                "threshold_unit": "score_percentage",
                "top_features": [],
                "model_version": None,
            }

        # Calculate average of available sessions
        scores = [(s.score * 100.0 / max_score) for s, max_score in sessions]
        avg_score = float(np.mean(scores))
        rule_label = 1 if avg_score < PASS_THRESHOLD else 0

        return {
            "method": "rule",
            "reason": (
                f"Trainee has {session_count} session(s) (minimum 5 required for ML prediction); "
                "evaluated using rule fallback"
            ),
            "label": rule_label,
            "probability": None,
            "threshold": PASS_THRESHOLD,
            "threshold_unit": "score_percentage",
            "top_features": [],
            "model_version": None,
        }

    # 2. Extract features using identical logic from build_ml_dataset
    features = compute_decision_features(sessions)

    # 3. Call ML prediction microservice with 2.0-second timeout
    try:
        response = httpx.post(
            f"{ML_SERVICE_URL}/predict",
            json=features,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        if response.status_code == 200:
            data = response.json()
            return {
                "method": "ml",
                "reason": None,
                "label": data["label"],
                "probability": data["probability"],
                "threshold": data["threshold"],
                "threshold_unit": data.get("threshold_unit", "probability"),
                "top_features": data.get("top_features", []),
                "model_version": data.get("model_version"),
            }
        else:
            # Service error fallback
            rule_label = 1 if features["last_3_mean_score"] < PASS_THRESHOLD else 0
            return {
                "method": "rule",
                "reason": f"ML service returned status {response.status_code}; evaluated using rule fallback",
                "label": rule_label,
                "probability": None,
                "threshold": PASS_THRESHOLD,
                "threshold_unit": "score_percentage",
                "top_features": [],
                "model_version": None,
            }

    except Exception:
        # Microservice unreachable, connection error, or timeout
        rule_label = 1 if features["last_3_mean_score"] < PASS_THRESHOLD else 0
        return {
            "method": "rule",
            "reason": "ML service is unreachable or timed out; evaluated using rule fallback",
            "label": rule_label,
            "probability": None,
            "threshold": PASS_THRESHOLD,
            "threshold_unit": "score_percentage",
            "top_features": [],
            "model_version": None,
        }
