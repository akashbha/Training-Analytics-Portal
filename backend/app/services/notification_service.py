"""Event notification service dispatching real-time WebSocket broadcasts.
Wraps all broadcast executions to ensure message failures never interrupt database transactions.
"""

import asyncio
import logging
from typing import Union, List
from app.models.session import Session
from app.core.realtime import manager

logger = logging.getLogger("notification_service")

def _safe_dispatch(event: dict) -> None:
    """Dispatches asynchronous WebSocket broadcast without blocking synchronous execution."""
    try:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast(event))
        except RuntimeError:
            # Fallback if no running loop in the current thread
            asyncio.run(manager.broadcast(event))
    except Exception as exc:
        logger.error("Failed to dispatch real-time WebSocket event: %s", exc)

def notify_session_created(session: Union[Session, List[Session]]) -> None:
    """Broadcasts session creation event after database transaction has been committed."""
    if isinstance(session, list):
        notify_bulk_sessions_created(session)
        return

    if not session:
        return

    batch_id = session.trainee.batch_id if session.trainee else None
    trainee_name = session.trainee.name if session.trainee else None
    created_at_iso = session.created_at.isoformat() if session.created_at else None

    event = {
        "type": "session_created",
        "session_id": session.id,
        "trainee_id": session.trainee_id,
        "trainee_name": trainee_name,
        "batch_id": batch_id,
        "created_at": created_at_iso
    }
    _safe_dispatch(event)

def notify_bulk_sessions_created(sessions: List[Session]) -> None:
    """Broadcasts a consolidated bulk session creation event instead of individual notifications."""
    if not sessions:
        return

    batch_ids = list({s.trainee.batch_id for s in sessions if s.trainee and s.trainee.batch_id})
    trainee_ids = list({s.trainee_id for s in sessions})

    event = {
        "type": "sessions_bulk_created",
        "count": len(sessions),
        "batch_ids": batch_ids,
        "trainee_ids": trainee_ids
    }
    _safe_dispatch(event)

def notify_session_deleted(trainee_id: int, batch_id: int) -> None:
    """Broadcasts session deletion event to update connected dashboards."""
    event = {
        "type": "session_deleted",
        "trainee_id": trainee_id,
        "batch_id": batch_id
    }
    _safe_dispatch(event)
