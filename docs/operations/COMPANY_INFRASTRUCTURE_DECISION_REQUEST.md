# Company Infrastructure Decision Request

**To**: Engineering Leadership / Infrastructure Committee  
**From**: Training Analytics Portal Engineering Team  
**Subject**: Required Infrastructure & Deployment Architecture Decisions for Production Rollout  
**Date**: November 14, 2026  
**Status**: Decision Required Prior to Phase 2B Implementation  

---

## Executive Summary

The Training Analytics Portal has completed its data-layer and migration re-architecture (Sprint 2 Phase 2A). All 20 application models have been mapped into an ordered, single-head Alembic migration chain with least-privilege PostgreSQL roles, production fail-fast startup assertions, and 222 passing backend regression tests.

Before the team begins Phase 2B (containerization, deployment manifests, and infrastructure wiring), the organization must formally select its target infrastructure stack. **The engineering team will not unilaterally select cloud providers or infrastructure services.**

Please review the 6 decision areas below and designate the approved corporate selections.

---

## 1. Hosting Architecture & Compute Runtime

| Option | Architecture | Operational Complexity | Recommendation |
| :--- | :--- | :---: | :---: |
| **Option A** | **Dedicated Cloud / On-Prem VM** with Docker Compose + Nginx/Caddy | Low | **Recommended** for initial corporate rollout. Simple to operate, inspect, and maintain with predictable compute costs. |
| **Option B** | **Managed Cloud Container** (AWS ECS Fargate / GCP Cloud Run / Azure ACA) | Low–Medium | Viable if company already operates on AWS/GCP and prefers serverless compute scaling. |
| **Option C** | **Corporate Kubernetes** (EKS / GKE / On-Prem K8s) | High | Recommended only if the company already maintains a dedicated Kubernetes operations platform team. |

*Corporate Decision*: `[   ]` Option A &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option B &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option C

---

## 2. Production PostgreSQL Database

| Option | Architecture | Maintenance & DR | Recommendation |
| :--- | :--- | :---: | :---: |
| **Option A** | **Cloud-Managed PostgreSQL 16** (AWS RDS / GCP Cloud SQL / Neon) | Zero OS ops; Automated WAL archiving & PITR | **Recommended**. Essential for automated point-in-time recovery and zero-maintenance security patching. |
| **Option B** | **Self-Hosted PostgreSQL Container** on persistent attached storage | High (requires manual backup scripts, WAL archiving, and host patching) | Acceptable only if compliance forbids managed database services. |

*Corporate Decision*: `[   ]` Option A &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option B

---

## 3. Secrets Management Solution

| Option | Architecture | Rotation & Auditing | Recommendation |
| :--- | :--- | :---: | :---: |
| **Option A** | **Centralized Enterprise Secret Manager** (AWS Secrets Manager / Vault / Doppler) | High (automated key rotation, access audit trails) | **Recommended**. Guarantees zero secrets exist in Git, Docker images, or server environment files. |
| **Option B** | **Platform-Native CI/CD Pipeline Injection** (GitHub Actions / GitLab CI Secrets) | Medium (injected into runtime container environment) | Viable intermediate step if enterprise secret manager is not yet provisioned. |

*Corporate Decision*: `[   ]` Option A &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option B

---

## 4. Session Revocation Store Topology

| Option | Architecture | Infrastructure Footprint | Recommendation |
| :--- | :--- | :---: | :---: |
| **Option A** | **Database-Backed Revocation** (PostgreSQL `revoked_tokens` table) | Zero extra containers; already tested & working | **Recommended for single-instance or small cluster**. Index on `(user_id, expires_at)` handles sub-millisecond lookups. |
| **Option B** | **Shared Memory Cache** (Managed Redis 7+ / Valkey Cluster) | Requires dedicated Redis instance, monitoring, and failover | Recommended **only** if company mandates horizontal multi-node load balancing across 3+ web instances. |

*Corporate Decision*: `[   ]` Option A &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option B

---

## 5. Course Media Storage & Video Streaming

| Option | Architecture | Bandwidth & Scalability | Recommendation |
| :--- | :--- | :---: | :---: |
| **Option A** | **Cloud Object Storage with Signed URLs** (AWS S3 / Cloudflare R2 / GCS) | Offloads 14+ GB video traffic from portal server; CDN-accelerated | **Recommended**. Protects server disk from exhaustion and prevents server CPU starvation during video playback. |
| **Option B** | **Private Internal MinIO Cluster** | S3-compatible private storage inside corporate network | Ideal if video assets must strictly reside within private perimeter. |
| **Option C** | **Mounted Persistent Storage Volume** (EFS / NFS) | Directly served via FastAPI HTTP 206 stream | Simple but consumes web server bandwidth. |

*Corporate Decision*: `[   ]` Option A &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option B &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option C

---

## 6. Observability, Logging & Error Telemetry

| Option | Architecture | Alerting & Compliance | Recommendation |
| :--- | :--- | :---: | :---: |
| **Option A** | **Existing Corporate Observability Stack** (Datadog / New Relic / Splunk) | Unified with company monitoring guidelines | **Recommended**. Ingest structured JSON logs and Prometheus metrics into standard corporate dashboards. |
| **Option B** | **Self-Hosted Open Source Stack** (Prometheus + Grafana + Loki) | Zero third-party SaaS fees; full data sovereignty | Viable if company prefers self-hosted telemetry. |
| **Option C** | **CloudWatch / GCP Cloud Logging + Sentry** | Turnkey APM error tracking | Quick to configure if AWS/GCP cloud platform is chosen. |

*Corporate Decision*: `[   ]` Option A &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option B &nbsp;&nbsp;&nbsp;&nbsp; `[   ]` Option C

---

## Summary of Action Required

Please return decisions on items 1–6 above. Concurrently, please provide connection credentials to an **isolated PostgreSQL 16 testing instance** so the engineering team can execute the live runtime validation pass.
