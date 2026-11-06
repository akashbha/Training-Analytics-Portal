"""Pydantic schemas for help assistant documentation retrieval."""

from pydantic import BaseModel
from typing import List

class HelpSearchResult(BaseModel):
    source_path: str
    heading: str
    text: str
    role: str
    score: float

class HelpSearchResponse(BaseModel):
    answer_found: bool
    message: str
    results: List[HelpSearchResult]
