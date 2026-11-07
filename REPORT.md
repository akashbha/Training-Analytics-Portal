# Project Report: Training Analytics Portal

## 1. Problem Statement

Technical training programs frequently experience difficulty monitoring trainee skill acquisition across diverse curriculum topics. Without centralized tracking tools, instructors must rely on distributed spreadsheets and informal observations. This approach introduces multiple operational shortcomings:

- Inconsistent grading scales across assessment modules (such as 20, 50, or 100 maximum marks) prevent direct comparison of student performance.
- Instructors lack early warning indicators to detect struggling students before final evaluations take place.
- Assigning and tracking corrective assignments occurs outside the evaluation workflow, leading to unaddressed skill deficits.
- Disjointed metrics between administrative overviews, trainer cohort dashboards, and student dossiers produce conflicting assessments of progress.

The Training Analytics Portal addresses these challenges through a unified full-stack system that standardizes score normalization, implements role-based access control, tracks curriculum defect frequencies, evaluates predictive risk models, and manages corrective remediations.

---

## 2. Database Schema

The database is structured as a normalized relational schema, implemented using SQLAlchemy 2.0 ORM with support for SQLite and PostgreSQL:

- **`users`**: Stores user authentication and role data.
  - Columns: `id` (PK), `email` (Unique), `hashed_password`, `role` (`admin`, `trainer`, `trainee`), `full_name`, `is_active`, `created_at`, `updated_at`.
- **`batches`**: Represents training cohorts.
  - Columns: `id` (PK), `name` (Unique), `start_date`, `end_date`, `trainer_id` (FK to `users.id`), `created_at`.
- **`trainees`**: Stores trainee-specific profile information.
  - Columns: `id` (PK), `user_id` (FK to `users.id`, Unique), `batch_id` (FK to `batches.id`), `phone`, `github_username`, `created_at`.
- **`modules`**: Curriculum assessment topics with normalized scoring limits.
  - Columns: `id` (PK), `name` (Unique), `description`, `max_score`, `created_at`.
- **`sessions`**: Records individual assessment evaluations.
  - Columns: `id` (PK), `trainee_id` (FK to `trainees.id`), `module_id` (FK to `modules.id`), `score` (raw score), `score_percentage` (normalized percentage), `errors` (defect count), `time_seconds` (duration), `created_at`, `created_by` (FK to `users.id`).
- **`remediations`**: Tracks corrective drills assigned to trainees.
  - Columns: `id` (PK), `trainee_id` (FK to `trainees.id`), `module_id` (FK to `modules.id`), `assigned_by` (FK to `users.id`), `notes`, `status` (`pending`, `completed`), `created_at`, `updated_at`.
- **`trainee_goals`**: Stores personalized target percentage scores per curriculum module.
  - Columns: `id` (PK), `trainee_id` (FK to `trainees.id`), `module_id` (FK to `modules.id`), `target_score` (percentage), `created_at`, `updated_at`.
  - Constraints: Unique constraint on `(trainee_id, module_id)`.
- **`audit_logs`**: Application-level log tracking sensitive modifications.
  - Columns: `id` (PK), `action`, `entity_type`, `entity_id`, `actor_id` (FK to `users.id`), `changes` (JSON text), `timestamp`.

---

## 3. Key SQL Queries

The application relies on optimized SQL queries within `AnalyticsRepository` to compute cohort and trainee metrics:

### 3.1 Cohort Aggregate KPI and Period Trend Query

Computes total active trainees, completed sessions, cohort mean score percentage, and pass rate percentage over the cohort:

