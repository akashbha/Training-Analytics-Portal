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
    actor_id: Optional[int] = None
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    created_at: datetime
    before: Optional[Any] = None
    after: Optional[Any] = None
    details: Optional[Any] = None

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


class ModelEvaluationMetrics(BaseModel):
    """Precision, recall, F1, and confusion matrix counts for binary classification."""
    precision: float
    recall: float
    f1: float
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int


class ModelEvaluationResponse(BaseModel):
    """Evaluation report comparing ML predictor against baseline threshold rule on held-out test data."""
    sample_size: int
    positive_labels: int
    negative_labels: int
    pass_threshold: float
    min_sessions_required: int
    held_out_sessions: int
    label_definition: str
    baseline_rule: str
    model_name: str
    baseline: ModelEvaluationMetrics
    model: ModelEvaluationMetrics
    model_beats_baseline: bool
    summary: str
    evaluated_at: Optional[str] = None
    artifact_modified_at: Optional[str] = None
    evaluation_timestamp_source: Optional[str] = None
    details: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(from_attributes=True)


class ServiceHealthResponse(BaseModel):
    """Live infrastructure and dependency probe report for the admin console."""
    checked_at: str
    backend_api: Dict[str, Any]
    database: Dict[str, Any]
    websocket: Dict[str, Any]
    ml_service: Dict[str, Any]


