"""FastAPI router managing administrative operations, user lifecycles, and audit inspection.
Enforces admin-only access, prevents self-harm/last-admin mutations, and maintains compliance logs.
"""

import secrets
import string
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.deps import get_db, require_admin
from app.core.security import get_password_hash
from app.core.exceptions import AppException
from app.models.user import User
from app.models.trainee import Trainee
from app.schemas.admin import (
    AdminUserResponse,
    AdminUserCreate,
    AdminUserUpdate,
    AdminUserCreateResponse,
    AdminResetPasswordResponse,
    AuditLogResponse
)
from app.schemas.common import PaginatedResponse
from app.services.audit_service import create_audit_log, AuditService

router = APIRouter(prefix="/admin", tags=["Admin"])

def _generate_temporary_password(length: int = 12) -> str:
    """Generates a secure temporary password meeting complexity criteria."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    # Ensure at least 1 uppercase, 1 lowercase, 1 digit, 1 special
    pwd = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*")
    ]
    for _ in range(length - 4):
        pwd.append(secrets.choice(alphabet))
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)

def _build_admin_user_response(user: User) -> AdminUserResponse:
    """Serializes User model into AdminUserResponse with linked trainee metadata."""
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        trainee_id=user.trainee_id,
        trainee_name=user.trainee.name if user.trainee else None
    )

@router.get("/users", response_model=PaginatedResponse[AdminUserResponse])
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email or trainee name"),
    role: Optional[str] = Query(None, pattern="^(admin|trainer|trainee)$", description="Filter by user role"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Retrieves paginated user accounts with search and role filtering (Admin only)."""
    query = db.query(User).outerjoin(User.trainee)

    if role:
        query = query.filter(User.role == role)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.email.ilike(search_pattern),
                Trainee.name.ilike(search_pattern)
            )
        )

    total = query.count()
    pages = (total + page_size - 1) // page_size if total > 0 else 1
    users = query.order_by(User.id.asc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [_build_admin_user_response(u) for u in users]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.post("/users", response_model=AdminUserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Provisions a new user account with temporary credentials and trainee linkage (Admin only)."""
    # 1. Check duplicate email
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise AppException(
            code="DUPLICATE_EMAIL",
            message=f"User account with email '{payload.email}' already exists",
            status_code=409
        )

    # 2. Safety & Linkage Rule: Trainee linkage verification
    # A trainee account must link to exactly one trainee record
    if payload.role == "trainee":
        if payload.trainee_id is None:
            raise AppException(
                code="TRAINEE_LINKAGE_REQUIRED",
                message="Trainee accounts must link to a valid trainee record",
                status_code=400
            )
        # Verify trainee exists
        trainee = db.query(Trainee).filter(Trainee.id == payload.trainee_id).first()
        if not trainee:
            raise AppException(
                code="TRAINEE_NOT_FOUND",
                message=f"Trainee record with ID {payload.trainee_id} does not exist",
                status_code=404
            )
        # Check if already linked to another user
        linked_user = db.query(User).filter(User.trainee_id == payload.trainee_id).first()
        if linked_user:
            raise AppException(
                code="TRAINEE_ALREADY_LINKED",
                message=f"Trainee record {payload.trainee_id} is already linked to user '{linked_user.email}'",
                status_code=409
            )
    else:
        # Trainer or Admin cannot link to trainee
        payload.trainee_id = None

    temp_password = payload.password or _generate_temporary_password()
    password_hash = get_password_hash(temp_password)

    new_user = User(
        email=payload.email,
        password_hash=password_hash,
        role=payload.role,
        is_active=True,
        trainee_id=payload.trainee_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log (never log passwords!)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="user_created",
        entity_type="user",
        entity_id=new_user.id,
        details={
            "email": new_user.email,
            "role": new_user.role,
            "trainee_id": new_user.trainee_id
        }
    )
    db.commit()

    return AdminUserCreateResponse(
        user=_build_admin_user_response(new_user),
        temporary_password=temp_password
    )

@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Updates user role or activation state with self-protection and last-admin safety checks (Admin only)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise AppException(
            code="USER_NOT_FOUND",
            message=f"User with ID {user_id} not found",
            status_code=404
        )

    # Safety Rule 1: An admin cannot deactivate or demote themselves
    if target.id == admin.id:
        if payload.is_active is False:
            raise AppException(
                code="CANNOT_DEACTIVATE_SELF",
                message="Administrators cannot deactivate their own account",
                status_code=409
            )
        if payload.role is not None and payload.role != "admin":
            raise AppException(
                code="CANNOT_DEMOTE_SELF",
                message="Administrators cannot demote their own account",
                status_code=409
            )

    # Safety Rule 2: The last active admin cannot be demoted or deactivated
    if target.role == "admin" and target.is_active:
        will_demote = payload.role is not None and payload.role != "admin"
        will_deactivate = payload.is_active is False
        if will_demote or will_deactivate:
            active_admin_count = db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count()
            if active_admin_count <= 1:
                raise AppException(
                    code="LAST_ACTIVE_ADMIN",
                    message="Cannot demote or deactivate the last active administrator",
                    status_code=409
                )

    action = "user_updated"
    if payload.is_active is False and target.is_active:
        action = "user_deactivated"

    if payload.role is not None:
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active

    db.commit()
    db.refresh(target)

    create_audit_log(
        db=db,
        user_id=admin.id,
        action=action,
        entity_type="user",
        entity_id=target.id,
        details={
            "role": target.role,
            "is_active": target.is_active
        }
    )
    db.commit()

    return _build_admin_user_response(target)

@router.post("/users/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Generates and sets a new temporary password for the specified user (Admin only)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise AppException(
            code="USER_NOT_FOUND",
            message=f"User with ID {user_id} not found",
            status_code=404
        )

    temp_password = _generate_temporary_password()
    target.password_hash = get_password_hash(temp_password)
    db.commit()

    create_audit_log(
        db=db,
        user_id=admin.id,
        action="password_reset",
        entity_type="user",
        entity_id=target.id,
        details={"email": target.email}
    )
    db.commit()

    return AdminResetPasswordResponse(
        temporary_password=temp_password,
        message="Password reset successfully"
    )

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deletes user account with self-delete and last-admin safety protections (Admin only)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise AppException(
            code="USER_NOT_FOUND",
            message=f"User with ID {user_id} not found",
            status_code=404
        )

    # Safety Rule 1: An admin cannot delete themselves
    if target.id == admin.id:
        raise AppException(
            code="CANNOT_DELETE_SELF",
            message="Administrators cannot delete their own account",
            status_code=409
        )

    # Safety Rule 2: The last active admin cannot be deleted
    if target.role == "admin" and target.is_active:
        active_admin_count = db.query(User).filter(User.role == "admin", User.is_active.is_(True)).count()
        if active_admin_count <= 1:
            raise AppException(
                code="LAST_ACTIVE_ADMIN",
                message="Cannot delete the last active administrator",
                status_code=409
            )

    create_audit_log(
        db=db,
        user_id=admin.id,
        action="user_deleted",
        entity_type="user",
        entity_id=target.id,
        details={"email": target.email, "role": target.role}
    )
    db.delete(target)
    db.commit()
    return None

@router.get("/audit-logs", response_model=PaginatedResponse[AuditLogResponse])
def get_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by audit action"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Retrieves paginated audit logs for compliance monitoring (Admin only)."""
    audit_service = AuditService(db)
    result = audit_service.list_logs(
        page=page,
        page_size=page_size,
        user_id=user_id,
        action=action,
        entity_type=entity_type
    )

    items = []
    for item in result.items:
        items.append(
            AuditLogResponse(
                id=item.id,
                user_id=item.user_id,
                user_email=item.user.email if item.user else None,
                action=item.action,
                entity_type=item.entity_type,
                entity_id=item.entity_id,
                details=item.details,
                created_at=item.created_at
            )
        )

    return PaginatedResponse(
        items=items,
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        pages=result.pages
    )
