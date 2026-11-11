"""Pydantic schemas for the Evidence-Grounded Trainer Copilot."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict

class CopilotQueryRequest(BaseModel):
    batch_id: int
    query: str

class CitationItem(BaseModel):
    source_type: str
    title: str
    excerpt: str
    metadata: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)

class DraftActionItem(BaseModel):
    action_type: str
    label: str
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    module_name: Optional[str] = None
    suggested_payload: str

    model_config = ConfigDict(from_attributes=True)

class CopilotQueryResponse(BaseModel):
    query: str
    batch_id: int
    recorded_facts: str
    generated_suggestions: str
    citations: List[CitationItem]
    draft_actions: List[DraftActionItem]
    sufficient_evidence: bool = True

    model_config = ConfigDict(from_attributes=True)
