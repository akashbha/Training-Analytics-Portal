"""Remediation model tracking curriculum interventions and performance benchmarks."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Remediation(Base):
    __tablename__ = "remediations"

    id = Column(Integer, primary_key=True, index=True)
    trainee_id = Column(Integer, ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    note = Column(String(500), nullable=True)

    trainee = relationship("Trainee", backref="remediations")
    module = relationship("Module")
    assigner = relationship("User", foreign_keys=[assigned_by])
