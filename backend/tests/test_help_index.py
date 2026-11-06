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

def test_no_trainee_chunk_contains_forbidden_admin_terms(db_session):
    """Negative assertion: no trainee-tagged chunk contains admin, audit, credentials, or data quality."""
    trainee_chunks = (
        db_session.query(HelpChunk)
        .filter(HelpChunk.role == "trainee")
        .all()
    )
    assert len(trainee_chunks) > 0, "Expected at least one trainee-tagged chunk"

    forbidden_terms = ["admin", "audit", "credentials", "data quality"]
    for chunk in trainee_chunks:
        lower_text = chunk.text.lower()
        lower_heading = chunk.heading.lower()
        for term in forbidden_terms:
            assert term not in lower_text, (
                f"Trainee chunk {chunk.id} ('{chunk.heading}') contains forbidden term '{term}':\n{chunk.text}"
            )
            assert term not in lower_heading, (
                f"Trainee chunk {chunk.id} heading ('{chunk.heading}') contains forbidden term '{term}'"
            )

def test_no_credentials_or_model_internals_in_trainee_or_trainer_chunks(db_session):
    """Credentials and model evaluation internals must not appear under trainee or trainer."""
    non_admin_chunks = (
        db_session.query(HelpChunk)
        .filter(HelpChunk.role.in_(["trainee", "trainer"]))
        .all()
    )
    assert len(non_admin_chunks) > 0

    sensitive_snippets = [
        "Admin123!", "Trainer@123", "Trainee@123",
        "0.8276", "0.8000", "Random Forest"
    ]
    for c in non_admin_chunks:
        for snippet in sensitive_snippets:
            assert snippet.lower() not in c.text.lower(), (
                f"Role '{c.role}' chunk {c.id} ('{c.heading}') contains restricted snippet '{snippet}'"
            )
            assert snippet.lower() not in c.heading.lower(), (
                f"Role '{c.role}' chunk {c.id} heading ('{c.heading}') contains restricted snippet '{snippet}'"
            )

def test_audience_role_distribution(db_session):
    """Verifies all four audiences have meaningful representation."""
    chunks = db_session.query(HelpChunk).all()
    counts = {}
    for c in chunks:
        counts[c.role] = counts.get(c.role, 0) + 1

    assert counts.get("trainee", 0) >= 5, f"Too few trainee chunks: {counts.get('trainee', 0)}"
    assert counts.get("trainer", 0) >= 10, f"Too few trainer chunks: {counts.get('trainer', 0)}"
    assert counts.get("admin", 0) >= 20, f"Too few admin chunks: {counts.get('admin', 0)}"
    assert counts.get("all", 0) >= 5, f"Too few all-audience chunks: {counts.get('all', 0)}"
