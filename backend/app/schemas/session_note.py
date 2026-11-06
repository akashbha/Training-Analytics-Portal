"""Pydantic schemas for session feedback notes.
Validates note content length constraints and structures note responses with author attribution.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class SessionNoteCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=300, description="Trainer feedback note (max 300 characters)")

class SessionNoteResponse(BaseModel):
    id: int
    session_id: int
    author_id: int
    author_email: Optional[str] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
