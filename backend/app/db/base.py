"""Declarative base class for all SQLAlchemy 2.0 ORM models.
Establishes the shared registry and metadata for table definitions and migrations.
"""

from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
