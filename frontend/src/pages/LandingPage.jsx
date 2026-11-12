import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  ArrowRight,
  ChevronRight,
  Code2,
  Database,
  Layers,
  Lock,
  Radio,
  ShieldCheck,
  Terminal,
  Users,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import "./../components/landing/landingAnimations.css";
import { OrbitalRing } from "../components/landing/OrbitalRing.jsx";
import { InteractiveRoleDeck } from "../components/landing/InteractiveRoleDeck.jsx";
import { WorkflowPreviewSection } from "../components/landing/WorkflowPreviewSection.jsx";
import { useRevealOnScroll } from "../components/landing/useRevealOnScroll.js";

const IMPACT_CARDS = [
  {
    value: "3-Tier",
    label: "Role-Scoped Access Control",
    stepOffset: "lg:mt-0",
    tone: "from-[#F2F1EE] to-[#ECEAE5]",
    Icon: ShieldCheck,
  },
  {
    value: "Live",
    label: "WebSocket Cohort Stream",
    stepOffset: "lg:mt-8",
    tone: "from-[#ECEAE6] to-[#E4E1DB]",
    Icon: Radio,
  },
  {
    value: "0",
    label: "Masked Error States",
    stepOffset: "lg:mt-16",
    tone: "from-[#E6E4DF] to-[#DCD9D2]",
    Icon: Lock,
  },
  {
    value: "100%",
    label: "Audit-Logged Admin Actions",
    stepOffset: "lg:mt-24",
    tone: "from-[#DFDDD7] to-[#D4D1C9]",
    Icon: Database,
  },
];

const ARCH_STAGES = {
  frontend: {
    label: "Presentation Layer",
    tech: "React 18 · Vite · Tailwind",
    desc: "Modular dashboards with explicit loading, empty, and error contracts plus WebSocket sync.",
    code: `// Real-time cohort assessment subscription
const ws = new WebSocket(\`\${WS_BASE}/ws/live\`);
ws.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  if (payload.type === "session_recorded") refreshCohort();
};`,
  },
  api: {
    label: "Core API & Advisory ML",
    tech: "FastAPI · Pydantic · Scikit-Learn",
    desc: "Strict server-verified RBAC, rate-limited auth, and Random Forest risk prediction with explicit rule fallback.",
    code: `@router.get("/batches/{batch_id}/summary")
def get_batch_summary(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff)
):
    return AnalyticsService(db).get_batch_summary(batch_id)`,
  },
  database: {
    label: "Relational Schema",
    tech: "SQLAlchemy 2.0 · Postgres / SQLite",
    desc: "Normalized 3NF tables with database check constraints, composite indexes, and Alembic tracking.",
    code: `__table_args__ = (
    CheckConstraint("score >= 0", name="chk_score_non_neg"),
    CheckConstraint("errors >= 0", name="chk_errors_non_neg"),
    CheckConstraint("time_seconds > 0", name="chk_time_pos"),
    Index("ix_sessions_trainee_created", "trainee_id", "created_at"),
)`,
  },
};

const WORKSPACE_SHOWCASE = [
  {
    rolePill: "Learner Role",
    title: "Trainee Portal",
    subtitle: "Inspect personal assessment history, skill mastery gaps, and direct trainer feedback.",
    highlights: ["Scoped self-only routes", "Private mentor & batch threads"],
    gradient: "from-[#222B3A] via-[#1C2330] to-[#151A24]",
    Icon: GraduationCap,
  },
  {
    rolePill: "Staff Role",
    title: "Trainer Console",
    subtitle: "Review cohort readiness, module error hotspots, misconception clusters, and remediations.",
    highlights: ["Live cohort leaderboard", "Guided intervention tracking"],
    gradient: "from-[#2B2621] via-[#211E1A] to-[#181613]",
    Icon: BarChart3,
  },
  {
    rolePill: "Operations Role",
    title: "Admin Governance",
    subtitle: "Provision accounts safely, manage trainer batch staffing, and inspect full audit trails.",
    highlights: ["Last-admin protection", "Service & ML health checks"],
    gradient: "from-[#202938] via-[#1A212D] to-[#131821]",
    Icon: Users,
  },
];

