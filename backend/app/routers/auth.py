"""FastAPI router handling login, session token issuance, user profile inspection, and password changes.
Applies IP rate limiting to login attempts and protects profile routes via JWT dependencies.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_staff, bearer_scheme
from app.core.rate_limit import limiter
from app.core.security import verify_password, get_password_hash, decode_access_token
from app.core.exceptions import AppException
from app.core.ws_ticket import ws_tickets
from app.core.realtime import disconnect_user_sync
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, ChangePasswordRequest
from app.services.auth_service import AuthService
from app.services.audit_service import create_audit_log
from app.services.revocation_service import revoke_token, revoke_all_user_tokens
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticates credentials with rate limiting and issues a signed Bearer token."""
    auth_service = AuthService(db)
    token, user = auth_service.authenticate_user(
        email=payload.email,
        password=payload.password
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revokes the current JWT token via its JTI claim and severs live WebSocket sessions."""
    raw_token = credentials.credentials
    try:
        payload = decode_access_token(raw_token)
        jti = payload.get("jti")
        exp = payload.get("exp")
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
    except Exception:
        jti = None
        expires_at = None

    if jti:
        revoke_token(
            db=db,
            jti=jti,
            user_id=current_user.id,
            expires_at=expires_at,
            reason="logout"
        )

    disconnect_user_sync(current_user.id, reason="User logged out")

    create_audit_log(
        db=db,
        user_id=current_user.id,
        action="logout",
        entity_type="auth",
        entity_id=current_user.id,
        details={"email": current_user.email, "jti": jti}
    )
    db.commit()

    return {"message": "Logged out successfully"}

@router.post("/ws-ticket", status_code=status.HTTP_200_OK)
def get_websocket_ticket(
    current_user: User = Depends(get_current_user)
):
    """Issues a short-lived (60s), single-use ticket for secure WebSocket connection without URL token leakage."""
    ticket = ws_tickets.create_ticket(
        user_id=current_user.id,
        role=current_user.role,
        trainee_id=current_user.trainee_id
    )
    return {"ticket": ticket, "expires_in": 60}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user entity derived from the validated JWT token."""
    return UserResponse.model_validate(current_user)

@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Changes password for the current authenticated user across all roles (min length 8)."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise AppException(
            code="INVALID_CURRENT_PASSWORD",
            message="Current password is incorrect",
            status_code=400
        )
    if len(payload.new_password) < 8:
        raise AppException(
            code="PASSWORD_TOO_SHORT",
            message="New password must be at least 8 characters long",
            status_code=422
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()

    # 1. Explicitly revoke the caller token's JTI
    if credentials and credentials.credentials:
        try:
            p = decode_access_token(credentials.credentials)
            caller_jti = p.get("jti")
            exp = p.get("exp")
            exp_dt = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
            if caller_jti:
                revoke_token(db=db, jti=caller_jti, user_id=current_user.id, expires_at=exp_dt, reason="password_changed")
        except Exception:
            pass

    # 2. Revoke all existing sessions for this user across all devices
    revoke_all_user_tokens(db=db, user_id=current_user.id, reason="password_changed")
    disconnect_user_sync(current_user.id, reason="Password changed")

    create_audit_log(
        db=db,
        user_id=current_user.id,
        action="password_changed",
        entity_type="user",
        entity_id=current_user.id,
        details={"email": current_user.email}
    )
    db.commit()

    return {"message": "Password changed successfully. Existing sessions have been revoked."}

@router.get("/trainer-only-ping")
def trainer_only_ping(current_user: User = Depends(require_staff)):
    """Demonstration route proving role enforcement: accessible by staff (trainer and admin)."""
    return {"message": f"Welcome Staff Member {current_user.email}"}

@router.get("/trainee/{trainee_id}/data")
def trainee_scoped_data(
    trainee_id: int,
    current_user: User = Depends(get_current_user)
):
    """Demonstration route proving trainee self-access scoping vs staff universal access."""
    if current_user.role not in ("trainer", "admin"):
        if current_user.role != "trainee" or current_user.trainee_id != trainee_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees are restricted to viewing only their own performance data",
                status_code=403
            )
    return {
        "trainee_id": trainee_id,
        "message": f"Access granted to trainee data for user {current_user.email}"
    }
