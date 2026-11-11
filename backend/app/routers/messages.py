"""FastAPI router for private messaging, batch cohort channels, and file attachments.
Enforces participant scoping, chronological thread reads, contacts discovery, and attachment security.
"""

from fastapi import APIRouter, Depends, Query, UploadFile, File, status
from fastapi.responses import FileResponse
import math
import os
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.message import (
    MessageCreate,
    MessageResponse,
    ContactResponse,
    AttachmentUploadResponse
)
from app.schemas.common import PaginatedResponse
from app.services.messaging_service import MessagingService, format_message
from app.core.exceptions import AppException

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sends a private or batch message to eligible recipients or cohort batch."""
    service = MessagingService(db)
    msg = service.send_message(
        sender=current_user,
        channel=payload.channel,
        recipient_id=payload.recipient_id,
        batch_id=payload.batch_id,
        body=payload.body
    )
    return format_message(msg)


@router.post("/{id}/attachments", response_model=AttachmentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Uploads a file attachment for a recently created message by the author."""
    content = await file.read()
    service = MessagingService(db)
    attachment = service.upload_attachment(
        caller=current_user,
        message_id=id,
        original_filename=file.filename or "attachment",
        content_type=file.content_type,
        content=content
    )
    return AttachmentUploadResponse(
        id=attachment.id,
        original_filename=attachment.original_filename,
        mime_type=attachment.mime_type,
        size_bytes=attachment.size_bytes,
        created_at=attachment.created_at
    )


@router.get("/attachments/{id}")
def download_attachment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Downloads an attachment file if caller is an authorized message participant."""
    service = MessagingService(db)
    attachment = service.get_attachment_for_download(caller=current_user, attachment_id=id)

    if not os.path.exists(attachment.stored_path):
        raise AppException(
            code="FILE_NOT_FOUND",
            message="Attachment file missing on server storage",
            status_code=404
        )

    return FileResponse(
        path=attachment.stored_path,
        media_type=attachment.mime_type,
        filename=attachment.original_filename
    )


@router.get("/contacts", response_model=list[ContactResponse])
def get_messaging_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists eligible conversational partners for the current user."""
    service = MessagingService(db)
    return service.get_contacts(current_user)


@router.get("/private/{user_id}", response_model=PaginatedResponse[MessageResponse])
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


@router.get("/batch/{batch_id}", response_model=PaginatedResponse[MessageResponse])
def get_batch_messages(
    batch_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves batch cohort channel messages, oldest first."""
    service = MessagingService(db)
    res = service.get_batch_messages(
        caller=current_user,
        batch_id=batch_id,
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


@router.put("/private/{user_id}/read")
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
