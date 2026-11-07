"""Temporal ML dataset builder for trainee performance prediction.
Constructs a leakage-safe dataset with one row per trainee per decision point.
Decision point k >= 5: features computed strictly from sessions 1..k (prior to decision point).
Label computed strictly from the next 2 sessions (k+1 and k+2): 1 if mean score < PASS_THRESHOLD, else 0.
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union
import csv
import numpy as np

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.constants import PASS_THRESHOLD
from app.db.session import SyncSessionLocal
from app.models.trainee import Trainee
from app.models.session import Session as AssessmentSession
from app.models.module import Module

FEATURE_COLUMNS = [
    "last_1_score",
    "last_3_mean_score",
    "overall_mean_score",
    "slope_last_5",
    "error_rate",
    "mean_time",
    "session_count",
    "score_std",
]

DATASET_COLUMNS = ["trainee_id", "decision_index"] + FEATURE_COLUMNS + ["label"]


def _parse_session_entry(entry: Any) -> Dict[str, float]:
    """Extracts normalized score percentage, errors, and duration from an ORM object, Row, or tuple."""
    if hasattr(entry, "__len__") and not hasattr(entry, "score"):
        sess, max_score = entry[0], float(entry[1])
    elif isinstance(entry, (tuple, list)):
        sess, max_score = entry[0], float(entry[1])
    else:
        sess = entry
        max_score = float(
            sess.module.max_score
            if hasattr(sess, "module") and sess.module
            else getattr(sess, "max_score", 100.0)
        )

    score_val = float(sess.score)
    errors_val = float(sess.errors)
    time_val = float(sess.time_seconds)

    # Calculate normalized score percentage
    score_pct = (score_val * 100.0) / max_score if max_score > 0 else score_val

    return {
        "score_pct": score_pct,
        "errors": errors_val,
        "time_seconds": time_val,
    }


def compute_decision_features(past_sessions: List[Any]) -> Dict[str, Union[float, int]]:
    """Computes the 8 analytical features using ONLY historical sessions strictly prior to the decision point."""
    if len(past_sessions) < 5:
        raise ValueError(f"Decision point requires at least 5 past sessions, got {len(past_sessions)}")

    parsed = [_parse_session_entry(s) for s in past_sessions]
    scores = [p["score_pct"] for p in parsed]
    errors = [p["errors"] for p in parsed]
    times = [p["time_seconds"] for p in parsed]

    # Linear regression slope over the last 5 session score percentages
    slope_last_5 = float(np.polyfit(np.arange(5), scores[-5:], 1)[0])

    return {
        "last_1_score": round(float(scores[-1]), 4),
        "last_3_mean_score": round(float(np.mean(scores[-3:])), 4),
        "overall_mean_score": round(float(np.mean(scores)), 4),
        "slope_last_5": round(slope_last_5, 4),
        "error_rate": round(float(np.mean(errors)), 4),
        "mean_time": round(float(np.mean(times)), 4),
        "session_count": int(len(past_sessions)),
        "score_std": round(float(np.std(scores)), 4),
    }


def compute_decision_label(future_sessions: List[Any]) -> int:
    """Computes binary risk label using strictly the next 2 sessions after the decision point.
    Returns 1 if mean score percentage is strictly below PASS_THRESHOLD, else 0.
    """
    if len(future_sessions) < 2:
        raise ValueError(f"Label computation requires at least 2 future sessions, got {len(future_sessions)}")

    parsed = [_parse_session_entry(s) for s in future_sessions[:2]]
    scores = [p["score_pct"] for p in parsed]
    mean_future_score = float(np.mean(scores))
    return 1 if mean_future_score < PASS_THRESHOLD else 0


def build_dataset_rows_for_trainee(sessions: List[Any], trainee_id: int) -> List[Dict[str, Any]]:
    """Builds leakage-safe dataset rows for a single trainee across all valid decision points.
    A valid decision point k satisfies:
      - k >= 5 (minimum 5 past sessions)
      - k + 2 <= N (at least 2 future sessions)
    """
    n = len(sessions)
    rows: List[Dict[str, Any]] = []

    # Valid decision points: k from 5 up to n - 2 (inclusive)
    for k in range(5, n - 2 + 1):
        past = sessions[:k]
        future = sessions[k : k + 2]

        features = compute_decision_features(past)
        label = compute_decision_label(future)

        row = {
            "trainee_id": trainee_id,
            "decision_index": k,
            **features,
            "label": label,
        }
        rows.append(row)

    return rows


def build_dataset(db: Any, output_path: Union[str, Path, None] = None) -> List[Dict[str, Any]]:
    """Builds the full dataset across all trainees in the database and optionally writes to CSV."""
    trainees = db.query(Trainee).order_by(Trainee.id.asc()).all()
    all_rows: List[Dict[str, Any]] = []

    for trainee in trainees:
        sessions = (
            db.query(AssessmentSession, Module.max_score)
            .join(Module, Module.id == AssessmentSession.module_id)
            .filter(AssessmentSession.trainee_id == trainee.id)
            .order_by(AssessmentSession.created_at.asc(), AssessmentSession.id.asc())
            .all()
        )
        trainee_rows = build_dataset_rows_for_trainee(sessions, trainee_id=trainee.id)
        all_rows.extend(trainee_rows)

    if output_path:
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=DATASET_COLUMNS)
            writer.writeheader()
            for r in all_rows:
                writer.writerow(r)

    return all_rows


def main() -> None:
    """Entry point: queries database, builds dataset, writes dataset.csv, and prints summary metrics."""
    backend_dir = Path(__file__).resolve().parent.parent
    output_path = backend_dir / "app" / "ml" / "dataset.csv"

    db = SyncSessionLocal()
    try:
        rows = build_dataset(db, output_path=output_path)
    finally:
        db.close()

    total_rows = len(rows)
    positives = sum(1 for r in rows if r["label"] == 1)
    negatives = total_rows - positives
    pos_rate = (positives / total_rows * 100.0) if total_rows > 0 else 0.0
    trainees_in_dataset = len(set(r["trainee_id"] for r in rows))

    print("========================================")
    print("  ML Dataset Builder Execution Summary  ")
    print("========================================")
    print(f"Output path:          {output_path}")
    print(f"Total rows:           {total_rows}")
    print(f"Positive count (1):   {positives}")
    print(f"Negative count (0):   {negatives}")
    print(f"Positive rate:        {pos_rate:.2f}% ({positives}/{total_rows})")
    print(f"Trainees in dataset:  {trainees_in_dataset}")
    print("========================================")


if __name__ == "__main__":
    main()
