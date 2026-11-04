"""Unit tests for Step 7: Model Evaluation and Benchmark Comparison.
Tests label definition on small fixtures, baseline rule matches hand-computed cases,
and RBAC protection on GET /admin/model-evaluation.
"""

from unittest.mock import MagicMock
from app.core.constants import PASS_THRESHOLD
from app.services.evaluation_service import (
    compute_ground_truth_label,
    compute_baseline_prediction,
    calculate_binary_metrics
)


def _make_mock_session(score: float, max_score: float = 100.0):
    sess = MagicMock()
    sess.score = score
    return sess, max_score


def test_label_definition_on_small_fixture():
    """Ground truth label must be 1 if average of held-out 2 sessions < PASS_THRESHOLD (60.0), else 0."""
    # Case 1: average 52.5% < 60.0 -> at risk (1)
    held_out_at_risk = [
        _make_mock_session(50.0, 100.0),
        _make_mock_session(55.0, 100.0)
    ]
    assert compute_ground_truth_label(held_out_at_risk) == 1

    # Case 2: exactly 60.0% boundary -> on track (0), because rule is strictly below PASS_THRESHOLD
    held_out_boundary = [
        _make_mock_session(60.0, 100.0),
        _make_mock_session(60.0, 100.0)
    ]
    assert compute_ground_truth_label(held_out_boundary) == 0

    # Case 3: average 75.0% >= 60.0 -> on track (0)
    held_out_passing = [
        _make_mock_session(70.0, 100.0),
        _make_mock_session(80.0, 100.0)
    ]
    assert compute_ground_truth_label(held_out_passing) == 0

    # Case 4: varying max_scores (e.g. 25/50 = 50%, 40/50 = 80%, avg = 65% >= 60%) -> on track (0)
    held_out_varying = [
        _make_mock_session(25.0, 50.0),
        _make_mock_session(40.0, 50.0)
    ]
    assert compute_ground_truth_label(held_out_varying) == 0


def test_baseline_rule_matches_hand_computed_case():
    """Baseline rule and binary metrics match a hand-computed 4-sample case.
    Hand calculation:
      Sample 1: earlier=[50, 55, 58] (avg 54.33 < 60) -> pred=1, true=1 (TP)
      Sample 2: earlier=[50, 52, 56] (avg 52.67 < 60) -> pred=1, true=0 (FP)
      Sample 3: earlier=[70, 80, 85] (avg 78.33 >= 60)-> pred=0, true=0 (TN)
      Sample 4: earlier=[65, 70, 72] (avg 69.00 >= 60)-> pred=0, true=1 (FN)
    Expected:
      TP=1, FP=1, TN=1, FN=1
      Precision = 1 / 2 = 0.5000
      Recall = 1 / 2 = 0.5000
      F1 = 2 * (0.5 * 0.5) / (0.5 + 0.5) = 0.5000
    """
    # Verify baseline prediction on earlier sessions
    earlier_s1 = [_make_mock_session(50.0), _make_mock_session(55.0), _make_mock_session(58.0)]
    earlier_s2 = [_make_mock_session(50.0), _make_mock_session(52.0), _make_mock_session(56.0)]
    earlier_s3 = [_make_mock_session(70.0), _make_mock_session(80.0), _make_mock_session(85.0)]
    earlier_s4 = [_make_mock_session(65.0), _make_mock_session(70.0), _make_mock_session(72.0)]

    pred1 = compute_baseline_prediction(earlier_s1)
    pred2 = compute_baseline_prediction(earlier_s2)
    pred3 = compute_baseline_prediction(earlier_s3)
    pred4 = compute_baseline_prediction(earlier_s4)

    assert pred1 == 1
    assert pred2 == 1
    assert pred3 == 0
    assert pred4 == 0

    y_true = [1, 0, 0, 1]
    y_pred = [pred1, pred2, pred3, pred4]

    metrics = calculate_binary_metrics(y_true, y_pred)

    assert metrics["true_positives"] == 1
    assert metrics["false_positives"] == 1
    assert metrics["true_negatives"] == 1
    assert metrics["false_negatives"] == 1
    assert metrics["precision"] == 0.5000
    assert metrics["recall"] == 0.5000
    assert metrics["f1"] == 0.5000


def test_model_evaluation_endpoint_admin_only(client, admin_headers, trainer_headers, trainee_headers):
    """GET /admin/model-evaluation must strictly require admin role."""
    # 1. Unauthenticated -> 401
    res_unauth = client.get("/admin/model-evaluation")
    assert res_unauth.status_code == 401

    # 2. Trainee authenticated -> 403
    res_trainee = client.get(
        "/admin/model-evaluation",
        headers=trainee_headers
    )
    assert res_trainee.status_code == 403

    # 3. Trainer authenticated -> 403
    res_trainer = client.get(
        "/admin/model-evaluation",
        headers=trainer_headers
    )
    assert res_trainer.status_code == 403

    # 4. Admin authenticated -> 200 with complete metrics payload
    res_admin = client.get("/admin/model-evaluation", headers=admin_headers)
    assert res_admin.status_code == 200

    data = res_admin.json()
    assert "sample_size" in data
    assert "positive_labels" in data
    assert "label_definition" in data
    assert "baseline_rule" in data
    assert "baseline" in data
    assert "model" in data
    assert "model_beats_baseline" in data
    assert data["sample_size"] >= 0
    assert data["pass_threshold"] == PASS_THRESHOLD
    assert isinstance(data["baseline"]["f1"], (int, float))
    assert isinstance(data["model"]["f1"], (int, float))
