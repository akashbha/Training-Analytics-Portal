"""Repository handling database operations for curriculum Module entities.
Provides paginated listings, uniqueness lookups by title, and persistence operations.
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.module import Module

class ModuleRepository:
    """Repository handling persistence operations for assessment Modules."""
    def __init__(self, db: Session):
        self.db = db

    def list(self, skip: int = 0, limit: int = 20) -> Tuple[List[Module], int]:
        """Returns paginated assessment modules ordered alphabetically."""
        query = self.db.query(Module)
        total = query.count()
        items = query.order_by(Module.name.asc()).offset(skip).limit(limit).all()
        return items, total

    def get_by_id(self, module_id: int) -> Optional[Module]:
        """Retrieves a single module by primary key."""
        return self.db.query(Module).filter(Module.id == module_id).first()

    def get_by_name(self, name: str) -> Optional[Module]:
        """Retrieves a module by case-insensitive name match."""
        return self.db.query(Module).filter(func.lower(Module.name) == name.lower().strip()).first()

    def create(self, module: Module) -> Module:
        """Persists a new Module record."""
        self.db.add(module)
        self.db.commit()
        self.db.refresh(module)
        return module

    def update(self, module: Module) -> Module:
        """Updates an existing Module record."""
        self.db.commit()
        self.db.refresh(module)
        return module

    def delete(self, module: Module) -> None:
        """Deletes a Module record."""
        self.db.delete(module)
        self.db.commit()
