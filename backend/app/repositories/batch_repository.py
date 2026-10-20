"""Repository handling database operations for Batch entities.
Provides paginated listings, uniqueness lookups, and trainee count verification before deletion.
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.batch import Batch
from app.models.trainee import Trainee

class BatchRepository:
    """Repository handling persistence operations for Batch cohorts."""
    def __init__(self, db: Session):
        self.db = db

    def list(self, skip: int = 0, limit: int = 20) -> Tuple[List[Batch], int]:
        """Returns paginated batches alongside the overall count."""
        query = self.db.query(Batch)
        total = query.count()
        items = query.order_by(Batch.start_date.desc(), Batch.name.asc()).offset(skip).limit(limit).all()
        return items, total

    def get_by_id(self, batch_id: int) -> Optional[Batch]:
        """Retrieves a single batch cohort by primary key."""
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def get_by_name(self, name: str) -> Optional[Batch]:
        """Retrieves a batch by exact case-insensitive name match."""
        return self.db.query(Batch).filter(func.lower(Batch.name) == name.lower().strip()).first()

    def count_trainees(self, batch_id: int) -> int:
        """Returns the number of active trainees enrolled in this batch."""
        return self.db.query(Trainee).filter(Trainee.batch_id == batch_id).count()

    def create(self, batch: Batch) -> Batch:
        """Persists a new Batch record."""
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def update(self, batch: Batch) -> Batch:
        """Saves modifications made to an existing Batch record."""
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def delete(self, batch: Batch) -> None:
        """Deletes a Batch record from the database."""
        self.db.delete(batch)
        self.db.commit()
