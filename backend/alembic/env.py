"""Alembic environment configuration for database migrations.
Binds application models and settings to generate schema revisions and execute migrations.
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.db.base import Base
import app.models  # noqa: F401 - ensure all 20 models are registered in metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_url() -> str:
    """Retrieves target database URL from CLI -x url=..., alembic.ini, or app settings."""
    x_args = context.get_x_argument(as_dictionary=True)
    if "url" in x_args and x_args["url"]:
        return x_args["url"]
    return config.get_main_option("sqlalchemy.url") or settings.sync_database_url

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode without an active connection pool."""
    url = get_url()
    is_sqlite = "sqlite" in url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=is_sqlite,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode with an established database connection."""
    url = get_url()
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        is_sqlite = connection.dialect.name == "sqlite"
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=is_sqlite,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
