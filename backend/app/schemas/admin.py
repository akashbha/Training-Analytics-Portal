"""Pydantic v2 schemas for administrative user lifecycle and audit log monitoring.
Validates role assignments, trainee 1-to-1 linkage, and password reset responses.
"""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field

class AdminUserResponse(BaseModel):
    """Rich user account schema with linked trainee details."""
    id: int
    email: str
    role: str
    is_active: bool
    trainee_id: Optional[int] = None
    trainee_name: Optional[str] = None

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True
