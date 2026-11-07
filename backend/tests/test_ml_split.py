"""Unit and leakage tests for grouped train/test split and baseline models.
Verifies zero trainee_id overlap between train and test sets,
correctness of the hand-computed rule baseline against PASS_THRESHOLD,
and that majority baseline predicts class 0 exclusively.
"""

import json
from pathlib import Path
import numpy as np
import pytest

from app.core.constants import PASS_THRESHOLD
from scripts.train_models import predict_majority, predict_rule


SPLIT_FILE = Path(__file__).resolve().parent.parent / "app" / "ml" / "split.json"
DATASET_FILE = Path(__file__).resolve().parent.parent / "app" / "ml" / "dataset.csv"


def test_no_trainee_id_overlap_between_train_and_test():
    """Verify that split.json defines disjoint train and test trainee sets with zero overlap."""
    assert SPLIT_FILE.exists(), f"split.json not found at {SPLIT_FILE}"

    with open(SPLIT_FILE, "r", encoding="utf-8") as f:
        split_data = json.load(f)

    train_ids = set(split_data["train_trainee_ids"])
    test_ids = set(split_data["test_trainee_ids"])

    assert len(train_ids) > 0, "train_trainee_ids must not be empty"
    assert len(test_ids) > 0, "test_trainee_ids must not be empty"

    # Assert strictly no overlap
    overlap = train_ids.intersection(test_ids)
    assert len(overlap) == 0, f"Data leakage detected! Trainees found in both sets: {overlap}"
    assert train_ids.isdisjoint(test_ids)


def test_rule_baseline_matches_hand_computed_case():
    """Verify that rule baseline predicts 1 strictly when last_3_mean_score < PASS_THRESHOLD, else 0."""
    # Hand-computed test cases
    # PASS_THRESHOLD = 60.0
    assert PASS_THRESHOLD == 60.0

    scores = [59.9, 60.0, 60.1, 45.0, 80.0, 0.0]
    expected = [1, 0, 0, 1, 0, 1]

    preds = predict_rule(scores)
    np.testing.assert_array_equal(preds, expected)

    # Single value checks
    assert int(predict_rule([55.0])[0]) == 1
    assert int(predict_rule([60.0])[0]) == 0  # 60.0 is not strictly below 60.0
    assert int(predict_rule([75.0])[0]) == 0


def test_majority_baseline_predicts_only_0():
    """Verify that the majority class baseline predicts class 0 exclusively."""
    # Test on arbitrary batch sizes
    for n_samples in [1, 10, 100, 522]:
        mock_features = np.ones((n_samples, 8))
        preds = predict_majority(mock_features)

        assert len(preds) == n_samples
        assert np.all(preds == 0), "Majority baseline must predict 0 for all instances"
        assert 1 not in preds
        assert set(np.unique(preds)).issubset({0})