export function LandingPage() {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const [portalEmail, setPortalEmail] = useState("");
  const [activeStage, setActiveStage] = useState("api");

  const [impactRef, impactVisible] = useRevealOnScroll();
  const [darkSplitRef, darkSplitVisible] = useRevealOnScroll();
  const [aboutRef, aboutVisible] = useRevealOnScroll();
  const [workspacesRef, workspacesVisible] = useRevealOnScroll();

  const dashboardPath = isAdmin
    ? "/admin"
    : isStaff
    ? "/dashboard"
    : user?.trainee_id
    ? `/trainees/${user.trainee_id}`
    : "/dashboard";

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handlePortalForward = (e) => {
    e.preventDefault();
    if (user) {
      navigate(dashboardPath);
      return;
    }
    const cleanEmail = portalEmail.trim();
    if (cleanEmail) {
      navigate(`/login?email=${encodeURIComponent(cleanEmail)}`);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F1ED] text-[#1C1B17] font-sans selection:bg-[#E45826] selection:text-white overflow-x-hidden">
      {/* =========================================================================
          1. FLOATING FROSTED PILL NAVBAR (5U AI Reference Top Bar)
          ========================================================================= */}
      <div className="sticky top-4 z-50 px-4 sm:px-6 pointer-events-none">
        <header className="pointer-events-auto max-w-5xl mx-auto rounded-full bg-[#ECEAE5]/85 backdrop-blur-md border border-black/[0.06] shadow-[0_10px_30px_-14px_rgba(28,27,23,0.22)] px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <span className="w-8 h-8 rounded-full bg-[#1C2331] text-white text-[11px] font-black tracking-tight flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                TIQ
              </span>
            </button>

            <nav className="hidden md:flex items-center gap-5 text-[11px] font-bold uppercase tracking-wider text-[#5C5549]">
              <button
                type="button"
                onClick={() => scrollToSection("impact")}
                className="hover:text-[#1C1B17] transition-colors"
              >
                Impact
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("workflows")}
                className="hover:text-[#1C1B17] transition-colors"
              >
                Workflows
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("about")}
                className="hover:text-[#1C1B17] transition-colors"
              >
                Platform
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("architecture")}
                className="hover:text-[#1C1B17] transition-colors"
              >
                Architecture
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => scrollToSection("architecture")}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/75 border border-black/[0.06] text-[10px] font-bold uppercase tracking-wider text-[#1C1B17] hover:bg-white transition-colors"
            >
              <span className="text-[#E45826]">ARCH</span>
              <span>3NF + ML ADVISORY</span>
              <ChevronRight className="w-3 h-3 text-[#787063]" />
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to={dashboardPath}
                  className="px-4 py-1.5 rounded-full bg-[#1C2331] hover:bg-[#111620] text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                >
                  Open Portal
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-[11px] font-bold uppercase tracking-wider text-[#5C5549] border border-black/[0.08] transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-full bg-[#E3E0D9] hover:bg-[#1C2331] hover:text-white text-[#1C1B17] text-[11px] font-bold uppercase tracking-wider transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </header>
      </div>

      {/* =========================================================================
          2. HERO SECTION (5U AI Warm Stone Surface + Orbital Integration Ring)
          ========================================================================= */}
      <section className="relative pt-10 sm:pt-14 pb-12 sm:pb-16 overflow-hidden border-b border-black/[0.05]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Hero Copy + Interactive Role Deck */}
          <div className="lg:col-span-6 z-10 py-4">
            <span className="inline-block px-3 py-1 rounded-md bg-[#FBEAE2] text-[10px] font-bold uppercase tracking-[0.14em] text-[#E45826] mb-5">
              FROM DRILL TO MASTERY
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold text-[#1C1B17] tracking-[-0.03em] leading-[1.06]">
              Training Analytics.
              <br />
              Built for Tech Teams.
            </h1>

            <p className="mt-5 text-sm sm:text-base text-[#5C5549] max-w-md leading-relaxed">
              Track assessment velocity, isolate skill hotspots, and guide trainer remediation
              across every cohort without spreadsheets or guesswork.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={user ? dashboardPath : "/login"}
                className="px-6 py-3 rounded-lg bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-[0_12px_24px_-10px_rgba(228,88,38,0.65)] transition-all hover:-translate-y-0.5 inline-flex items-center gap-2"
              >
                <span>{user ? "Go to Workspace" : "Sign In to Portal"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => scrollToSection("workflows")}
                className="px-5 py-3 rounded-lg bg-white/80 hover:bg-white border border-black/[0.08] text-xs font-bold uppercase tracking-wider text-[#1C1B17] transition-colors"
              >
                Explore Workflows
              </button>
            </div>

            <InteractiveRoleDeck />
          </div>

          {/* Right Orbital Integration Arc + Vertical Metric Strip */}
          <div className="lg:col-span-6">
            <OrbitalRing />
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. STEPPED WATERFALL IMPACT SECTION (Frame ~12s: "Scaling Without Hiring")
          ========================================================================= */}
      <section id="impact" className="py-20 sm:py-28 px-6 sm:px-10 max-w-6xl mx-auto">
        <div
          ref={impactRef}
          className={`tiq-reveal ${impactVisible ? "tiq-revealed" : ""}`}
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-md bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
              OPERATIONAL DISCIPLINE
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17]">
              Cohort Clarity <span className="font-normal text-[#5C5549]">Without Guesswork</span>
            </h2>
            <p className="mt-3 text-sm text-[#787063]">
              Every metric stays grounded in real recorded assessments, strict permissions, and explicit failure states.
            </p>
          </div>

          {/* 4 Stepped Waterfall Cards */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {IMPACT_CARDS.map(({ value, label, stepOffset, tone, Icon }) => (
              <div
                key={label}
                className={`${stepOffset} rounded-2xl bg-gradient-to-b ${tone} border border-black/[0.06] p-6 h-[240px] sm:h-[260px] flex flex-col justify-between shadow-[0_16px_32px_-24px_rgba(28,27,23,0.28)] hover:-translate-y-1.5 transition-transform duration-300`}
              >
                <div className="text-4xl sm:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17]">
                  {value}
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#5C5549]">
                  <Icon className="w-3.5 h-3.5 text-[#1C1B17] shrink-0" />
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. INTERACTIVE WORKFLOW & RULE PREVIEW (Frame ~15s)
          ========================================================================= */}
      <div className="border-t border-black/[0.05]">
        <WorkflowPreviewSection onInspectArchitecture={() => scrollToSection("architecture")} />
      </div>

      {/* =========================================================================
          5. DARK SPLIT PORTAL ENTRY SHOWCASE (Frame ~6s: "Your Digital Workforce")
          ========================================================================= */}
      <section className="bg-[#232B3A] py-20 sm:py-24 px-6 sm:px-10">
        <div
          ref={darkSplitRef}
          className={`tiq-reveal ${darkSplitVisible ? "tiq-revealed" : ""} max-w-5xl mx-auto rounded-3xl bg-[#181F2B] border border-white/10 p-5 sm:p-7 shadow-[0_32px_70px_-24px_rgba(0,0,0,0.65)] grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch`}
        >
          {/* Left Visual Telemetry Panel + Frosted Overlay Card */}
          <div className="lg:col-span-6 rounded-2xl relative overflow-hidden min-h-[340px] flex flex-col justify-between p-6 bg-gradient-to-br from-[#2B4368] via-[#1C2A42] to-[#121926] border border-white/10">
            {/* Subtle Architectural Grid Mesh */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
              }}
            />
            <div className="relative z-10 flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest text-[#FBD1A7]">
                LIVE COHORT TELEMETRY
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#E45826] tiq-pulse-dot" />
            </div>

            {/* Central Abstract Analytics Rings */}
            <div className="relative z-10 my-6 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border border-white/15 flex items-center justify-center relative">
                <div className="w-28 h-28 rounded-full border border-[#F09A3E]/40 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#1C2331]/90 border border-white/15 flex items-center justify-center shadow-lg">
                    <Layers className="w-7 h-7 text-[#F09A3E]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Frosted Glass Highlight Bottom Card */}
            <div className="relative z-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 p-4 text-white">
              <div className="text-sm font-semibold">Verified Sessions, Scoped By Role</div>
              <p className="text-[11px] text-white/75 mt-1 leading-relaxed">
                Trainers inspect cohort readiness and misconceptions, admins audit system health,
                and learners track only their own verified progress.
              </p>
            </div>
          </div>

          {/* Right Sign-In Forwarder Panel */}
          <div className="lg:col-span-6 p-3 sm:p-6 flex flex-col justify-center">
            <span className="inline-block self-start px-3 py-1 rounded-md bg-white/10 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
              PORTAL ACCESS
            </span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-snug">
              Your Unified Workspace for Engineering Cohorts
            </h2>
            <p className="mt-2.5 text-xs sm:text-sm text-white/65 leading-relaxed">
              Enter your organization email to continue to the authenticated portal login—all
              credentials are validated directly against the FastAPI auth service.
            </p>

            <form onSubmit={handlePortalForward} className="mt-6 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1.5">
                  WORK E-MAIL
                </label>
                <input
                  type="email"
                  value={portalEmail}
                  onChange={(e) => setPortalEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#E45826] transition-colors"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 min-w-[180px] py-3 px-5 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>{user ? "Open Active Dashboard" : "Continue to Sign In"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. ABOUT BANNER + 4-STAT STRIP + VALUES + CODE INSPECTOR (Frames ~18s–21s)
          ========================================================================= */}
      <section id="about" className="bg-[#DFDDD8]">
        {/* Full-Bleed Architectural Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1A2536] via-[#263C52] to-[#1D283A] py-20 sm:py-24 px-6 sm:px-10 text-white">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 72% 35%, rgba(240, 154, 62, 0.38), transparent 46%)",
            }}
          />
          <div
            ref={aboutRef}
            className={`tiq-reveal ${aboutVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto relative z-10`}
          >
            <span className="inline-block px-3 py-1 rounded bg-white/15 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
              PLATFORM ARCHITECTURE
            </span>
            <h2 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight">ABOUT TRAINEEIQ</h2>
            <p className="mt-3 text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
              Designed to keep training operations verifiable—connecting drill ingestion, advisory ML risk scoring, and trainer-trainee remediation loops cleanly.
            </p>
          </div>
        </div>

        {/* 4-Column Stack Pillar Strip */}
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8 border-b border-black/[0.08]">
          <div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1C1B17]">FastAPI</div>
            <div className="text-xs text-[#5C5549] mt-1 font-medium">Pydantic v2 Service Layer</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1C1B17]">3NF SQL</div>
            <div className="text-xs text-[#5C5549] mt-1 font-medium">Constraint-Enforced Storage</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1C1B17]">Advisory ML</div>
            <div className="text-xs text-[#5C5549] mt-1 font-medium">Random Forest + Rule Fallback</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold text-[#1C1B17]">WebSocket</div>
            <div className="text-xs text-[#5C5549] mt-1 font-medium">Real-Time Event Broadcast</div>
          </div>
        </div>

        {/* Values + Interactive Stack Stage Inspector */}
        <div
          id="architecture"
          className="max-w-6xl mx-auto px-6 sm:px-10 py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
        >
          {/* Left Values Stack */}
          <div className="lg:col-span-5 space-y-5">
            <span className="inline-block px-3 py-1 rounded-md bg-white/60 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
              CORE PRINCIPLES
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
              Built on Trust,
              <br />
              Driven by Clarity
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5549] leading-relaxed">
              Every dashboard state distinguishes live records from empty cohorts and service outages—never inventing fallback data.
            </p>

            <div className="rounded-2xl bg-white/55 border border-black/[0.06] divide-y divide-black/[0.06]">
              <div className="p-4">
                <div className="text-xs font-bold text-[#1C1B17]">Honest Failure States</div>
                <p className="text-[11px] text-[#5C5549] mt-1">
                  Invalid tokens, server outages, and empty batches surface exact statuses rather than placeholders.
                </p>
              </div>
              <div className="p-4">
                <div className="text-xs font-bold text-[#1C1B17]">Human-AI Partnership</div>
                <p className="text-[11px] text-[#5C5549] mt-1">
                  Advisory predictions assist trainers in spotting struggling trainees without automatic grading.
                </p>
              </div>
              <div className="p-4">
                <div className="text-xs font-bold text-[#1C1B17]">Scoped Privacy</div>
                <p className="text-[11px] text-[#5C5549] mt-1">
                  Role routes and backend guards isolate trainee assessments and private peer/mentor messaging.
                </p>
              </div>
            </div>
          </div>

          {/* Right Interactive Live Code / Architecture Inspector */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-[#1C2331] text-white p-5 sm:p-6 shadow-2xl border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#F09A3E]" />
                  <span className="text-xs font-bold tracking-wide">
                    Three-Tier System Inspector
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl">
                  {Object.entries(ARCH_STAGES).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveStage(key)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeStage === key
                          ? "bg-[#E45826] text-white"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{ARCH_STAGES[activeStage].label}</span>
                  <span className="text-[11px] font-mono text-[#FBD1A7]">
                    {ARCH_STAGES[activeStage].tech}
                  </span>
                </div>
                <p className="text-xs text-white/70 mt-1.5 leading-relaxed">
                  {ARCH_STAGES[activeStage].desc}
                </p>

                <pre className="mt-4 rounded-xl bg-[#121721] border border-white/10 p-4 text-[11px] font-mono text-[#E7E4DD] overflow-x-auto leading-relaxed">
                  <code>{ARCH_STAGES[activeStage].code}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. THREE WORKSPACES PORTRAIT CARDS (Frame ~24s: "People and AI Together")
          ========================================================================= */}
      <section className="bg-[#ECEAE5] py-20 sm:py-28 px-6 sm:px-10">
        <div
          ref={workspacesRef}
          className={`tiq-reveal ${workspacesVisible ? "tiq-revealed" : ""} max-w-5xl mx-auto`}
        >
          <div className="text-center max-w-xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-md bg-white/70 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
              ROLE WORKSPACES
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17]">
              Three Workspaces, Built Around Real Accountability
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-[#5C5549]">
              Each authenticated user enters a tailored operational console scoped cleanly by role.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {WORKSPACE_SHOWCASE.map(({ rolePill, title, subtitle, highlights, gradient, Icon }) => (
              <div
                key={title}
                className={`rounded-2xl bg-gradient-to-b ${gradient} text-white p-6 min-h-[340px] flex flex-col justify-between shadow-[0_20px_40px_-24px_rgba(28,27,23,0.45)] border border-white/10 hover:-translate-y-1.5 transition-transform duration-300`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-bold uppercase tracking-wider text-white/85">
                    {rolePill}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#F09A3E]">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-3 mt-10">
                  <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="text-xs text-white/70 leading-relaxed">{subtitle}</p>
                  <ul className="space-y-1.5 pt-2 border-t border-white/10">
                    {highlights.map((item) => (
                      <li key={item} className="text-[11px] text-white/85 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E45826]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. CLOSING GRADIENT CTA + BENTO FOOTER + WATERMARK GRID (Frame ~9s)
          ========================================================================= */}
      <footer className="relative bg-gradient-to-b from-[#2A3343] via-[#3B4454] to-[#232A37] text-white pt-20 pb-10 px-6 sm:px-10 overflow-hidden">
        {/* Top Centered CTA */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Let&apos;s Upgrade Your
            <br />
            Training Outcomes.
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-white/75 max-w-md mx-auto leading-relaxed">
            Inspect live cohorts, guide targeted remediation, and keep every assessment workflow transparent.
          </p>
          <div className="mt-7">
            <Link
              to={user ? dashboardPath : "/login"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all hover:-translate-y-0.5"
            >
              <span>{user ? "Open Dashboard" : "Sign In to Portal"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Stack Strip */}
        <div className="max-w-5xl mx-auto mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px] text-white/60">
          <div>
            <div className="font-bold text-white/85">Core Technologies</div>
            <div>Verified relational, API, and reactive UI modules.</div>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-bold uppercase tracking-widest text-white/70 text-[10px]">
            <span>React 18</span>
            <span>FastAPI</span>
            <span>SQLAlchemy</span>
            <span>Scikit-Learn</span>
            <span>WebSockets</span>
            <span>Tailwind</span>
          </div>
        </div>

        {/* 4-Card Bento Footer Grid */}
        <div className="max-w-5xl mx-auto mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-5 flex flex-col justify-between min-h-[160px]">
            <div className="w-9 h-9 rounded-lg bg-white text-[#1C2331] text-xs font-black flex items-center justify-center">
              TIQ
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-2">
                PORTAL ENTRY
              </div>
              <Link
                to={user ? dashboardPath : "/login"}
                className="block w-full text-center py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors"
              >
                {user ? "Go to Active Session" : "Authenticate Account"}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-5">
            <div className="text-xs font-bold text-white/90 mb-3">Platform</div>
            <ul className="space-y-2 text-xs text-white/70">
              <li>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="hover:text-white transition-colors"
                >
                  › Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("impact")}
                  className="hover:text-white transition-colors"
                >
                  › Operational Discipline
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("workflows")}
                  className="hover:text-white transition-colors"
                >
                  › Remediation Flows
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("architecture")}
                  className="hover:text-white transition-colors"
                >
                  › 3-Tier Architecture
                </button>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-5">
            <div className="text-xs font-bold text-white/90 mb-3">Workspaces</div>
            <ul className="space-y-2 text-xs text-white/70">
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">
                  › Trainer Console
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-white transition-colors">
                  › Admin Governance
                </Link>
              </li>
              <li>
                <Link to="/batches" className="hover:text-white transition-colors">
                  › Batch Cohorts
                </Link>
              </li>
              <li>
                <Link to="/messages" className="hover:text-white transition-colors">
                  › Intervention Channels
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-3 flex flex-col justify-between">
            <div className="h-20 rounded-xl bg-gradient-to-r from-[#1A2536] to-[#2B4368] border border-white/10 flex items-center justify-center">
              <Code2 className="w-6 h-6 text-[#F09A3E]" />
            </div>
            <div className="p-2">
              <div className="text-xs font-semibold text-white">
                From Raw Drill Logs to Guided Action
              </div>
              <p className="text-[11px] text-white/60 mt-1 line-clamp-2">
                Full audit logging, RBAC session checks, and live WebSocket assessment telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright Row */}
        <div className="max-w-5xl mx-auto mt-10 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/50 relative z-10">
          <span>© 2026 Training Analytics Portal</span>
          <span>TraineeIQ Engineering Cohort System</span>
        </div>

        {/* Subtle Repeating Watermark Pattern Backdrop */}
        <div
          aria-hidden="true"
          className="mt-8 select-none pointer-events-none text-center text-[10px] font-bold tracking-[0.55em] text-white/[0.06] leading-loose uppercase overflow-hidden whitespace-nowrap"
        >
          TRAINEEIQ · TRAINEEIQ · TRAINEEIQ · TRAINEEIQ · TRAINEEIQ · TRAINEEIQ
        </div>
      </footer>
    </div>
  );
}
