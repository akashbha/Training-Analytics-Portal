"""FastAPI router for documentation search and grounded help assistant.
Provides role-filtered search across indexed documentation chunks with citation metadata.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.help import HelpSearchResponse
from app.services.help_service import help_search

router = APIRouter(prefix="/help", tags=["Help"])

@router.get("/search", response_model=HelpSearchResponse, status_code=status.HTTP_200_OK)
def search_help_documentation(
    q: Optional[str] = Query(default=None, description="Search query string"),
    limit: int = Query(default=3, ge=1, le=10, description="Maximum number of citations to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Searches indexed project documentation filtered by caller role."""
    results = help_search(query=q, role=current_user.role, limit=limit, db=db)

    if not results:
        return HelpSearchResponse(
            answer_found=False,
            message="This is not covered in the project documentation.",
            results=[]
        )

    return HelpSearchResponse(
        answer_found=True,
        message="Matches from project documentation.",
        results=results
    )
