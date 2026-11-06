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

# Minimum BM25 score floor to filter out incidental keyword matches on out-of-scope queries
RELEVANCE_FLOOR: float = 5.0

# Standard English stopwords to remove conversational filler from natural language queries
ENGLISH_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't",
    "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers",
    "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if",
    "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
    "ours", "ourselves", "out", "over", "own", "same", "she", "she'd", "she'll", "she's", "should",
    "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
    "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
    "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
    "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves"
}

def extract_search_tokens(raw_query: Optional[str]) -> List[str]:
    """Validates, caps length at 200 characters, removes FTS5 operators, and strips English stopwords."""
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
    raw_tokens = cleaned.lower().split()

    # Filter out standalone FTS5 keywords, English stopwords, and tokens shorter than 2 characters
    fts5_reserved = {"and", "or", "not", "near"}
    valid_tokens = [
        t for t in raw_tokens
        if len(t) >= 2 and t not in ENGLISH_STOPWORDS and t not in fts5_reserved
    ]

    if not valid_tokens:
        raise AppException(
            code="INVALID_QUERY",
            message="Query string must contain valid search terms",
            status_code=422
        )

    return valid_tokens

def sanitize_query(raw_query: Optional[str]) -> str:
    """Formats valid search tokens into an OR-joined FTS5 expression."""
    valid_tokens = extract_search_tokens(raw_query)
    return " OR ".join(f'"{t}"' for t in valid_tokens)

def help_search(
    query: str,
    role: str,
    limit: int = 3,
    db: Optional[Session] = None,
    floor: Optional[float] = None
) -> List[Dict[str, Any]]:
    """Executes a role-filtered full-text search against the indexed documentation.

    Args:
        query: User search string.
        role: Participant role ('trainee', 'trainer', 'admin').
        limit: Maximum number of documentation chunks to retrieve.
        db: Optional database session; creates managed session if None.
        floor: Optional relevance threshold override; defaults to RELEVANCE_FLOOR.

    Returns:
        List of matching documentation chunk dictionaries meeting or exceeding the relevance floor.
    """
    tokens = extract_search_tokens(query)
    sanitized_match = " OR ".join(f'"{t}"' for t in tokens)
    allowed_roles = ROLE_SCOPES.get(role.lower(), ["all"])

    # For multi-word queries, enforce the full floor (5.0) to reject incidental single-word hits
    # For single-term lookups, allow single-keyword matches meeting base threshold (2.0)
    base_floor = floor if floor is not None else RELEVANCE_FLOOR
    threshold_floor = base_floor if len(tokens) > 1 else min(base_floor, 2.0)

    close_session = False
    if db is None:
        db = SyncSessionLocal()
        close_session = True

    try:
        stmt = text("""
            SELECT c.source_path, c.heading, c.text, c.role, bm25(help_chunks_fts) AS bm25_score
            FROM help_chunks_fts f
            JOIN help_chunks c ON c.id = f.rowid
            WHERE help_chunks_fts MATCH :match_query
              AND c.role IN :allowed_roles
            ORDER BY bm25(help_chunks_fts) ASC
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
            bm25_val = float(round(abs(r.bm25_score), 4))
            if bm25_val >= threshold_floor:
                results.append({
                    "source_path": r.source_path,
                    "heading": r.heading,
                    "text": r.text,
                    "role": r.role,
                    "score": bm25_val
                })

        # Return empty list when best match does not meet or exceed the relevance floor
        if not results or results[0]["score"] < threshold_floor:
            return []

        return results
    except Exception as e:
        # If FTS table returns no match or table is uninitialized, return empty list
        return []
    finally:
        if close_session and db is not None:
            db.close()

