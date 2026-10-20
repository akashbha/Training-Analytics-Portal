"""WebSocket router handling real-time subscriptions and connection health monitoring.
Validates JWT tokens and user active status before accepting handshakes, and exposes admin-only connection metrics.
"""

from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from app.core.security import decode_access_token
from app.core.realtime import manager
from app.core.deps import require_admin
from app.db.session import SyncSessionLocal
from app.models.user import User

router = APIRouter(tags=["Realtime"])

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """Establishes real-time connection after pre-handshake JWT authentication and active status check."""
    # Enforce token validation BEFORE accepting connection
    if not token:
        await websocket.close(code=4401)
        return

    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        role = payload.get("role")
        trainee_id = payload.get("trainee_id")

        if not user_id_str or not role:
            await websocket.close(code=4401)
            return
        user_id = int(user_id_str)
    except Exception:
        # Invalid or expired token: reject before accept
        await websocket.close(code=4401)
        return

    # Reject inactive users with code 4401
    db = SyncSessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            await websocket.close(code=4401)
            return
        # Ensure role is fresh from DB
        role = user.role
        trainee_id = user.trainee_id
    finally:
        db.close()

    # Validation succeeded; accept socket and enroll into manager
    session = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        role=role,
        trainee_id=trainee_id
    )

    try:
        while True:
            # Keep socket open and process client heartbeats (e.g. {"type": "pong"})
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)

@router.get("/realtime/health", tags=["System"])
@router.get("/health/realtime", tags=["System"])
def realtime_health(admin: User = Depends(require_admin)):
    """Returns connected_clients, messages_sent, and uptime_seconds (Admin only)."""
    return manager.get_health_stats()
