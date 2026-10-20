"""Pydantic v2 schemas for assessment curriculum modules and scoring bounds.
Validates non-empty module titles and enforces strictly positive maximum scores.
"""

from typing import Optional
from pydantic import BaseModel, Field

class ModuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, example="Python Fundamentals")
    max_score: float = Field(..., gt=0, example=100.0)

class ModuleCreate(ModuleBase):
    pass

class ModuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    max_score: Optional[float] = Field(None, gt=0)

class ModuleResponse(BaseModel):
    id: int
    name: str
    max_score: float
    session_count: Optional[int] = 0

    class Config:
        from_attributes = True
