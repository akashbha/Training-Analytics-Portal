"""Training and validation pipeline for trainee risk prediction models.
Implements:
1. Grouped train/test split (GroupShuffleSplit by trainee_id, test_size=0.2, random_state=42).
2. Grouped 5-fold cross-validation on the training set (GroupKFold by trainee_id).
3. Baseline models: Majority class and Rule-based (last_3_mean_score < PASS_THRESHOLD).
4. Machine learning models: Logistic Regression (standardized, class_weight='balanced')
   and Random Forest (n_estimators=200, class_weight='balanced', random_state=42).
5. CV out-of-fold probability threshold selection targeting recall >= 0.80 with highest precision.
6. Single final evaluation on the held-out test set trainees.
"""

import os
import sys
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit, GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
)

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.constants import PASS_THRESHOLD

BACKEND_DIR = Path(__file__).resolve().parent.parent
ML_DIR = BACKEND_DIR / "app" / "ml"
DATASET_PATH = ML_DIR / "dataset.csv"
SPLIT_PATH = ML_DIR / "split.json"
RESULTS_PATH = ML_DIR / "model_results.json"
MODEL_PATH = ML_DIR / "model.joblib"

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


def predict_majority(X: Any) -> np.ndarray:
    """Majority baseline: always predicts class 0."""
    n = len(X) if hasattr(X, "__len__") else 1
    return np.zeros(n, dtype=int)


def predict_rule(last_3_mean_scores: Any) -> np.ndarray:
    """Rule baseline: predict 1 if last_3_mean_score < PASS_THRESHOLD, else 0."""
    scores = np.asarray(last_3_mean_scores, dtype=float)
    return (scores < PASS_THRESHOLD).astype(int)


def select_probability_threshold(
    y_true: np.ndarray,
    oof_probs: np.ndarray,
    min_recall: float = 0.80,
) -> Tuple[float, float, float, bool]:
    """Selects probability threshold on out-of-fold predictions to reach recall >= min_recall with highest precision.

    Returns:
        (chosen_threshold, oof_recall, oof_precision, target_reached)
    """
    candidate_thresholds = np.linspace(0.01, 0.99, 99)
    valid_candidates = []

    for t in candidate_thresholds:
        preds = (oof_probs >= t).astype(int)
        rec = float(recall_score(y_true, preds, zero_division=0))
        prec = float(precision_score(y_true, preds, zero_division=0))
        if rec >= min_recall:
            valid_candidates.append((prec, rec, t))

    if valid_candidates:
        # Sort by precision desc, then recall desc, then closest to 0.5
        valid_candidates.sort(key=lambda item: (item[0], item[1], -abs(item[2] - 0.5)), reverse=True)
        best_prec, best_rec, best_t = valid_candidates[0]
        return float(best_t), float(best_rec), float(best_prec), True

    # If target recall not reached, select threshold with highest recall, then highest precision
    fallback_candidates = []
    for t in candidate_thresholds:
        preds = (oof_probs >= t).astype(int)
        rec = float(recall_score(y_true, preds, zero_division=0))
        prec = float(precision_score(y_true, preds, zero_division=0))
        fallback_candidates.append((rec, prec, t))

    fallback_candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    best_rec, best_prec, best_t = fallback_candidates[0]
    return float(best_t), float(best_rec), float(best_prec), False


def run_pipeline() -> Dict[str, Any]:
    """Executes the complete split, CV benchmark, threshold tuning, and held-out test evaluation."""
    assert DATASET_PATH.exists(), f"Dataset file not found at {DATASET_PATH}"
    df = pd.read_csv(DATASET_PATH)

    # 1. Grouped Train/Test Split
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(df, groups=df["trainee_id"]))

    train_df = df.iloc[train_idx].copy().reset_index(drop=True)
    test_df = df.iloc[test_idx].copy().reset_index(drop=True)

    train_trainees = sorted([int(tid) for tid in train_df["trainee_id"].unique()])
    test_trainees = sorted([int(tid) for tid in test_df["trainee_id"].unique()])

    # Assert no trainee_id appears in both sets
    overlap = set(train_trainees).intersection(set(test_trainees))
    assert len(overlap) == 0, f"Overlap between train and test trainees: {overlap}"

    split_payload = {
        "random_state": 42,
        "test_size": 0.2,
        "train_trainee_ids": train_trainees,
        "test_trainee_ids": test_trainees,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "train_positives": int(train_df["label"].sum()),
        "test_positives": int(test_df["label"].sum()),
    }
    SPLIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SPLIT_PATH, "w", encoding="utf-8") as f:
        json.dump(split_payload, f, indent=2)

    X_train = train_df[FEATURE_COLUMNS].values
    y_train = train_df["label"].values.astype(int)
    groups_train = train_df["trainee_id"].values

    X_test = test_df[FEATURE_COLUMNS].values
    y_test = test_df["label"].values.astype(int)

    # 2. Grouped 5-Fold Cross Validation Setup
    gkf = GroupKFold(n_splits=5)
    splits = list(gkf.split(X_train, y_train, groups=groups_train))

    # --- Baseline 1: Majority Class ---
    majority_cv_prec = []
    majority_cv_rec = []
    for trn_i, val_i in splits:
        preds = predict_majority(X_train[val_i])
        majority_cv_prec.append(float(precision_score(y_train[val_i], preds, zero_division=0)))
        majority_cv_rec.append(float(recall_score(y_train[val_i], preds, zero_division=0)))

    # --- Baseline 2: Rule Based ---
    rule_cv_prec = []
    rule_cv_rec = []
    rule_idx = FEATURE_COLUMNS.index("last_3_mean_score")
    for trn_i, val_i in splits:
        preds = predict_rule(X_train[val_i, rule_idx])
        rule_cv_prec.append(float(precision_score(y_train[val_i], preds, zero_division=0)))
        rule_cv_rec.append(float(recall_score(y_train[val_i], preds, zero_division=0)))

    # --- Model Setup ---
    model_factories = {
        "logistic_regression": lambda: Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "clf",
                    LogisticRegression(
                        class_weight="balanced",
                        random_state=42,
                        max_iter=1000,
                    ),
                ),
            ]
        ),
        "random_forest": lambda: RandomForestClassifier(
            n_estimators=200,
            class_weight="balanced",
            random_state=42,
        ),
    }

    cv_results = {
        "majority_baseline": {
            "cv_precision_mean": round(float(np.mean(majority_cv_prec)), 4),
            "cv_precision_std": round(float(np.std(majority_cv_prec)), 4),
            "cv_recall_mean": round(float(np.mean(majority_cv_rec)), 4),
            "cv_recall_std": round(float(np.std(majority_cv_rec)), 4),
        },
        "rule_baseline": {
            "cv_precision_mean": round(float(np.mean(rule_cv_prec)), 4),
            "cv_precision_std": round(float(np.std(rule_cv_prec)), 4),
            "cv_recall_mean": round(float(np.mean(rule_cv_rec)), 4),
            "cv_recall_std": round(float(np.std(rule_cv_rec)), 4),
        },
    }

    model_thresholds: Dict[str, float] = {}

    for name, factory in model_factories.items():
        oof_probs = np.zeros(len(train_df), dtype=float)

        for trn_i, val_i in splits:
            m = factory()
            m.fit(X_train[trn_i], y_train[trn_i])
            oof_probs[val_i] = m.predict_proba(X_train[val_i])[:, 1]

        t, oof_rec, oof_prec, reached = select_probability_threshold(y_train, oof_probs, min_recall=0.80)
        model_thresholds[name] = t

        # Compute per-fold metrics at the chosen threshold
        fold_precisions = []
        fold_recalls = []
        for trn_i, val_i in splits:
            val_preds = (oof_probs[val_i] >= t).astype(int)
            fold_precisions.append(float(precision_score(y_train[val_i], val_preds, zero_division=0)))
            fold_recalls.append(float(recall_score(y_train[val_i], val_preds, zero_division=0)))

        cv_results[name] = {
            "chosen_threshold": round(t, 4),
            "target_recall_reached": reached,
            "threshold_selection_oof_recall": round(oof_rec, 4),
            "threshold_selection_oof_precision": round(oof_prec, 4),
            "cv_precision_mean": round(float(np.mean(fold_precisions)), 4),
            "cv_precision_std": round(float(np.std(fold_precisions)), 4),
            "cv_recall_mean": round(float(np.mean(fold_recalls)), 4),
            "cv_recall_std": round(float(np.std(fold_recalls)), 4),
        }

    # 3. Final Evaluation on Held-Out Test Trainees (Executed Once)
    test_rows_count = len(test_df)
    test_trainees_count = len(test_trainees)

    # Test Majority
    test_maj_preds = predict_majority(X_test)
    test_results = {
        "majority_baseline": {
            "test_rows": test_rows_count,
            "test_trainees": test_trainees_count,
            "precision": round(float(precision_score(y_test, test_maj_preds, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, test_maj_preds, zero_division=0)), 4),
            "f1": round(float(f1_score(y_test, test_maj_preds, zero_division=0)), 4),
            "roc_auc": 0.5,
            "pr_auc": round(float(y_test.sum() / len(y_test)), 4),
            "confusion_matrix": confusion_matrix(y_test, test_maj_preds).tolist(),
        }
    }

    # Test Rule Baseline
    test_rule_preds = predict_rule(X_test[:, rule_idx])
    test_results["rule_baseline"] = {
        "test_rows": test_rows_count,
        "test_trainees": test_trainees_count,
        "precision": round(float(precision_score(y_test, test_rule_preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, test_rule_preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, test_rule_preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, test_rule_preds)), 4),
        "pr_auc": round(float(average_precision_score(y_test, test_rule_preds)), 4),
        "confusion_matrix": confusion_matrix(y_test, test_rule_preds).tolist(),
    }

    # Train on Full Train Set and Evaluate Models
    fitted_models = {}
    for name, factory in model_factories.items():
        full_model = factory()
        full_model.fit(X_train, y_train)
        fitted_models[name] = full_model

        test_probs = full_model.predict_proba(X_test)[:, 1]
        t = model_thresholds[name]
        test_preds = (test_probs >= t).astype(int)

        test_results[name] = {
            "test_rows": test_rows_count,
            "test_trainees": test_trainees_count,
            "threshold": round(t, 4),
            "precision": round(float(precision_score(y_test, test_preds, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, test_preds, zero_division=0)), 4),
            "f1": round(float(f1_score(y_test, test_preds, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, test_probs)), 4),
            "pr_auc": round(float(average_precision_score(y_test, test_probs)), 4),
            "confusion_matrix": confusion_matrix(y_test, test_preds).tolist(),
        }

    # Persist Results to model_results.json
    final_output = {
        "metadata": {
            "dataset": str(DATASET_PATH),
            "total_rows": len(df),
            "total_trainees": int(df["trainee_id"].nunique()),
            "train_rows": len(train_df),
            "train_trainees": len(train_trainees),
            "test_rows": len(test_df),
            "test_trainees": len(test_trainees),
            "features": FEATURE_COLUMNS,
            "pass_threshold": PASS_THRESHOLD,
        },
        "cv_results": cv_results,
        "test_results": test_results,
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)

    return final_output


