# Training Analytics Portal

A web application for tracking trainee assessment sessions, cohort progress, evaluator scoring, and training performance metrics.

The system is built with a FastAPI backend (Python, SQLAlchemy, SQLite/PostgreSQL) and a React frontend (Vite, Tailwind CSS, Recharts).

---

## Setup Steps

> **Important Working Directory Note:** Each command block states whether it runs from the **repository root**, `backend/`, or `frontend/`. Do not run `seed.py --reset` against an existing or production database.

**Environment Configuration Templates:**

Copy the tracked templates before startup:
- **Backend & ML Service** (`backend/.env` from `backend/.env.example`):
  - `ENVIRONMENT`: `development` or `production` (`production` refuses startup if `SECRET_KEY` is left at the default insecure value)
  - `DATABASE_URL`: SQLite (`sqlite:///./training_portal.db`) or PostgreSQL (`postgresql+psycopg2://user:pass@localhost:5432/training_portal`)
  - `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT signing settings
  - `ALLOWED_ORIGINS`: Comma-separated origins (`http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173`)
  - `ML_SERVICE_URL`: Prediction microservice URL (default `http://127.0.0.1:8001`)
  - `ML_MODEL_PATH`: Optional model override for `ml_service/main.py` (default `app/ml/risk_model.joblib`)
- **Frontend** (`frontend/.env` from `frontend/.env.example`):
  - `VITE_API_URL`: Backend API URL (default `http://localhost:8000`)
  - `VITE_WS_URL`: WebSocket URL (default `ws://localhost:8000`)

### 1. Backend Setup

Run the virtual environment and dependency installation from `backend/`:

```powershell
cd backend
# Windows PowerShell (macOS/Linux: python3 -m venv venv && source venv/bin/activate)
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Option A — Existing Database Upgrade (Non-Destructive, preserves data):**

- **SQLite installations** (from repository root or `backend/`):
  ```powershell
  python backend/scripts/upgrade_existing_db.py
  ```
- **PostgreSQL installations** (`alembic` revisions `001`–`003` target PostgreSQL syntax; then apply post-`003` tables/columns):
  ```powershell
  cd backend
  alembic upgrade head
  python scripts/upgrade_existing_db.py
  ```

*Note: `backend/scripts/upgrade_existing_db.py` idempotently creates post-`003` tables (`batch_trainers`, `messages`, `message_attachments`, `remediations`, `trainee_goals`, `session_notes`, `help_chunks`) and adds missing columns on `audit_logs` and `remediations` without dropping or resetting existing data.*

**Option B — Fresh Disposable Demo Database (DESTRUCTIVE RESET):**

> **DESTRUCTIVE WARNING:** `python scripts/seed.py --reset` drops/recreates tables or wipes existing rows and inserts synthetic demo records. Use this **only** for a disposable demo or clean development database—never on an existing installation.

```powershell
cd backend
python scripts/seed.py --reset
```

**Start Backend API (Port `8000`) & Optional ML Risk Microservice (Port `8001`):**

```powershell
# Terminal 1 (from backend/) — Main API server (http://localhost:8000/docs)
cd backend
uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal 2 (optional, from backend/) — Random Forest ML prediction microservice
cd backend
.\venv\Scripts\Activate.ps1
uvicorn ml_service.main:app --port 8001
```

*Requires `backend/app/ml/risk_model.joblib` (or `ML_MODEL_PATH`). When the ML microservice is offline, the main backend starts normally and automatically applies deterministic rule fallback for risk predictions.*

### 2. Frontend Setup

Run from `frontend/`:

```powershell
cd frontend
npm install
npm run dev
```

*Configured in `frontend/vite.config.js` to serve at `http://localhost:3000` (pass `--port 5173` if you prefer port `5173` and keep it listed in `ALLOWED_ORIGINS`).*

**Verification Commands (Run from Repository Root):**

```powershell
# 1. Backend test suite
backend\venv\Scripts\pytest.exe backend/tests -o pythonpath=backend -v

# 2. Frontend production build
npm --prefix frontend run build

# 3. End-to-end Admin & ML verification (empty DB, seeded DB, RBAC, ML offline & online)
backend\venv\Scripts\python.exe backend/scripts/verify_admin_release.py
```

### 3. Default Seeded Credentials