```sql
WITH cohort_trainees AS (
    SELECT id FROM trainees WHERE batch_id = :batch_id
),
session_metrics AS (
    SELECT 
        s.id,
        (CAST(s.score AS FLOAT) * 100.0 / CAST(m.max_score AS FLOAT)) AS score_pct,
        s.created_at
    FROM sessions s
    JOIN modules m ON m.id = s.module_id
    WHERE s.trainee_id IN (SELECT id FROM cohort_trainees)
),
period_comparisons AS (
    SELECT
        AVG(CASE WHEN created_at >= :recent_cutoff THEN score_pct END) AS recent_avg,
        AVG(CASE WHEN created_at >= :prior_cutoff AND created_at < :recent_cutoff THEN score_pct END) AS prior_avg
    FROM session_metrics
)
SELECT 
    (SELECT COUNT(*) FROM cohort_trainees) AS trainee_count,
    COUNT(sm.id) AS session_count,
    ROUND(AVG(sm.score_pct), 1) AS avg_score_pct,
    ROUND(
        (COUNT(CASE WHEN sm.score_pct >= :pass_threshold THEN 1 END) * 100.0) / 
        NULLIF(COUNT(sm.id), 0), 
        1
    ) AS pass_rate_pct,
    ROUND((pc.recent_avg - pc.prior_avg), 1) AS period_delta
FROM period_comparisons pc
LEFT JOIN session_metrics sm ON true
GROUP BY pc.recent_avg, pc.prior_avg;
```

### 3.2 Student by Module Performance Matrix (Heatmap)

Aggregates average percentage scores and defect counts across each trainee-module combination:

```sql
SELECT 
    t.id AS trainee_id,
    u.full_name AS trainee_name,
    m.id AS module_id,
    m.name AS module_name,
    ROUND(AVG(CAST(s.score AS FLOAT) * 100.0 / CAST(m.max_score AS FLOAT)), 1) AS avg_score_pct,
    ROUND(AVG(s.errors), 1) AS avg_errors,
    COUNT(s.id) AS session_count
FROM trainees t
JOIN users u ON u.id = t.user_id
JOIN batches b ON b.id = t.batch_id
CROSS JOIN modules m
LEFT JOIN sessions s ON s.trainee_id = t.id AND s.module_id = m.id
WHERE t.batch_id = :batch_id
GROUP BY t.id, u.full_name, m.id, m.name
ORDER BY u.full_name ASC, m.id ASC;
```

### 3.3 Trainee At-Risk Heuristic Identification

Identifies enrolled trainees whose historical average percentage score falls strictly below the pass cutoff:

```sql
SELECT 
    t.id AS trainee_id,
    u.full_name AS trainee_name,
    b.name AS batch_name,
    COUNT(s.id) AS session_count,
    ROUND(AVG(CAST(s.score AS FLOAT) * 100.0 / CAST(m.max_score AS FLOAT)), 1) AS avg_score_pct
FROM trainees t
JOIN users u ON u.id = t.user_id
JOIN batches b ON b.id = t.batch_id
JOIN sessions s ON s.trainee_id = t.id
JOIN modules m ON m.id = s.module_id
WHERE b.id = :batch_id
GROUP BY t.id, u.full_name, b.name
HAVING AVG(CAST(s.score AS FLOAT) * 100.0 / CAST(m.max_score AS FLOAT)) < :pass_threshold
ORDER BY avg_score_pct ASC;
```

### 3.4 Curriculum Defect Diagnostics Query

Computes error distributions across modules for an individual trainee:

```sql
SELECT 
    m.name AS module_name,
    ROUND(AVG(s.errors), 1) AS avg_errors,
    COUNT(s.id) AS session_count
FROM sessions s
JOIN modules m ON m.id = s.module_id
WHERE s.trainee_id = :trainee_id
GROUP BY m.id, m.name
ORDER BY avg_errors DESC, m.name ASC;
```

---

## 4. Design Decisions

### 4.1 Centralized Grading Threshold Policy
The threshold parameters (`PASS_THRESHOLD = 60.0%`, `EXCELLENT_THRESHOLD = 75.0%`) are defined in shared constants files (`app/core/constants.py` on backend, `frontend/src/constants/thresholds.js` on frontend). All aggregate queries, alert rules, and badge renderings evaluate against these exact numbers, preventing discrepancy between cohort summaries and individual reports.

### 4.2 Two-Tier Early Risk Detection
Machine learning classifiers require sufficient historical data to generate reliable predictions. The portal implements a standalone risk prediction service (`GET /analytics/trainees/{id}/risk`) with graceful degradation:
- The endpoint returns `method: "ml"` or `method: "rule"`.
- Rule-based evaluation applies whenever a trainee has completed fewer than 5 assessment sessions, has no recorded history, or when the external machine learning microservice is unreachable or timed out (2.0-second network deadline).
- Under rule fallback, the cutoff evaluates against `PASS_THRESHOLD` (60.0% average score), and probabilities are strictly omitted (`probability: null`).
- When a trainee has 5 or more recorded sessions and the microservice responds successfully, the prediction returns `method: "ml"`, the model probability of at-risk outcome, and the decision cutoff (0.67 for the champion machine learning model).
- Feature importances returned by the endpoint represent global feature importance across the entire trained model artifact, rather than an individualized causal explanation for that specific trainee.

