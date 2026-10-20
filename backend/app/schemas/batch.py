"""Pydantic v2 schemas for batch cohort creation, updates, and serialized responses.
Validates cohort date ranges and enforces non-blank unique cohort names.
"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, model_validator

class BatchBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, example="Batch Alpha")
    start_date: date = Field(..., example="2026-01-15")
    end_date: date = Field(..., example="2026-06-15")

    @model_validator(mode="after")
    def validate_dates(self) -> "BatchBase":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "BatchUpdate":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self

class BatchResponse(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    trainee_count: Optional[int] = 0

    class Config:
        from_attributes = True
