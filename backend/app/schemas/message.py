"""Pydantic v2 schemas for private and batch messaging endpoints.
Validates channel constraints, recipient/batch targets, character bounds, and file attachment representations.
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class AttachmentResponse(BaseModel):
    id: int
    filename: str
    size: int
    mime_type: str
    download_url: str

    model_config = ConfigDict(from_attributes=True)


class AttachmentUploadResponse(BaseModel):
    id: int
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    channel: Literal["private", "batch"] = "private"
    recipient_id: Optional[int] = None
    batch_id: Optional[int] = None
    body: Optional[str] = None

    @model_validator(mode="after")
    def validate_targets_and_body(self) -> "MessageCreate":
        # Validate channel pairing
        if self.channel == "private":
            if self.recipient_id is None:
                raise ValueError("recipient_id is required for private messages")
            if self.batch_id is not None:
                raise ValueError("batch_id must be null for private messages")
        elif self.channel == "batch":
            if self.batch_id is None:
                raise ValueError("batch_id is required for batch messages")
            if self.recipient_id is not None:
                raise ValueError("recipient_id must be null for batch messages")

        # Validate body length
        if self.body is not None:
            trimmed = self.body.strip()
            if not trimmed:
                raise ValueError("Message body cannot be empty or whitespace only")
            if len(self.body) > 500:
                raise ValueError("Message body cannot exceed 500 characters")
            self.body = trimmed
        else:
            raise ValueError("Message body is required")

        return self


class MessageResponse(BaseModel):
    id: int
    channel: str = "private"
    sender_id: int
    recipient_id: Optional[int] = None
    batch_id: Optional[int] = None
    body: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None
    sender_name: Optional[str] = None
    recipient_name: Optional[str] = None
    attachments: list[AttachmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ContactResponse(BaseModel):
    id: int
    email: str
    role: str
    name: str
    trainee_id: Optional[int] = None
    batch_id: Optional[int] = None
    batch_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
