"""Authentication service executing business logic and credential validation.
Verifies passwords without user enumeration leaks and signs authorized access tokens.
Rejects inactive users with the identical generic credentials error.
"""

from typing import Tuple
from sqlalchemy.orm import Session
from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, create_access_token
from app.core.exceptions import AppException
from app.models.user import User

class AuthService:
    """Service encapsulating authentication, credential verification, and token signing."""
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)

    def authenticate_user(self, email: str, password: str) -> Tuple[str, User]:
        """Validates credentials and returns a signed JWT alongside the authenticated user."""
        user = self.user_repo.get_by_email(email)

        # Constant message for unknown email, wrong password, or inactive account to prevent user enumeration
        if not user or not user.is_active or not verify_password(password, user.password_hash):
            raise AppException(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password",
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"}
            )

        token_data = {
            "sub": str(user.id),
            "role": user.role,
            "trainee_id": user.trainee_id,
        }
        access_token = create_access_token(data=token_data)
        return access_token, user
