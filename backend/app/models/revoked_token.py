"""SQLAlchemy 2.0 ORM model for storing revoked JWT token IDs (JTI) and user-level invalidation markers.
Enforces server-side token revocation across logouts, credential modifications, deactivations, and role updates.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # jti is nullable: if NULL, it indicates a user-wide invalidation (all tokens issued before revoked_at)
    jti: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    reason: Mapped[str] = mapped_column(String(50), default="logout", nullable=False)

    def __repr__(self) -> str:
        return f"<RevokedToken(id={self.id}, jti='{self.jti}', user_id={self.user_id}, reason='{self.reason}')>"

