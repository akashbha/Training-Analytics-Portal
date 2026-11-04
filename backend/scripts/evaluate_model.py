#!/usr/bin/env python3
"""CLI Script: Model Evaluation vs Baseline Rule.
Holds out the last 2 sessions for trainees with >= 5 sessions, defines 'at risk' as
average of held-out sessions < PASS_THRESHOLD, and evaluates predictor vs baseline.
Saves results to backend/app/ml/evaluation.json.
"""

import sys
import os

# Ensure backend directory is in python path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.db.session import SyncSessionLocal
from app.services.evaluation_service import evaluate_model_vs_baseline, EVALUATION_JSON_PATH


def main():
    print("=" * 70)
    print("TRAINING ANALYTICS PORTAL — MODEL EVALUATION & BENCHMARK")
    print("=" * 70)

    db = SyncSessionLocal()
    try:
        results = evaluate_model_vs_baseline(db, save_to_file=True)

        sample_size = results["sample_size"]
        pos_labels = results["positive_labels"]
        neg_labels = results["negative_labels"]
        base = results["baseline"]
        model = results["model"]

        print(f"\nSample Size (trainees with >= 5 sessions): {sample_size}")
        print(f"Positive Labels (ground truth at risk)   : {pos_labels} ({pos_labels / sample_size * 100:.1f}%)")
        print(f"Negative Labels (on track)              : {neg_labels} ({neg_labels / sample_size * 100:.1f}%)")
        print(f"\nLabel Definition : {results['label_definition']}")
        print(f"Baseline Rule    : {results['baseline_rule']}")

        print("\n" + "-" * 70)
        print(f"{'Metric':<20} | {'Baseline Rule':<20} | {'ML Predictor (' + results['model_name'] + ')':<25}")
        print("-" * 70)
        print(f"{'Precision':<20} | {base['precision']:<20.4f} | {model['precision']:<25.4f}")
        print(f"{'Recall':<20} | {base['recall']:<20.4f} | {model['recall']:<25.4f}")
        print(f"{'F1-Score':<20} | {base['f1']:<20.4f} | {model['f1']:<25.4f}")
        print(f"{'True Positives':<20} | {base['true_positives']:<20} | {model['true_positives']:<25}")
        print(f"{'False Positives':<20} | {base['false_positives']:<20} | {model['false_positives']:<25}")
        print(f"{'True Negatives':<20} | {base['true_negatives']:<20} | {model['true_negatives']:<25}")
        print(f"{'False Negatives':<20} | {base['false_negatives']:<20} | {model['false_negatives']:<25}")
        print("-" * 70)

        print(f"\nResults written to: {EVALUATION_JSON_PATH}")
        print("\n" + "=" * 70)
        print("OUTCOME ASSESSMENT:")
        if results["model_beats_baseline"]:
            print(">>> The ML model beats the baseline rule on F1 score.")
        else:
            print(">>> The ML model does NOT beat the baseline rule.")
            print(f">>> Baseline F1 ({base['f1']:.4f}) > Model F1 ({model['f1']:.4f}).")
            print(">>> In accordance with project policy, no artificial hyperparameter tuning was applied.")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    main()