> **Synthetic Demo Data Notice:** All seeded user accounts (`admin@example.com`, `trainer@example.com`, `trainee@example.com`), cohorts, assessment scores, remediations, and analytics created by `scripts/seed.py` are synthetically generated demo data for evaluation and presentation only.

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| Administrator | `admin@example.com` | `Admin123!` | System-wide cohort oversight, trainer assignment, user management, audit logs, and service/model status |
| Trainer | `trainer@example.com` | `Trainer@123` | Assigned-cohort analytics, heatmap, session recording, batch CSV import, copilot, and closed-loop remediations |
| Trainee | `trainee@example.com` | `Trainee@123` | Personal dossier, progress timeline, misconception feedback, practice submission, and personal goals |

---

## Grading Policy

The application enforces a centralized threshold policy across all database queries, backend analytical services, and frontend dashboard components:

| Constant | Value | Definition and Enforcement |
| :--- | :--- | :--- |
| `PASS_THRESHOLD` | `60.0%` | Minimum percentage score required to pass an individual assessment drill. Also used for cohort-wide pass rate computations (`pass_rate_pct`) and identifying batches below target (`batches_below_target` flagged when cohort mean is below `60.0%`). |
| `EXCELLENT_THRESHOLD` | `75.0%` | Threshold for trainee mastery tier classification across cohort score bands and milestone indicators. |
| `COLD_START_SESSIONS` | `3` | Minimum number of completed assessment sessions required before applying the machine learning early-warning classifier. |
| `COLD_START_CUTOFF` | `50.0%` | Rule-based heuristic fallback threshold. Trainees with fewer than 3 sessions and an initial average below `50.0%` are immediately flagged for attention. |

Both individual assessment qualification and batch aggregate pass rates evaluate strictly against the identical `60.0%` cutoff (`PASS_THRESHOLD`), ensuring consistent classification between personal trainee dossiers and cohort analytics.

---

## Role-Based User Guides

### Trainee Guide: Performance and Progress Tracking
Trainees can view their historical evaluation performance from the Trainee Dashboard. The progress chart plots percentage scores across consecutive evaluation sessions, illustrating your learning trajectory and mastery over time. Consistent scores above the passing cutoff demonstrate readiness for practical deployment.

### Trainee Guide: Module Goals and Milestones
Trainees can configure personalized target percentage scores for each curriculum module. Setting module goals allows you to focus study efforts on challenging topics and measure your achievement against your personal milestones. These personal goals provide motivation and self-assessment benchmarks as you complete practice drills.

### Trainee Guide: Setting and Editing Module Learning Goals
Trainees can create and update personal learning goals for any curriculum module. From the module goals panel, enter a target percentage score that reflects your target proficiency. The portal compares your latest drill scores against these targets to show your progress. Setting ambitious but achievable goals helps structure daily practice routines.

### Trainee Guide: Corrective Remediation Records
When an evaluation session indicates areas that need reinforcement, your instructor may assign a corrective remediation drill. Trainees can review all assigned remediations in their profile view. Each record details the module, required focus area, and guidance provided by your evaluator. Remediations remain listed until your instructor marks them resolved.

### Trainee Guide: Speed Versus Accuracy Analysis
The speed versus accuracy scatter chart displays the relationship between completion duration and percentage score across your recorded sessions. Trainees can analyze their speed accuracy balance to determine optimal pacing. Rushing through assessment drills often leads to avoidable defect errors, while excessive caution slows completion. Aim for steady speed paired with high accuracy above passing thresholds.

### Trainee Guide: Batch Messaging With Assigned Trainer
Trainees can communicate directly with the trainers assigned to their cohort using the private messaging interface. You can ask questions regarding curriculum concepts, request assistance on drills, or coordinate review sessions. All messages remain private within your batch, and messages with unauthorized parties outside your batch are prevented.

### Trainee Guide: Private Messages and Cohort Communication
The private messaging screen provides a direct inbox for conversations with instructors and peers. Trainees can compose messages to ask for help on difficult topics, review session notes, or coordinate practice sessions. All messages are scoped to your cohort, ensuring that communication remains private and protected within your assigned batch.

### Trainee Guide: Reviewing Session Feedback Notes
Following each evaluation session, instructors record qualitative feedback notes outlining your technical strengths and specific error patterns. Trainees can inspect these notes directly from their session ledger to understand examiner recommendations and prepare effectively for subsequent drills.

