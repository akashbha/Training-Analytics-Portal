"""Unit and safety tests for ML dataset builder (leakage-safe temporal dataset).
Verifies temporal decision point splitting, zero leakage of future sessions into features,
label windowing on strictly the next 2 sessions, session count edge cases,
and imported PASS_THRESHOLD usage.
"""

import inspect
import numpy as np
import pytest
from unittest.mock import MagicMock

from app.core.constants import PASS_THRESHOLD
import scripts.build_ml_dataset as bmd
from scripts.build_ml_dataset import (
    build_dataset_rows_for_trainee,
    compute_decision_features,
    compute_decision_label,
    FEATURE_COLUMNS,
    DATASET_COLUMNS
)


def _make_mock_session(score: float, max_score: float = 100.0, errors: int = 2, time_seconds: int = 1200):
    """Creates a mock assessment session with normalized score percentage."""
    sess = MagicMock()
    sess.score = float(score)
    sess.errors = int(errors)
    sess.time_seconds = int(time_seconds)
    return sess, float(max_score)


def test_pass_threshold_is_imported_not_hardcoded():
    """Verify that build_ml_dataset imports and references PASS_THRESHOLD from app.core.constants."""
    source = inspect.getsource(bmd)
    assert "from app.core.constants import PASS_THRESHOLD" in source, (
        "PASS_THRESHOLD must be explicitly imported from app.core.constants"
    )
    assert bmd.PASS_THRESHOLD == PASS_THRESHOLD


def test_trainee_with_6_sessions_yields_expected_rows():
    """A trainee with 6 sessions yields exactly 0 rows because at least 2 future sessions are required.
    Minimum 5 prior sessions + 2 future sessions = at least 7 sessions needed for a valid decision point.
    """
    sessions_6 = [_make_mock_session(70.0) for _ in range(6)]
    rows_6 = build_dataset_rows_for_trainee(sessions_6, trainee_id=101)
    assert len(rows_6) == 0, f"Expected 0 rows for 6 sessions, got {len(rows_6)}"

    # 5 sessions also yields 0 rows
    sessions_5 = [_make_mock_session(70.0) for _ in range(5)]
    rows_5 = build_dataset_rows_for_trainee(sessions_5, trainee_id=101)
    assert len(rows_5) == 0, f"Expected 0 rows for 5 sessions, got {len(rows_5)}"

    # 7 sessions yields exactly 1 row (decision point after session 5)
    sessions_7 = [_make_mock_session(70.0) for _ in range(7)]
    rows_7 = build_dataset_rows_for_trainee(sessions_7, trainee_id=101)
    assert len(rows_7) == 1, f"Expected 1 row for 7 sessions, got {len(rows_7)}"
    assert rows_7[0]["decision_index"] == 5

    # 8 sessions yields exactly 2 rows (decision points after session 5 and 6)
    sessions_8 = [_make_mock_session(70.0) for _ in range(8)]
    rows_8 = build_dataset_rows_for_trainee(sessions_8, trainee_id=101)
    assert len(rows_8) == 2, f"Expected 2 rows for 8 sessions, got {len(rows_8)}"
    assert rows_8[0]["decision_index"] == 5
    assert rows_8[1]["decision_index"] == 6


