# Production Operations & Handoff Package

**Project**: Training Analytics Portal  
**Milestone Status**: Phase 2A implementation and documentation complete; PostgreSQL runtime verification, production migration rehearsal, company infrastructure decisions, and content licensing remain pending.  
**Readiness**: ~76–79% Company Ready  
**Phase 2B Status**: **HELD & FROZEN**  

---

## 1. Executive Summary

This directory contains the operational documentation, migration runbooks, role provisioning scripts, and infrastructure decision packs prepared during Sprint 2 Phase 2A.

The data layer has been re-architected away from runtime schema patching (`Base.metadata.create_all()` and dynamic `PRAGMA table_info` ALTER TABLEs). All 20 application models are codified into an ordered, single-head Alembic migration DAG (`001_initial_schema` &rarr; `008_learning_path_foundation`).

---

## 2. Status of Deliverables

### What Is Complete (Phase 2A):
1. **Model & Schema Inventory**: Complete inventory of all 20 tables, foreign keys, check constraints, and composite indexes codified in [`DATABASE_SCHEMA_MODEL_INVENTORY.md`](./DATABASE_SCHEMA_MODEL_INVENTORY.md).
2. **Ordered Alembic DAG**: Continuous migration chain from `<base>` to `head` (`008_learning_path_foundation`) with zero branching.
3. **PostgreSQL Configuration**: Dynamic connection pooling parameters (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE`, `DB_POOL_PRE_PING`).
4. **Least-Privilege SQL Architecture**: [`backend/scripts/setup_postgres_roles.sql`](../../backend/scripts/setup_postgres_roles.sql) establishing `portal_admin` (schema owner / DDL) and `portal_app` (DML only, owns zero tables, cannot `CREATE` or `TRUNCATE`).
5. **Fail-Fast Production Startup Assertions**: `validate_production_configuration` actively rejects SQLite URLs, weak keys ($<32$ chars), placeholder keys (`change-me`), and wildcard CORS (`*`) in production.
6. **Automated Migration Tests**: 6 regression test cases in [`backend/tests/test_alembic_migrations.py`](../../backend/tests/test_alembic_migrations.py) verifying fresh installs, upgrades, rollbacks, and legacy data preservation.
7. **Passing Regression Suites**: 222 backend pytest tests passed, 26 frontend vitest tests passed, and clean production build.

### What Remains Pending (External Gates):
1. **Live PostgreSQL Runtime Proof**: Runtime verification against an active PostgreSQL 16 server (sequence allocations, live table locks, and runtime query execution).
2. **Company Infrastructure Decisions**: Formal sign-off on hosting model, managed database tier, secret manager, media storage, observability, and revocation store.
3. **Course Content Licensing**: Written commercial licensing agreement or in-house video recording schedule. (Third-party DevOps media remains strictly **local/demo-only**).

### PostgreSQL Verification Definition of Done (Success Criteria):
Phase 2A is considered **PostgreSQL-verified** only when:
1. All migrations reach head (`008_learning_path_foundation`) on live PostgreSQL 16.
2. The full backend regression suite (222 tests) passes against PostgreSQL using `portal_app`.
3. The backend starts and serves authorized requests (`/health`, `/api/auth/token`, cohort authorization, learning path, and ML advisory).
4. `portal_app` owns zero tables in `public` and cannot `CREATE` or `TRUNCATE`.
5. A backup created with `pg_dump -Fc` is restored with `pg_restore` into a scratch database and smoke-tested.
6. Pre/post row-count parity is verified and documented.
7. A documented rollback procedure based on the verified backup is confirmed.

> [!IMPORTANT]
> **Safety Mandate**: Do not use production credentials, real employee data, or a publicly accessible database for verification. Use an isolated disposable test instance and rotate/dispose of its credentials afterward.

---

## 3. Required Corporate Decisions (Decision Pack)

Full decision memo available in [`COMPANY_INFRASTRUCTURE_DECISION_REQUEST.md`](./COMPANY_INFRASTRUCTURE_DECISION_REQUEST.md):

| Decision Area | Evaluated Options | Engineering Recommendation | Owner |
| :--- | :--- | :--- | :--- |
| **1. Hosting Model** | Dedicated VM with Docker Compose, Managed Cloud Container (ECS/Cloud Run), Corporate Kubernetes | **Dedicated VM or Managed Container** | DevOps Lead |
| **2. Production PostgreSQL** | Cloud-Managed PostgreSQL 16 (RDS/Cloud SQL) vs. Self-Hosted Container | **Managed PostgreSQL 16** | Database Admin |
| **3. Secrets Management** | Enterprise Secret Manager (AWS SM/Vault/Doppler) vs. CI/CD Injection | **Approved Enterprise Secret Manager** | Security Architect |
| **4. Revocation Store** | Database-Backed table (`revoked_tokens`) vs. Shared Redis/Valkey | **Database-Backed initially** (add Redis only for multi-worker) | System Architect |
| **5. Course Media Storage** | S3-Compatible Cloud Storage (AWS S3/Cloudflare R2) vs. Internal MinIO | **S3-Compatible Object Storage with Signed URLs** | Storage Lead |
| **6. Observability Stack** | Unified Corporate APM (Datadog/New Relic) vs. Self-Hosted Prometheus/Grafana | **Integrate with Existing Corporate Stack** | SRE Lead |
| **7. Content Licensing** | Commercial License Agreement vs. In-House Video Curriculum Authoring | **Author Original In-House Training Videos** | Legal / Product |

---

## 4. Exact Execution Commands (When PostgreSQL 16 Access is Provided)

Detailed turnkey checklist available in [`POSTGRESQL_RUNTIME_VERIFICATION_CHECKLIST.md`](./POSTGRESQL_RUNTIME_VERIFICATION_CHECKLIST.md):

```bash
# Step 1: Export Target Test Instance Credentials (use disposable test credentials only)
export PG_HOST="<postgres-test-host>"
export PG_PORT="5432"
export PG_SUPERPASS="<postgres-superuser-pass>"
export PORTAL_ADMIN_PASS="<disposable-admin-pass>"
export PORTAL_APP_PASS="<disposable-app-pass>"

# Step 2: Provision Isolated Roles & Verify Boundary
PGPASSWORD=$PG_SUPERPASS psql -h $PG_HOST -p $PG_PORT -U postgres -f backend/scripts/setup_postgres_roles.sql

# Step 3: Run Least-Privilege Verification Queries
PGPASSWORD=$PORTAL_APP_PASS psql -h $PG_HOST -p $PG_PORT -U portal_app -d training_portal -c "
  SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'portal_app';
  SELECT has_schema_privilege('portal_app', 'public', 'CREATE') AS can_create;
  SELECT has_table_privilege('portal_app', 'sessions', 'TRUNCATE') AS can_truncate;
"
# EXPECTED: 0 rows for tableowner='portal_app', can_create=false, can_truncate=false.

# Step 4: Run Alembic Migration to Head
alembic -c backend/alembic.ini \
  -x url="postgresql+psycopg2://portal_admin:${PORTAL_ADMIN_PASS}@${PG_HOST}:${PG_PORT}/training_portal" \
  upgrade head

# Step 5: Run Full Backend Regression Suite Against PostgreSQL
DATABASE_URL="postgresql+psycopg2://portal_app:${PORTAL_APP_PASS}@${PG_HOST}:${PG_PORT}/training_portal" \
  ENVIRONMENT="development" \
  pytest backend/tests/

# Step 6: Execute Staging Backup & Restore Smoke Drill
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U portal_admin -h $PG_HOST -p $PG_PORT -d training_portal -Fc -v -f /tmp/backup_${TIMESTAMP}.dump
createdb -U postgres -h $PG_HOST -p $PG_PORT training_portal_scratch_${TIMESTAMP}
pg_restore -U postgres -h $PG_HOST -p $PG_PORT -d training_portal_scratch_${TIMESTAMP} -v /tmp/backup_${TIMESTAMP}.dump
DATABASE_URL="postgresql+psycopg2://portal_app:${PORTAL_APP_PASS}@${PG_HOST}:${PG_PORT}/training_portal_scratch_${TIMESTAMP}" \
  pytest backend/tests/test_auth.py backend/tests/test_cohort_authorization.py
dropdb -U postgres -h $PG_HOST -p $PG_PORT training_portal_scratch_${TIMESTAMP}
```

---

## 5. Operations Documents Reference

- [`POSTGRESQL_RUNTIME_VERIFICATION_CHECKLIST.md`](./POSTGRESQL_RUNTIME_VERIFICATION_CHECKLIST.md): Step-by-step verification protocol.
- [`COMPANY_INFRASTRUCTURE_DECISION_REQUEST.md`](./COMPANY_INFRASTRUCTURE_DECISION_REQUEST.md): Leadership decision request memorandum.
- [`PRODUCTION_DATABASE_MIGRATION_RUNBOOK.md`](./PRODUCTION_DATABASE_MIGRATION_RUNBOOK.md): Backup, restore drill, and maintenance-window runbook.
- [`DATABASE_SCHEMA_MODEL_INVENTORY.md`](./DATABASE_SCHEMA_MODEL_INVENTORY.md): Comprehensive 20-model schema specification.
- [`../../backend/DATABASE_MIGRATION_GUIDE.md`](../../backend/DATABASE_MIGRATION_GUIDE.md): Developer guide for local migrations and pooling.
- [`../../backend/scripts/setup_postgres_roles.sql`](../../backend/scripts/setup_postgres_roles.sql): Role provisioning script.