### Trainee Guide: Score Bands and Thresholds
The portal measures evaluation results against standard score thresholds:
- Pass Mark: The pass threshold required to pass an evaluation session is a percentage score of 60.0% (PASS_THRESHOLD) or higher. Scoring 60.0% or above confirms basic competency in the module material and counts as an individual passing attempt.
- Excellence Tier: A percentage score of 75.0% (EXCELLENT_THRESHOLD) marks the tier for outstanding performance and advanced subject mastery. Trainees who sustain percentage marks of 75.0% or higher demonstrate exceptional skill acquisition across the curriculum.

### Trainer Guide: Needs-Attention Queue and Alerts
The Needs-Attention queue highlights candidates within active batches who require prompt pedagogical intervention. A trainee is placed in this queue for two explicit reasons:
1. Their historical average score across completed sessions falls below the 60.0% pass threshold.
2. An early-warning alert is triggered during initial onboarding when early performance falls below acceptable marks.
Trainers should review flagged candidates daily and assign corrective remediation drills where deficits are found.

### Trainer Guide: Cold-Start Evaluation Rules
The system applies cold-start heuristic rules for new learners who lack sufficient evaluation history:
- Trainees with fewer than 3 completed sessions (COLD_START_SESSIONS) are classified under the cold-start rule.
- If a trainee with fewer than 3 sessions records an initial average percentage score below 50.0% (COLD_START_CUTOFF), they are immediately flagged for instructor attention.
- Once a learner completes 3 or more sessions, evaluation transitions to longitudinal performance tracking.

### Trainer Guide: Curriculum Heatmap and Defect Matrix
The cohort heatmap displays a cross-tabulated matrix of trainees and curriculum modules. Each cell displays the trainee average percentage score, recorded error count, and session total. This allows instructors to identify both cohort-wide curriculum bottlenecks and individual learner struggle areas at a glance. Cells with lower averages or higher error counts indicate where review lectures or supplemental exercises are needed.

### Trainer Guide: Session Recording and Batch CSV Import Rules
Trainers can record individual assessment sessions or bulk-import session records via CSV files. All imports enforce atomic validation:
- Every CSV row must specify an existing trainee email, valid module name, valid date, non-negative duration, and non-negative defect count.
- The raw score cannot exceed the module maximum score.
- If any single row contains validation errors or invalid values, the entire import transaction is rejected, preventing partial or inconsistent data persistence.

### Trainer Guide: Qualitative Session Feedback Notes
When recording or reviewing an assessment drill, trainers can write qualitative feedback notes. These notes document technical shortcomings, recommend remedial actions, and provide constructive guidance. Feedback notes are visible to the trainee in their dossier and persist in the evaluation record to track longitudinal improvement.

### Trainer Guide: Cohort Messaging Rules
Trainers can exchange direct messages with trainees enrolled in batches assigned to them. Trainer messaging adheres to strict participant boundaries:
- Trainers may message only trainees in batches to which they are assigned via batch trainer mappings.
- Trainer-to-trainer messaging is prohibited to ensure communication remains focused on trainee instruction.
- All communications are strictly contained within batch boundaries.

### Trainer Guide: Batch Trainer Assignments
Cohort oversight is governed by batch trainer assignments in the database. A trainer is linked to one or more batches, granting them access to view cohort analytics, record session results, import CSV data, and message assigned students. Instructors cannot inspect or modify batches to which they are not assigned.

### Admin Guide: User Provisioning and Account Controls
Administrators manage user accounts across all platform roles (admin, trainer, and trainee). User provisioning includes creating new accounts, assigning role permissions, resetting passwords with secure hashing, and activating or deactivating user access. Administrators ensure proper role separation across the training organization.

### Admin Guide: Audit Log Compliance Tracking
The platform maintains an append-only audit log tracking sensitive administrative and evaluation modifications. Every log entry records the action performed, the entity type, the entity ID, the actor user ID, changes, and the exact timestamp. Audit logs cannot be modified or deleted through the interface, providing accountability and compliance traceability.

### Admin Guide: Predictive Model Evaluation
The platform evaluates early-warning risk models using a grouped holdout partition of trainees:
- Baseline Heuristic: Flags trainees whose last 3 session average is below 60.0% (F1: 0.9275, precision: 0.8649, recall: 1.0000, 5 false positives).
- Random Forest Classifier: Predicts using historical session features with threshold 0.67 (F1: 0.9697, precision: 0.9412, recall: 1.0000, 2 false positives).
The difference between the heuristic baseline and the machine learning model is 3 rows on the 8-trainee test set, which is within statistical sampling noise. Complete results are tabulated in the Machine Learning Early-Warning Prediction section below and documented in [MODEL_CARD.md](backend/app/ml/MODEL_CARD.md).

