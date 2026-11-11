"""Pydantic schemas for Curriculum Misconception & Error Clustering analysis.
Represents semantically grouped failure patterns across batch assessments.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class AffectedTraineeEvidence(BaseModel):
    trainee_id: int
    trainee_name: str
    session_id: int
    score: float
    errors: int
    module_name: str
    note_excerpt: str
    session_date: str

    model_config = ConfigDict(from_attributes=True)

class MisconceptionClusterItem(BaseModel):
    id: str
    title: str
    domain: str
    affected_trainee_count: int
    cohort_prevalence_pct: float
    modules: List[str]
    key_terms: List[str]
    suggested_action: str
    evidence_count: int
    evidence: List[AffectedTraineeEvidence]
    approved: bool = False

    model_config = ConfigDict(from_attributes=True)

class MisconceptionAnalysisResponse(BaseModel):
    batch_id: int
    total_notes_analyzed: int
    cluster_count: int
    clusters: List[MisconceptionClusterItem]

    model_config = ConfigDict(from_attributes=True)
