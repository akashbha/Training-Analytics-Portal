"""WebSocket router handling real-time subscriptions and connection health monitoring.
Supports ticket-based authentication (preventing URL token leakage) with fallback to validated tokens,
cohort-scoped event distribution, and instant severance of revoked/deactivated sessions.
"""

from typing import Optional, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from app.core.security import decode_access_token
from app.core.realtime import manager
from app.core.ws_ticket import ws_tickets
from app.core.deps import require_staff
from app.db.session import SyncSessionLocal
from app.models.user import User
from app.models.batch_trainer import BatchTrainer
from app.models.trainee import Trainee
from app.services.revocation_service import is_token_revoked

router = APIRouter(tags=["Realtime"])

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """Establishes real-time connection after pre-handshake ticket or token authentication."""
    user_id: Optional[int] = None
    role: Optional[str] = None
    trainee_id: Optional[int] = None
    jti: Optional[str] = None
    iat: Optional[int] = None

    # Option 1: Single-use, short-lived nonce ticket (preferred secure mechanism)
    if ticket:
        ticket_data = ws_tickets.consume_ticket(ticket)
        if not ticket_data:
            await websocket.close(code=4401)
            return
        user_id = ticket_data["user_id"]
        role = ticket_data["role"]
        trainee_id = ticket_data["trainee_id"]

    # Option 2: Fallback to token (validated and checked against revocation ledger)
    elif token:
        try:
            payload = decode_access_token(token)
            user_id_str = payload.get("sub")
            role = payload.get("role")
            trainee_id = payload.get("trainee_id")
            jti = payload.get("jti")
            iat = payload.get("iat")

            if not user_id_str or not role:
                await websocket.close(code=4401)
                return
            user_id = int(user_id_str)
        except Exception:
            await websocket.close(code=4401)
            return
    else:
        # Neither ticket nor token provided: reject before accept
        await websocket.close(code=4401)
        return

    # Database verification: active account status, token revocation, and assigned cohorts
    from app.core.deps import get_db
    override = websocket.app.dependency_overrides.get(get_db)
    db = next(override()) if override else SyncSessionLocal()
    assigned_batch_ids: List[int] = []

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            await websocket.close(code=4401)
            return

        # Check revocation ledger if token was used
        if token and is_token_revoked(db, jti=jti, user_id=user_id, iat=iat):
            await websocket.close(code=4401)
            return

        # Ensure role and trainee_id are fresh from database
        role = user.role
        trainee_id = user.trainee_id

        # Cohort scoping resolution
        if role == "trainer":
            assigned_batch_ids = [
                r[0] for r in db.query(BatchTrainer.batch_id).filter(BatchTrainer.trainer_id == user.id).all()
            ]
        elif role == "trainee" and trainee_id:
            t = db.query(Trainee).filter(Trainee.id == trainee_id).first()
            if t and t.batch_id:
                assigned_batch_ids = [t.batch_id]
        elif role == "admin":
            assigned_batch_ids = []  # Admin receives all batches
    finally:
        db.close()

    # Handshake succeeded; accept socket and enroll into manager with cohort context
    session = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        role=role,
        trainee_id=trainee_id,
        assigned_batch_ids=assigned_batch_ids
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
def realtime_health(staff: User = Depends(require_staff)):
    """Returns connected_clients, messages_sent, and uptime_seconds (Staff only)."""
    return manager.get_health_stats()