### Admin Guide: Data Quality and Integrity Monitoring
Data quality controls protect the database against corrupted or invalid records:
- Score Bounds: Assessment scores must fall between zero and the curriculum module maximum score.
- Referential Integrity: Foreign keys link trainees to valid batches and users, and link sessions to valid trainees and modules.
- Unique Constraints: Trainee goals enforce uniqueness per trainee and module pair.
- Validation: CSV imports undergo atomic pre-validation to prevent orphan or corrupted records.

### Admin Guide: Batch and Curriculum Module Management
Administrators oversee the curriculum structure by creating, updating, and retiring batches and modules:
- Batches: Define cohort name, start date, end date, and assigned lead instructor.
- Modules: Define curriculum assessment topics, description, and maximum raw score allowable for scoring calculations.

### Admin Guide: Seeded User Credentials and Access Tokens
For development and demonstration, the database seed initializes three role accounts:
- Administrator: admin@example.com (Password: Admin123!)
- Trainer: trainer@example.com (Password: Trainer@123)
- Trainee: trainee@example.com (Password: Trainee@123)
Authentication uses JSON Web Tokens (JWT) signed with HS256, valid for 24 hours.

### Admin Guide: Relational Database Schema and Architecture
The persistence layer is structured around eight core relational tables: users, batches, batch_trainers, trainees, modules, sessions, remediations, trainee_goals, and audit_logs. All tables feature strict primary and foreign key constraints, indexes on lookup keys, and automated timestamp tracking via SQLAlchemy 2.0 ORM.

### General Definitions: What Is an Assessment Session
An assessment session is a single recorded evaluation of a trainee on a curriculum module. Each session captures the trainee identifier, module identifier, raw score achieved, normalized score percentage, defect error count, completion time in seconds, and the evaluator who submitted the score. Sessions serve as the atomic unit of measurement for individual progress and cohort analytics.

### General Definitions: Score Bands and Thresholds
The platform applies consistent system-wide grading thresholds:
- PASS_THRESHOLD (60.0%): The minimum percentage score required to pass an individual assessment drill. Also serves as the cohort target benchmark.
- EXCELLENT_THRESHOLD (75.0%): The boundary designating student mastery and high achievement.

---

## Core Technical Architecture and Accurate System Descriptions

The platform is built on four core analytical and pedagogical workflows, described below according to verified codebase implementations:

1. **Early-Warning Performance Risk Prediction**:
   - Supervised tabular **Random Forest classifier** (`RandomForestClassifier` in Scikit-learn) trained to predict whether a candidate will fall below the passing benchmark on subsequent sessions.
   - Deterministic heuristic rule fallback applied automatically when candidates have fewer than 3 completed sessions or when the microservice is cold.
   - Not a deep learning model or neural network.

2. **Curriculum Misconception and Error Clustering**:
   - Statistical Natural Language Processing using **TF-IDF feature extraction** (`TfidfVectorizer` with n-grams) paired with **hierarchical agglomerative clustering** (`AgglomerativeClustering` using cosine distance) on session feedback text and error logs.
   - Synthesizes recurring failure patterns into structured misconception themes without neural embeddings or LLM APIs.
   - Features trainer human-in-the-loop validation controls to inspect and approve generated themes.

3. **Evidence-Grounded Trainer Help Assistant**:
   - Retrieval system powered by **SQLite FTS5 BM25 full-text search** over syllabus guidelines and rubrics, combined with relational SQL joins over candidate sessions and remediations.
   - Returns structured answers strictly paired with source citations and deep-linked action recommendations.
   - Enforces domain boundaries: when a query lacks supporting documentation or telemetry, the assistant returns an explicit low-confidence "Insufficient domain evidence" disclaimer. Not a generative neural model or NIST-certified system.

4. **Closed-Loop Remediation Outcome Tracker**:
   - Complete 5-stage intervention lifecycle: Trainer assigns drill &rarr; Trainee reviews instructions &rarr; Trainee submits completed practice &rarr; Trainer evaluates follow-up re-assessment &rarr; Ledger updates longitudinal outcome.
   - Defined resolution criteria: Clicking "Complete" records trainee submission without prematurely marking the intervention resolved; resolution requires a confirmed re-assessment score meeting the 70.0% passing benchmark or explicit trainer resolution.
   - Score trajectory changes are recorded as **percentage-point deltas** (the arithmetic difference between post-drill and pre-drill percentage scores).

