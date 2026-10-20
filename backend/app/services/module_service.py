"""Service layer coordinating business logic for curriculum assessment Modules.
Enforces unique module titles and strictly positive score maximum constraints.
"""

import math
from sqlalchemy.orm import Session
from app.repositories.module_repository import ModuleRepository
from app.schemas.module import ModuleCreate, ModuleUpdate, ModuleResponse
from app.schemas.common import PaginatedResponse
from app.models.module import Module
from app.core.exceptions import AppException

class ModuleService:
    """Service handling assessment module management and uniqueness verification."""
    def __init__(self, db: Session):
        self.repo = ModuleRepository(db)

    def list_modules(self, page: int = 1, page_size: int = 20) -> PaginatedResponse[ModuleResponse]:
        """Returns paginated assessment modules ordered alphabetically."""
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        skip = (page - 1) * page_size

        items, total = self.repo.list(skip=skip, limit=page_size)
        pages = math.ceil(total / page_size) if total > 0 else 1

        response_items = [
            ModuleResponse(
                id=m.id,
                name=m.name,
                max_score=m.max_score,
                session_count=len(m.sessions) if m.sessions is not None else 0
            )
            for m in items
        ]

        return PaginatedResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages
        )

    def get_module(self, module_id: int) -> ModuleResponse:
        """Retrieves a single module by ID or raises 404."""
        module = self.repo.get_by_id(module_id)
        if not module:
            raise AppException(code="MODULE_NOT_FOUND", message=f"Module with ID {module_id} not found", status_code=404)
        return ModuleResponse(
            id=module.id,
            name=module.name,
            max_score=module.max_score,
            session_count=len(module.sessions) if module.sessions is not None else 0
        )

    def create_module(self, module_in: ModuleCreate) -> ModuleResponse:
        """Validates module title uniqueness and creates a new assessment module."""
        existing = self.repo.get_by_name(module_in.name)
        if existing:
            raise AppException(
                code="MODULE_NAME_CONFLICT",
                message=f"Module with name '{module_in.name}' already exists",
                status_code=409
            )

        module = Module(
            name=module_in.name.strip(),
            max_score=float(module_in.max_score)
        )
        created = self.repo.create(module)
        return ModuleResponse(
            id=created.id,
            name=created.name,
            max_score=created.max_score,
            session_count=0
        )

    def update_module(self, module_id: int, module_in: ModuleUpdate) -> ModuleResponse:
        """Updates module details while preventing duplicate name collisions."""
        module = self.repo.get_by_id(module_id)
        if not module:
            raise AppException(code="MODULE_NOT_FOUND", message=f"Module with ID {module_id} not found", status_code=404)

        if module_in.name and module_in.name.strip().lower() != module.name.lower():
            existing = self.repo.get_by_name(module_in.name)
            if existing and existing.id != module_id:
                raise AppException(
                    code="MODULE_NAME_CONFLICT",
                    message=f"Module with name '{module_in.name}' already exists",
                    status_code=409
                )
            module.name = module_in.name.strip()

        if module_in.max_score is not None:
            if module_in.max_score <= 0:
                raise AppException(code="INVALID_MAX_SCORE", message="max_score must be strictly greater than 0", status_code=422)
            module.max_score = float(module_in.max_score)

        updated = self.repo.update(module)
        return ModuleResponse(
            id=updated.id,
            name=updated.name,
            max_score=updated.max_score,
            session_count=len(updated.sessions) if updated.sessions is not None else 0
        )

    def delete_module(self, module_id: int) -> None:
        """Deletes an assessment module."""
        module = self.repo.get_by_id(module_id)
        if not module:
            raise AppException(code="MODULE_NOT_FOUND", message=f"Module with ID {module_id} not found", status_code=404)
        self.repo.delete(module)
