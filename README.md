# Training Analytics Portal

A web application for tracking trainee assessment sessions, cohort progress, evaluator scoring, and training performance metrics.

The system is built with a FastAPI backend (Python, SQLAlchemy, SQLite/PostgreSQL) and a React frontend (Vite, Tailwind CSS, Recharts).

---

## Setup Steps

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Seed the database with sample data using the `--reset` flag:
   ```bash
   python scripts/seed.py --reset
   ```
   *Note: This creates all required tables and seeds deterministic batches, trainees, modules, and assessment sessions.*

5. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The backend API will be available at `http://localhost:8000`. Interactive OpenAPI documentation is accessible at `http://localhost:8000/docs`.*

---

### 2. Frontend Setup

1. Open a second terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The web application will be accessible at `http://localhost:5173`.*

   *Note: The landing page background chart texture is rendered in SVG from static seeded batch score averages (`frontend/src/assets/landing-heatmap.json`), containing no credentials or email addresses.*

---

### 3. Default Seeded Credentials

The database seed provides pre-configured user accounts across all three platform roles:

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| Administrator | `admin@example.com` | `Admin123!` | System-wide batch oversight, user management, audit logs, and model evaluation metrics |
| Trainer | `trainer@example.com` | `Trainer@123` | Cohort performance, heatmap analytics, session recording, batch CSV import, and remediation assignment |
| Trainee | `trainee@example.com` | `Trainee@123` | Personal profile dossier, progress timeline, defect diagnostics, speed versus accuracy analysis, and module targets |

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

- **Frontend Risk Component Test Coverage**: The flagged trainee risk display component (`FlaggedTraineeRiskCard.jsx`) is verified via clean Vite production build compilation, static string audits (checking for forbidden buzzwords and typography rules), and live backend API integration, rather than a dedicated frontend component or browser test suite.
- **Machine Learning Generalization and Evaluation**: As documented in [MODEL_CARD.md](backend/app/ml/MODEL_CARD.md), models were evaluated on 8 synthetic test trainees where the 3-row difference between models (2 false positives) and the baseline rule (5 false positives) is within statistical sampling noise.
- **Audit Log Append-Only Scope**: Audit logging is append-only at the application layer only via repository interfaces; database-level immutability triggers or external database administrator access restrictions are not implemented.
- **Database Schema and Migrations**: The `audit_logs.actor_id` column requires a database reseed (`python scripts/seed.py --reset`) on old databases because automatic table creation (`Base.metadata.create_all`) does not alter pre-existing tables.
- **SQLite DateTime Parameter Warnings**: Deprecation warnings during SQLite test execution occur because raw Python datetime objects are bound directly in specific text SQL queries; these will be migrated to SQLAlchemy typed expressions or explicit ISO strings in future maintenance.

---

## License

This project is licensed under the MIT License.
