"""Pydantic v2 schemas for SQL-computed analytics dashboards and performance trends.
Defines response contracts for batch summaries, weekly progressions, score bands, and leaderboards.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class BatchSummaryResponse(BaseModel):
    batch_id: int
    batch_name: str
    trainee_count: int
    session_count: int
    avg_score_pct: Optional[float] = None
    pass_rate_pct: Optional[float] = None
    avg_errors: Optional[float] = None
    avg_time_seconds: Optional[float] = None
    avg_score_change_pct: Optional[float] = None

class BatchWeeklyItem(BaseModel):
    week_start: str
    avg_score_pct: Optional[float] = None
    session_count: int = 0

class ScoreBandItem(BaseModel):
    label: str  # "Excellent", "Average", "Struggling"
    count: int
    percent: float

class LeaderboardItem(BaseModel):
    rank: Optional[int] = None
    trainee_id: int
    name: str
    avg_score_pct: Optional[float] = None
    session_count: int
    trend_pct: Optional[float] = None
    status: str  # "on_track", "struggling", "needs_help", "no_sessions"

class AttentionItem(BaseModel):
    trainee_id: int
    name: str
    avg_score_pct: Optional[float] = None
    trend: str  # "falling", "critical_low", "struggling"

class TraineeSummaryResponse(BaseModel):
    latest_score_pct: Optional[float] = None
    best_score_pct: Optional[float] = None
    avg_score_pct: Optional[float] = None
    session_count: int = 0
    avg_errors: Optional[float] = None
    avg_time_seconds: Optional[float] = None
    improvement_pct: Optional[float] = None

class TraineeProgressItem(BaseModel):
    created_at: datetime
    module_name: str
    score_pct: float
    errors: int
    time_seconds: int

class ModuleErrorItem(BaseModel):
    module_name: str
    avg_errors: float
    session_count: int

class BatchCompareItem(BaseModel):
    batch_id: int
    batch_name: str
    avg_score_pct: Optional[float] = None
    pass_rate_pct: Optional[float] = None
    trainee_count: int
