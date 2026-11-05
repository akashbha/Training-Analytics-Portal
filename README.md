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

## Features and Operational Limits

- **Role-Based Authentication**: Supports Admin, Trainer, and Trainee roles via JSON Web Tokens; tokens expire after 24 hours and self-service password reset is not supported.
- **Trainer Dashboard**: Displays cohort statistics, batch cards, module performance heatmaps, and at-risk candidate alerts; it only computes metrics for active batches assigned to the logged-in trainer.
- **Trainee Profile and Dossier**: Displays historical progress curves, module defect analysis, speed versus accuracy scatter plots, and personal learning targets; it restricts trainees to viewing only their own individual performance data.
- **Admin Management and System Oversight**: Provides batch overviews, account management, system audit logs, and machine learning model evaluation metrics; system audit logs cannot be edited or deleted through the interface.
- **Session Recording**: Trainers can manually record individual evaluation sessions with score, error count, and duration; sessions cannot exceed the module maximum score or contain negative defect counts.
- **Batch CSV Import**: Allows trainers to bulk-import assessment sessions from CSV files with row-level validation; the entire batch import is rejected if any single row contains validation errors or module score overages.
- **Remediation Assignment**: Trainers can assign targeted improvement drills to trainees scoring below pass threshold; remediations are read-only for trainees and cannot be marked completed directly by trainees.
- **Module Learning Goals**: Trainees can configure target percentage scores per curriculum module and monitor progress; goals are advisory milestones and do not alter official pass or fail classifications.
- **Early-Warning Risk Detection**: Flags trainees at risk of failing based on either a trained machine learning model or cold-start heuristic rules; the machine learning model evaluates only trainees with three or more recorded sessions.

---

## Development Demo States Note

The state switcher pills and simulated query parameters (`?state=loading`, `?state=empty`, `?state=error`) on the Admin, Trainer, and Trainee dashboards are development-only verification tools gated by `import.meta.env.DEV`. In production builds, the UI pill switcher is excluded from the bundle and the `?state=` query parameter is ignored, ensuring live production telemetry is always rendered.

---

## Known Limitations

- **Machine Learning Evaluation Outcome**: The machine learning early-warning model (Random Forest) did not beat the baseline heuristic rule ("flag if historical average < 60.0%") on 41 trainees and 12 positives (baseline F1: 0.8276 vs ML F1: 0.8000), with differences remaining within statistical sampling noise.
- **Audit Log Append-Only Scope**: Audit logging is append-only at the application layer only via repository interfaces; database-level immutability triggers or external database administrator access restrictions are not implemented.
- **Database Schema and Migrations**: The `audit_logs.actor_id` column requires a database reseed (`python scripts/seed.py --reset`) on old databases because automatic table creation (`Base.metadata.create_all`) does not alter pre-existing tables.
- **SQLite DateTime Parameter Warnings**: Deprecation warnings during SQLite test execution occur because raw Python datetime objects are bound directly in specific text SQL queries; these will be migrated to SQLAlchemy typed expressions or explicit ISO strings in future maintenance.

---

## License

This project is licensed under the MIT License.
