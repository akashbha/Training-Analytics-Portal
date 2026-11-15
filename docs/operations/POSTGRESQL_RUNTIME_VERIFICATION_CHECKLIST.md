# Executable PostgreSQL 16 Runtime Verification Checklist

**Project**: Training Analytics Portal  
**Target Milestone**: Phase 2A &rarr; Phase 2B Bridge Verification  
**Precondition**: Access credentials provided for an isolated PostgreSQL 16 testing instance.  

> [!IMPORTANT]
> **Credential & Data Safety Mandate**:
> Do not use production credentials, real employee data, or a publicly accessible database for verification. Use an isolated disposable test instance and rotate/dispose of its credentials afterward.

## Phase 2A Success Criteria (PostgreSQL Verification Definition of Done)
Phase 2A is considered **PostgreSQL-verified** only when:
1. All migrations reach head (`008_learning_path_foundation`) on live PostgreSQL 16.
2. The full backend regression suite (222 tests) passes against PostgreSQL using `portal_app`.
3. The backend starts and serves authorized requests (`/health`, `/api/auth/token`, cohort authorization, learning path, and ML advisory).
4. `portal_app` owns zero tables in `public` and cannot `CREATE` or `TRUNCATE`.
5. A backup created with `pg_dump -Fc` is restored with `pg_restore` into a scratch database and smoke-tested.
6. Pre/post row-count parity is verified and documented.
7. A documented rollback procedure based on the verified backup is confirmed.

---

## Pre-Execution Environment Setup
Export target credentials in shell session:
```bash
export PG_HOST="<postgres-test-host>"
export PG_PORT="5432"
export PG_SUPERUSER="postgres"
export PG_SUPERPASS="<postgres-superuser-password>"
export PORTAL_ADMIN_PASS="<strong-portal-admin-password>"
export PORTAL_APP_PASS="<strong-portal-app-password>"
```

---

## Step 1: Provision Isolated Roles & Database
Execute the role hardening script as postgres superuser:
```bash
PGPASSWORD=$PG_SUPERPASS psql -h $PG_HOST -p $PG_PORT -U $PG_SUPERUSER -f backend/scripts/setup_postgres_roles.sql
```

---

## Step 2: Verify Least-Privilege Role Boundary
Run the role privilege assertions as `postgres` or `portal_app`:
```bash
PGPASSWORD=$PORTAL_APP_PASS psql -h $PG_HOST -p $PG_PORT -U portal_app -d training_portal -c "
  -- Assertion 1: portal_app must own ZERO tables (Expected: 0 rows)
  SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'portal_app';

  -- Assertion 2: portal_app must NOT have CREATE privilege in public (Expected: false)
  SELECT has_schema_privilege('portal_app', 'public', 'CREATE') AS portal_app_can_create;

  -- Assertion 3: portal_app must NOT have TRUNCATE privilege (Expected: false)
  SELECT has_table_privilege('portal_app', 'sessions', 'TRUNCATE') AS portal_app_can_truncate;
"
```
- [ ] Assertion 1 returned 0 rows.
- [ ] Assertion 2 returned `false`.
- [ ] Assertion 3 returned `false`.

---

## Step 3: Execute Fresh Database Migration to Head
Run Alembic upgrade using the privileged `portal_admin` role:
```bash
alembic -c backend/alembic.ini \
  -x url="postgresql+psycopg2://portal_admin:${PORTAL_ADMIN_PASS}@${PG_HOST}:${PG_PORT}/training_portal" \
  upgrade head
```
- [ ] Alembic reached `008_learning_path_foundation (head)`.
- [ ] All 20 application tables created successfully without errors.

---

