"""Database repository for user model queries and persistence operations.
Encapsulates all SQLAlchemy queries targeting the users table to isolate database access.
"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User

class UserRepository:
    """Repository handling database operations for User records."""
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> Optional[User]:
        """Retrieves a single user record by their unique email address."""
        return self.db.query(User).filter(User.email == email.lower().strip()).first()

    def get_by_id(self, user_id: int) -> Optional[User]:
        """Retrieves a single user record by primary key."""
        return self.db.query(User).filter(User.id == user_id).first()
