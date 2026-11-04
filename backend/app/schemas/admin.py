"""Pydantic v2 schemas for administrative user lifecycle and audit log monitoring.
Validates role assignments, trainee 1-to-1 linkage, and password reset responses.
"""

from datetime import datetime
from typing import Optional, Any, List, Dict
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class AdminUserResponse(BaseModel):
    """Rich user account schema with linked trainee details."""
    id: int
    email: str
    role: str
    is_active: bool
    trainee_id: Optional[int] = None
    trainee_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AdminUserCreate(BaseModel):
    """Payload schema for administrative user account provisioning."""
    email: EmailStr
    role: str = Field(..., pattern="^(admin|trainer|trainee)$")
    password: Optional[str] = Field(None, min_length=8, description="Temporary initial password (auto-generated if omitted)")
    trainee_id: Optional[int] = Field(None, description="Required for trainee role, forbidden for trainer/admin")

class AdminUserUpdate(BaseModel):
    """Payload schema for administrative role mutation or account deactivation."""
    role: Optional[str] = Field(None, pattern="^(admin|trainer|trainee)$")
    is_active: Optional[bool] = None

class AdminUserCreateResponse(BaseModel):
    """Response returned upon administrative user creation, including the generated temporary password."""
    user: AdminUserResponse
    temporary_password: str

class AdminResetPasswordResponse(BaseModel):
    """Response returned upon password reset, including the generated temporary password."""
    temporary_password: str
    message: str = "Password reset successfully"

class AuditLogResponse(BaseModel):
    """Serialized audit trail entry."""
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DataQualityFlaggedRecord(BaseModel):
    """Details for a single session anomaly detected during data quality audits."""
    session_id: int
    trainee_id: int
    trainee_name: Optional[str] = None
    module_id: int
    module_name: Optional[str] = None
    rule_violated: str
    details: str
    score: float
    max_score: Optional[float] = None
    time_seconds: int
    errors: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DataQualityResponse(BaseModel):
    """Aggregate data quality report with counts per rule and sample flagged records."""
    total_flagged: int
    rule_counts: Dict[str, int]
    flagged_records: List[DataQualityFlaggedRecord]