## Step 4: Stepwise Upgrade, Downgrade & Idempotency Check
Verify bidirectional migration safety:
```bash
# 1. Downgrade to 007
alembic -c backend/alembic.ini -x url="postgresql+psycopg2://portal_admin:${PORTAL_ADMIN_PASS}@${PG_HOST}:${PG_PORT}/training_portal" downgrade 007_assessment_practice_sessions

# 2. Downgrade to 003
alembic -c backend/alembic.ini -x url="postgresql+psycopg2://portal_admin:${PORTAL_ADMIN_PASS}@${PG_HOST}:${PG_PORT}/training_portal" downgrade 003_add_admin_and_audit

# 3. Re-upgrade back to head
alembic -c backend/alembic.ini -x url="postgresql+psycopg2://portal_admin:${PORTAL_ADMIN_PASS}@${PG_HOST}:${PG_PORT}/training_portal" upgrade head
```
- [ ] Downgrade to 007 passed.
- [ ] Downgrade to 003 passed.
- [ ] Re-upgrade to head passed cleanly.

---

## Step 5: Full Backend Regression Suite Against PostgreSQL
Run all 222 tests targeting the PostgreSQL database using the unprivileged `portal_app` role:
```bash
DATABASE_URL="postgresql+psycopg2://portal_app:${PORTAL_APP_PASS}@${PG_HOST}:${PG_PORT}/training_portal" \
  ENVIRONMENT="development" \
  pytest backend/tests/
```
- [ ] 222 / 222 tests passed against PostgreSQL.
- [ ] Zero database lock timeouts or syntax incompatibilities.

---

## Step 6: Application Startup & Critical Endpoint Smoke Test
Boot the FastAPI server connected to PostgreSQL:
```bash
DATABASE_URL="postgresql+psycopg2://portal_app:${PORTAL_APP_PASS}@${PG_HOST}:${PG_PORT}/training_portal" \
  ENVIRONMENT="production" \
  SECRET_KEY="a-very-long-production-cryptographic-secret-key-64-characters-long!" \
  ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000" \
  uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verify critical endpoints via curl:
```bash
# 1. System Health Probe
curl -s http://localhost:8000/health | grep '"status":"healthy"'

# 2. Authentication Login (Valid Trainer)
curl -s -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=trainer1@company.com&password=ValidPassword123!"

# 3. Cohort Authorization Check (Authorized vs Unauthorized Batch)
# Verify 200 OK for authorized cohort; 403 Forbidden for unauthorized cohort

# 4. Learning Path Endpoint Check
# Verify /api/learning/subjects returns 200 OK

# 5. ML Advisory Fallback Check
# Verify /api/analytics/trainees/{id}/risk returns "is_advisory": true
```
- [ ] Health probe returns 200 OK healthy.
- [ ] Login returns valid JWT access token.
- [ ] Cohort authorization enforces 403 on unauthorized batches.
- [ ] Learning endpoints return structured subject/module manifests.
- [ ] ML endpoints return `is_advisory: true` badge.

---

## Step 7: Staging Migration Rehearsal & Backup/Restore Drill
Execute full runbook rehearsal on staging data:
```bash
# 1. Create compressed custom archive backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U portal_admin -h $PG_HOST -p $PG_PORT -d training_portal -Fc -v -f /tmp/portal_rehearsal_${TIMESTAMP}.dump

# 2. Restore into clean scratch database
createdb -U postgres -h $PG_HOST -p $PG_PORT training_portal_scratch_${TIMESTAMP}
pg_restore -U postgres -h $PG_HOST -p $PG_PORT -d training_portal_scratch_${TIMESTAMP} -v /tmp/portal_rehearsal_${TIMESTAMP}.dump

# 3. Run smoke tests against scratch database
DATABASE_URL="postgresql+psycopg2://portal_app:${PORTAL_APP_PASS}@${PG_HOST}:${PG_PORT}/training_portal_scratch_${TIMESTAMP}" \
  pytest backend/tests/test_auth.py backend/tests/test_cohort_authorization.py

# 4. Clean up scratch database
dropdb -U postgres -h $PG_HOST -p $PG_PORT training_portal_scratch_${TIMESTAMP}
```
- [ ] Backup created successfully.
- [ ] Restore into scratch database succeeded.
- [ ] Smoke tests passed on restored data.
- [ ] Scratch database dropped cleanly.
