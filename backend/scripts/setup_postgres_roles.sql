-- ==============================================================================
-- Production Database Setup & Least-Privilege Role Provisioning
-- Project: Training Analytics Portal
-- Dialect: PostgreSQL 14+ (Recommended: PostgreSQL 16)
-- Standards: OWASP Database Security & ASVS V13 Access Control
-- ==============================================================================

-- 1. Create Dedicated Application Database
-- Run as postgres superuser (e.g. psql -U postgres):
CREATE DATABASE training_portal
    WITH
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

\connect training_portal;

-- 2. Revoke Public Default Permissions to Prevent Unauthorized Access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 3. Migration Administrator Role (CI/CD / Alembic Runner Only)
-- This role owns the schema and has full DDL privileges to execute migrations.
-- NEVER used by the running web application backend.
CREATE ROLE portal_admin WITH
    LOGIN
    PASSWORD 'CHANGE_ME_IN_PRODUCTION_ADMIN_SECRET'
    NOSUPERUSER
    INHERIT
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION;

GRANT CONNECT ON DATABASE training_portal TO portal_admin;
GRANT ALL ON SCHEMA public TO portal_admin;
ALTER SCHEMA public OWNER TO portal_admin;

-- 4. Application Runtime Service Role (FastAPI Backend Only)
-- Strictly least-privilege: DML only (SELECT, INSERT, UPDATE, DELETE).
-- Zero DDL privileges: cannot CREATE, ALTER, DROP, or TRUNCATE tables.
CREATE ROLE portal_app WITH
    LOGIN
    PASSWORD 'CHANGE_ME_IN_PRODUCTION_APP_SECRET'
    NOSUPERUSER
    INHERIT
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION;

GRANT CONNECT ON DATABASE training_portal TO portal_app;
GRANT USAGE ON SCHEMA public TO portal_app;

-- Grant DML permissions on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_app;

-- Grant sequence usage for auto-incrementing primary keys
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portal_app;

-- 5. Default Privileges for Future Tables and Sequences Created by portal_admin
-- Guarantees that tables created during future Alembic migrations are automatically
-- accessible to portal_app with DML permissions, without needing manual grants.
ALTER DEFAULT PRIVILEGES FOR ROLE portal_admin IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_app;

ALTER DEFAULT PRIVILEGES FOR ROLE portal_admin IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO portal_app;

-- 6. Verification Assertions (Run to verify strict least-privilege boundary):
-- In PostgreSQL, table ownership inherently grants DROP and ALTER rights.
-- Therefore, portal_app MUST NOT own any tables in schema public.

-- Verification Check 1: portal_app must NOT own any application tables (Expected: 0 rows)
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' AND tableowner = 'portal_app';

-- Verification Check 2: portal_app must NOT have CREATE privilege on schema public (Expected: false)
SELECT has_schema_privilege('portal_app', 'public', 'CREATE') AS portal_app_can_create;

-- Verification Check 3: portal_app must NOT have TRUNCATE privilege on application tables (Expected: false)
SELECT has_table_privilege('portal_app', 'sessions', 'TRUNCATE') AS portal_app_can_truncate;

-- Verification Check 4: portal_app MUST have standard DML privileges (Expected: true)
SELECT 
    has_table_privilege('portal_app', 'sessions', 'SELECT') AS can_select,
    has_table_privilege('portal_app', 'sessions', 'INSERT') AS can_insert,
    has_table_privilege('portal_app', 'sessions', 'UPDATE') AS can_update,
    has_table_privilege('portal_app', 'sessions', 'DELETE') AS can_delete;

