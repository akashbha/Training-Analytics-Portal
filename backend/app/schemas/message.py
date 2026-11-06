"""Pydantic v2 schemas for private messaging endpoints.
Validates character bounds (max 500 chars, non-empty after trim) and recipient definitions.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

class MessageCreate(BaseModel):
    recipient_id: int
    body: str = Field(..., max_length=500)

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message body cannot be empty or whitespace only")
        if len(v) > 500:
            raise ValueError("Message body cannot exceed 500 characters")
        return trimmed

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    body: str
    created_at: datetime
    read_at: Optional[datetime] = None
    sender_name: Optional[str] = None
    recipient_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ContactResponse(BaseModel):
    id: int
    email: str
    role: str
    name: str
    batch_id: Optional[int] = None
    batch_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

