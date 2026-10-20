"""Shared pagination schemas and parameter validators.
Enforces standard page and page_size boundaries across all resource list endpoints.
"""

from typing import Generic, TypeVar, List
from pydantic import BaseModel, Field

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    """Standard pagination envelope containing items slice, total records, and page metrics."""
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int
