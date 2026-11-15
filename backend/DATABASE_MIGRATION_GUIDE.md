# Database Operations & Migration Guide

**Project**: Training Analytics Portal  
**Target Engine**: PostgreSQL 16 (Production) / SQLite (Local Development Only)  
**Migration Framework**: Alembic 1.13+  
**ORM**: SQLAlchemy 2.0  

---

## 1. Architecture & Least-Privilege Role Model

In accordance with OWASP ASVS V13 and Database Security standards, production database access is split into two isolated database roles:

| Role Name | Scope | Permissions | Used By |
| :--- | :--- | :--- | :--- |
| `portal_admin` | Migration & DDL | Schema owner, `CREATE`, `ALTER`, `DROP` on `public` | CI/CD Deployment Runner / Alembic |
| `portal_app` | Runtime DML | `CONNECT`, `USAGE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` | FastAPI Application Server |

> [!CAUTION]
> The running web application (`portal_app`) has **zero DDL privileges**. It cannot create, drop, alter, or truncate tables. This prevents destructive SQL injection vectors from altering table schemas.

### Provisioning Roles in PostgreSQL
Run the automated role provisioning script as postgres superuser:
```bash
psql -U postgres -f backend/scripts/setup_postgres_roles.sql
```

### Mandatory Privilege Verification Queries
Verify least-privilege boundary before connecting the application:
```sql
-- 1. Must return 0 rows (confirms portal_app owns NO tables)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'portal_app';

-- 2. Must return false (confirms portal_app cannot CREATE tables/types in public)
SELECT has_schema_privilege('portal_app', 'public', 'CREATE');

-- 3. Must return false (confirms portal_app cannot TRUNCATE application data)
SELECT has_table_privilege('portal_app', 'sessions', 'TRUNCATE');
```

---

## 2. Environment Variables Reference

| Variable | Default (Dev) | Production Target | Description |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | `production` | Gating flag. Disables runtime `create_all()` in production. |
| `DATABASE_URL` | `sqlite:///./training_portal.db` | `postgresql+psycopg2://portal_app:SECRET@db:5432/training_portal` | Synchronous SQLAlchemy database connection URL. |
| `DB_POOL_SIZE` | `10` | `20` | Persistent connection pool size. |
| `DB_MAX_OVERFLOW` | `20` | `40` | Maximum bursting connections above pool size. |
| `DB_POOL_TIMEOUT` | `30` | `30` | Seconds to wait before timing out connection acquisition. |
| `DB_POOL_RECYCLE` | `1800` | `1800` | Seconds after which connections are recycled (avoids stale connections). |
| `DB_POOL_PRE_PING`| `True` | `True` | Emits `SELECT 1` ping test before handing out pool connection. |

---

## 3. Migration Commands Cheatsheet

Always run migration commands using the application virtual environment from the repository root:

### Check Current Migration Revision
```bash
alembic -c backend/alembic.ini current
```

### View Ordered Migration History
```bash
alembic -c backend/alembic.ini history
```

### Apply All Pending Migrations (Deploy to Head)
```bash
# Uses portal_admin connection string in CI/CD pipeline:
alembic -c backend/alembic.ini -x url=postgresql+psycopg2://portal_admin:SECRET@db:5432/training_portal upgrade head
```

### Preview Dry-Run SQL (Offline DDL Generation)
Inspect exact SQL DDL statements without applying them:
```bash
alembic -c backend/alembic.ini -x url=postgresql+psycopg2://postgres:postgres@localhost:5432/training_portal upgrade head --sql
```

### Production Rollback Strategy Hierarchy
> [!CAUTION]
> In production, `alembic downgrade -1` is **NOT** the primary rollback strategy because schema downgrades can drop newly populated columns and destroy live production data.
> - **Primary Production Rollback**: Restore the verified pre-migration backup snapshot using `pg_restore` (see `production_database_migration_runbook.md`).
> - **Secondary Situational Rollback**: Use `alembic downgrade -1` only in staging or during dry-runs where zero production data was recorded.

```bash
# Secondary rollback (dry-run / staging only):
alembic -c backend/alembic.ini downgrade -1
```

---

## 4. Migration History Chain

```
[001_initial_schema]                          (Batches, Modules, Trainees, Sessions, Users)
       │
[002_analytics_indexes]                       (Covering and performance indexes on Sessions)
       │
[003_add_admin_and_audit]                     (Admin role constraint, is_active, AuditLog table)
       │
[004_trainee_profile_and_audit_enhancements]  (Trainee bio/avatar/specialization, AuditLog actor_id & snapshots)
       │
[005_remediation_notes_and_goals]             (Remediations, TraineeGoals, SessionNotes, HelpChunks)
       │
[006_cohort_auth_and_messaging]               (BatchTrainers, Messages, Attachments, RevokedTokens)
       │
[007_assessment_practice_sessions]            (is_practice session flag & anti-gaming index)
       │
[008_learning_path_foundation] (HEAD)         (Subjects, Modules, Lessons, Progress, Assignments, Submissions)
```

---

## 5. Local Development Workflow

For local development on SQLite, the system retains developer convenience:
1. When `ENVIRONMENT=development`, FastAPI lifespan will automatically invoke `Base.metadata.create_all()` on startup if `training_portal.db` does not exist.
2. When testing migration compatibility, you can target local SQLite:
   ```bash
   alembic -c backend/alembic.ini upgrade head
   ```
3. To test with a local PostgreSQL container:
   ```bash
   docker run -d --name pg-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
   alembic -c backend/alembic.ini -x url=postgresql+psycopg2://postgres:postgres@localhost:5432/training_portal upgrade head
   ```

