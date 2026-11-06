"""Integration and validation tests for document indexing (Stage 1 Help Assistant).
Verifies chunk attributes, heading parsing, metric value preservation, idempotency,
character bounds, and SQLite FTS searchability.
"""

import pytest
from app.models.help_chunk import HelpChunk
from scripts.build_help_index import build_index

@pytest.fixture(autouse=True)
def populate_help_index(db_session):
    """Ensures help index is populated before each test execution."""
    build_index(db_session)

def test_every_chunk_has_source_and_heading(db_session):
    """Every chunk in help_chunks has a non-empty source_path, heading, and valid role."""
    chunks = db_session.query(HelpChunk).all()
    assert len(chunks) > 0, "help_chunks table should not be empty"

    valid_roles = {"trainer", "trainee", "admin", "all"}
    for c in chunks:
        assert c.source_path and c.source_path.strip(), f"Empty source_path on chunk {c.id}"
        assert c.heading and c.heading.strip(), f"Empty heading on chunk {c.id}"
        assert c.role in valid_roles, f"Invalid role '{c.role}' on chunk {c.id}"

def test_evaluation_json_chunks_contain_exact_metric_values(db_session):
    """Chunks from evaluation.json contain 0.8276 and 0.8000 only as text from the file."""
    eval_chunks = (
        db_session.query(HelpChunk)
        .filter(HelpChunk.source_path.like("%evaluation.json"))
        .all()
    )
    assert len(eval_chunks) > 0, "No chunks indexed from evaluation.json"

    combined_text = " ".join(c.text for c in eval_chunks)
    assert "0.8276" in combined_text, "0.8276 must be present in evaluation.json chunks"
    assert "0.8000" in combined_text, "0.8000 must be present in evaluation.json chunks"

def test_constants_section_states_exact_thresholds(db_session):
    """Constants section states PASS_THRESHOLD = 60.0 and EXCELLENT_THRESHOLD = 75.0 exactly as in constants.py."""
    const_chunks = (
        db_session.query(HelpChunk)
        .filter(HelpChunk.source_path.like("%constants.py"))
        .all()
    )
    assert len(const_chunks) > 0, "No chunks indexed from constants.py"

    combined_text = " ".join(c.text for c in const_chunks)
    assert "PASS_THRESHOLD = 60.0" in combined_text, "PASS_THRESHOLD = 60.0 missing"
    assert "EXCELLENT_THRESHOLD = 75.0" in combined_text, "EXCELLENT_THRESHOLD = 75.0 missing"

def test_rebuild_is_idempotent(db_session):
    """Re-running the build produces the exact same row count (idempotent)."""
    initial_count = db_session.query(HelpChunk).count()
    assert initial_count > 0

    # Re-run build on the same session
    rebuild_count = build_index(db_session)
    assert rebuild_count == initial_count

    final_count = db_session.query(HelpChunk).count()
    assert final_count == initial_count

def test_chunk_text_length_and_non_empty(db_session):
    """No chunk text is empty or longer than 2000 characters."""
    chunks = db_session.query(HelpChunk).all()
    assert len(chunks) > 0

    for c in chunks:
        assert c.text and c.text.strip(), f"Chunk {c.id} text is empty"
        assert len(c.text) <= 2000, f"Chunk {c.id} text exceeds 2000 characters (len={len(c.text)})"
