"""Pydantic schemas for Remediation records, assignments, and before/after averages."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class RemediationCreate(BaseModel):
    trainee_id: int
    module_id: int
    note: Optional[str] = Field(None, max_length=500, description="Trainer observation or instructions (max 500 characters)")
    assigned_at: Optional[datetime] = Field(None, description="Timestamp of remediation intervention")

class RemediationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trainee_id: int
    module_id: int
    assigned_by: Optional[int] = None
    assigned_at: datetime
    note: Optional[str] = None

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
    before_average: Optional[float] = None
    after_average: Optional[float] = None
    before_status: str
    after_status: str
    before_sessions_count: int
    after_sessions_count: int
