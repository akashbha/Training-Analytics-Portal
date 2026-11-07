"""Standalone FastAPI Microservice for Trainee Risk Prediction.
Loads the champion model trained by train_models.py at startup.
Refuses to start if the serialized model artifact is missing.
Exposes /health, /model-info, and /predict endpoints with strict input validation.
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

# Ensure backend root is in PYTHONPATH
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

MODEL_PATH = Path(
    os.getenv(
        "ML_MODEL_PATH",
        str(BACKEND_DIR / "app" / "ml" / "risk_model.joblib"),
    )
)

if not MODEL_PATH.exists():
    raise RuntimeError(
        f"Critical Error: Saved model artifact not found at {MODEL_PATH}. "
        "The ML prediction service refuses to start without a trained model."
    )

artifact = joblib.load(MODEL_PATH)
model = artifact["model"]
model_name = artifact.get("model_name", "Random Forest")
model_version = artifact.get("version", "1.0.0")
threshold_used = float(artifact.get("threshold", 0.67))
feature_list = artifact.get(
    "features",
    [
        "last_1_score",
        "last_3_mean_score",
        "overall_mean_score",
        "slope_last_5",
        "error_rate",
        "mean_time",
        "session_count",
        "score_std",
    ],
)
training_date = artifact.get("training_date", "2026-11-07")
feature_importances = artifact.get("feature_importances", {})

app = FastAPI(
    title="Trainee Performance Risk Prediction Service",
    description="Dedicated microservice serving early intervention predictions for trainees at risk of failing.",
    version=model_version,
)


class PredictRequest(BaseModel):
    last_1_score: float = Field(..., ge=0.0, le=100.0, description="Score percentage of most recent prior session")
    last_3_mean_score: float = Field(..., ge=0.0, le=100.0, description="Mean score percentage of last 3 prior sessions")
    overall_mean_score: float = Field(..., ge=0.0, le=100.0, description="Mean score percentage across all prior sessions")
    slope_last_5: float = Field(..., description="Linear regression slope over last 5 prior score percentages")
    error_rate: float = Field(..., ge=0.0, description="Mean error count per session")
    mean_time: float = Field(..., ge=0.0, description="Mean completion duration in seconds")
    session_count: int = Field(..., ge=5, description="Count of prior assessment sessions (minimum 5)")
    score_std: float = Field(..., ge=0.0, description="Standard deviation of prior score percentages")


class TopFeatureItem(BaseModel):
    feature: str
    importance: float
    explanation: str


class PredictResponse(BaseModel):
    probability: float
    label: int
    threshold: float
    threshold_unit: str = "probability"
    model_version: str
    top_features: List[TopFeatureItem]


@app.get("/health")
def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/model-info")
def model_info() -> Dict[str, Any]:
    """Returns model metadata, version, training date, threshold, and feature specification."""
    return {
        "model_name": model_name,
        "version": model_version,
        "training_date": training_date,
        "threshold_used": round(threshold_used, 4),
        "feature_list": feature_list,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    """Computes risk probability, binary decision label, and top contributing factors."""
    input_vector = np.array(
        [
            [
                payload.last_1_score,
                payload.last_3_mean_score,
                payload.overall_mean_score,
                payload.slope_last_5,
                payload.error_rate,
                payload.mean_time,
                payload.session_count,
                payload.score_std,
            ]
        ]
    )

    probabilities = model.predict_proba(input_vector)[0]
    prob = float(probabilities[1]) if len(probabilities) > 1 else float(probabilities[0])
    label = 1 if prob >= threshold_used else 0

    # Top 2 contributing features using Random Forest feature importances as global explanation
    sorted_features = sorted(feature_importances.items(), key=lambda item: item[1], reverse=True)[:2]
    top_features = [
        TopFeatureItem(
            feature=feat,
            importance=round(float(imp), 4),
            explanation="Global Random Forest feature importance",
        )
        for feat, imp in sorted_features
    ]

    return PredictResponse(
        probability=round(prob, 4),
        label=label,
        threshold=round(threshold_used, 4),
        threshold_unit="probability",
        model_version=model_version,
        top_features=top_features,
    )
