# 🎓 Training Analytics Portal

A full-stack, enterprise-grade training management and analytics portal designed for tracking trainee session performance, batch progress, evaluator scoring, and real-time operational metrics.

Built with **FastAPI** (Python) and **React** (Vite, Tailwind CSS, Recharts).

---

## 🌟 Key Features

- **📊 Comprehensive Analytics Dashboard**: Real-time visualization of cohort progress, score distributions, attendance metrics, and session trends powered by Recharts.
- **👥 Role-Based Access Control (RBAC)**: Secure JWT-based authentication distinguishing Admins, Trainers/Mentors, and Trainees.
- **📚 Batch & Module Management**: Organize trainees into structured batches, modules, and learning paths with curriculum tracking.
- **📝 Session Evaluations & Scoring**: Record granular session feedback, milestone assessments, and detailed scoring criteria.
- **⚡ Real-Time Operational Activity**: WebSocket integration for live notifications, status changes, and trainee progress updates.
- **🛡️ Enterprise Security & Rate Limiting**: SlowAPI protection against brute force and abuse, CORS validation, and robust input validation via Pydantic v2.
- **📜 Append-Only Audit Logging**: Track state changes, role assignments, and session modifications for compliance and oversight.

---

## 🎯 Grading & Evaluation Policy

The portal enforces a centralized, single-source-of-truth threshold policy across all backend SQL queries, analytical services, and frontend dashboards:

| Constant | Value | Definition & Enforcement |
| :--- | :--- | :--- |
| **`PASS_THRESHOLD`** | **`60.0%`** | Minimum percentage score required to pass an individual assessment drill. Also used for cohort-wide pass rate computations (`pass_rate_pct`) and identifying batches below target (`batches_below_target` flagged when cohort mean $< 60.0\%$). |
| **`EXCELLENT_THRESHOLD`** | **`75.0%`** | Benchmark for trainee excellence and mastery tier classification across cohort score bands (`get_batch_bands`) and dashboard milestone indicators. |
| **`COLD_START_SESSIONS`** | **`3`** | Minimum number of completed assessments required before activating the ML early-intervention classifier. |
| **`COLD_START_CUTOFF`** | **`50.0%`** | Rule-based heuristic fallback threshold. Trainees with $< 3$ sessions and an initial average $< 50.0\%$ are immediately flagged for attention without waiting for ML training data. |

Both individual assessment qualification and batch aggregate pass rates evaluate strictly against the identical **`60.0%`** cutoff (`PASS_THRESHOLD`), guaranteeing consistency between personal trainee dossiers and platform-level administrator/trainer analytics.

---

## 🏗️ Architecture & Project Structure

```text
training-analytics-portal/
├── backend/                       # FastAPI Backend (Python)
│   ├── alembic/                   # Database migrations and revision scripts
│   ├── alembic.ini                # Alembic configuration
│   ├── app/
│   │   ├── core/                  # Security (JWT), configuration, and rate limiting
│   │   ├── db/                    # SQLAlchemy engine, session factory, and seed data
│   │   ├── models/                # Database entities (User, Batch, Trainee, Session, etc.)
│   │   ├── repositories/          # Data access layer and query abstractions
│   │   ├── routers/               # API endpoints (auth, analytics, batches, trainees, sessions)
│   │   ├── schemas/               # Pydantic models for request/response validation
│   │   └── services/              # Business logic and aggregation services
│   ├── scripts/                   # Data simulation and utility scripts
│   ├── tests/                     # Pytest suite for backend APIs and services
│   ├── requirements.txt           # Python backend dependencies
│   └── .env.example               # Backend environment variable template
│
├── frontend/                      # React Frontend Application (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/                   # Axios API clients and interceptors
│   │   ├── components/            # Reusable UI widgets, cards, charts, and tables
│   │   ├── context/               # AuthProvider and LiveContext (WebSockets)
│   │   ├── hooks/                 # Custom React hooks (real-time updates, analytics)
│   │   ├── pages/                 # Full dashboard pages (Admin, Trainee, Sessions, Batches)
│   │   ├── App.jsx                # Application routing and role guards
│   │   ├── index.css              # Global styles and Tailwind imports
│   │   └── main.jsx               # React DOM entry point
│   ├── index.html                 # HTML5 document template
│   ├── package.json               # Frontend dependencies and scripts
│   ├── vite.config.js             # Vite bundler configuration
│   ├── tailwind.config.js         # Tailwind CSS design system configuration
│   ├── postcss.config.js          # PostCSS plugins
│   └── .env.example               # Frontend environment variable template
│
├── package.json                   # Root monorepo orchestration scripts
├── .gitignore                     # Repository-wide ignore rules
├── LICENSE                        # MIT License
└── README.md                      # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites

Ensure you have the following installed:
- **Node.js** (v18.0.0 or higher) & **npm**
- **Python** (v3.10 or higher)
- **PostgreSQL** (v14 or higher)

---

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/training-analytics-portal.git
cd training-analytics-portal
```

