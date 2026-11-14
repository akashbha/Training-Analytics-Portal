import sys
sys.path.insert(0, 'backend')
from app.db.session import sync_engine
from app.db.base import Base
# Import all models to ensure all tables are registered with Base.metadata
from app.models.batch import Batch
from app.models.module import Module
from app.models.trainee import Trainee
from app.models.user import User
from app.models.session import Session
from app.models.session_note import SessionNote
from app.models.remediation import Remediation
from app.models.trainee_goal import TraineeGoal
from app.models.batch_trainer import BatchTrainer
from app.models.message import Message
from app.models.message_attachment import MessageAttachment

print("Registering models and creating all missing tables...")
Base.metadata.create_all(bind=sync_engine)

from app.db.session import SyncSessionLocal
from sqlalchemy import text
db = SyncSessionLocal()
tables = [t[0] for t in db.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
print("Tables now in DB:", tables)
db.close()
