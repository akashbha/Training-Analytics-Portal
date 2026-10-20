"""Pydantic v2 schemas for trainee records and cohort enrollments.
Enforces non-empty names, valid email formats, and cohort association identifiers.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class TraineeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, example="Jane Doe")
    email: EmailStr = Field(..., example="jane.doe@example.com")
    batch_id: int = Field(..., example=1)

class TraineeCreate(TraineeBase):
    pass

class TraineeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    batch_id: Optional[int] = None

class TraineeResponse(BaseModel):
    id: int
    name: str
    email: str
    batch_id: int
    batch_name: Optional[str] = None
    session_count: Optional[int] = 0

    class Config:
        from_attributes = True
