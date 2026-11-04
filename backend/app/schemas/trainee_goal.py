"""Pydantic schemas for trainee goal setting and achievement progress."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class TraineeGoalCreate(BaseModel):
    module_id: int
    target_score: float = Field(..., ge=0.0, le=100.0, description="Target score percentage (0-100)")


class TraineeGoalResponse(BaseModel):
    id: int
    trainee_id: int
    module_id: int
    module_name: Optional[str] = None
    target_score: float
    best_score: Optional[float] = None
    progress_pct: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

