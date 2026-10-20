"""FastAPI router handling login, session token issuance, user profile inspection, and password changes.
Applies IP rate limiting to login attempts and protects profile routes via JWT dependencies.
"""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_staff
from app.core.rate_limit import limiter
from app.core.security import verify_password, get_password_hash
from app.core.exceptions import AppException
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, ChangePasswordRequest
from app.services.auth_service import AuthService
from app.services.audit_service import create_audit_log
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

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user entity derived from the validated JWT token."""
    return UserResponse.model_validate(current_user)

@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
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

    create_audit_log(
        db=db,
        user_id=current_user.id,
        action="password_changed",
        entity_type="user",
        entity_id=current_user.id,
        details={"email": current_user.email}
    )
    db.commit()

    return {"message": "Password changed successfully"}

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
