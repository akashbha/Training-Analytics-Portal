"""Service module for role-filtered documentation retrieval.
Queries SQLite FTS5 virtual table help_chunks_fts with participant scoping and query sanitization.
"""

import re
from typing import List, Dict, Any, Optional
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session

from app.db.session import SyncSessionLocal
from app.core.exceptions import AppException

# Permitted audience scopes per participant role
ROLE_SCOPES: Dict[str, List[str]] = {
    "trainee": ["trainee", "all"],
    "trainer": ["trainer", "all"],
    "admin": ["admin", "trainer", "trainee", "all"]
}

def sanitize_query(raw_query: Optional[str]) -> str:
    """Validates, caps length at 200 characters, and removes FTS5 operators and quotes."""
    if raw_query is None or not raw_query.strip():
        raise AppException(
            code="INVALID_QUERY",
            message="Query string cannot be empty",
            status_code=422
        )

    # Cap length at 200 characters
    truncated = raw_query.strip()[:200]

    # Remove quotes and FTS5 punctuation operators
    cleaned = re.sub(r'[*"\'():^{}+~[\]/\\<>=?!@#$%&]', ' ', truncated)
    tokens = cleaned.split()

    # Filter out standalone FTS5 keywords
    fts5_reserved = {"and", "or", "not", "near"}
    valid_tokens = [t for t in tokens if t.lower() not in fts5_reserved]

    if not valid_tokens:
        raise AppException(
            code="INVALID_QUERY",
            message="Query string must contain valid search terms",
            status_code=422
        )

    # Format tokens with double quotes to ensure exact token matching without syntax errors
    return " ".join(f'"{t}"' for t in valid_tokens)

def help_search(
    query: str,
    role: str,
    limit: int = 3,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """Executes a role-filtered full-text search against the indexed documentation.

    Args:
        query: User search string.
        role: Participant role ('trainee', 'trainer', 'admin').
        limit: Maximum number of documentation chunks to retrieve.
        db: Optional database session; creates managed session if None.

    Returns:
        List of matching documentation chunk dictionaries.
    """
    sanitized_match = sanitize_query(query)
    allowed_roles = ROLE_SCOPES.get(role.lower(), ["all"])

    close_session = False
    if db is None:
        db = SyncSessionLocal()
        close_session = True

    try:
        stmt = text("""
            SELECT c.source_path, c.heading, c.text, c.role, f.rank
            FROM help_chunks_fts f
            JOIN help_chunks c ON c.id = f.rowid
            WHERE help_chunks_fts MATCH :match_query
              AND c.role IN :allowed_roles
            ORDER BY f.rank ASC
            LIMIT :result_limit
        """).bindparams(bindparam("allowed_roles", expanding=True))

        rows = db.execute(
            stmt,
            {
                "match_query": sanitized_match,
                "allowed_roles": allowed_roles,
                "result_limit": limit
            }
        ).fetchall()

        results: List[Dict[str, Any]] = []
        for r in rows:
            results.append({
                "source_path": r.source_path,
                "heading": r.heading,
                "text": r.text,
                "role": r.role,
                "score": float(round(abs(r.rank), 4))
            })

        return results
    except Exception as e:
        # If FTS table returns no match or table is uninitialized, return empty list
        return []
    finally:
        if close_session and db is not None:
            db.close()

