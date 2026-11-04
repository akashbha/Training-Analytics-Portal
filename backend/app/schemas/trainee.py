"""Pydantic v2 schemas for trainee records and cohort enrollments.
Enforces non-empty names, valid email formats, and cohort association identifiers.
Supports profile customization details: phone, bio, specialization, avatar_url, github_url.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class TraineeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, json_schema_extra={"example": "Jane Doe"})
    email: EmailStr = Field(..., json_schema_extra={"example": "jane.doe@example.com"})
    batch_id: int = Field(..., json_schema_extra={"example": 1})
    phone: Optional[str] = Field(None, max_length=40)
    bio: Optional[str] = Field(None, max_length=1000)
    specialization: Optional[str] = Field(None, max_length=120)
    avatar_url: Optional[str] = None
    github_url: Optional[str] = Field(None, max_length=255)

class TraineeCreate(TraineeBase):
    pass

class TraineeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    batch_id: Optional[int] = None
    phone: Optional[str] = Field(None, max_length=40)
    bio: Optional[str] = Field(None, max_length=1000)
    specialization: Optional[str] = Field(None, max_length=120)
    avatar_url: Optional[str] = None
    github_url: Optional[str] = Field(None, max_length=255)

class TraineeResponse(BaseModel):
    id: int
    name: str
    email: str
    batch_id: int
    batch_name: Optional[str] = None
    session_count: Optional[int] = 0
    phone: Optional[str] = None
    bio: Optional[str] = None
    specialization: Optional[str] = None
    avatar_url: Optional[str] = None
    github_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
