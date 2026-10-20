"""FastAPI router managing curriculum assessment Module endpoints.
Enforces positive scoring limits and restricts curriculum modifications to administrator users.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, require_admin
from app.schemas.module import ModuleCreate, ModuleUpdate, ModuleResponse
from app.schemas.common import PaginatedResponse
from app.services.module_service import ModuleService
from app.services.audit_service import create_audit_log
from app.models.user import User

router = APIRouter(prefix="/modules", tags=["Modules"])

@router.get("", response_model=PaginatedResponse[ModuleResponse])
def list_modules(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves paginated curriculum assessment modules."""
    service = ModuleService(db)
    return service.list_modules(page=page, page_size=page_size)

@router.get("/{module_id}", response_model=ModuleResponse)
def get_module(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves assessment module specifications by ID."""
    service = ModuleService(db)
    return service.get_module(module_id)

@router.post("", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
def create_module(
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Creates a curriculum module with unique title and positive score ceiling (Admin only)."""
    service = ModuleService(db)
    module = service.create_module(payload)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="module_created",
        entity_type="module",
        entity_id=module.id,
        details={"name": module.name, "max_score": module.max_score}
    )
    db.commit()
    return module

@router.put("/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: int,
    payload: ModuleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Updates curriculum module specifications (Admin only)."""
    service = ModuleService(db)
    module = service.update_module(module_id, payload)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="module_updated",
        entity_type="module",
        entity_id=module.id,
        details={"name": module.name, "max_score": module.max_score}
    )
    db.commit()
    return module

@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deletes an assessment module and associated sessions (Admin only)."""
    service = ModuleService(db)
    existing = service.get_module(module_id)
    service.delete_module(module_id)
    create_audit_log(
        db=db,
        user_id=admin.id,
        action="module_deleted",
        entity_type="module",
        entity_id=module_id,
        details={"name": existing.name}
    )
    db.commit()
    return None