def test_no_feature_uses_session_at_or_after_decision_point():
    """Features must use only sessions strictly before the decision point.
    Mutating or corrupting future sessions must not change any feature value.
    """
    # 5 historical sessions with known scores [60, 65, 70, 75, 80]
    hist_sessions = [
        _make_mock_session(60.0, 100.0, errors=1, time_seconds=1000),
        _make_mock_session(65.0, 100.0, errors=2, time_seconds=1100),
        _make_mock_session(70.0, 100.0, errors=3, time_seconds=1200),
        _make_mock_session(75.0, 100.0, errors=2, time_seconds=1300),
        _make_mock_session(80.0, 100.0, errors=1, time_seconds=1400),
    ]

    # Future sessions with initial normal values
    future_normal = [
        _make_mock_session(70.0, 100.0, errors=2, time_seconds=1200),
        _make_mock_session(72.0, 100.0, errors=1, time_seconds=1150),
    ]

    # Future sessions with extreme corrupted values
    future_extreme = [
        _make_mock_session(999.0, 100.0, errors=999, time_seconds=99999),
        _make_mock_session(999.0, 100.0, errors=999, time_seconds=99999),
    ]

    rows_normal = build_dataset_rows_for_trainee(hist_sessions + future_normal, trainee_id=42)
    rows_extreme = build_dataset_rows_for_trainee(hist_sessions + future_extreme, trainee_id=42)

    assert len(rows_normal) == 1
    assert len(rows_extreme) == 1

    row_a = rows_normal[0]
    row_b = rows_extreme[0]

    for feat in FEATURE_COLUMNS:
        assert row_a[feat] == row_b[feat], (
            f"Feature '{feat}' leaked future data! normal={row_a[feat]}, extreme={row_b[feat]}"
        )

    # Verify exact feature calculations on hist_sessions
    assert row_a["last_1_score"] == 80.0
    assert row_a["last_3_mean_score"] == pytest.approx(75.0, abs=1e-3)
    assert row_a["overall_mean_score"] == pytest.approx(70.0, abs=1e-3)
    assert row_a["session_count"] == 5
    assert row_a["error_rate"] == pytest.approx(1.8, abs=1e-3)
    assert row_a["mean_time"] == pytest.approx(1200.0, abs=1e-3)
    # Slope of [60, 65, 70, 75, 80] over x=[0,1,2,3,4] is exactly +5.0 per session
    assert row_a["slope_last_5"] == pytest.approx(5.0, abs=1e-3)


def test_label_uses_only_next_2_sessions():
    """Label is 1 if mean of next 2 sessions is strictly below PASS_THRESHOLD (60.0), else 0.
    Sessions beyond the 2-session window must not influence the label.
    """
    past_sessions = [_make_mock_session(70.0) for _ in range(5)]

    # Case 1: Next 2 sessions avg = 55.0 < 60.0 -> label = 1 (at risk)
    next_2_at_risk = [_make_mock_session(50.0), _make_mock_session(60.0)]
    subsequent_passing = [_make_mock_session(100.0), _make_mock_session(100.0)]
    rows_1 = build_dataset_rows_for_trainee(past_sessions + next_2_at_risk + subsequent_passing, trainee_id=1)
    assert rows_1[0]["label"] == 1

    # Case 2: Next 2 sessions avg = 60.0 (boundary) -> label = 0 (on track, strictly below required)
    next_2_boundary = [_make_mock_session(60.0), _make_mock_session(60.0)]
    rows_2 = build_dataset_rows_for_trainee(past_sessions + next_2_boundary + subsequent_passing, trainee_id=1)
    assert rows_2[0]["label"] == 0

    # Case 3: Next 2 sessions avg = 75.0 >= 60.0 -> label = 0
    next_2_passing = [_make_mock_session(70.0), _make_mock_session(80.0)]
    subsequent_at_risk = [_make_mock_session(20.0), _make_mock_session(20.0)]
    rows_3 = build_dataset_rows_for_trainee(past_sessions + next_2_passing + subsequent_at_risk, trainee_id=1)
    assert rows_3[0]["label"] == 0


def test_columns_do_not_contain_trainee_name_or_email():
    """Dataset columns must contain trainee_id and decision_index, but strictly no PII."""
    expected_cols = [
        "trainee_id",
        "decision_index",
        "last_1_score",
        "last_3_mean_score",
        "overall_mean_score",
        "slope_last_5",
        "error_rate",
        "mean_time",
        "session_count",
        "score_std",
        "label"
    ]
    assert DATASET_COLUMNS == expected_cols
    for col in DATASET_COLUMNS:
        assert "name" not in col.lower()
        assert "email" not in col.lower()
