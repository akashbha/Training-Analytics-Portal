"""Repository handling database operations for Trainee records.
Supports filtering by cohort, case-insensitive keyword search on name and email, and name sorting.
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from app.models.trainee import Trainee

class TraineeRepository:
    """Repository handling persistence operations for enrolled Trainees."""
    def __init__(self, db: Session):
        self.db = db

    def list(
        self,
        skip: int = 0,
        limit: int = 20,
        batch_id: Optional[int] = None,
        search: Optional[str] = None,
        sort: Optional[str] = "name"
    ) -> Tuple[List[Trainee], int]:
        """Queries trainees with optional batch filtering, search keywords, and sorting."""
        query = self.db.query(Trainee).options(joinedload(Trainee.batch))

        if batch_id is not None:
            query = query.filter(Trainee.batch_id == batch_id)

        if search:
            search_term = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(Trainee.name).like(search_term),
                    func.lower(Trainee.email).like(search_term)
                )
            )

        total = query.count()

        if sort == "-name":
            query = query.order_by(Trainee.name.desc())
        elif sort == "-id":
            query = query.order_by(Trainee.id.desc())
        elif sort == "id":
            query = query.order_by(Trainee.id.asc())
        else:
            query = query.order_by(Trainee.name.asc())

        items = query.offset(skip).limit(limit).all()
        return items, total

    def get_by_id(self, trainee_id: int) -> Optional[Trainee]:
        """Retrieves a single trainee entity with their batch relation loaded."""
        return self.db.query(Trainee).options(
            joinedload(Trainee.batch),
            joinedload(Trainee.sessions)
        ).filter(Trainee.id == trainee_id).first()

    def get_by_email(self, email: str) -> Optional[Trainee]:
        """Finds a trainee by exact email match."""
        return self.db.query(Trainee).filter(func.lower(Trainee.email) == email.lower().strip()).first()

    def create(self, trainee: Trainee) -> Trainee:
        """Persists a new Trainee record."""
        self.db.add(trainee)
        self.db.commit()
        self.db.refresh(trainee)
        return trainee

    def update(self, trainee: Trainee) -> Trainee:
        """Updates an existing Trainee record."""
        self.db.commit()
        self.db.refresh(trainee)
        return trainee

    def delete(self, trainee: Trainee) -> None:
        """Deletes a Trainee record."""
        self.db.delete(trainee)
        self.db.commit()
