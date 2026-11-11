"""Service module enforcing messaging participant rules, batch channels, attachments, and audit logging.
Provides strict batch scoping, authorization checks, thread and channel history, and file handling.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import os
import uuid
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.models.user import User
from app.models.trainee import Trainee
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.message import Message
from app.models.message_attachment import MessageAttachment
from app.core.exceptions import AppException
from app.services.audit_service import record_audit_log

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def get_user_display_name(user: Optional[User]) -> str:
    """Derives a human-friendly display name from trainee or email metadata."""
    if not user:
        return "Unknown User"
    if user.trainee and user.trainee.name:
        return user.trainee.name
    if user.email:
        prefix = user.email.split("@")[0].replace(".", " ").title()
        return prefix
    return f"User {user.id}"


def can_access_batch_channel(user: User, batch_id: int, db: Session) -> bool:
    """Checks whether user is authorized to read or post in the specified batch channel."""
    if user.role == "admin":
        raise AppException(
            code="FORBIDDEN_ROLE",
            message="Administrative accounts cannot access batch channels",
            status_code=403
        )
    if user.role == "trainee":
        if not user.trainee or user.trainee.batch_id != batch_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainees can only access their own batch channel",
                status_code=403
            )
        return True
    if user.role == "trainer":
        is_assigned = (
            db.query(BatchTrainer)
            .filter(BatchTrainer.batch_id == batch_id, BatchTrainer.trainer_id == user.id)
            .first()
        )
        if not is_assigned:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainer is not assigned to this batch",
                status_code=403
            )
        return True
    raise AppException(
        code="FORBIDDEN_ROLE",
        message="Role not permitted in batch channels",
        status_code=403
    )


def can_message(sender: User, recipient: User, db: Session) -> bool:
    """Enforces the strict participant matrix between trainees and trainers."""
    if sender.id == recipient.id:
        raise AppException(
            code="INVALID_RECIPIENT",
            message="Cannot send a message to yourself",
            status_code=422
        )

    if sender.role == "admin":
        raise AppException(
            code="FORBIDDEN_ROLE",
            message="Administrative accounts cannot send or read private messages",
            status_code=403
        )
    if recipient.role == "admin":
        raise AppException(
            code="INVALID_RECIPIENT",
            message="Administrative accounts cannot be message recipients",
            status_code=422
        )

    if sender.role == "trainer":
        if recipient.role == "trainer":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Trainer-to-trainer messaging is not permitted",
                status_code=403
            )
        if recipient.role != "trainee":
            raise AppException(
                code="INVALID_RECIPIENT",
                message="Trainers may only message enrolled trainees",
                status_code=422
            )

        if not recipient.trainee or not recipient.trainee.batch_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Recipient trainee is not assigned to a valid batch",
                status_code=403
            )

        is_assigned = (
            db.query(BatchTrainer)
            .filter(
                BatchTrainer.trainer_id == sender.id,
                BatchTrainer.batch_id == recipient.trainee.batch_id
            )
            .first()
        )
        if not is_assigned:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Trainer is not assigned to the recipient's batch cohort",
                status_code=403
            )
        return True

    if sender.role == "trainee":
        if not sender.trainee or not sender.trainee.batch_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Sender trainee is not enrolled in a valid batch",
                status_code=403
            )
        sender_batch_id = sender.trainee.batch_id

        if recipient.role == "trainer":
            is_assigned = (
                db.query(BatchTrainer)
                .filter(
                    BatchTrainer.trainer_id == recipient.id,
                    BatchTrainer.batch_id == sender_batch_id
                )
                .first()
            )
            if not is_assigned:
                raise AppException(
                    code="FORBIDDEN_RESOURCE_ACCESS",
                    message="Trainer is not assigned to your batch cohort",
                    status_code=403
                )
            return True

        if recipient.role == "trainee":
            if not recipient.trainee or not recipient.trainee.batch_id:
                raise AppException(
                    code="FORBIDDEN_RESOURCE_ACCESS",
                    message="Recipient trainee is not enrolled in a batch",
                    status_code=403
                )
            if recipient.trainee.batch_id != sender_batch_id:
                raise AppException(
                    code="FORBIDDEN_RESOURCE_ACCESS",
                    message="Cannot message or inspect threads with trainees outside your batch cohort",
                    status_code=403
                )
            return True

        raise AppException(
            code="INVALID_RECIPIENT",
            message="Invalid recipient role for trainee message",
            status_code=422
        )

    raise AppException(
        code="FORBIDDEN_ROLE",
        message="Role is not authorized for messaging operations",
        status_code=403
    )


def validate_attachment_file(filename: str, content_type: Optional[str], content: bytes) -> str:
    """Validates file size, mime type, and magic bytes. Returns validated mime_type."""
    if len(content) > MAX_FILE_SIZE:
        raise AppException(
            code="FILE_TOO_LARGE",
            message="File exceeds maximum allowed size of 5 MB",
            status_code=422
        )

    ext = os.path.splitext(filename)[1].lower() if filename else ""

    if ext == ".pdf" or content_type == "application/pdf":
        if not content.startswith(b"%PDF"):
            raise AppException(
                code="INVALID_FILE_TYPE",
                message="File content does not match PDF format",
                status_code=422
            )
        return "application/pdf"

    if ext in (".png",) or content_type == "image/png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AppException(
                code="INVALID_FILE_TYPE",
                message="File content does not match PNG format",
                status_code=422
            )
        return "image/png"

    if ext in (".jpg", ".jpeg") or content_type == "image/jpeg":
        if not content.startswith(b"\xff\xd8\xff"):
            raise AppException(
                code="INVALID_FILE_TYPE",
                message="File content does not match JPEG format",
                status_code=422
            )
        return "image/jpeg"

    if ext == ".docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        if not content.startswith(b"PK\x03\x04"):
            raise AppException(
                code="INVALID_FILE_TYPE",
                message="File content does not match DOCX format",
                status_code=422
            )
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    if ext in (".txt",) or content_type == "text/plain":
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            raise AppException(
                code="INVALID_FILE_TYPE",
                message="Text file must be valid UTF-8",
                status_code=422
            )
        return "text/plain"

    if ext in (".md", ".markdown") or content_type == "text/markdown":
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            raise AppException(
                code="INVALID_FILE_TYPE",
                message="Markdown file must be valid UTF-8",
                status_code=422
            )
        return "text/markdown"

    raise AppException(
        code="INVALID_FILE_TYPE",
        message=f"File type {content_type or ext} is not supported",
        status_code=422
    )


def format_message(m: Message) -> Dict[str, Any]:
    """Serializes message for API response without exposing internal file paths."""
    attachments = []
    for a in (m.attachments or []):
        attachments.append({
            "id": a.id,
            "filename": a.original_filename,
            "size": a.size_bytes,
            "mime_type": a.mime_type,
            "download_url": f"/messages/attachments/{a.id}"
        })
    return {
        "id": m.id,
        "channel": m.channel,
        "sender_id": m.sender_id,
        "recipient_id": m.recipient_id,
        "batch_id": m.batch_id,
        "body": m.body,
        "created_at": m.created_at,
        "read_at": m.read_at,
        "sender_name": get_user_display_name(m.sender),
        "sender_role": m.sender.role if m.sender else None,
        "recipient_name": get_user_display_name(m.recipient) if m.recipient else None,
        "attachments": attachments
    }


class MessagingService:
    def __init__(self, db: Session):
        self.db = db

    def get_contacts(self, caller: User) -> List[Dict[str, Any]]:
        """Retrieves eligible conversational contacts for the caller."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot access messaging contacts",
                status_code=403
            )

        contacts = []

        if caller.role == "trainee":
            if not caller.trainee or not caller.trainee.batch_id:
                return []
            batch_id = caller.trainee.batch_id
            batch_name = caller.trainee.batch.name if caller.trainee.batch else "Batch"

            # 1. Assigned batch trainers
            assigned_trainers = (
                self.db.query(User)
                .join(BatchTrainer, BatchTrainer.trainer_id == User.id)
                .filter(BatchTrainer.batch_id == batch_id, User.is_active.is_(True))
                .all()
            )
            for t in assigned_trainers:
                contacts.append({
                    "id": t.id,
                    "email": t.email,
                    "role": t.role,
                    "name": get_user_display_name(t),
                    "batch_id": batch_id,
                    "batch_name": f"{batch_name} (Trainer)"
                })

            # 2. Peer trainees in same batch
            peers = (
                self.db.query(User)
                .join(Trainee, User.trainee_id == Trainee.id)
                .filter(Trainee.batch_id == batch_id, User.id != caller.id, User.is_active.is_(True))
                .order_by(Trainee.name.asc())
                .all()
            )
            for p in peers:
                contacts.append({
                    "id": p.id,
                    "email": p.email,
                    "role": p.role,
                    "name": get_user_display_name(p),
                    "trainee_id": p.trainee_id,
                    "batch_id": batch_id,
                    "batch_name": batch_name
                })

        elif caller.role == "trainer":
            assignments = (
                self.db.query(BatchTrainer)
                .filter(BatchTrainer.trainer_id == caller.id)
                .all()
            )
            batch_ids = [a.batch_id for a in assignments]
            if not batch_ids:
                return []

            trainees_users = (
                self.db.query(User)
                .join(Trainee, User.trainee_id == Trainee.id)
                .filter(Trainee.batch_id.in_(batch_ids), User.is_active.is_(True))
                .order_by(Trainee.name.asc())
                .all()
            )
            for tu in trainees_users:
                batch_name = tu.trainee.batch.name if tu.trainee and tu.trainee.batch else "Batch"
                contacts.append({
                    "id": tu.id,
                    "email": tu.email,
                    "role": tu.role,
                    "name": get_user_display_name(tu),
                    "trainee_id": tu.trainee_id,
                    "batch_id": tu.trainee.batch_id if tu.trainee else None,
                    "batch_name": batch_name
                })

        return contacts

    def send_message(
        self,
        sender: User,
        channel: str = "private",
        recipient_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        body: Optional[str] = None
    ) -> Message:
        """Sends a private or batch message after enforcing scoping rules and audit logging."""
        trimmed_body = body.strip() if body else ""
        if not trimmed_body:
            raise AppException(
                code="INVALID_MESSAGE_BODY",
                message="Message body cannot be empty or whitespace only",
                status_code=422
            )
        if len(body) > 500:
            raise AppException(
                code="INVALID_MESSAGE_BODY",
                message="Message body cannot exceed 500 characters",
                status_code=422
            )

        if sender.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot send messages",
                status_code=403
            )

        if channel == "batch":
            if batch_id is None:
                raise AppException(
                    code="INVALID_BATCH_TARGET",
                    message="batch_id is required for batch messages",
                    status_code=422
                )
            if recipient_id is not None:
                raise AppException(
                    code="INVALID_BATCH_TARGET",
                    message="recipient_id must be null for batch messages",
                    status_code=422
                )

            # Validate batch existence
            batch_entity = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if not batch_entity:
                raise AppException(
                    code="BATCH_NOT_FOUND",
                    message=f"Batch with ID {batch_id} not found",
                    status_code=404
                )

            # Enforce batch channel authorization
            can_access_batch_channel(sender, batch_id, self.db)

            msg = Message(
                channel="batch",
                sender_id=sender.id,
                recipient_id=None,
                batch_id=batch_id,
                body=trimmed_body
            )
            self.db.add(msg)
            self.db.flush()

            record_audit_log(
                db=self.db,
                actor_id=sender.id,
                action="create",
                entity_type="message",
                entity_id=msg.id,
                before=None,
                after={
                    "channel": "batch",
                    "batch_id": batch_id,
                    "created_at": msg.created_at.isoformat() if msg.created_at else str(datetime.now(timezone.utc)),
                    "attachment_count": 0
                }
            )
            self.db.commit()
            self.db.refresh(msg)
            return msg

        # Private channel
        if recipient_id is None:
            raise AppException(
                code="INVALID_RECIPIENT",
                message="recipient_id is required for private messages",
                status_code=422
            )
        if batch_id is not None:
            raise AppException(
                code="INVALID_RECIPIENT",
                message="batch_id must be null for private messages",
                status_code=422
            )

        recipient = self.db.query(User).filter(User.id == recipient_id).first()
        if not recipient:
            # Fallback: check if recipient_id was passed as trainee_id
            recipient = self.db.query(User).filter(User.trainee_id == recipient_id).first()
            if recipient:
                recipient_id = recipient.id
        if not recipient:
            raise AppException(
                code="RECIPIENT_NOT_FOUND",
                message=f"Recipient user with ID {recipient_id} not found",
                status_code=404
            )

        can_message(sender, recipient, self.db)

        msg = Message(
            channel="private",
            sender_id=sender.id,
            recipient_id=recipient_id,
            batch_id=None,
            body=trimmed_body
        )
        self.db.add(msg)
        self.db.flush()

        record_audit_log(
            db=self.db,
            actor_id=sender.id,
            action="create",
            entity_type="message",
            entity_id=msg.id,
            before=None,
            after={
                "channel": "private",
                "recipient_id": recipient_id,
                "created_at": msg.created_at.isoformat() if msg.created_at else str(datetime.now(timezone.utc)),
                "attachment_count": 0
            }
        )
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def get_thread(self, caller: User, other_user_id: int, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        """Retrieves paginated private messages in chronological order (oldest first)."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot access messaging threads",
                status_code=403
            )

        other_user = self.db.query(User).filter(User.id == other_user_id).first()
        if not other_user:
            # Fallback: check if other_user_id was passed as trainee_id
            other_user = self.db.query(User).filter(User.trainee_id == other_user_id).first()
            if other_user:
                other_user_id = other_user.id
        if not other_user:
            raise AppException(
                code="USER_NOT_FOUND",
                message=f"User with ID {other_user_id} not found",
                status_code=404
            )

        can_message(caller, other_user, self.db)

        query = (
            self.db.query(Message)
            .filter(
                Message.channel == "private",
                or_(
                    and_(Message.sender_id == caller.id, Message.recipient_id == other_user_id),
                    and_(Message.sender_id == other_user_id, Message.recipient_id == caller.id),
                )
            )
            .order_by(Message.created_at.asc())
        )

        total = query.count()
        offset = (page - 1) * page_size
        items = query.offset(offset).limit(page_size).all()

        return {
            "items": [format_message(m) for m in items],
            "total": total,
            "page": page,
            "page_size": page_size
        }

    def get_batch_messages(self, caller: User, batch_id: int, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        """Retrieves paginated batch channel messages in chronological order (oldest first)."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise AppException(
                code="BATCH_NOT_FOUND",
                message=f"Batch with ID {batch_id} not found",
                status_code=404
            )

        can_access_batch_channel(caller, batch_id, self.db)

        query = (
            self.db.query(Message)
            .filter(
                Message.channel == "batch",
                Message.batch_id == batch_id
            )
            .order_by(Message.created_at.asc())
        )

        total = query.count()
        offset = (page - 1) * page_size
        items = query.offset(offset).limit(page_size).all()

        return {
            "items": [format_message(m) for m in items],
            "total": total,
            "page": page,
            "page_size": page_size
        }

    def mark_thread_read(self, caller: User, other_user_id: int) -> int:
        """Marks inbound private messages from other_user to caller as read."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot participate in messaging",
                status_code=403
            )

        other_user = self.db.query(User).filter(User.id == other_user_id).first()
        if not other_user:
            other_user = self.db.query(User).filter(User.trainee_id == other_user_id).first()
            if other_user:
                other_user_id = other_user.id

        now = datetime.now(timezone.utc)
        updated = (
            self.db.query(Message)
            .filter(
                Message.channel == "private",
                Message.sender_id == other_user_id,
                Message.recipient_id == caller.id,
                Message.read_at.is_(None)
            )
            .update({Message.read_at: now}, synchronize_session=False)
        )
        self.db.commit()
        return updated

    def upload_attachment(self, caller: User, message_id: int, original_filename: str, content_type: Optional[str], content: bytes) -> MessageAttachment:
        """Uploads a file attachment for an authored message created within the last 5 minutes."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot upload attachments",
                status_code=403
            )

        msg = self.db.query(Message).filter(Message.id == message_id).first()
        if not msg:
            raise AppException(
                code="MESSAGE_NOT_FOUND",
                message=f"Message with ID {message_id} not found",
                status_code=404
            )

        if msg.sender_id != caller.id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Only the message author may attach files",
                status_code=403
            )

        # Enforce 5-minute creation threshold
        msg_created = msg.created_at
        if msg_created.tzinfo is None:
            msg_created = msg_created.replace(tzinfo=timezone.utc)
        now_utc = datetime.now(timezone.utc)
        if (now_utc - msg_created) > timedelta(minutes=5):
            raise AppException(
                code="ATTACHMENT_WINDOW_EXPIRED",
                message="Attachments can only be added within 5 minutes of message creation",
                status_code=400
            )

        # Max 3 attachments check
        current_count = self.db.query(MessageAttachment).filter(MessageAttachment.message_id == msg.id).count()
        if current_count >= 3:
            raise AppException(
                code="ATTACHMENT_LIMIT_EXCEEDED",
                message="A message can carry at most 3 attachments",
                status_code=422
            )

        # Validate file size, mime type, and magic bytes
        validated_mime = validate_attachment_file(original_filename, content_type, content)

        # Store file on disk: backend/uploads/messages/{message_id}/{server_generated_filename}
        base_upload_dir = Path("backend") / "uploads" / "messages" / str(msg.id)
        if not Path("backend").exists():
            base_upload_dir = Path("uploads") / "messages" / str(msg.id)
        base_upload_dir.mkdir(parents=True, exist_ok=True)

        ext = os.path.splitext(original_filename)[1].lower() if original_filename else ""
        server_filename = f"{uuid.uuid4().hex}{ext}"
        target_path = base_upload_dir / server_filename
        target_path.write_bytes(content)

        attachment = MessageAttachment(
            message_id=msg.id,
            original_filename=original_filename[:255],
            stored_path=str(target_path.resolve()),
            mime_type=validated_mime,
            size_bytes=len(content),
            uploaded_by=caller.id
        )
        self.db.add(attachment)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def get_attachment_for_download(self, caller: User, attachment_id: int) -> MessageAttachment:
        """Applies parent message access control to retrieve attachment metadata for download."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot download attachments",
                status_code=403
            )

        attachment = self.db.query(MessageAttachment).filter(MessageAttachment.id == attachment_id).first()
        if not attachment:
            raise AppException(
                code="ATTACHMENT_NOT_FOUND",
                message=f"Attachment with ID {attachment_id} not found",
                status_code=404
            )

        parent_message = attachment.message
        if not parent_message:
            raise AppException(
                code="MESSAGE_NOT_FOUND",
                message="Associated message not found",
                status_code=404
            )

        # Scoping check matching parent message
        if parent_message.channel == "private":
            if caller.id not in (parent_message.sender_id, parent_message.recipient_id):
                raise AppException(
                    code="FORBIDDEN_RESOURCE_ACCESS",
                    message="You are not authorized to view attachments from this private conversation",
                    status_code=403
                )
        elif parent_message.channel == "batch":
            can_access_batch_channel(caller, parent_message.batch_id, self.db)
        else:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Unsupported message channel for attachment download",
                status_code=403
            )

        return attachment
