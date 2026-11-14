// System-wide operational thresholds and analytics constants.
// Centralizes pass marks, mastery boundaries, remediation criteria, and cold-start heuristic limits.

export const ASSESSMENT_PASS_THRESHOLD = 60;
export const PASS_THRESHOLD = ASSESSMENT_PASS_THRESHOLD; // Backwards-compatible alias
export const REMEDIATION_RESOLVE_THRESHOLD = 70;
export const EXCELLENT_THRESHOLD = 75;
export const COLD_START_SESSIONS = 3;
export const COLD_START_CUTOFF = 50;
export const MAX_SESSION_TIME_SECONDS = 14400; // 4 hours limit

// ML Governance & Transparency
export const ML_ADVISORY_DISCLAIMER =
  "Advisory only. Model outputs are decision-support suggestions and require trainer review before taking pedagogical or administrative action.";

