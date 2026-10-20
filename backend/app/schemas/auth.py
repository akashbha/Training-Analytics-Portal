"""Pydantic v2 schemas for authentication requests, token responses, and user profiles.
Enforces request validation rules, email formatting, and output serialization contracts.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    """Payload schema for authenticating with email and password."""
    email: EmailStr = Field(..., example="trainer@example.com")
    password: str = Field(..., min_length=1, example="Trainer@123")

class ChangePasswordRequest(BaseModel):
    """Payload schema for authenticated user password change."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, description="Minimum length 8 characters")

class UserResponse(BaseModel):
    """Public user identity schema excluding sensitive password hashes."""
    id: int
    email: str
    role: str
    is_active: bool = True
    trainee_id: Optional[int] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    """Bearer token response payload returned upon successful login."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ErrorDetail(BaseModel):
    """Unified error representation containing code and description."""
    code: str
    message: str

class ErrorResponse(BaseModel):
    """Standard wrapper for error responses throughout the API."""
    error: ErrorDetail
