"""WebSocket connection ticket management for secure pre-handshake authentication.
Replaces sensitive JWTs in WebSocket query strings with single-use, short-lived (60s) cryptographic nonces.
"""

import time
import secrets
import threading
from typing import Optional, Dict, Any

class WebSocketTicketManager:
    """Thread-safe ticket registry with single-use consumption and automatic TTL expiration."""
    def __init__(self, ttl_seconds: int = 60):
        self.ttl_seconds = ttl_seconds
        self._tickets: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create_ticket(self, user_id: int, role: str, trainee_id: Optional[int]) -> str:
        """Generates a secure single-use ticket bound to user identity with 60s TTL."""
        now = time.time()
        ticket = f"wst_{secrets.token_urlsafe(32)}"
        with self._lock:
            # Lazy cleanup of expired tickets
            expired = [k for k, v in self._tickets.items() if v["expires_at"] < now]
            for k in expired:
                del self._tickets[k]

            self._tickets[ticket] = {
                "user_id": user_id,
                "role": role,
                "trainee_id": trainee_id,
                "expires_at": now + self.ttl_seconds
            }
        return ticket

    def consume_ticket(self, ticket: str) -> Optional[Dict[str, Any]]:
        """Atomically retrieves and invalidates a ticket. Returns None if invalid or expired."""
        now = time.time()
        with self._lock:
            entry = self._tickets.pop(ticket, None)

        if not entry:
            return None
        if entry["expires_at"] < now:
            return None
        return entry

    def active_ticket_count(self) -> int:
        """Returns the number of unconsumed tickets currently in memory."""
        now = time.time()
        with self._lock:
            return sum(1 for v in self._tickets.values() if v["expires_at"] >= now)

ws_tickets = WebSocketTicketManager()

