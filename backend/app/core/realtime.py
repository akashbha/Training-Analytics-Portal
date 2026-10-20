"""WebSocket real-time connection manager and role-based event broadcaster.
Maintains active socket sessions, enforces 5-connection concurrency limits, and sanitizes payloads per role.
"""

# NOTE ON HORIZONTAL SCALING:
# This in-memory ConnectionManager is designed for a single server instance.
# For multi-node horizontal deployments behind a load balancer, a distributed message
# broker (such as Redis Pub/Sub, RabbitMQ, or NATS) would be integrated so that events
# published on one instance fan out to WebSocket clients connected to any other instance.

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("realtime")

MAX_CONNECTIONS_PER_USER = 5
HEARTBEAT_INTERVAL_SECONDS = 30

@dataclass
class ClientSession:
    """Represents an active client WebSocket session with security context."""
    websocket: WebSocket
    user_id: int
    role: str
    trainee_id: Optional[int]
    connected_at: datetime
    ping_task: Optional[asyncio.Task] = None

class ConnectionManager:
    """Central WebSocket hub managing user sockets, pings, and role-filtered broadcasts."""
    def __init__(self):
        self.active_sessions: List[ClientSession] = []
        self._lock = asyncio.Lock()
        self.messages_sent: int = 0
        self.start_time: float = time.time()

    async def connect(
        self,
        websocket: WebSocket,
        user_id: int,
        role: str,
        trainee_id: Optional[int]
    ) -> ClientSession:
        """Accepts verified WebSocket, enforces per-user concurrency limit, and starts heartbeat."""
        async with self._lock:
            # Enforce max 5 connections per user: close oldest if limit reached
            user_sessions = [s for s in self.active_sessions if s.user_id == user_id]
            if len(user_sessions) >= MAX_CONNECTIONS_PER_USER:
                oldest_session = sorted(user_sessions, key=lambda s: s.connected_at)[0]
                try:
                    await oldest_session.websocket.close(
                        code=1000,
                        reason="Maximum simultaneous connection limit (5) reached"
                    )
                except Exception:
                    pass
                if oldest_session.ping_task and not oldest_session.ping_task.done():
                    oldest_session.ping_task.cancel()
                self.active_sessions.remove(oldest_session)

            await websocket.accept()
            session = ClientSession(
                websocket=websocket,
                user_id=user_id,
                role=role,
                trainee_id=trainee_id,
                connected_at=datetime.now(timezone.utc)
            )
            # Start background 30s heartbeat ping
            session.ping_task = asyncio.create_task(self._heartbeat_loop(session))
            self.active_sessions.append(session)
            logger.info("WebSocket connected for user_id=%s, role=%s", user_id, role)
            return session

    async def disconnect(self, websocket: WebSocket) -> None:
        """Removes a disconnected socket and cancels its heartbeat loop."""
        async with self._lock:
            target = next((s for s in self.active_sessions if s.websocket == websocket), None)
            if target:
                if target.ping_task and not target.ping_task.done():
                    target.ping_task.cancel()
                self.active_sessions.remove(target)
                logger.info("WebSocket disconnected for user_id=%s", target.user_id)

    async def broadcast(self, event: Dict[str, Any]) -> None:
        """Broadcasts event across active connections with role-scoped privacy filtering."""
        dead_sessions: List[ClientSession] = []

        # Iterate over a snapshot of active connections
        for session in list(self.active_sessions):
            try:
                # 1. Trainers and Admins receive all events unmodified
                if session.role in ("trainer", "admin"):
                    await session.websocket.send_json(event)
                    self.messages_sent += 1
                    continue

                # 2. Trainees receive ONLY events relevant to their own trainee_id
                if session.role == "trainee" and session.trainee_id is not None:
                    event_type = event.get("type")

                    if event_type in ("session_created", "session_deleted"):
                        if event.get("trainee_id") == session.trainee_id:
                            await session.websocket.send_json(event)
                            self.messages_sent += 1

                    elif event_type == "sessions_bulk_created":
                        bulk_trainee_ids = event.get("trainee_ids", [])
                        if session.trainee_id in bulk_trainee_ids:
                            # Sanitized payload: hide all other trainee IDs and names
                            trainee_payload = {
                                "type": "sessions_bulk_created",
                                "count": 1,
                                "batch_ids": event.get("batch_ids", []),
                                "trainee_ids": [session.trainee_id]
                            }
                            await session.websocket.send_json(trainee_payload)
                            self.messages_sent += 1

            except (WebSocketDisconnect, Exception) as exc:
                logger.warning("Failed to send message to user_id=%s: %s", session.user_id, exc)
                dead_sessions.append(session)

        # Cleanup failed or dead sockets
        if dead_sessions:
            async with self._lock:
                for dead in dead_sessions:
                    if dead in self.active_sessions:
                        if dead.ping_task and not dead.ping_task.done():
                            dead.ping_task.cancel()
                        self.active_sessions.remove(dead)

    async def _heartbeat_loop(self, session: ClientSession) -> None:
        """Sends periodic ping messages to keep WebSocket connections alive through firewalls."""
        try:
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
                try:
                    await session.websocket.send_json({"type": "ping"})
                    self.messages_sent += 1
                except Exception:
                    break
        except asyncio.CancelledError:
            pass

    def get_connected_count(self) -> int:
        """Returns the current number of active WebSocket connections."""
        return len(self.active_sessions)

    def get_health_stats(self) -> Dict[str, Any]:
        """Returns realtime health metrics: connected_clients, messages_sent, and uptime_seconds."""
        uptime = int(time.time() - self.start_time)
        return {
            "status": "healthy",
            "connected_clients": len(self.active_sessions),
            "messages_sent": self.messages_sent,
            "uptime_seconds": uptime
        }

manager = ConnectionManager()