---

### 2. Backend Setup (FastAPI)

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` with your PostgreSQL database credentials and a secure `SECRET_KEY`.*

5. Run database migrations & seed initial sample data:
   ```bash
   alembic upgrade head
   python -m app.db.seed
   ```

6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *API documentation will be accessible at: `http://localhost:8000/docs`*

---

### 3. Frontend Setup (React + Vite)

You can run the frontend in two ways:

#### Option A: Directly from root (Convenient)
```bash
npm install
npm run dev
```

#### Option B: From the `frontend` folder
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

*The application will be live at `http://localhost:3000`.*

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg2://postgres:postgres@localhost:5432/training_portal` |
| `SECRET_KEY` | Secret key for JWT signing | *Random secure secret string* |
| `ALGORITHM` | JWT hashing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifespan in minutes | `1440` (24 hours) |
| `ALLOWED_ORIGINS` | Permitted CORS frontend origins | `http://localhost:3000,http://127.0.0.1:3000` |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base HTTP endpoint for the backend API | `http://localhost:8000` |
| `VITE_WS_URL` | Base WebSocket endpoint for live updates | `ws://localhost:8000` |

---

## 📡 API Documentation

Once the backend server is running, interactive API documentation is automatically generated:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🛠️ Scripts & Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the frontend dev server from root |
| `npm run build` | Compiles frontend production assets |
| `cd backend && uvicorn app.main:app --reload` | Starts the backend API server |
| `cd backend && python -m app.db.seed` | Seeds database with initial batches and users |
| `cd backend && pytest` | Runs the backend test suite |

---

## ⚠️ Technical Notes & Limitations

- **Dashboard Demo States (Development Only)**: The state switcher pills and simulated query parameters (`?state=loading`, `?state=empty`, `?state=error`) on the Trainer console are development-only verification tools gated strictly by `import.meta.env.DEV`. In production builds, the UI pill switcher is excluded from the bundle and the `?state=` query parameter is ignored, ensuring live production telemetry is always rendered.
- **Audit Log Append-Only Scope**: The append-only invariant is strictly enforced at the **application layer** via the `AuditRepository` and service interfaces (which forbid update and delete operations). Direct manipulation via database administrative tools or raw SQL access is outside the scope of application-level guards.
- **Database Schema & Migrations**: While `Base.metadata.create_all()` automatically creates missing tables on application startup (such as `remediations`), it does not add new columns to pre-existing tables. For SQLite databases created prior to Step 4, the `audit_logs.actor_id` column requires either reseeding via `python scripts/seed.py --reset` or applying a manual SQL statement (`ALTER TABLE audit_logs ADD COLUMN actor_id INTEGER REFERENCES users(id)`).
- **Model Evaluation Empirical Benchmark**: The ML early-warning predictor (Random Forest) is empirically evaluated against a transparent baseline heuristic rule ("flag if historical average $< 60.0\%$") using chronological holdout (the last 2 sessions held out as test data for all trainees with $\ge 5$ sessions). On the benchmark cohort ($N = 41$ trainees, 12 ground-truth positive "at-risk" labels), the baseline rule achieved an F1 of **0.8276** (precision: 0.7059, recall: 1.0000) versus the ML model F1 of **0.8000** (precision: 0.6667, recall: 1.0000). Because a difference of just 1 false positive across 41 samples shifts precision by $\sim 0.04$, the 0.83 vs 0.80 margin is well within statistical sampling noise. Both models utilize the identical earlier-session historical window for an apples-to-apples comparison. In accordance with platform governance policy, no artificial hyperparameter tuning was applied. `backend/app/ml/evaluation.json` serves as the committed snapshot from this seed.
- **SQLite DateTime Adapter Warning**: The `DeprecationWarning` observed during SQLite test runs originates in our code (`backend/app/repositories/analytics_repository.py`), where Python `datetime` objects are passed directly as bind parameters to raw SQL text queries. Resolution is scheduled as a cleanup item to bind via SQLAlchemy typed expressions or explicit ISO-formatted strings.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
