"""FastAPI authentication and role-based authorization dependencies.
Enforces Bearer token validation, admin privileges, staff access, and trainee ownership scoping.
"""

from typing import Generator, Callable
from fastapi import Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.db.session import SyncSessionLocal
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.core.security import decode_access_token
from app.core.exceptions import AppException

bearer_scheme = HTTPBearer(auto_error=False)

def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a managed database session for the request lifecycle."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Validates the Bearer token and returns the active User entity or raises 401."""
    auth_header = {"WWW-Authenticate": "Bearer"}
    if not credentials or not credentials.credentials:
        raise AppException(
            code="MISSING_TOKEN",
            message="Missing bearer authentication token",
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers=auth_header
        )

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise AppException(
                code="INVALID_TOKEN",
                message="Invalid authentication token payload",
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers=auth_header
            )
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise AppException(
            code="INVALID_OR_EXPIRED_TOKEN",
            message="Authentication token is invalid or expired",
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers=auth_header
        )

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise AppException(
            code="USER_NOT_FOUND",
            message="User corresponding to authentication token does not exist",
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers=auth_header
        )

    # Reject inactive users with 401
    if not user.is_active:
        raise AppException(
            code="USER_INACTIVE",
            message="User account is deactivated",
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers=auth_header
        )

    return user

def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Enforces that the current authenticated user possesses the 'admin' role."""
    if current_user.role != "admin":
        raise AppException(
            code="FORBIDDEN_ADMIN_ONLY",
            message="Operation restricted to users with the admin role",
            status_code=status.HTTP_403_FORBIDDEN
        )
    return current_user

def require_staff(
    current_user: User = Depends(get_current_user)
) -> User:
    """Enforces that the current user possesses either the 'trainer' or 'admin' role."""
    if current_user.role not in ("trainer", "admin"):
        raise AppException(
            code="FORBIDDEN_STAFF_ONLY",
            message="Operation restricted to trainers and administrators",
            status_code=status.HTTP_403_FORBIDDEN
        )
    return current_user

def require_trainer(
    current_user: User = Depends(get_current_user)
) -> User:
    """Backwards-compatible dependency: checks if user is a trainer or admin."""
    if current_user.role not in ("trainer", "admin"):
        raise AppException(
            code="FORBIDDEN_TRAINER_ONLY",
            message="Operation restricted to users with the trainer or admin role",
            status_code=status.HTTP_403_FORBIDDEN
        )
    return current_user

def require_self_or_staff(trainee_id: int) -> Callable:
    """Factory creating a dependency ensuring access is restricted to the owner trainee or staff."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role in ("trainer", "admin"):
            return current_user

        if current_user.role == "trainee" and current_user.trainee_id == trainee_id:
            return current_user

        raise AppException(
            code="FORBIDDEN_RESOURCE_ACCESS",
            message="Trainees are restricted to viewing only their own performance data",
            status_code=status.HTTP_403_FORBIDDEN
        )

    return dependency