### 4.3 Atomic Two-Phase Batch CSV Import
File uploads undergo a dry-run validation pass before database persistence. Rows are checked for trainee existence, module bounds, date validity, and duplicate entries. If any row contains an error, the commit action is disabled, preventing partial database corruption.

### 4.4 Shared Dashboard State Components
The user interface replaces ad-hoc loading spinners and empty placeholders with a unified set of three state components (`LoadingState`, `EmptyState`, `ErrorState`). These components are applied consistently across Admin, Trainer, and Trainee dashboards, preserving layout structure during network operations.

### 4.5 Role-Gated Data Access
Trainees can inspect only their own individual dossier, session ledger, and learning goals. Trainees are prevented from viewing cohort attention queues, inspecting other trainees' risk scores, creating evaluation sessions, or assigning remediations through backend route guards and frontend interface hiding.

---

## 5. Evaluation Results

The machine learning early-warning model was evaluated using a GroupShuffleSplit partition grouped by trainee identifier:

### 5.1 Protocol

- **Dataset**: `backend/app/ml/dataset.csv` contains 677 decision-point rows from 39 trainees who completed at least 7 assessment sessions (216 positive cases, 31.9% overall positive rate). Each row represents a decision point at session k (k >= 5), using historical features computed strictly before session k.
- **Ground Truth Target**: Binary label equal to 1 if the arithmetic mean score percentage of the subsequent 2 sessions (sessions k + 1 and k + 2) is strictly below `PASS_THRESHOLD` (60.0%), and 0 otherwise.
- **Grouped Split**: Evaluated on a strictly isolated test set split with `GroupShuffleSplit` (test size 0.20, fixed random state 42, grouped by trainee identifier).
  - Training Set: 31 trainees, 522 rows, 184 positive cases (35.2% positive rate).
  - Test Set: 8 trainees, 155 rows, 32 positive cases (20.6% positive rate).
- **Candidate Models and Threshold Selection**: Models were evaluated on the training set using 5-fold `GroupKFold` cross-validation grouped by trainee identifier. Decision boundaries were selected on out-of-fold cross-validation predictions to achieve recall >= 0.80 with highest precision (0.53 for standardized Logistic Regression, 0.67 for Random Forest with 200 estimators).

### 5.2 Performance Comparison

The test results copied directly from `backend/app/ml/model_results.json` are summarized below:

| Model | Test Rows | Test Trainees | Cutoff | Precision | Recall | F1 Score | ROC-AUC | PR-AUC | Confusion Matrix (TN, FP, FN, TP) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Majority Baseline | 155 | 8 | - | 0.0000 | 0.0000 | 0.0000 | 0.5000 | 0.2065 | [[123, 0], [32, 0]] |
| Rule Baseline | 155 | 8 | 60.0% | 0.8649 | 1.0000 | 0.9275 | 0.9797 | 0.8649 | [[118, 5], [0, 32]] |
| Logistic Regression | 155 | 8 | 0.53 | 0.9412 | 1.0000 | 0.9697 | 0.9995 | 0.9982 | [[121, 2], [0, 32]] |
| Random Forest | 155 | 8 | 0.67 | 0.9412 | 1.0000 | 0.9697 | 1.0000 | 1.0000 | [[121, 2], [0, 32]] |

### 5.3 Analysis

- The held-out test set contains 8 trainees, 155 rows, and 32 positive cases.
- All 32 positive cases were identified by both the rule baseline and the machine learning models (recall 1.0000).
- The difference between the rule baseline (5 false positives) and the machine learning models (2 false positives) amounts to exactly 3 rows out of 155.
- On a test set of 8 trainees and 32 positive instances, a 3-row difference is within statistical sampling noise.
- Model metrics on the test partition were computed three times during development (during initial threshold candidate inspection, pipeline execution, and JSON formatting verification), while candidate model settings and decision boundaries remained fixed on training cross-validation.

