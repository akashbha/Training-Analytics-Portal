"""Pydantic v2 schemas for assessment session submissions and bulk CSV ingestion metrics.
Validates score bounds, non-negative error counts, positive durations, and CSV row errors.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class SessionCreate(BaseModel):
    trainee_id: int = Field(..., example=1)
    module_id: int = Field(..., example=2)
    score: float = Field(..., ge=0, example=85.5)
    errors: int = Field(..., ge=0, example=2)
    time_seconds: int = Field(..., gt=0, example=1200)
    created_at: Optional[datetime] = None

class SessionResponse(BaseModel):
    id: int
    trainee_id: int
    trainee_name: Optional[str] = None
    trainee_email: Optional[str] = None
    module_id: int
    module_name: Optional[str] = None
    module_max_score: Optional[float] = None
    score: float
    score_percentage: Optional[float] = None
    errors: int
    time_seconds: int
    created_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True

class BulkRowError(BaseModel):
    row: int
    message: str

class BulkSessionResponse(BaseModel):
    inserted: int
    failed: int
    errors: List[BulkRowError]