5. **Cohort-Level Object Authorization (OWASP BOLA Defense)**:
   - Object-level authorization enforced on every batch-specific endpoint (`/analytics/batches/{id}/*`, `/batches/{id}/remediations`, `/help/trainer-copilot`, etc.).
   - Trainers can only view analytics, list interventions, and assign drills for cohorts to which they are assigned via the `batch_trainers` table. Unauthorized cross-cohort access attempts receive HTTP 403 Forbidden.

---

## Machine Learning Prediction Service and Endpoint
Role tag: all

The backend provides a dedicated endpoint for evaluating trainee performance risk (`GET /analytics/trainees/{id}/risk`):
- Evaluation Method: Returns `method: "ml"` when the trainee has completed at least 5 assessment sessions and the prediction microservice is reachable; otherwise returns `method: "rule"`.
- Rule Fallback: Applies automatically when a trainee has fewer than 5 completed sessions, has no session history, or when the external prediction microservice is unreachable or times out (2.0-second network limit).
- Cutoff Units: For `method: "ml"`, returns decision cutoff 0.67 with unit `"probability"`. For `method: "rule"`, returns pass cutoff 60.0 with unit `"score_percentage"`.
- Probability Display Guard: The probability value is provided only when method is `"ml"` (labeled "Model probability of at-risk outcome"). Probabilities are strictly never returned or rendered for `"rule"` rows.
- Global Feature Importance: Feature importances in the response represent global feature importance across the entire trained model artifact, not an individualized causal explanation for that specific trainee.

---

## Held-Out Machine Learning Evaluation Results
Role tag: all

The machine learning models and baselines were evaluated on an isolated test partition grouped by trainee identifier using `GroupShuffleSplit` (test size 0.20, fixed random state 42). The test metrics copied directly from `backend/app/ml/model_results.json` are:

| Model | Test Rows | Test Trainees | Cutoff | Precision | Recall | F1 Score | ROC-AUC | PR-AUC | Confusion Matrix (TN, FP, FN, TP) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Majority Baseline | 155 | 8 | - | 0.0000 | 0.0000 | 0.0000 | 0.5000 | 0.2065 | [[123, 0], [32, 0]] |
| Rule Baseline | 155 | 8 | 60.0% | 0.8649 | 1.0000 | 0.9275 | 0.9797 | 0.8649 | [[118, 5], [0, 32]] |
| Logistic Regression | 155 | 8 | 0.53 | 0.9412 | 1.0000 | 0.9697 | 0.9995 | 0.9982 | [[121, 2], [0, 32]] |
| Random Forest | 155 | 8 | 0.67 | 0.9412 | 1.0000 | 0.9697 | 1.0000 | 1.0000 | [[121, 2], [0, 32]] |

### Evaluation Findings
- The held-out test partition comprises 8 trainees, 155 rows, and 32 positive cases (20.6% positive rate).
- Both the rule baseline and machine learning models achieved 1.0000 recall (identifying all 32 positive cases).
- The difference between the rule baseline (5 false positives) and the models (2 false positives) is 3 rows out of 155, which is within statistical sampling noise.
- Test set metrics were computed three times during development iteration (during threshold candidate inspection, pipeline execution, and JSON formatting checks), with candidate model settings and decision boundaries fixed on training cross-validation.

---

## Model Card Limitations Reference
Role tag: all

Detailed architectural specifications, feature derivations, and permutation checks are documented in [MODEL_CARD.md](backend/app/ml/MODEL_CARD.md). The model card establishes seven explicit operational limitations:
1. Synthetic Data: Assessment data originates from simulation scripts and does not reflect real human learning behaviors.
2. Small Test Set: Evaluated on 8 trainees and 32 positive instances; the 3-row difference between the rule baseline and models is within statistical noise.
3. Shared Cutoff: The target label uses the identical 60.0% cutoff as the rule baseline, training models to mirror future adherence to that cutoff.
4. Proxy Target: The ground truth target is a short-term proxy (mean score on the next 2 sessions) rather than an observed career outcome.
5. High AUC Caveat: Test ROC-AUC scores (0.9995 for Logistic Regression, 1.0000 for Random Forest) reflect simplicity and consistency in the synthetic generator and must not be assumed to generalize to real cohorts.
6. No Real Student Data: The models have not been validated on real student or trainee cohorts.
7. Development Test Exposures: Test set metrics were computed three times during development iteration.

