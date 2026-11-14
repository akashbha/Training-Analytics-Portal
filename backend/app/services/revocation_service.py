"""Service managing server-side token revocation and session invalidation.
Supports exact JTI blacklisting (for explicit logouts) and user-wide invalidation (for password changes,
deactivations, and role modifications) based on token issue timestamps (iat).
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.revoked_token import RevokedToken
from app.core.config import settings

def revoke_token(
    db: Session,
    jti: Optional[str],
    user_id: int,
    expires_at: Optional[datetime] = None,
    reason: str = "logout"
) -> RevokedToken:
    """Records an explicit token JTI revocation in the database."""
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    revocation = RevokedToken(
        jti=jti,
        user_id=user_id,
        revoked_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        reason=reason
    )
    db.add(revocation)
    db.commit()
    db.refresh(revocation)
    return revocation

def revoke_all_user_tokens(
    db: Session,
    user_id: int,
    reason: str = "credential_change"
) -> RevokedToken:
    """Records a user-level invalidation marker, invalidating any token issued prior to this timestamp."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    revocation = RevokedToken(
        jti=None,
        user_id=user_id,
        revoked_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        reason=reason
    )
    db.add(revocation)
    db.commit()
    db.refresh(revocation)
    return revocation

def is_token_revoked(
    db: Session,
    jti: Optional[str],
    user_id: int,
    iat: Optional[int]
) -> bool:
    """Verifies whether a token is revoked by checking its JTI or checking if issued prior to a user-level invalidation."""
    now = datetime.now(timezone.utc)

    # 1. Check exact JTI match
    if jti:
        exists_jti = db.query(RevokedToken).filter(
            RevokedToken.jti == jti
        ).first()
        if exists_jti:
            return True

    # 2. Check user-level invalidations (issued prior to user-wide invalidation marker)
    if iat is not None:
        user_invalidation = (
            db.query(RevokedToken)
            .filter(
                RevokedToken.user_id == user_id,
                RevokedToken.jti.is_(None)
            )
            .order_by(RevokedToken.revoked_at.desc())
            .first()
        )
        if user_invalidation:
            rev_dt = user_invalidation.revoked_at
            if rev_dt.tzinfo is None:
                rev_dt = rev_dt.replace(tzinfo=timezone.utc)
            if float(iat) < rev_dt.timestamp():
                return True

    return False

def cleanup_expired_revocations(db: Session) -> int:
    """Deletes expired revocation entries whose lifetime has passed the token maximum expiry window."""
    now = datetime.now(timezone.utc)
    deleted = (
        db.query(RevokedToken)
        .filter(RevokedToken.expires_at < now)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted
