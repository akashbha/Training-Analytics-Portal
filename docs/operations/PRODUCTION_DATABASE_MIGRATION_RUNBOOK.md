# Production Database Migration Runbook

**Project**: Training Analytics Portal  
**Target Engine**: PostgreSQL 16  
**Migration Framework**: Alembic 1.13+  
**Target Revision**: `008_learning_path_foundation`  

---

## 1. Governance Principles & Pre-Flight Checklist

> [!CAUTION]
> **Cardinal Rule**: Never execute a schema migration in production without a verified, restored backup and an approved staging dry-run. Every production migration must be treated as potentially irreversible.

### Pre-Migration Approval Gates:
- [ ] Staging rehearsal completed successfully on identical dataset snapshot.
- [ ] Full database backup created, verified, and test-restored onto an isolated instance.
- [ ] Pre-migration row counts and financial/performance aggregates documented.
- [ ] Maintenance window scheduled and announced (minimum 60-minute window recommended).
- [ ] Application ingress drained / placed in maintenance mode (zero active application pool connections).
- [ ] Migration executed exclusively via dedicated `portal_admin` role; `portal_app` role verified as DML-only.

---

## 2. Phase 1: Pre-Migration Backup & Restore Verification

### Step 1.1: Full Database Snapshot with Custom Archive (`-Fc`)
Execute full database dump using custom compressed format (`-Fc`):
> [!NOTE]
> `pg_dump -Fc` creates a compressed binary archive containing metadata and table data. It **must be restored using `pg_restore`**, not `psql`.
> Continuous Point-In-Time Recovery (PITR) is an infrastructure-level capability requiring Write-Ahead Log (WAL) archiving (e.g. AWS RDS automated WAL retention or `pgBackRest`/`WAL-G`). A `pg_dump` snapshot is an on-demand point snapshot, not a continuous stream.

```bash
# Set timestamp variable
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Execute binary compressed dump
pg_dump -U portal_admin -h $DB_HOST -p 5432 -d training_portal \
  -Fc -v -f /backups/training_portal_pre_migration_${TIMESTAMP}.dump
```

### Step 1.2: Backup Integrity & Restore Drill with Smoke Testing (Mandatory)
A backup that has never been restored is an unverified assumption. Prove the backup is valid by restoring it onto a clean scratch instance and running application smoke tests:
```bash
# 1. Create temporary scratch validation database
createdb -U postgres -h $DB_HOST training_portal_verify_${TIMESTAMP}

# 2. Execute test restore using pg_restore (NOT psql)
pg_restore -U postgres -h $DB_HOST -d training_portal_verify_${TIMESTAMP} \
  -v /backups/training_portal_pre_migration_${TIMESTAMP}.dump

# 3. Check table count matches production baseline (20 tables expected)
psql -U postgres -h $DB_HOST -d training_portal_verify_${TIMESTAMP} -c "
  SELECT count(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public';
"

# 4. Run application integration smoke suite against restored database
DATABASE_URL="postgresql+psycopg2://portal_app:$APP_PASS@$DB_HOST:5432/training_portal_verify_${TIMESTAMP}" \
  pytest backend/tests/test_auth.py backend/tests/test_cohort_authorization.py

# 5. Clean up temporary scratch database
dropdb -U postgres -h $DB_HOST training_portal_verify_${TIMESTAMP}
```

---

## 3. Phase 2: Staging Rehearsal & Baseline Parity Verification

Before touching production, replicate the migration against the staging database:

### Step 2.1: Record Pre-Migration Baseline Metrics
Run pre-migration baseline audit query:
```sql
SELECT 'batches' AS entity, count(*) AS count FROM batches
UNION ALL
SELECT 'trainees', count(*) FROM trainees
UNION ALL
SELECT 'modules', count(*) FROM modules
UNION ALL
SELECT 'sessions', count(*) FROM sessions
UNION ALL
SELECT 'users', count(*) FROM users
UNION ALL
SELECT 'audit_logs', count(*) FROM audit_logs;
```

### Step 2.2: Apply Alembic Migrations
```bash
alembic -c backend/alembic.ini -x url=postgresql+psycopg2://portal_admin:$ADMIN_PASS@$STAGING_HOST:5432/training_portal upgrade head
```

### Step 2.3: Record Post-Migration Parity & Assert Zero Data Loss
Run the identical audit query. All row counts for existing tables (`batches`, `trainees`, `modules`, `sessions`, `users`, `audit_logs`) must match pre-migration numbers exactly.

---

## 4. Phase 3: Production Maintenance-Window Execution

### Step 3.1: Application Traffic Drain & Shutdown
1. Divert ingress traffic via reverse proxy to maintenance page:
   ```nginx
   return 503 "The Training Analytics Portal is undergoing scheduled database maintenance. Please check back shortly.";
   ```
2. Stop all running FastAPI application instances / containers to release all active connection pool locks.

### Step 3.2: Execute Alembic Migration to Head
Run migration as `portal_admin`:
```bash
alembic -c backend/alembic.ini \
  -x url=postgresql+psycopg2://portal_admin:$PORTAL_ADMIN_PASSWORD@$PROD_DB_HOST:5432/training_portal \
  upgrade head
```

### Step 3.3: Verify Alembic Revision Status
Confirm the database is at head revision `008_learning_path_foundation`:
```bash
alembic -c backend/alembic.ini \
  -x url=postgresql+psycopg2://portal_admin:$PORTAL_ADMIN_PASSWORD@$PROD_DB_HOST:5432/training_portal \
  current
```

---

## 5. Phase 4: Security & Least-Privilege Role Verification

Verify that application role `portal_app` remains strictly confined to DML and cannot drop or alter tables (since ownership confers DROP/ALTER):

```sql
-- Connect as application user or run verification queries:
-- Check 1: portal_app must NOT own any application tables (Must return 0 rows)
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' AND tableowner = 'portal_app';

-- Check 2: portal_app must NOT have CREATE privilege on schema public (Must return false)
SELECT has_schema_privilege('portal_app', 'public', 'CREATE') AS can_create_in_public;

-- Check 3: portal_app must NOT have TRUNCATE privilege on application tables (Must return false)
SELECT has_table_privilege('portal_app', 'sessions', 'TRUNCATE') AS can_truncate_sessions;

-- Check 4: DML verification (Must succeed for SELECT/INSERT/UPDATE/DELETE)
SELECT count(*) FROM users;
```

---

## 6. Phase 5: Rollback & Recovery Contingency Protocol

> [!WARNING]
> **Production Rollback Hierarchy**:
> Do not treat `alembic downgrade -1` as the default rollback strategy in production. Downgrades drop columns and tables, permanently deleting newly collected data or failing when foreign-key dependencies exist.
> - **PRIMARY Strategy**: Restore the pre-migration snapshot via `pg_restore`.
> - **SECONDARY Strategy**: Alembic downgrade (only for dry-runs or trivial, non-destructive forward migrations).

### Primary Production Rollback: Restore Pre-Migration Snapshot
If DDL corrupted tables, caused unrecoverable locks, or violated constraints:
1. Terminate all database client connections:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE datname = 'training_portal' AND pid <> pg_backend_pid();
   ```
2. Restore the pre-migration snapshot using `pg_restore`:
   ```bash
   pg_restore -U postgres -h $PROD_DB_HOST --clean --if-exists -d training_portal \
     -v /backups/training_portal_pre_migration_${TIMESTAMP}.dump
   ```
3. Restart application backend on previous version and restore traffic.
4. Convene post-mortem to analyze migration failure logs before rescheduling.

### Secondary Situational Rollback: Alembic Clean Downgrade (Staging / Non-Destructive)
Only if verified that the failed revision produced zero destructive data changes:
```bash
alembic -c backend/alembic.ini \
  -x url=postgresql+psycopg2://portal_admin:$PORTAL_ADMIN_PASSWORD@$PROD_DB_HOST:5432/training_portal \
  downgrade -1
```
