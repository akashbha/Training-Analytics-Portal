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
- **📜 Comprehensive Audit Logging**: Track state changes, role assignments, and session modifications for compliance and oversight.

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

## 📄 License

This project is licensed under the [MIT License](LICENSE).