### 5.4 Model Card Reference and Limitations
Role tag: all

Detailed documentation of model architecture, features, and verification checks is available in [MODEL_CARD.md](backend/app/ml/MODEL_CARD.md). The model card establishes seven explicit operational limitations:
1. Synthetic Data: Assessment sessions originate from synthetic data generation scripts rather than authentic human classroom behavior.
2. Small Test Set: Evaluated on 8 trainees and 32 positive instances; the 3-row difference between rule baseline and models is within statistical noise.
3. Shared Cutoff: The label uses the identical 60.0% cutoff as the rule baseline, meaning the model learns consistency with that cutoff rather than an independent educational outcome.
4. Proxy Target: The target is a short-term proxy (average score on the next 2 sessions) rather than course completion, graduation, or employment placement.
5. High AUC Caveat: Perfect and near-perfect test ROC-AUC scores (0.9995 for Logistic Regression, 1.0000 for Random Forest) reflect simplicity and consistency in the synthetic generator and must not be interpreted as guaranteed generalization to real cohorts.
6. No Real Student Data: The model has not been calibrated or tested on authentic human learner populations.
7. Development Test Exposures: Test set metrics were computed three times during development iteration.

---

## 6. Help Assistant Documentation Search Architecture and Evaluation
Role tag: all

### Search Architecture

The Help Assistant (`GET /help/search`, `GET /help/assistant`) is implemented as an inverted index keyword search engine over structured markdown documentation chunks:
- Indexing Pipeline: Markdown headers and sections are parsed into normalized text documents. Documents are tokenized, case-folded, filtered for standard stop words, and indexed by term frequency.
- Query Resolution: Queries undergo lexical token matching and TF-IDF scoring against document terms. Queries containing role filters (`role:trainer`, `role:trainee`, `role:admin`) filter matching candidate chunks before scoring.
- Architectural Nature: The Help Assistant is strictly a keyword retrieval engine over curated documentation text. It is not a large language model or generative neural network. It cannot synthesize novel prose, infer unstated facts, or answer questions that lie outside the indexed documentation.

### Known Retrieval Limits

- Vocabulary Sensitivity: Because retrieval depends on exact token matching, queries that use synonyms not present in the index may fail to retrieve relevant sections.
- Syntactic Rigidity: Phrasing variations without term overlap cannot be resolved semantically.
- Boundary Enforcement: Questions targeting internal system secrets, database credentials, or prompt injection patterns are rejected through deterministic rule gates.

### Benchmark Evaluation on Fresh Unseen Set

The search engine was evaluated on a fresh, previously unseen benchmark set of query prompts:
- Hit@1: 3/5 (60.0%)
- Hit@3: 4/5 (80.0%)
- Role Violations: 0/5 (0.0% unauthorized disclosures)
- Adversarial Refusal: 5/5 (100.0% successful rejection of unauthorized access queries)

Earlier benchmark figures showing 100% retrieval precision were obtained from development and tuning sets used during initial index construction. The fresh unseen benchmark demonstrates realistic retrieval performance on novel formulations.

---

## 6. Limitations

### 6.1 Small Dataset Volume for Machine Learning
The benchmark cohort consists of qualified trainees and positive instances. While adequate for operational tracking, this sample volume limits the machine learning model from learning non-linear interactions beyond simple moving averages. Frontend risk component verification is confirmed via clean production builds and static audits rather than an end-to-end browser suite.

### 6.2 Application-Layer Audit Log Immutability
Immutability of the `audit_logs` table is enforced at the repository and service interface level. Database-level immutability triggers and hardware-enforced write-once storage are not implemented.

### 6.3 Database Schema Migration Constraints
When using SQLite with SQLAlchemy, `Base.metadata.create_all()` creates missing tables but does not alter pre-existing tables. Introducing new columns requires a full database reseed (`python scripts/seed.py --reset`) or manual DDL migration.

### 6.4 Simulated Real-Time Communication
Dashboard state synchronization utilizes local component updates and polling intervals rather than dedicated WebSocket servers or Server-Sent Events in production environments.
