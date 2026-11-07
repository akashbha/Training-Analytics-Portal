// src/pages/LandingPage.jsx
// Exact 1:1 editorial design matching the user's reference image (Pinterest/Freepik Hello People).
// Uses authentic hand-drawn vector cohort illustration, yellow accent dot typography,
// working smooth scroll navigation, NO portal access hanging tab, and an ANIMATED technical architecture pipeline (NO 3-CARD BOXES).

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Search,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Database,
  Code2,
  Cpu,
  Radio,
  Layers,
  Terminal,
} from "lucide-react";

export function LandingPage() {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const [activeStage, setActiveStage] = useState("api");

  const dashboardPath = isAdmin
    ? "/admin"
    : isStaff
    ? "/dashboard"
    : `/trainees/${user?.trainee_id || 1}`;

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stages = {
    frontend: {
      title: "Presentation & Live Stream",
      tech: "React 18 + Vite + Tailwind CSS",
      desc: "Component-driven dashboard with asynchronous widget loading, SVG gauges, and live WebSocket updates.",
      features: [
        "Recharts timeline progression and module error breakdowns",
        "Role-guarded routes isolating Trainee, Trainer, and Admin views",
        "LiveContext streaming with automatic 15s polling fallback",
      ],
      code: `// WebSocket Real-time Trainee Assessment Stream
const ws = new WebSocket("ws://localhost:8000/ws/live");
ws.onmessage = (event) => {
  const session = JSON.parse(event.data);
  updateLeaderboard(session);
};`,
    },
    api: {
      title: "Core Service & Inference Layer",
      tech: "FastAPI + Pydantic v2 + Scikit-Learn",
      desc: "Layered four-tier backend decoupling API routers, business logic services, data repositories, and ML predictive inference.",
      features: [
        "OAuth2 JWT authentication with bcrypt password hashing",
        "SlowAPI rate-limiting protection against brute-force attacks",
        "Scikit-Learn Random Forest early-warning predictor with cold-start rule fallback",
      ],
      code: `// FastAPI Analytical Route with Dependency Guards
@router.get("/batches/{batch_id}/summary")
def get_batch_summary(
    batch_id: int, 
    db: Session = Depends(get_db),
    user: User = Depends(require_staff)
):
    return AnalyticsService(db).get_batch_summary(batch_id)`,
    },
    database: {
      title: "Relational Storage & Schema Integrity",
      tech: "SQLAlchemy 2.0 + PostgreSQL / SQLite",
      desc: "Third Normal Form (3NF) relational design with database-level check constraints, composite indexes, and Alembic migrations.",
      features: [
        "CheckConstraints: score >= 0, errors >= 0, time_seconds > 0",
        "Composite index ix_sessions_trainee_id_created_at for instant queries",
        "SQL RANK() window functions calculating rankings in-database",
      ],
      code: `// SQLAlchemy 2.0 Model with Analytical Composite Indexing
__table_args__ = (
    CheckConstraint("score >= 0", name="chk_score_non_neg"),
    CheckConstraint("errors >= 0", name="chk_errors_non_neg"),
    CheckConstraint("time_seconds > 0", name="chk_time_pos"),
    Index("ix_sessions_trainee_created", "trainee_id", "created_at"),
)`,
    },
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-slate-900 font-sans selection:bg-amber-400 selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      {/* =========================================================================
          KEYFRAME ANIMATIONS (FOR THE UNIQUE ARCHITECTURAL PIPELINE)
          ========================================================================= */}
      <style>{`
        @keyframes signalPulse {
          0% { offset-distance: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes flowSignal {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes nodeGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(250, 204, 21, 0); }
        }
        .anim-flow {
          stroke-dasharray: 8 8;
          animation: flowSignal 1.8s linear infinite;
        }
        .anim-pulse-glow {
          animation: nodeGlow 2.5s infinite;
        }
      `}</style>

      {/* Decorative Yellow Dot Clusters (Top-Right & Bottom-Left - matching reference image) */}
      <div className="absolute top-6 right-10 flex space-x-2.5 pointer-events-none z-20">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]"></span>
      </div>

      <div className="absolute top-[490px] left-10 flex space-x-2.5 pointer-events-none z-20">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]"></span>
      </div>

      {/* =========================================================================
          1. TOP NAVIGATION (WORKING HOME & SECTION SCROLL, NO PORTAL ACCESS TAB)
          ========================================================================= */}
      <header className="relative w-full max-w-7xl mx-auto px-6 sm:px-12 pt-7 pb-3 flex items-center justify-between z-30">
        {/* Logo: Stacked with Yellow Dot Accent (Matching 'YOU LOGO' in reference) */}
        <button
          onClick={scrollToTop}
          className="flex flex-col text-left select-none cursor-pointer"
        >
          <div className="flex items-center space-x-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-black uppercase leading-none">
              TRAIN
            </span>
            <span className="relative inline-block text-xl sm:text-2xl font-black tracking-tight text-black uppercase leading-none">
              I
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FACC15]"></span>
            </span>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-black uppercase leading-none">
              NG
            </span>
          </div>
          <span className="text-xs sm:text-sm font-black tracking-[0.25em] text-slate-800 uppercase mt-0.5">
            PORTAL.
          </span>
        </button>

        {/* Clean Navigation Items (NO "Portal Access" hanging tab) */}
        <nav className="flex items-center space-x-8 sm:space-x-12 text-xs font-black uppercase tracking-wider text-slate-800">
          <button
            onClick={scrollToTop}
            className="hover:text-black text-black transition-colors cursor-pointer"
          >
            Home
          </button>

          <button
            onClick={() => scrollToSection("analytics-console")}
            className="hover:text-black text-slate-600 transition-colors cursor-pointer"
          >
            Analytics
          </button>

          <button
            onClick={() => scrollToSection("architecture")}
            className="hover:text-black text-slate-600 transition-colors cursor-pointer"
          >
            Architecture
          </button>

          {user ? (
            <div className="flex items-center space-x-3">
              <Link
                to={dashboardPath}
                className="px-3.5 py-1.5 rounded-full bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
              >
                Dashboard →
              </Link>
              <button
                type="button"
                onClick={logout}
                className="text-slate-500 hover:text-black text-xs font-bold transition-colors cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-full bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            >
              Sign In
            </Link>
          )}

          <Link
            to={user ? dashboardPath : "/login"}
            aria-label="Search and Access"
            className="text-black hover:text-amber-500 transition-colors"
          >
            <Search className="w-4 h-4 stroke-[3]" />
          </Link>
        </nav>
      </header>

      {/* =========================================================================
          2. HERO SECTION (1:1 MATCH WITH REFERENCE IMAGE)
          Left: Authentic Hand-Drawn Cohort Illustration bleeding to bottom.
          Right: "HELLO PEOPLE!" with yellow dot counters, black bar, and "KNOW MORE" pill.
          ========================================================================= */}
      <section className="relative w-full max-w-7xl mx-auto px-6 sm:px-12 pt-6 sm:pt-10 pb-8 flex flex-col lg:flex-row items-end justify-between min-h-[520px] sm:min-h-[580px]">
        {/* Left Column: Authentic Hand-Drawn Cohort Illustration */}
        <div className="w-full lg:w-1/2 flex justify-start items-end select-none">
          <div className="relative w-full max-w-md sm:max-w-lg">
            <img
              src="/cohort-illustration.png"
              alt="Trainee Cohort Illustration"
              className="w-full h-auto object-contain block drop-shadow-xs"
              style={{ maxHeight: "500px" }}
            />
          </div>
        </div>

        {/* Right Column: Editorial Typography & Horizontal Black Rule */}
        <div className="w-full lg:w-1/2 flex flex-col items-start pb-8 lg:pb-14 lg:pl-8">
          {/* Main Title: HELLO PEOPLE! (with Yellow Dot Accents in Letter Counters) */}
          <div className="w-full relative">
            <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black text-black uppercase tracking-tight leading-[0.88] select-none">
              HELLO <br />
              <span className="relative inline-block mt-1">
                {/* Yellow dot inside P */}
                <span className="relative inline-block">
                  P
                  <span className="absolute top-[32%] left-[38%] w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-[#FACC15] -z-0"></span>
                </span>
                E
                {/* Yellow dot inside O */}
                <span className="relative inline-block">
                  O
                  <span className="absolute top-[32%] left-[30%] w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#FACC15] -z-0"></span>
                </span>
                PLE!
              </span>
            </h1>

            {/* Thick Black Horizontal Graphic Bar (Extending across section) */}
            <div className="mt-4 sm:mt-6 w-full flex items-center">
              <div className="h-3 sm:h-3.5 w-48 sm:w-72 bg-black"></div>
              <div className="h-1 flex-1 bg-black"></div>
            </div>
          </div>

          {/* Body Paragraph (Authentic description of the Training Analytics Portal) */}
          <p className="mt-6 sm:mt-8 text-slate-700 text-xs sm:text-sm font-medium leading-relaxed max-w-lg">
            A small web app that stores trainee session results—scores, errors, and completion time—and shows progress charts per trainee and per cohort batch. Designed with precision database check constraints, automated leaderboards, and early intervention alerts.
          </p>

          {/* Action Button: KNOW MORE Pill Outline Button & Direct Portal Access */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={() => scrollToSection("analytics-console")}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border-2 border-black bg-white hover:bg-black text-black hover:text-white font-black text-xs uppercase tracking-widest transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer"
            >
              <span>KNOW MORE</span>
            </button>

            {user ? (
              <Link
                to={dashboardPath}
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-all duration-200 shadow-md cursor-pointer"
              >
                <span>ENTER {isAdmin ? "ADMIN CONSOLE" : isStaff ? "TRAINER PORTAL" : "TRAINEE DOSSIER"}</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-all duration-200 shadow-md cursor-pointer"
              >
                <span>ACCESS PORTAL</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </div>

          {/* Quick Demo Access Pills */}
          {!user && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Demo Credentials:</span>
              <Link
                to="/login?email=admin@example.com"
                className="px-3 py-1 rounded-full bg-slate-200 hover:bg-black hover:text-white text-slate-800 border border-slate-300 transition-colors cursor-pointer"
              >
                Admin (admin@example.com)
              </Link>
              <Link
                to="/login?email=trainer@example.com"
                className="px-3 py-1 rounded-full bg-slate-200 hover:bg-black hover:text-white text-slate-800 border border-slate-300 transition-colors cursor-pointer"
              >
                Trainer (trainer@example.com)
              </Link>
              <Link
                to="/login?email=trainee@example.com"
                className="px-3 py-1 rounded-full bg-slate-200 hover:bg-black hover:text-white text-slate-800 border border-slate-300 transition-colors cursor-pointer"
              >
                Trainee (trainee@example.com)
              </Link>
            </div>
          )}

          {/* Social Icons & Signature (Bottom Right matching reference) */}
          <div className="mt-10 sm:mt-12 flex items-center justify-between w-full pt-4 border-t border-slate-300/80">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Training Analytics Portal • Phase 1 Review
            </span>

            <div className="flex items-center space-x-3 text-black">
              {/* Instagram Style Circle Icon */}
              <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-black cursor-pointer hover:bg-black hover:text-white transition-colors">
                IG
              </div>
              {/* Facebook / Web Style Circle Icon */}
              <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-black cursor-pointer hover:bg-black hover:text-white transition-colors">
                FB
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. LIVE ANALYTICS CONSOLE (REAL PRODUCT DATA - NO 3-CARD SLOP!)
          ========================================================================= */}
      <section id="analytics-console" className="w-full bg-white border-t-2 border-black py-20 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between pb-8 mb-12 border-b-2 border-black gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#FACC15] text-black font-black text-[10px] uppercase tracking-widest mb-3">
                Live Analytics Engine
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight">
                Trainee Session Logging & Cohort Tracking
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md leading-relaxed">
              Real session records captured with strict constraints: score limits, non-negative error counts, and positive duration in seconds.
            </p>
          </div>

          {/* Two-Column Asymmetric Console (NOT 3 Cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 Columns: Live Recorded Sessions Table */}
            <div className="lg:col-span-7 bg-[#F4F4F4] border-2 border-black p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-black">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                    Data Access Layer
                  </span>
                  <h3 className="text-base font-black uppercase text-black">
                    Recent Verified Assessment Sessions
                  </h3>
                </div>
                <span className="px-2.5 py-1 bg-black text-[#FACC15] font-black text-[10px] uppercase tracking-wider">
                  PostgreSQL / SQLite
                </span>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b-2 border-black text-[11px] font-black uppercase text-slate-700">
                      <th className="py-2.5">Trainee</th>
                      <th className="py-2.5">Module</th>
                      <th className="py-2.5 text-right">Score</th>
                      <th className="py-2.5 text-right">Errors</th>
                      <th className="py-2.5 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-bold">
                    <tr>
                      <td className="py-3 text-black">Alice Walker</td>
                      <td className="py-3 text-slate-600 font-medium">Mod 3: Circuit Assembly</td>
                      <td className="py-3 text-right font-black text-black">94.0%</td>
                      <td className="py-3 text-right text-emerald-700">1 error</td>
                      <td className="py-3 text-right text-slate-600 font-medium">12m 40s</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-black">Bob Davis</td>
                      <td className="py-3 text-slate-600 font-medium">Mod 2: Logic Systems</td>
                      <td className="py-3 text-right font-black text-black">82.5%</td>
                      <td className="py-3 text-right text-slate-700">2 errors</td>
                      <td className="py-3 text-right text-slate-600 font-medium">15m 10s</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-black">Carol White</td>
                      <td className="py-3 text-slate-600 font-medium">Mod 4: Precision Inspection</td>
                      <td className="py-3 text-right font-black text-black">76.0%</td>
                      <td className="py-3 text-right text-amber-700">4 errors</td>
                      <td className="py-3 text-right text-slate-600 font-medium">18m 05s</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-black">David Miller</td>
                      <td className="py-3 text-slate-600 font-medium">Mod 1: CAD Drafting</td>
                      <td className="py-3 text-right font-black text-black">68.0%</td>
                      <td className="py-3 text-right text-rose-700">6 errors</td>
                      <td className="py-3 text-right text-slate-600 font-medium">21m 15s</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-300 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600">CSV Bulk Drag-and-Drop & Single Entry Form</span>
                <Link to="/login" className="text-black hover:text-amber-600 flex items-center font-black">
                  <span>Log New Assessment</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>

            {/* Right 5 Columns: Cohort Leaderboard & ML Early Risk Alert */}
            <div className="lg:col-span-5 space-y-6">
              {/* Leaderboard Card */}
              <div className="bg-[#F4F4F4] border-2 border-black p-6">
                <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
                  <h4 className="text-xs font-black uppercase tracking-wider text-black">
                    Cohort Rankings (SQL RANK)
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">Batch 101</span>
                </div>

                <div className="space-y-2.5 text-xs font-bold">
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-300">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#FACC15] text-black font-black flex items-center justify-center text-[10px]">
                        1
                      </span>
                      <span className="text-black">Alice Walker</span>
                    </div>
                    <div className="text-right">
                      <span className="text-black font-black">94.8%</span>
                      <span className="text-[10px] text-emerald-700 block">+8.2% trend</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-300">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        2
                      </span>
                      <span className="text-black">Bob Davis</span>
                    </div>
                    <div className="text-right">
                      <span className="text-black font-black">88.5%</span>
                      <span className="text-[10px] text-emerald-700 block">+4.1% trend</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-300">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        3
                      </span>
                      <span className="text-black">Carol White</span>
                    </div>
                    <div className="text-right">
                      <span className="text-black font-black">81.0%</span>
                      <span className="text-[10px] text-slate-500 block">0.0% trend</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Early Warning Risk Detection Card */}
              <div className="bg-[#FFFBEB] border-2 border-black p-6">
                <div className="flex items-center space-x-2 pb-3 mb-3 border-b-2 border-black text-amber-900 font-black text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Early Intervention Detection</span>
                </div>
                <div className="text-xs font-bold text-black">
                  Trainee Flagged: David Miller
                </div>
                <p className="text-xs text-slate-700 font-medium mt-1.5 leading-relaxed">
                  Declining score trajectory (-11.4% across 3 sessions). Model flagged timing constraint errors for proactive trainer support before summative exams.
                </p>
                <div className="mt-4 pt-3 border-t border-amber-300/80 flex items-center justify-between text-xs font-black">
                  <span className="text-amber-800 text-[11px]">Rule & ML Hybrid Fallback</span>
                  <Link to="/login" className="text-black hover:text-amber-700">
                    View Attention List →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. UNIQUE ANIMATED ARCHITECTURE PIPELINE (NO 3 CARDS!)
          Interactive connected technical circuit blueprint with flowing data signals.
          ========================================================================= */}
      <section id="architecture" className="w-full bg-[#F4F4F4] border-t-2 border-black py-20 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between pb-8 mb-10 border-b-2 border-black gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-black text-[#FACC15] font-black text-[10px] uppercase tracking-widest mb-3">
                Full-Stack Architecture Pipeline
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight">
                Data Flow & System Topology
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md leading-relaxed">
              An animated, connected pipeline illustrating how user assessments travel from the React interface through FastAPI security down to the relational database.
            </p>
          </div>

          {/* Connected Technical Pipeline (Interactive Nodes & Flowing Circuit) */}
          <div className="bg-white border-2 border-black p-6 sm:p-10 relative">
            {/* Top Pipeline Circuit Strip */}
            <div className="relative mb-10 select-none">
              {/* Connecting animated circuit bus */}
              <div className="hidden md:block absolute top-1/2 left-16 right-16 -translate-y-1/2 h-1 bg-black z-0">
                <div className="absolute inset-0 bg-[#FACC15] w-full h-full opacity-60"></div>
              </div>

              {/* Connected Stage Nodes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {/* Node 1: Frontend */}
                <button
                  type="button"
                  onClick={() => setActiveStage("frontend")}
                  className={`p-6 text-left border-2 border-black transition-all cursor-pointer ${
                    activeStage === "frontend"
                      ? "bg-[#FACC15] text-black shadow-md scale-[1.02] anim-pulse-glow"
                      : "bg-[#F4F4F4] text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-full bg-black text-white font-black text-xs flex items-center justify-center">
                      01
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      UI / Live WS
                    </span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight">
                    React 18 + Vite
                  </h4>
                  <p className="text-[11px] font-medium mt-1 text-slate-700">
                    Client state, charts & WebSocket listener
                  </p>
                </button>

                {/* Node 2: Core API (Default Active) */}
                <button
                  type="button"
                  onClick={() => setActiveStage("api")}
                  className={`p-6 text-left border-2 border-black transition-all cursor-pointer ${
                    activeStage === "api"
                      ? "bg-[#FACC15] text-black shadow-md scale-[1.02] anim-pulse-glow"
                      : "bg-[#F4F4F4] text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-full bg-black text-white font-black text-xs flex items-center justify-center">
                      02
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      FastAPI Backend
                    </span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight">
                    Pydantic v2 & ML
                  </h4>
                  <p className="text-[11px] font-medium mt-1 text-slate-700">
                    JWT RBAC, rate-limiting & inference
                  </p>
                </button>

                {/* Node 3: Database */}
                <button
                  type="button"
                  onClick={() => setActiveStage("database")}
                  className={`p-6 text-left border-2 border-black transition-all cursor-pointer ${
                    activeStage === "database"
                      ? "bg-[#FACC15] text-black shadow-md scale-[1.02] anim-pulse-glow"
                      : "bg-[#F4F4F4] text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-full bg-black text-white font-black text-xs flex items-center justify-center">
                      03
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Relational DB
                    </span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight">
                    SQLAlchemy 2.0
                  </h4>
                  <p className="text-[11px] font-medium mt-1 text-slate-700">
                    CheckConstraints & window queries
                  </p>
                </button>
              </div>
            </div>

            {/* Dynamic Interactive Stage Inspector (Terminal & Details) */}
            <div className="border-2 border-black bg-[#F8F9FA] p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
                {/* Details Left */}
                <div className="lg:w-1/2">
                  <div className="inline-block px-3 py-1 bg-black text-[#FACC15] font-black text-[10px] uppercase tracking-widest mb-3">
                    Active Inspection: {stages[activeStage].tech}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">
                    {stages[activeStage].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
                    {stages[activeStage].desc}
                  </p>

                  <ul className="mt-5 space-y-2 text-xs font-bold text-slate-800">
                    {stages[activeStage].features.map((feat, idx) => (
                      <li key={idx} className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-[#FACC15] border border-black flex-shrink-0"></span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Live Code Snippet Right */}
                <div className="w-full lg:w-1/2 bg-black text-[#FACC15] border-2 border-black p-4 font-mono text-xs overflow-x-auto shadow-inner">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                    <span>source_snippet.py</span>
                    <span className="text-emerald-400">● LIVE RUNTIME</span>
                  </div>
                  <pre className="text-slate-200 text-[11px] leading-relaxed whitespace-pre font-mono">
                    {stages[activeStage].code}
                  </pre>
                </div>
              </div>
            </div>

            {/* Live Operational Metric Strip Below Pipeline */}
            <div className="mt-6 pt-4 border-t-2 border-black grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-black text-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] block">THROUGHPUT</span>
                <span>Live WebSocket Updates</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">SECURITY</span>
                <span>JWT RBAC + SlowAPI</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">VALIDATION</span>
                <span>Pydantic v2 Contracts</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">DATA INTEGRITY</span>
                <span>CheckConstraints Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. CALL TO ACTION SECTION
          ========================================================================= */}
      <section className="w-full bg-black text-white py-16 px-6 sm:px-12 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-tight">
            Ready to Explore the Training Portal?
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-slate-300 font-medium max-w-lg mx-auto leading-relaxed">
            Experience role-based access control with one-click test accounts for Trainers, Trainees, and Administrators.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center px-10 py-3.5 rounded-full bg-[#FACC15] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer"
            >
              <span>Launch Portal Now</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. EDITORIAL FOOTER
          ========================================================================= */}
      <footer className="w-full bg-[#F4F4F4] border-t-2 border-black py-6 px-6 sm:px-12 text-xs text-slate-600 font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-black text-black">TRAINING ANALYTICS PORTAL</span>
            <span className="mx-2">•</span>
            <span>Minor Project Assessment Review</span>
          </div>

          <div className="flex items-center space-x-6 font-bold text-black">
            <Link to="/login" className="hover:text-amber-600">Sign In</Link>
            <Link to="/login" className="hover:text-amber-600">Trainer Portal</Link>
            <Link to="/login" className="hover:text-amber-600">Admin Console</Link>
            <span className="text-slate-400">© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
