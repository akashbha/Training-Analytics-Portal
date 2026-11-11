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
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.trainee import Trainee
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


def verify_batch_access(batch_id: int, current_user: User, db: Session) -> Batch:
    """Enforces object-level cohort access for batches (OWASP BOLA defense).
    - Admins: global access.
    - Trainers: must be explicitly assigned to the batch via batch_trainers.
    - Trainees: must be enrolled in the batch.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise AppException(
            code="BATCH_NOT_FOUND",
            message=f"Batch with ID {batch_id} not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if current_user.role == "admin":
        return batch

    if current_user.role == "trainer":
        is_assigned = (
            db.query(BatchTrainer)
            .filter(BatchTrainer.batch_id == batch_id, BatchTrainer.trainer_id == current_user.id)
            .first()
        )
        if is_assigned:
            return batch
        raise AppException(
            code="FORBIDDEN_COHORT_ACCESS",
            message="Trainers are restricted to viewing analytics for batches they are assigned to",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if current_user.role == "trainee" and current_user.trainee_id:
        trainee = db.query(Trainee).filter(Trainee.id == current_user.trainee_id).first()
        if trainee and trainee.batch_id == batch_id:
            return batch

    raise AppException(
        code="FORBIDDEN_COHORT_ACCESS",
        message="Trainees are restricted to viewing only their assigned cohort analytics",
        status_code=status.HTTP_403_FORBIDDEN,
    )


def verify_trainee_cohort_access(trainee_id: int, current_user: User, db: Session) -> None:
    """Enforces object-level access for trainee endpoints:
    - Trainees: can only access their own trainee_id (checked before DB lookup to block ID enumeration).
    - Admins: global access.
    - Trainers: must be assigned to the trainee's cohort batch via batch_trainers (or 404 if trainee missing).
    """
    if current_user.role not in ("trainer", "admin"):
        if current_user.role == "trainee" and current_user.trainee_id == trainee_id:
            return
        raise AppException(
            code="FORBIDDEN_RESOURCE_ACCESS",
            message="Trainees are restricted to viewing only their own performance data",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if current_user.role == "admin":
        return

    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        # Let downstream handlers return domain-specific 404 TRAINEE_NOT_FOUND
        return

    is_assigned = (
        db.query(BatchTrainer)
        .filter(BatchTrainer.batch_id == trainee.batch_id, BatchTrainer.trainer_id == current_user.id)
        .first()
    )
    if not is_assigned:
        raise AppException(
            code="FORBIDDEN_COHORT_ACCESS",
            message="Trainer is not assigned to the trainee's cohort batch",
            status_code=status.HTTP_403_FORBIDDEN,
        )
