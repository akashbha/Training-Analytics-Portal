"""System-wide operational thresholds and analytics constants.
Centralizes pass marks, mastery boundaries, remediation criteria, and cold-start heuristic limits.

Institutional Threshold Policy:
- ASSESSMENT_PASS_THRESHOLD (60.0%):
  The qualifying cutoff for standard trainee assessment sessions and cohort pass rate calculations.
  A score of 60.0% or higher confirms basic competency in the module material.

- REMEDIATION_RESOLVE_THRESHOLD (70.0%):
  The elevated mastery cutoff required to resolve a Remediation drill.
  Once a trainee has failed an assessment and been assigned a remedial intervention, resolving
  the remediation requires demonstrating a higher tier of competency (>= 70.0%) on the re-assessment,
  ensuring full conceptual recovery rather than borderline survival.

- EXCELLENT_THRESHOLD (75.0%):
  The benchmark for mastery tier classification across cohort score bands and milestone achievements.
"""

ASSESSMENT_PASS_THRESHOLD: float = 60.0
PASS_THRESHOLD: float = ASSESSMENT_PASS_THRESHOLD  # Backwards-compatible alias for 60.0%
REMEDIATION_RESOLVE_THRESHOLD: float = 70.0
EXCELLENT_THRESHOLD: float = 75.0
COLD_START_SESSIONS: int = 3
COLD_START_CUTOFF: float = 50.0
MAX_SESSION_TIME_SECONDS: int = 14400  # 4 hours limit (14400 seconds)

# ML Governance & Transparency
ML_ADVISORY_DISCLAIMER: str = (
    "Advisory only. Model outputs are decision-support suggestions and require trainer review "
    "before taking pedagogical or administrative action."
)

