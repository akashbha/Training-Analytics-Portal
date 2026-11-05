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

- **Centralized Grading Threshold Policy**: The threshold parameters (`PASS_THRESHOLD = 60.0%`, `EXCELLENT_THRESHOLD = 75.0%`) are defined in shared constants files (`app/core/constants.py` on backend, `frontend/src/constants/thresholds.js` on frontend). All aggregate queries, alert rules, and badge renderings evaluate against these exact numbers, preventing discrepancy between cohort summaries and individual reports.
- **Two-Tier Early Risk Detection**: Machine learning classifiers require historical data to generate reliable predictions. To address cold starts, the system employs a two-tier strategy: trainees with fewer than 3 sessions are evaluated via a heuristic rule (`COLD_START_CUTOFF = 50.0%`), while trainees with 3 or more sessions are evaluated using the trained machine learning model.
- **Atomic Two-Phase Batch CSV Import**: File uploads undergo a dry-run validation pass before database persistence. Rows are checked for trainee existence, module bounds, date validity, and duplicate entries. If any row contains an error, the commit action is disabled, preventing partial database corruption.
- **Shared Dashboard State Components**: The user interface replaces ad-hoc loading spinners and empty placeholders with a unified set of three state components (`LoadingState`, `EmptyState`, `ErrorState`). These components are applied consistently across Admin, Trainer, and Trainee dashboards, preserving layout structure during network operations.
- **Role-Gated Data Access**: Trainees can inspect only their own individual dossier, session ledger, and learning goals. Trainees are prevented from creating evaluation sessions or assigning remediations through backend route guards and frontend interface hiding.

---

## 5. Evaluation Results

The machine learning early-warning predictor was evaluated using a rigorous chronological holdout methodology:

### 5.1 Protocol

- **Sample Population**: 41 trainees with 5 or more recorded sessions.
- **Holdout Partition**: The last 2 sessions in chronological order were held out as the test evaluation set. All earlier sessions were used as historical input features.
- **Ground Truth Target**: A trainee was labeled "at-risk" if their average percentage score across the 2 held-out sessions was strictly below `PASS_THRESHOLD` (60.0%). This produced 12 positive cases and 29 negative cases.
- **Baseline Heuristic Rule**: Flagged as at-risk if the trainee's average score across earlier sessions was strictly below `60.0%`.
- **Machine Learning Model**: Random Forest classifier trained on earlier session summary features (mean score, score slope, error rate, pacing).

### 5.2 Performance Comparison

| Metric | Baseline Rule | Random Forest Model |
| :--- | :--- | :--- |
| **Precision** | `0.7059` (12 / 17) | `0.6667` (12 / 18) |
| **Recall** | `1.0000` (12 / 12) | `1.0000` (12 / 12) |
| **F1 Score** | `0.8276` | `0.8000` |
| **True Positives** | 12 | 12 |
| **False Positives** | 5 | 6 |
| **True Negatives** | 24 | 23 |
| **False Negatives** | 0 | 0 |

### 5.3 Analysis

The machine learning model did not beat the baseline heuristic rule. Both approaches identified all 12 at-risk trainees (100% recall). The difference between the two approaches amounts to a single additional false positive generated by the Random Forest model (6 false positives versus 5 for the baseline). On a sample size of 41 trainees, a difference of 1 classification shifts precision by approximately 0.04, indicating that performance differences remain within statistical sampling noise. In accordance with project requirements, no artificial hyperparameter tuning was applied.

---

## 6. Limitations

- **Small Dataset Volume for Machine Learning**: The benchmark cohort consists of 41 qualified trainees and 12 positive instances. While adequate for operational tracking, this sample volume limits the machine learning model from learning non-linear interactions beyond simple moving averages.
- **Application-Layer Audit Log Immutability**: Immutability of the `audit_logs` table is enforced at the repository and service interface level. Database-level immutability triggers and hardware-enforced write-once storage are not implemented.
- **Database Schema Migration Constraints**: When using SQLite with SQLAlchemy, `Base.metadata.create_all()` creates missing tables but does not alter pre-existing tables. Introducing new columns (such as `audit_logs.actor_id`) requires a full reseed (`python scripts/seed.py --reset`) or manual DDL migration.
- **Simulated Real-Time Communication**: Dashboard state synchronization utilizes local component updates and polling intervals rather than enterprise WebSocket servers or Server-Sent Events in production environments.