---

## Help Assistant Documentation Search
Role tag: all

The platform includes an in-app documentation search assistant (`GET /help/search`, `GET /help/assistant`):
- Architecture: Implemented as an inverted index keyword search engine using token frequency (TF-IDF) scoring over structured markdown documentation sections.
- Natural Language Limitation: The Help Assistant is strictly a documentation keyword search tool, not a large language model or generative AI system. It cannot write new text, infer unstated rules, or answer questions outside the indexed documentation.
- Retrieval Limits: Keyword search is sensitive to vocabulary choice; phrasing questions with terms not present in the guide may yield no results.
- Unseen Benchmark Evaluation: Evaluated on a fresh unseen benchmark evaluation set, the assistant achieved:
  - Hit@1: 3/5 (60.0%)
  - Hit@3: 4/5 (80.0%)
  - Role Violations: 0/5 (0.0% unauthorized disclosures)
  - Adversarial Refusal: 5/5 (100.0% correct rejection of unauthorized requests)
  Earlier benchmark figures showing 100% retrieval precision came from development and tuning sets used during initial index construction. The fresh unseen benchmark provides a realistic measure of retrieval on novel queries.

---

## Development Demo States Note

The state switcher pills and simulated query parameters (`?state=loading`, `?state=empty`, `?state=error`) on the Admin, Trainer, and Trainee dashboards are development-only verification tools gated by `import.meta.env.DEV`. In production builds, the UI pill switcher is excluded from the bundle and the `?state=` query parameter is ignored, ensuring live production telemetry is always rendered.

---

## Known Limitations

- **Per-Process ML Fallback Telemetry**: `Service Status` fallback counters (`fallback_used_count` and `last_fallback_at`) track runtime ML-to-rule fallback events **since this backend process started** using in-memory worker state; counts reset on server restart and are not aggregated across multi-worker processes.
- **First-Page Cohort & Add-User Trainee Selectors (`100`-Record Limit)**: While `Manage Trainers` paginates across all trainer pages (`1..pages`) and `User & Role Directory` supports server-side paginated search, `AdminDashboard` Cohort Directory batch loading and the `Add User` trainee dropdown request only page 1 (`page_size=100`). Extend pagination to those selectors before operating on more than 100 cohorts or 100 unlinked trainees.
- **Missing Evaluation Execution Timestamp**: When cached `backend/app/ml/evaluation.json` lacks a recorded `evaluated_at` timestamp, the Admin UI intentionally displays `Evaluation artifact modified: <date>` alongside `Execution time: not recorded` instead of conflating file mtime with evaluation execution time.
- **Dependency Deprecation Warnings**: Backend `pytest` reports SQLite Python 3.12+ datetime adapter deprecation warnings and Starlette `python_multipart`/`BlockingPortal` deprecation warnings; these are tracked separately as maintenance work.
- **Frontend Verification Scope**: Admin workflows and states are verified via `vite build` and headless Chrome CDP automation (`backend/scripts/verify_admin_release.py`) alongside backend `pytest` suites rather than a standalone Jest/Vitest component suite.
- **Machine Learning Generalization and Evaluation**: As documented in [MODEL_CARD.md](backend/app/ml/MODEL_CARD.md), holdout models were evaluated on synthetic cohorts (`8` held-out trainees in `model_results.json`; `41` trainees in cached `evaluation.json`), where service availability (`ML Available`) must not be mistaken for prediction superiority over the baseline rule.
- **Audit Log Append-Only Scope**: Audit logging is enforced append-only at the application layer (`AuditRepository`) rather than via database-level triggers.
- **Existing-Database Schema Upgrades**: Alembic migrations cover revisions `001`–`003`; post-`003` tables and columns on existing databases require running `python backend/scripts/upgrade_existing_db.py` (never `seed.py --reset`).
- **Illustrative Static Trainee Preview Widgets**: In [`TraineeDashboard`](frontend/src/pages/TraineeDashboard.jsx), the `Readiness Score` ring, `Skills Overview` / `Competency Radar` (`SkillsRadar`), `Placement Readiness` (`Career` tab), `Learning Journey`, `Mentor Feedback`, and `Today's Tasks` cards are explicitly labeled `Illustrative Preview` and display static/sample visual indicators rather than live readiness scoring; live trainee assessment telemetry is rendered in the progress charts, `ModuleDiagnosticLedger`, session history, and remediation workflow.

---

## License

This project is licensed under the MIT License.
