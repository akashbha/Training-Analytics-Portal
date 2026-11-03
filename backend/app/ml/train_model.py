# app/ml/train_model.py
"""ML Training and Validation Pipeline matching Project Synopsis Sections 10, 11, and 17.
Trains candidate models (Logistic Regression & Random Forest Classifier), computes
Precision, Recall, F1-Score, Confusion Matrix, and serializes the champion model artifact.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

from app.db.session import SyncSessionLocal
from app.models.trainee import Trainee
from app.models.session import Session as AssessmentSession
from app.models.module import Module
from app.ml.feature_extractor import FEATURE_COLUMNS, extract_trainee_features

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(MODEL_DIR, "model.joblib")
METRICS_FILE = os.path.join(MODEL_DIR, "metrics.json")


def generate_dataset_from_db():
    """Extracts features for all trainees with sufficient history and defines the target."""
    db = SyncSessionLocal()
    try:
        trainees = db.query(Trainee).all()
        rows = []

        for trainee in trainees:
            extracted = extract_trainee_features(db, trainee.id)
            if extracted["is_cold_start"] or not extracted["features"]:
                continue

            feat = extracted["features"]

            # Target Formulation (Synopsis Section 10):
            # Trainee requires attention if:
            # 1. Recent average score < 58.0% (struggling)
            # 2. Or significant negative trajectory trend (slope < -6.0%)
            # 3. Or consistently high recent errors (recent errors >= 4.0)
            target = 1 if (
                feat["recent_avg_score"] < 58.0
                or feat["score_trend_slope"] < -6.0
                or feat["recent_error_rate"] >= 4.0
            ) else 0

            row = {col: feat[col] for col in FEATURE_COLUMNS}
            row["requires_attention"] = target
            row["trainee_id"] = trainee.id
            rows.append(row)

        df = pd.DataFrame(rows)
        return df
    finally:
        db.close()


def train_and_evaluate_models():
    """Executes model training, candidate comparison, and model serialization."""
    print("=" * 65)
    print("TRAINING ANALYTICS PORTAL — ML MODEL TRAINING PIPELINE")
    print("=" * 65)

    df = generate_dataset_from_db()
    if len(df) < 10:
        print(f"Warning: Only {len(df)} trainees found with sufficient history. Need at least 10 for training.")
        return None

    print(f"Extracted {len(df)} trainee feature records across active cohorts.")
    print(f"Class distribution: {df['requires_attention'].value_counts().to_dict()} (1=Needs Attention, 0=On Track)")

    X = df[FEATURE_COLUMNS]
    y = df["requires_attention"]

    # Stratified Train/Test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if len(y.unique()) > 1 else None
    )

    # 1. Candidate Model A: Logistic Regression (Baseline)
    lr_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(random_state=42, class_weight="balanced"))
    ])
    lr_pipe.fit(X_train, y_train)
    lr_preds = lr_pipe.predict(X_test)

    lr_metrics = {
        "model": "Logistic Regression",
        "accuracy": round(float(accuracy_score(y_test, lr_preds)), 4),
        "precision": round(float(precision_score(y_test, lr_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, lr_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, lr_preds, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_test, lr_preds).tolist()
    }

    # 2. Candidate Model B: Random Forest Classifier (Champion)
    rf_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", RandomForestClassifier(
            n_estimators=100,
            max_depth=4,
            random_state=42,
            class_weight="balanced"
        ))
    ])
    rf_pipe.fit(X_train, y_train)
    rf_preds = rf_pipe.predict(X_test)

    rf_metrics = {
        "model": "Random Forest",
        "accuracy": round(float(accuracy_score(y_test, rf_preds)), 4),
        "precision": round(float(precision_score(y_test, rf_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, rf_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, rf_preds, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_test, rf_preds).tolist()
    }

    print("\n--- MODEL COMPARISON & VALIDATION RESULTS ---")
    print(f"Logistic Regression -> Acc: {lr_metrics['accuracy']:.2%}, Rec: {lr_metrics['recall']:.2%}, F1: {lr_metrics['f1']:.2%}")
    print(f"Random Forest       -> Acc: {rf_metrics['accuracy']:.2%}, Rec: {rf_metrics['recall']:.2%}, F1: {rf_metrics['f1']:.2%}")

    # Extract Feature Importances from Random Forest
    rf_model = rf_pipe.named_steps["classifier"]
    importances = {
        col: round(float(imp), 4)
        for col, imp in zip(FEATURE_COLUMNS, rf_model.feature_importances_)
    }
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    print("\nTop Contributing Risk Factors (Feature Importances):")
    for feat_name, imp in list(sorted_importances.items())[:5]:
        print(f"  • {feat_name:<26}: {imp:.4f}")

    # Select champion model prioritizing Recall (as specified in Synopsis Section 17)
    champion_pipeline = rf_pipe if rf_metrics["recall"] >= lr_metrics["recall"] else lr_pipe
    champion_name = "Random Forest" if champion_pipeline == rf_pipe else "Logistic Regression"
    champion_metrics = rf_metrics if champion_pipeline == rf_pipe else lr_metrics

    # Serialize trained pipeline to joblib
    joblib.dump({
        "pipeline": champion_pipeline,
        "feature_columns": FEATURE_COLUMNS,
        "model_name": champion_name,
        "feature_importances": sorted_importances
    }, MODEL_FILE)
    print(f"\nChampion model ({champion_name}) serialized to: {MODEL_FILE}")

    # Write evaluation metrics to json
    report = {
        "champion_model": champion_name,
        "evaluation_metrics": champion_metrics,
        "candidate_comparison": [lr_metrics, rf_metrics],
        "feature_importances": sorted_importances,
        "sample_size": len(df),
        "features_used": FEATURE_COLUMNS
    }
    with open(METRICS_FILE, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Metrics report saved to: {METRICS_FILE}")
    print("=" * 65 + "\n")
    return report


if __name__ == "__main__":
    train_and_evaluate_models()
