"""System-wide operational thresholds and analytics constants.
Centralizes pass marks, mastery boundaries, and cold-start heuristic limits.
"""

PASS_THRESHOLD: float = 60.0
EXCELLENT_THRESHOLD: float = 75.0
COLD_START_SESSIONS: int = 3
COLD_START_CUTOFF: float = 50.0
MAX_SESSION_TIME_SECONDS: int = 14400  # 4 hours limit (14400 seconds)


