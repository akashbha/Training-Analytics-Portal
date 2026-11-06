"""FastAPI router for private messaging between trainees and trainers.
Enforces participant scoping, chronological thread reads, contacts discovery, and read tracking.
"""

from fastapi import APIRouter, Depends, Query, status
import math
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse, ContactResponse
from app.schemas.common import PaginatedResponse
from app.services.messaging_service import MessagingService, get_user_display_name

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sends a private message to an eligible recipient (Trainee or Trainer)."""
    service = MessagingService(db)
    msg = service.send_message(
        sender=current_user,
        recipient_id=payload.recipient_id,
        body=payload.body
    )
    return MessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        recipient_id=msg.recipient_id,
        body=msg.body,
        created_at=msg.created_at,
        read_at=msg.read_at,
        sender_name=get_user_display_name(msg.sender),
        recipient_name=get_user_display_name(msg.recipient)
    )

@router.get("/contacts", response_model=list[ContactResponse])
def get_messaging_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists eligible conversational partners for the current user."""
    service = MessagingService(db)
    return service.get_contacts(current_user)

@router.get("/with/{user_id}", response_model=PaginatedResponse[MessageResponse])
def get_message_thread(
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves conversation thread between caller and target user, oldest first."""
    service = MessagingService(db)
    res = service.get_thread(
        caller=current_user,
        other_user_id=user_id,
        page=page,
        page_size=page_size
    )
    total = res["total"]
    pages = math.ceil(total / page_size) if total > 0 else 1
    return PaginatedResponse(
        items=res["items"],
        total=total,
        page=res["page"],
        page_size=res["page_size"],
        pages=pages
    )

@router.put("/with/{user_id}/read")
def mark_thread_read(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marks inbound messages from user_id to caller as read."""
    service = MessagingService(db)
    updated_count = service.mark_thread_read(caller=current_user, other_user_id=user_id)
    return {"status": "success", "marked_read": updated_count}
