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
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import "./../components/landing/landingAnimations.css";
import { OrbitalRing, OrbitalScreenArc, HeroMetricsColumn } from "../components/landing/OrbitalRing.jsx";
import { InteractiveRoleDeck } from "../components/landing/InteractiveRoleDeck.jsx";
import { WorkflowPreviewSection } from "../components/landing/WorkflowPreviewSection.jsx";
import { TelemetryIngestionSection } from "../components/landing/TelemetryIngestionSection.jsx";
import { KeyFeaturesBentoSection } from "../components/landing/KeyFeaturesBentoSection.jsx";
import { LeadershipAndMissionSection } from "../components/landing/LeadershipAndMissionSection.jsx";
import { FaqAccordionSection } from "../components/landing/FaqAccordionSection.jsx";
import { useRevealOnScroll } from "../components/landing/useRevealOnScroll.js";

const IMPACT_CARDS = [
  {
    value: "60%",
    label: "Faster Remediation Velocity",
    stepOffset: "lg:mt-0",
    tone: "from-[#F2F1EE] to-[#ECEAE5]",
    Icon: Sparkles,
  },
  {
    value: "30%",
    label: "Higher First-Attempt Pass Rate",
    stepOffset: "lg:mt-8",
    tone: "from-[#ECEAE6] to-[#E4E1DB]",
    Icon: Radio,
  },
  {
    value: "Zero",
    label: "Phantom Fallback Metrics",
    stepOffset: "lg:mt-16",
    tone: "from-[#E6E4DF] to-[#DCD9D2]",
    Icon: Lock,
  },
  {
    value: "25-50%",
    label: "Reduction in Grading Overhead",
    stepOffset: "lg:mt-24",
    tone: "from-[#DFDDD7] to-[#D4D1C9]",
    Icon: Database,
  },
];

const ARCH_STAGES = {
  frontend: {
    label: "Presentation Layer",
    tech: "React 18 · Vite · Tailwind",
    desc: "Modular role-guarded dashboards with explicit loading, empty, and error contracts.",
    code: `// Role-based route guard
const { user, isAdmin, isStaff } = useAuth();
if (!user) return <Navigate to="/login" replace />;
if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;`,
  },
  api: {
    label: "Core API & Advisory ML",
    tech: "FastAPI · Pydantic · SQLAlchemy",
    desc: "Strict server-verified RBAC, multi-tenant cohort boundaries, and advisory-only risk heuristics.",
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
    tech: "PostgreSQL 16 · SQLAlchemy · Alembic",
    desc: "Normalized 3NF relational tables with database check constraints, partial anti-gaming indexes, and Alembic tracking.",
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
    rolePill: "Learner Persona",
    title: "Trainee Portal",
    subtitle: "Inspect personal module history, competency mastery gaps, and access DevOps video curriculum.",
    highlights: ["Practice vs. Graded Assessment Split", "CLI Playbooks & Capstone Submissions"],
    gradient: "from-[#222B3A] via-[#1C2330] to-[#151A24]",
    Icon: GraduationCap,
  },
  {
    rolePill: "Instructor Persona",
    title: "Trainer Console",
    subtitle: "Review cohort readiness, module error hotspots, competency radar arcs, and remediation notes.",
    highlights: ["Multi-Tenant Cohort Sandboxing", "Advisory-Only ML Performance Telemetry"],
    gradient: "from-[#2B2621] via-[#211E1A] to-[#181613]",
    Icon: BarChart3,
  },
  {
    rolePill: "Governance Persona",
    title: "Admin Governance",
    subtitle: "Provision accounts safely, assign trainers to cohort batches, and inspect immutable audit logs.",
    highlights: ["Least-Privilege Role Separation", "Security & System Health Logging"],
    gradient: "from-[#202938] via-[#1A212D] to-[#131821]",
    Icon: Users,
  },
];

