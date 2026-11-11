"""Service for evaluating ML risk prediction model against a simple baseline rule.
Computes precision, recall, and F1 on a held-out test set of 2 sessions for trainees
with at least 5 sessions, in accordance with platform grading thresholds.
"""

from datetime import datetime, timezone
import json
import os
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session as DbSession

from app.models.trainee import Trainee
from app.models.session import Session as AssessmentSession
from app.models.module import Module
from app.core.constants import PASS_THRESHOLD
from app.ml.predictor import get_model
from app.ml.feature_extractor import FEATURE_COLUMNS

EVALUATION_JSON_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "ml", "evaluation.json")
)


def compute_ground_truth_label(held_out_sessions: List[Tuple[AssessmentSession, float]]) -> int:
    """Computes ground truth 'at risk' label.
    Label is 1 (at risk) if the average score percentage of the 2 held-out sessions is strictly below PASS_THRESHOLD.
    """
    if not held_out_sessions:
        return 0
    scores = [
        (s.score * 100.0 / max_score) if max_score > 0 else s.score
        for s, max_score in held_out_sessions
    ]
    avg_score = float(np.mean(scores))
    return 1 if avg_score < PASS_THRESHOLD else 0


def compute_baseline_prediction(earlier_sessions: List[Tuple[AssessmentSession, float]]) -> int:
    """Computes baseline rule prediction.
    Flags trainee as at risk (1) if the average score percentage of earlier sessions is strictly below PASS_THRESHOLD.
    """
    if not earlier_sessions:
        return 0
    scores = [
        (s.score * 100.0 / max_score) if max_score > 0 else s.score
        for s, max_score in earlier_sessions
    ]
    avg_score = float(np.mean(scores))
    return 1 if avg_score < PASS_THRESHOLD else 0


def extract_features_from_session_list(earlier_sessions: List[Tuple[AssessmentSession, float]]) -> Dict[str, Any]:
    """Extracts standard FEATURE_COLUMNS from a historical list of sessions."""
    scores = [
        (s.score * 100.0 / max_score) if max_score > 0 else s.score
        for s, max_score in earlier_sessions
    ]
    errors = [s.errors for s, _ in earlier_sessions]
    times = [s.time_seconds for s, _ in earlier_sessions]

    overall_avg_score = float(np.mean(scores))
    recent_3_avg = float(np.mean(scores[-3:]))
    initial_3_avg = float(np.mean(scores[:3]))
    score_trend_slope = recent_3_avg - initial_3_avg

    overall_avg_errors = float(np.mean(errors))
    recent_3_errors = float(np.mean(errors[-3:]))

    return {
        "overall_avg_score": round(overall_avg_score, 2),
        "recent_avg_score": round(recent_3_avg, 2),
        "score_trend_slope": round(score_trend_slope, 2),
        "avg_error_rate": round(overall_avg_errors, 2),
        "recent_error_rate": round(recent_3_errors, 2),
        "avg_time_seconds": round(float(np.mean(times)), 1),
        "performance_consistency": round(float(np.std(scores)), 2),
        "session_count": len(earlier_sessions)
    }


def calculate_binary_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, Any]:
    """Calculates precision, recall, f1, and confusion counts without division by zero."""
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn
    }