def main() -> None:
    results = run_pipeline()
    cv = results["cv_results"]
    test = results["test_results"]

    print("==========================================================================================")
    print("                    TRAINEE RISK MODEL BENCHMARK & EVALUATION                             ")
    print("==========================================================================================")
    print(f"Data Split: Train Rows = {results['metadata']['train_rows']} ({results['metadata']['train_trainees']} trainees) | "
          f"Test Rows = {results['metadata']['test_rows']} ({results['metadata']['test_trainees']} trainees)")
    print("------------------------------------------------------------------------------------------")
    print(f"{'Model':<22} | {'CV Recall':<15} | {'CV Precision':<15} | {'Test Prec':<10} | {'Test Rec':<10} | {'Test F1':<10} | {'ROC-AUC':<10}")
    print("------------------------------------------------------------------------------------------")

    names = [
        ("majority_baseline", "Majority Baseline"),
        ("rule_baseline", "Rule Baseline"),
        ("logistic_regression", "Logistic Regression"),
        ("random_forest", "Random Forest"),
    ]

    for key, display in names:
        cv_rec = f"{cv[key]['cv_recall_mean']:.4f} +/- {cv[key]['cv_recall_std']:.4f}"
        cv_prec = f"{cv[key]['cv_precision_mean']:.4f} +/- {cv[key]['cv_precision_std']:.4f}"
        t_prec = f"{test[key]['precision']:.4f}"
        t_rec = f"{test[key]['recall']:.4f}"
        t_f1 = f"{test[key]['f1']:.4f}"
        t_auc = f"{test[key]['roc_auc']:.4f}"
        print(f"{display:<22} | {cv_rec:<15} | {cv_prec:<15} | {t_prec:<10} | {t_rec:<10} | {t_f1:<10} | {t_auc:<10}")

    print("==========================================================================================")
    print(f"Logistic Regression chosen threshold: {cv['logistic_regression']['chosen_threshold']:.4f} (OOF Rec={cv['logistic_regression']['threshold_selection_oof_recall']:.4f}, OOF Prec={cv['logistic_regression']['threshold_selection_oof_precision']:.4f})")
    print(f"Random Forest chosen threshold:       {cv['random_forest']['chosen_threshold']:.4f} (OOF Rec={cv['random_forest']['threshold_selection_oof_recall']:.4f}, OOF Prec={cv['random_forest']['threshold_selection_oof_precision']:.4f})")
    print("==========================================================================================")


if __name__ == "__main__":
    main()
