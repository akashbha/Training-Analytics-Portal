"""Pydantic schemas for Remediation records, assignments, and before/after averages."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class RemediationCreate(BaseModel):
    trainee_id: int
    module_id: int
    note: Optional[str] = Field(None, max_length=500, description="Trainer observation or instructions (max 500 characters)")
    assigned_at: Optional[datetime] = Field(None, description="Timestamp of remediation intervention")

class RemediationComplete(BaseModel):
    completion_notes: Optional[str] = Field(None, max_length=500, description="Trainee submission notes, repository link, or reflection")

class RemediationResolve(BaseModel):
    reassessment_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Re-assessment score achieved (0-100)")
    resolution_note: Optional[str] = Field(None, max_length=500, description="Trainer evaluation note upon resolution")
    log_session: bool = Field(True, description="Whether to record a formal AssessmentSession row for the re-assessment score")

class RemediationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trainee_id: int
    module_id: int
    assigned_by: Optional[int] = None
    assigned_at: datetime
    note: Optional[str] = None
    status: str = "Pending"
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    reassessment_score: Optional[float] = None
    resolved_at: Optional[datetime] = None

class RemediationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trainee_id: int
    module_id: int
    module_name: Optional[str] = None
    assigned_by: Optional[int] = None
    assigned_by_name: Optional[str] = None
    assigned_at: datetime
    note: Optional[str] = None
    status: str = "Pending"
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    reassessment_score: Optional[float] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    before_average: Optional[float] = None
    after_average: Optional[float] = None
    before_status: str
    after_status: str
    before_sessions_count: int
    after_sessions_count: int

class BatchRemediationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trainee_id: int
    trainee_name: str
    trainee_email: str
    module_id: int
    module_name: str
    assigned_by: Optional[int] = None
    assigned_by_name: Optional[str] = None
    assigned_at: datetime
    note: Optional[str] = None
    status: str  # "Pending", "In Progress", "Completed", "Resolved"
    completed_at: Optional[datetime] = None
    completion_notes: Optional[str] = None
    reassessment_score: Optional[float] = None
    resolved_at: Optional[datetime] = None
    before_average: Optional[float] = None
    after_average: Optional[float] = None
    score_delta: Optional[float] = None
    before_sessions_count: int
    after_sessions_count: int
