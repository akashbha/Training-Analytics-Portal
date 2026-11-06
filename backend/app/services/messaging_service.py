"""Service module enforcing private messaging participant rules and data management.
Provides strict batch scoping, authorization checks, thread retrieval, and audit logging.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.models.user import User
from app.models.trainee import Trainee
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.message import Message
from app.core.exceptions import AppException
from app.services.audit_service import record_audit_log

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

def can_message(sender: User, recipient: User, db: Session) -> bool:
    """Enforces the strict participant matrix between trainees and trainers.

    Rules:
    1. Admin accounts cannot send or receive messages.
       - Admin sender -> 403 FORBIDDEN_ROLE
       - Admin recipient -> 422 INVALID_RECIPIENT
    2. Sending to oneself -> 422 INVALID_RECIPIENT
    3. Trainee:
       - May message trainers assigned to their batch (via batch_trainers)
       - May message trainees in their own batch
       - Trainee in another batch -> 403 FORBIDDEN_RESOURCE_ACCESS
       - Unassigned trainer -> 403 FORBIDDEN_RESOURCE_ACCESS
    4. Trainer:
       - May message trainees in batches they are assigned to
       - Trainer-to-trainer -> 403 FORBIDDEN_ROLE
       - Trainee in unassigned batch -> 403 FORBIDDEN_RESOURCE_ACCESS
    """
    # Rule 5: Cannot message oneself
    if sender.id == recipient.id:
        raise AppException(
            code="INVALID_RECIPIENT",
            message="Cannot send a message to yourself",
            status_code=422
        )

    # Rule 1: Admin account isolation
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

    # Rule 3: Trainer sender rules
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

        # Check if recipient trainee is in an assigned batch
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

    # Rule 2 & 4: Trainee sender rules
    if sender.role == "trainee":
        if not sender.trainee or not sender.trainee.batch_id:
            raise AppException(
                code="FORBIDDEN_RESOURCE_ACCESS",
                message="Sender trainee is not enrolled in a valid batch",
                status_code=403
            )
        sender_batch_id = sender.trainee.batch_id

        # Recipient is trainer
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

        # Recipient is peer trainee
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

class MessagingService:
    def __init__(self, db: Session):
        self.db = db

    def get_contacts(self, caller: User) -> List[Dict[str, Any]]:
        """Retrieves eligible conversational contacts for the authenticated caller."""
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
                .filter(BatchTrainer.batch_id == batch_id)
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

            # 2. Peer trainees in same batch (excluding self)
            peers = (
                self.db.query(User)
                .join(Trainee, User.trainee_id == Trainee.id)
                .filter(Trainee.batch_id == batch_id, User.id != caller.id)
                .all()
            )
            for p in peers:
                contacts.append({
                    "id": p.id,
                    "email": p.email,
                    "role": p.role,
                    "name": get_user_display_name(p),
                    "batch_id": batch_id,
                    "batch_name": batch_name
                })

        elif caller.role == "trainer":
            # Trainees in all batches assigned to this trainer
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
                .filter(Trainee.batch_id.in_(batch_ids))
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
                    "batch_id": tu.trainee.batch_id if tu.trainee else None,
                    "batch_name": batch_name
                })

        return contacts

    def send_message(self, sender: User, recipient_id: int, body: str) -> Message:
        """Sends a private message after applying participant validation and audit logging."""
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

        recipient = self.db.query(User).filter(User.id == recipient_id).first()
        if not recipient:
            raise AppException(
                code="RECIPIENT_NOT_FOUND",
                message=f"Recipient user with ID {recipient_id} not found",
                status_code=404
            )

        # Enforce participant rule matrix
        can_message(sender, recipient, self.db)

        msg = Message(
            sender_id=sender.id,
            recipient_id=recipient_id,
            body=trimmed_body
        )
        self.db.add(msg)
        self.db.flush()

        # Audit log creation: Never store body text
        record_audit_log(
            db=self.db,
            actor_id=sender.id,
            action="create",
            entity_type="message",
            entity_id=msg.id,
            before=None,
            after={
                "recipient_id": recipient_id,
                "created_at": msg.created_at.isoformat() if msg.created_at else str(datetime.now(timezone.utc))
            }
        )
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def get_thread(self, caller: User, other_user_id: int, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        """Retrieves paginated messages in chronological order (oldest first)."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot access messaging threads",
                status_code=403
            )

        other_user = self.db.query(User).filter(User.id == other_user_id).first()
        if not other_user:
            raise AppException(
                code="USER_NOT_FOUND",
                message=f"User with ID {other_user_id} not found",
                status_code=404
            )

        # Apply same participant rule on thread reading
        can_message(caller, other_user, self.db)

        query = (
            self.db.query(Message)
            .filter(
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

        formatted_items = []
        for m in items:
            formatted_items.append({
                "id": m.id,
                "sender_id": m.sender_id,
                "recipient_id": m.recipient_id,
                "body": m.body,
                "created_at": m.created_at,
                "read_at": m.read_at,
                "sender_name": get_user_display_name(m.sender),
                "recipient_name": get_user_display_name(m.recipient),
            })

        return {
            "items": formatted_items,
            "total": total,
            "page": page,
            "page_size": page_size
        }

    def mark_thread_read(self, caller: User, other_user_id: int) -> int:
        """Marks inbound messages from other_user to caller as read."""
        if caller.role == "admin":
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Administrative accounts cannot participate in messaging",
                status_code=403
            )

        now = datetime.now(timezone.utc)
        updated = (
            self.db.query(Message)
            .filter(
                Message.sender_id == other_user_id,
                Message.recipient_id == caller.id,
                Message.read_at.is_(None)
            )
            .update({Message.read_at: now}, synchronize_session=False)
        )
        self.db.commit()
        return updated

