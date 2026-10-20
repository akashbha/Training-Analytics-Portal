"""Repository handling database operations for assessment Session entries.
Executes multi-criteria query filtering by trainee, module, batch, and chronological date range.
"""

from datetime import date, datetime, time, timezone
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session as DbSession, joinedload
from app.models.session import Session
from app.models.trainee import Trainee

class SessionRepository:
    """Repository handling persistence operations for Session performance records."""
    def __init__(self, db: DbSession):
        self.db = db

    def list(
        self,
        skip: int = 0,
        limit: int = 20,
        trainee_id: Optional[int] = None,
        module_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Tuple[List[Session], int]:
        """Queries sessions sorted newest first with optional multi-attribute filters."""
        query = self.db.query(Session).options(
            joinedload(Session.trainee),
            joinedload(Session.module)
        )

        if batch_id is not None:
            query = query.join(Session.trainee).filter(Trainee.batch_id == batch_id)

        if trainee_id is not None:
            query = query.filter(Session.trainee_id == trainee_id)

        if module_id is not None:
            query = query.filter(Session.module_id == module_id)

        if from_date is not None:
            dt_from = datetime.combine(from_date, time.min, tzinfo=timezone.utc)
            query = query.filter(Session.created_at >= dt_from)

        if to_date is not None:
            dt_to = datetime.combine(to_date, time.max, tzinfo=timezone.utc)
            query = query.filter(Session.created_at <= dt_to)

        total = query.count()
        items = query.order_by(Session.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    def get_by_id(self, session_id: int) -> Optional[Session]:
        """Retrieves a single session entity with related trainee and module loaded."""
        return self.db.query(Session).options(
            joinedload(Session.trainee),
            joinedload(Session.module)
        ).filter(Session.id == session_id).first()

    def create(self, session: Session) -> Session:
        """Persists a single new Session record."""
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def bulk_create(self, sessions: List[Session]) -> List[Session]:
        """Atomically inserts multiple session entries in a single commit."""
        self.db.add_all(sessions)
        self.db.commit()
        return sessions

    def delete(self, session: Session) -> None:
        """Deletes a Session record."""
        self.db.delete(session)
        self.db.commit()