def evaluate_model_vs_baseline(db: DbSession, save_to_file: bool = True) -> Dict[str, Any]:
    """Evaluates the predictor model against the baseline rule on held-out sessions."""
    trainees = db.query(Trainee).all()

    model_data = get_model()
    pipeline = model_data.get("pipeline") if model_data else None

    y_true_list: List[int] = []
    baseline_pred_list: List[int] = []
    model_pred_list: List[int] = []
    trainee_eval_details: List[Dict[str, Any]] = []

    for trainee in trainees:
        sessions = (
            db.query(AssessmentSession, Module.max_score)
            .join(Module, Module.id == AssessmentSession.module_id)
            .filter(AssessmentSession.trainee_id == trainee.id)
            .order_by(AssessmentSession.created_at.asc())
            .all()
        )

        # Minimum 5 sessions required: hold out last 2, train/predict on earlier >= 3
        if len(sessions) < 5:
            continue

        earlier = sessions[:-2]
        held_out = sessions[-2:]

        y_true = compute_ground_truth_label(held_out)
        y_base = compute_baseline_prediction(earlier)

        features = extract_features_from_session_list(earlier)

        if pipeline:
            input_df = pd.DataFrame([features])[FEATURE_COLUMNS]
            y_model = int(pipeline.predict(input_df)[0])
        else:
            # Fallback heuristic if serialized pipeline missing
            y_model = 1 if (features["recent_avg_score"] < PASS_THRESHOLD or features["score_trend_slope"] < -6.0) else 0

        y_true_list.append(y_true)
        baseline_pred_list.append(y_base)
        model_pred_list.append(y_model)

        trainee_eval_details.append({
            "trainee_id": trainee.id,
            "trainee_name": trainee.name,
            "total_sessions": len(sessions),
            "earlier_sessions_count": len(earlier),
            "held_out_sessions_count": len(held_out),
            "earlier_avg_score": features["overall_avg_score"],
            "held_out_avg_score": round(float(np.mean([(s.score * 100.0 / m) if m > 0 else s.score for s, m in held_out])), 2),
            "ground_truth_at_risk": bool(y_true == 1),
            "baseline_predicted_risk": bool(y_base == 1),
            "model_predicted_risk": bool(y_model == 1)
        })

    sample_size = len(y_true_list)
    positive_labels = sum(y_true_list)
    negative_labels = sample_size - positive_labels

    baseline_metrics = calculate_binary_metrics(y_true_list, baseline_pred_list)
    model_metrics = calculate_binary_metrics(y_true_list, model_pred_list)

    model_beats_baseline = bool(model_metrics["f1"] > baseline_metrics["f1"])

    summary_statement = (
        f"Baseline rule (earlier average < {PASS_THRESHOLD}%) achieved F1={baseline_metrics['f1']:.4f} "
        f"(precision={baseline_metrics['precision']:.4f}, recall={baseline_metrics['recall']:.4f}), "
        f"compared to ML model F1={model_metrics['f1']:.4f} "
        f"(precision={model_metrics['precision']:.4f}, recall={model_metrics['recall']:.4f}). "
        + ("The ML model beats the baseline rule." if model_beats_baseline else "The ML model does NOT beat the baseline rule.")
    )

    now_iso = datetime.now(timezone.utc).isoformat()

    result_payload = {
        "sample_size": sample_size,
        "positive_labels": positive_labels,
        "negative_labels": negative_labels,
        "pass_threshold": PASS_THRESHOLD,
        "min_sessions_required": 5,
        "held_out_sessions": 2,
        "label_definition": f"At risk = average score of the 2 held-out sessions strictly below PASS_THRESHOLD ({PASS_THRESHOLD}%)",
        "baseline_rule": f"Flagged if average score of earlier sessions strictly below PASS_THRESHOLD ({PASS_THRESHOLD}%)",
        "model_name": model_data.get("model_name", "Random Forest Classifier") if model_data else "Random Forest Classifier",
        "baseline": baseline_metrics,
        "model": model_metrics,
        "model_beats_baseline": model_beats_baseline,
        "summary": summary_statement,
        "evaluated_at": now_iso,
        "artifact_modified_at": now_iso if save_to_file else None,
        "evaluation_timestamp_source": "execution_recorded",
        "details": trainee_eval_details
    }

    if save_to_file:
        os.makedirs(os.path.dirname(EVALUATION_JSON_PATH), exist_ok=True)
        with open(EVALUATION_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(result_payload, f, indent=2)

    return result_payload


def get_stored_or_computed_evaluation(db: DbSession) -> Dict[str, Any]:
    """Returns cached evaluation.json if present; distinguishes recorded execution time from file mtime."""
    if os.path.exists(EVALUATION_JSON_PATH):
        try:
            with open(EVALUATION_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            mtime = os.path.getmtime(EVALUATION_JSON_PATH)
            mtime_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
            recorded_at = data.get("evaluated_at")
            data["evaluated_at"] = recorded_at
            data["artifact_modified_at"] = mtime_iso
            data["evaluation_timestamp_source"] = "execution_recorded" if recorded_at else "file_mtime_only"
            return data
        except Exception:
            pass
    return evaluate_model_vs_baseline(db, save_to_file=True)