export function LandingPage() {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const [activeStage, setActiveStage] = useState("api");

  const [impactRef, impactVisible] = useRevealOnScroll();
  const [darkSplitRef, darkSplitVisible] = useRevealOnScroll();
  const [aboutRef, aboutVisible] = useRevealOnScroll();

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

  return (
    <div className="min-h-screen bg-[#F6F4F0] text-[#1C1B17] font-sans selection:bg-[#E45826] selection:text-white overflow-x-hidden">
      {/* =========================================================================
          1. UNBOXED MINIMAL TOP NAVBAR (1:1 with reference)
          ========================================================================= */}
      <div className="w-full z-50 pt-6 pb-2 px-6 sm:px-10 lg:px-14">
        <header className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 sm:gap-10">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-3 group focus:outline-none cursor-pointer"
            >
              <span className="w-11 h-11 rounded-full bg-[#1C2331] text-white text-xs font-black tracking-wider flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                TAP
              </span>
            </button>

            <nav className="hidden md:flex items-center gap-7 sm:gap-8 text-xs font-bold uppercase tracking-wider text-[#35312B]">
              <button
                type="button"
                onClick={() => scrollToSection("telemetry")}
                className="hover:text-black transition-colors cursor-pointer"
              >
                Telemetry
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="hover:text-black transition-colors cursor-pointer"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("workspaces")}
                className="hover:text-black transition-colors cursor-pointer"
              >
                Workspaces
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("about")}
                className="hover:text-black transition-colors cursor-pointer"
              >
                Architecture
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("faq")}
                className="hover:text-black transition-colors cursor-pointer"
              >
                FAQ
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => scrollToSection("architecture")}
              className="hidden sm:inline-flex items-center gap-2 text-xs font-medium cursor-pointer"
            >
              <span className="text-[#E45826] bg-[#FCECE6] px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                NEWS
              </span>
              <span className="text-[#4B5563] font-semibold text-[13px]">
                222 TESTS PASSING &rsaquo;
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to={dashboardPath}
                  className="px-6 py-2.5 rounded-full bg-white hover:bg-neutral-50 text-[#1C1B17] text-xs font-bold uppercase tracking-wider border border-black/10 shadow-xs hover:shadow-sm transition-all cursor-pointer"
                >
                  Open Portal
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2.5 rounded-full bg-transparent hover:bg-black/5 text-xs font-bold uppercase tracking-wider text-[#5C5549] transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-7 py-2.5 rounded-full bg-white hover:bg-neutral-50 text-[#1C1B17] text-xs font-bold uppercase tracking-wider border border-black/10 shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                Sign In
              </Link>
            )}
          </div>
        </header>
      </div>

      {/* =========================================================================
          2. HERO SECTION (Full-height hero matching reference preview)
          ========================================================================= */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center pt-6 sm:pt-10 pb-12 sm:pb-16 border-b border-black/[0.05] overflow-hidden">
        {/* Sweeping Circular Conveyor Ramp with 3D Pucks and Speed Blur */}
        <OrbitalScreenArc />

        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full z-10">
          {/* Left Hero Copy */}
          <div className="lg:col-span-6 z-10 py-4">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.35rem] font-bold text-[#1C1B17] tracking-tight leading-[1.08]">
              Training Analytics Portal.
              <br />
              <span className="text-[#555047]">Built for Engineering Cohorts.</span>
            </h1>

            <p className="mt-5 text-sm sm:text-base text-[#555047] max-w-md leading-relaxed">
              Objective drill telemetry, competency radar tracking, and ethical advisory-only ML to support instructors and accelerate trainee mastery.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <Link
                to={user ? dashboardPath : "/login"}
                className="px-7 py-3.5 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-[0_12px_24px_-10px_rgba(228,88,38,0.55)] transition-all hover:-translate-y-0.5 inline-flex items-center gap-2 cursor-pointer"
              >
                <span>{user ? "Open Dashboard" : "Sign In to Portal"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => scrollToSection("telemetry")}
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#faf9f6] border border-black/[0.08] text-xs font-bold uppercase tracking-wider text-[#1C1B17] shadow-xs transition-colors cursor-pointer"
              >
                See Telemetry
              </button>
            </div>

            <InteractiveRoleDeck />
          </div>

          {/* Right Performance Metrics Column deeply inside the concave circle hollow */}
          <div className="lg:col-span-6 relative flex items-end justify-end w-full h-full pb-8 sm:pb-12 lg:pb-16 z-10 pointer-events-auto">
            <HeroMetricsColumn />
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. DEEP NAVY TELEMETRY INGESTION SECTION
          ========================================================================= */}
      <div id="telemetry">
        <TelemetryIngestionSection />
      </div>

      {/* =========================================================================
          4. KEY FEATURES BENTO DECK
          ========================================================================= */}
      <div id="features">
        <KeyFeaturesBentoSection />
      </div>

      {/* =========================================================================
          5. STEPPED WATERFALL IMPACT SECTION
          ========================================================================= */}
      <section id="impact" className="py-20 sm:py-28 px-6 sm:px-10 max-w-6xl mx-auto">
        <div
          ref={impactRef}
          className={`tiq-reveal ${impactVisible ? "tiq-revealed" : ""}`}
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-md bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
              MEASURABLE RESULTS
            </span>
            <h2 className="font-display mt-4 text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17]">
              Optimizing Cohort Training with Verified Data
            </h2>
            <p className="mt-3 text-sm text-[#787063]">
              Eliminate arbitrary grading with objective performance metrics and targeted remediation loops.
            </p>
          </div>

          {/* 4 Stepped Waterfall Cards */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {IMPACT_CARDS.map(({ value, label, stepOffset, tone, Icon }) => (
              <div
                key={label}
                className={`${stepOffset} rounded-3xl bg-gradient-to-b ${tone} border border-black/[0.06] p-6 h-[240px] sm:h-[260px] flex flex-col justify-between shadow-[0_16px_32px_-24px_rgba(28,27,23,0.28)] hover:-translate-y-1.5 transition-transform duration-300`}
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
          6. INTERACTIVE WORKFLOW SECTION
          ========================================================================= */}
      <div className="border-t border-black/[0.05]">
        <WorkflowPreviewSection onInspectArchitecture={() => scrollToSection("architecture")} />
      </div>

      {/* =========================================================================
          7. THREE ROLE-BASED WORKSPACES (Replaces fake customer spotlight & lead form)
          ========================================================================= */}
      <section id="workspaces" className="bg-[#1C2433] py-20 sm:py-24 px-6 sm:px-10 border-b border-white/10 text-white">
        <div
          ref={darkSplitRef}
          className={`tiq-reveal ${darkSplitVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12`}
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-md bg-white/10 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 mb-3">
              ROLE ARCHITECTURE
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
              Three Portals. One Integrated Relational Store.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-white/70 leading-relaxed">
              Every persona operates within authenticated boundaries, backed by least-privilege permissions and audit logging.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WORKSPACE_SHOWCASE.map((ws) => {
              const Icon = ws.Icon;
              return (
                <div
                  key={ws.title}
                  className="rounded-3xl bg-[#141B28] border border-white/10 p-7 flex flex-col justify-between min-h-[320px] shadow-xl hover:-translate-y-1 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#E45826]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                        {ws.rolePill}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white tracking-tight">{ws.title}</h3>
                    <p className="text-xs text-white/70 mt-2 leading-relaxed">{ws.subtitle}</p>

                    <div className="mt-6 space-y-2">
                      {ws.highlights.map((h) => (
                        <div key={h} className="flex items-center gap-2 text-xs text-white/85">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/10">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#E45826] hover:text-[#f06e3e] transition-colors"
                    >
                      <span>Sign In as {ws.title.split(" ")[0]}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. VERIFIED SYSTEM STATS & ARCHITECTURAL PILLARS
          ========================================================================= */}
      <div id="about">
        {/* Full-Bleed Architectural Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1A2536] via-[#263C52] to-[#1D283A] py-20 sm:py-24 px-6 sm:px-10 text-white border-b border-white/10">
          <div
            ref={aboutRef}
            className={`tiq-reveal ${aboutVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto relative z-10 space-y-6`}
          >
            <span className="inline-block px-3 py-1 rounded bg-white/15 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
              VERIFIED SYSTEM METRICS
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
              ENGINEERED FOR RIGOR
            </h2>
            <p className="text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
              Every capability is backed by passing automated test suites, linear schema migrations, and explicit security assertions.
            </p>

            {/* 4 KPI Banner Strip */}
            <div className="pt-8 grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-white/15">
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">222 Passed</div>
                <div className="text-xs text-white/70 mt-1">Backend Pytest Specs</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">26 Passed</div>
                <div className="text-xs text-white/70 mt-1">Frontend Vitest Specs</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">20 Models</div>
                <div className="text-xs text-white/70 mt-1">Relational Schema</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">0 Errors</div>
                <div className="text-xs text-white/70 mt-1">Production Vite Build</div>
              </div>
            </div>
          </div>
        </div>

        {/* Architectural Pillars Section */}
        <LeadershipAndMissionSection />
      </div>

      {/* =========================================================================
          9. THREE-TIER ARCHITECTURE & LIVE CODE INSPECTOR
          ========================================================================= */}
      <section id="architecture" className="bg-[#ECEAE5] py-20 sm:py-28 px-6 sm:px-10 border-b border-black/[0.05]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-5">
            <span className="inline-block px-3 py-1 rounded-md bg-white/70 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
              CORE PRINCIPLES
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
              Three-Tier Rigor, Built for Production
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5549] leading-relaxed">
              Every dashboard metric distinguishes live records from empty cohorts and service outages—never substituting fake fallback data.
            </p>
          </div>

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
                  {Object.entries(ARCH_STAGES).map(([key]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveStage(key)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
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
          10. ACCORDION FAQ SECTION
          ========================================================================= */}
      <div id="faq">
        <FaqAccordionSection />
      </div>

      {/* =========================================================================
          11. CLOSING CALL TO ACTION & FOOTER
          ========================================================================= */}
      <footer className="relative bg-gradient-to-b from-[#2A3343] via-[#3B4454] to-[#232A37] text-white pt-20 pb-10 px-6 sm:px-10 overflow-hidden">
        {/* Top Centered CTA */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Ready to Review Your
            <br />
            Training Cohort?
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-white/75 max-w-md mx-auto leading-relaxed">
            Access multi-cohort competency radar telemetry, session notes, and the verified DevOps learning path.
          </p>
          <div className="mt-7">
            <Link
              to={user ? dashboardPath : "/login"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>{user ? "Open Dashboard" : "Sign In to Portal"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Collaborators Partner Bar */}
        <div className="max-w-5xl mx-auto mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px] text-white/60">
          <div>
            <div className="font-bold text-white/85">Technical Architecture Stack</div>
            <div>Built with verified, modern open-source technologies.</div>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-bold uppercase tracking-widest text-white/70 text-[10px]">
            <span>FastAPI</span>
            <span>React 18</span>
            <span>PostgreSQL</span>
            <span>Docker</span>
            <span>SQLAlchemy</span>
            <span>Alembic</span>
          </div>
        </div>

        {/* 4-Card Bento Footer Grid */}
        <div className="max-w-5xl mx-auto mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-5 flex flex-col justify-between min-h-[160px]">
            <div className="w-9 h-9 rounded-lg bg-white text-[#1C2331] text-xs font-black flex items-center justify-center">
              TAP
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-2">
                PORTAL ENTRY
              </div>
              <Link
                to={user ? dashboardPath : "/login"}
                className="block w-full text-center py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors cursor-pointer"
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
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  › Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("telemetry")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  › Live Telemetry
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("features")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  › Core Features
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("faq")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  › FAQ
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
                Full audit logging, RBAC session checks, and advisory-only ML telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright Row */}
        <div className="max-w-5xl mx-auto mt-10 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/50 relative z-10">
          <span>© 2026 Training Analytics Portal</span>
          <span>Technical Cohort Governance System</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;