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
import { OrbitalRing } from "../components/landing/OrbitalRing.jsx";
import { InteractiveRoleDeck } from "../components/landing/InteractiveRoleDeck.jsx";
import { WorkflowPreviewSection } from "../components/landing/WorkflowPreviewSection.jsx";
import { TelemetryIngestionSection } from "../components/landing/TelemetryIngestionSection.jsx";
import { KeyFeaturesBentoSection } from "../components/landing/KeyFeaturesBentoSection.jsx";
import { LeadershipAndMissionSection } from "../components/landing/LeadershipAndMissionSection.jsx";
import { FaqAccordionSection } from "../components/landing/FaqAccordionSection.jsx";
import { useRevealOnScroll } from "../components/landing/useRevealOnScroll.js";
import mentorReviewImg from "../assets/mentor-review.jpg";

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
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    cohort: "Cloud & DevOps",
    message: "",
  });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
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

  const handleLeadSubmit = (e) => {
    e.preventDefault();
    setLeadSubmitted(true);
    setTimeout(() => {
      navigate(leadForm.email ? `/login?email=${encodeURIComponent(leadForm.email)}` : "/login");
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#F6F4F0] text-[#1C1B17] font-sans selection:bg-[#E45826] selection:text-white overflow-x-hidden">
      {/* =========================================================================
          1. FLOATING FROSTED PILL NAVBAR (5U AI Reference Top Bar - Frame 000)
          ========================================================================= */}
      <div className="sticky top-4 z-50 px-4 sm:px-6 pointer-events-none">
        <header className="pointer-events-auto max-w-5xl mx-auto rounded-full bg-[#ECEAE5]/90 backdrop-blur-md border border-black/[0.06] shadow-[0_10px_30px_-14px_rgba(28,27,23,0.22)] px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2.5 group focus:outline-none cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-[#1C2331] text-white text-[11px] font-black tracking-tight flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                TIQ
              </span>
            </button>

            <nav className="hidden md:flex items-center gap-5 text-[11px] font-bold uppercase tracking-wider text-[#5C5549]">
              <button
                type="button"
                onClick={() => scrollToSection("telemetry")}
                className="hover:text-[#1C1B17] transition-colors cursor-pointer"
              >
                Telemetry
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="hover:text-[#1C1B17] transition-colors cursor-pointer"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("impact")}
                className="hover:text-[#1C1B17] transition-colors cursor-pointer"
              >
                Impact
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("workflows")}
                className="hover:text-[#1C1B17] transition-colors cursor-pointer"
              >
                Workflows
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("about")}
                className="hover:text-[#1C1B17] transition-colors cursor-pointer"
              >
                Platform
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("faq")}
                className="hover:text-[#1C1B17] transition-colors cursor-pointer"
              >
                FAQ
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => scrollToSection("architecture")}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-black/[0.06] text-[10px] font-bold uppercase tracking-wider text-[#1C1B17] hover:bg-white transition-colors cursor-pointer"
            >
              <span className="text-[#E45826]">NEWS</span>
              <span>TIQ 2.0 PUBLISHED</span>
              <ChevronRight className="w-3 h-3 text-[#787063]" />
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to={dashboardPath}
                  className="px-4 py-1.5 rounded-full bg-[#1C2331] hover:bg-[#111620] text-white text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                >
                  Open Portal
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-[11px] font-bold uppercase tracking-wider text-[#5C5549] border border-black/[0.08] transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-full bg-white hover:bg-[#1C2331] hover:text-white text-[#1C1B17] text-[11px] font-bold uppercase tracking-wider border border-black/[0.06] transition-all cursor-pointer shadow-xs"
              >
                Book a Demo
              </Link>
            )}
          </div>
        </header>
      </div>

      {/* =========================================================================
          2. HERO SECTION (Warm Stone Surface + 3D Orbital Conveyor Ring - Frame 000-004)
          ========================================================================= */}
      <section className="relative pt-10 sm:pt-14 pb-12 sm:pb-16 overflow-hidden border-b border-black/[0.05]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Hero Copy + Interactive Role Deck */}
          <div className="lg:col-span-6 z-10 py-4">
            <span className="inline-block px-3 py-1 rounded-md bg-[#FBEAE2] text-[10px] font-bold uppercase tracking-[0.14em] text-[#E45826] mb-5">
              FROM RUBRIC TO REMEDIATION
            </span>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-[#1C1B17] tracking-[-0.03em] leading-[1.06]">
              AI Workforce.
              <br />
              Built for Tech Teams.
            </h1>

            <p className="mt-5 text-sm sm:text-base text-[#5C5549] max-w-md leading-relaxed">
              They read, evaluate and act across viva sessions, code repositories and LMS signals so your instructional staff don&apos;t have to.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={user ? dashboardPath : "/login"}
                className="px-6 py-3 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-[0_12px_24px_-10px_rgba(228,88,38,0.65)] transition-all hover:-translate-y-0.5 inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Contact Us</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => scrollToSection("telemetry")}
                className="px-5 py-3 rounded-xl bg-white/80 hover:bg-white border border-black/[0.08] text-xs font-bold uppercase tracking-wider text-[#1C1B17] transition-colors cursor-pointer"
              >
                See Telemetry
              </button>
            </div>

            <InteractiveRoleDeck />
          </div>

          {/* Right Orbital Conveyor Arc + Vertical Metric Strip */}
          <div className="lg:col-span-6">
            <OrbitalRing />
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. DEEP NAVY TELEMETRY INGESTION SECTION (Exact Replica of Frame 006)
          ========================================================================= */}
      <div id="telemetry">
        <TelemetryIngestionSection />
      </div>

      {/* =========================================================================
          4. 4 KEY FEATURES BENTO DECK (Exact Replica of Frame 008 with Datacenter Photo)
          ========================================================================= */}
      <div id="features">
        <KeyFeaturesBentoSection />
      </div>

      {/* =========================================================================
          5. STEPPED WATERFALL IMPACT SECTION (Exact Replica of Frame 016)
          ========================================================================= */}
      <section id="impact" className="py-20 sm:py-28 px-6 sm:px-10 max-w-6xl mx-auto">
        <div
          ref={impactRef}
          className={`tiq-reveal ${impactVisible ? "tiq-revealed" : ""}`}
        >
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-md bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
              BUSINESS IMPACT
            </span>
            <h2 className="font-display mt-4 text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17]">
              Scaling Training <span className="font-normal text-[#5C5549]">Without Hiring</span>
            </h2>
            <p className="mt-3 text-sm text-[#787063]">
              Instructional bandwidth per batch was down 33% since 2011. We&apos;re flipping that trend with verified metrics.
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
          6. INTERACTIVE WORKFLOW & POLICY CONFIGURATOR (Frames 020-022)
          ========================================================================= */}
      <div className="border-t border-black/[0.05]">
        <WorkflowPreviewSection onInspectArchitecture={() => scrollToSection("architecture")} />
      </div>

      {/* =========================================================================
          7. DARK SPLIT LEAD CAPTURE / PORTAL ACCESS WITH REAL PHOTO (Frame 010)
          ========================================================================= */}
      <section className="bg-[#1C2433] py-20 sm:py-24 px-6 sm:px-10 border-b border-white/10">
        <div
          ref={darkSplitRef}
          className={`tiq-reveal ${darkSplitVisible ? "tiq-revealed" : ""} max-w-5xl mx-auto rounded-3xl bg-[#141B28] border border-white/10 p-5 sm:p-7 shadow-[0_32px_70px_-24px_rgba(0,0,0,0.65)] grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch`}
        >
          {/* Left Photographic Panel with Testimonial (Matching Frame 010) */}
          <div className="lg:col-span-6 rounded-2xl relative overflow-hidden min-h-[400px] flex flex-col justify-between p-6 border border-white/10 group">
            <img
              src={mentorReviewImg}
              alt="Mentors reviewing technical diagnostics"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141B28]/95 via-[#141B28]/60 to-[#141B28]/30 pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-[#FBD1A7]">
                CUSTOMER SPOTLIGHT
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#E45826] tiq-pulse-dot" />
            </div>

            {/* Testimonial Quote (Matching Video Frame 010) */}
            <div className="relative z-10 space-y-3 p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-white">
              <h4 className="text-sm font-bold text-white">Feels Like an Extension of Our Team</h4>
              <p className="text-[11px] text-white/80 leading-relaxed">
                &ldquo;We were hesitant about automated diagnostics at first, but TraineeIQ blends right into our viva workflow. The portal spots error patterns clearly and gives mentors exact action items.&rdquo;
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <div className="w-7 h-7 rounded-full bg-[#E45826] text-white font-black text-[10px] flex items-center justify-center">
                  SC
                </div>
                <div className="text-[10px]">
                  <div className="font-bold text-white">Dr. Sarah Chen</div>
                  <div className="text-white/60">Dean of Engineering @ Tech Academy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Lead Capture Form Panel (Matching Frame 010) */}
          <div className="lg:col-span-6 p-2 sm:p-4 flex flex-col justify-center">
            <span className="inline-block self-start px-3 py-1 rounded-md bg-white/10 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75 mb-3">
              BOOK A DEMO
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-snug">
              Your Digital Workforce for Technical Training
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-white/65 leading-relaxed">
              TraineeIQ automates the repetitive, manual work behind every cohort, from collecting rubric evaluations to preparing practice sets and tracking mastery.
            </p>

            <form onSubmit={handleLeadSubmit} className="mt-6 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  FULL NAME *
                </label>
                <input
                  type="text"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#E45826] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  WORK E-MAIL *
                </label>
                <input
                  type="email"
                  required
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#E45826] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  COHORT / TRACK
                </label>
                <input
                  type="text"
                  value={leadForm.cohort}
                  onChange={(e) => setLeadForm({ ...leadForm, cohort: e.target.value })}
                  placeholder="e.g. Cloud & DevOps"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#E45826] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  MESSAGE
                </label>
                <textarea
                  rows={2}
                  value={leadForm.message}
                  onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })}
                  placeholder="Tell us about your cohort size or training goals..."
                  className="w-full px-4 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#E45826] transition-colors resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-5 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  {leadSubmitted ? (
                    <span className="flex items-center gap-1.5 text-white">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Request Forwarded! Redirecting...</span>
                    </span>
                  ) : (
                    <span>Submit & Launch Portal</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. LEADERSHIP, MISSION & PHOTOGRAPHY (Exact Replica of Frames 024-032)
          ========================================================================= */}
      <div id="about">
        {/* Full-Bleed Architectural Banner with 4 KPIs (Frame 024) */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1A2536] via-[#263C52] to-[#1D283A] py-20 sm:py-24 px-6 sm:px-10 text-white border-b border-white/10">
          <div
            ref={aboutRef}
            className={`tiq-reveal ${aboutVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto relative z-10 space-y-6`}
          >
            <span className="inline-block px-3 py-1 rounded bg-white/15 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
              WHO WE ARE
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">ABOUT TRAINEEIQ</h2>
            <p className="text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
              At TraineeIQ, we&apos;re building the future of technical education with AI empowering training teams worldwide to scale smarter and faster.
            </p>

            {/* 4 KPI Banner Strip (Matching Frame 024) */}
            <div className="pt-8 grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-white/15">
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">120x +</div>
                <div className="text-xs text-white/70 mt-1">Diagnostic Velocity</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">100%</div>
                <div className="text-xs text-white/70 mt-1">Role-Guarded Security</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">10x</div>
                <div className="text-xs text-white/70 mt-1">Mentor Feedback Speed</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white">24/7</div>
                <div className="text-xs text-white/70 mt-1">Live Telemetry Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mission, Values, Vision, and 4 Portrait Cards */}
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
          10. ACCORDION FAQ SECTION (Exact Replica of Frame 012)
          ========================================================================= */}
      <div id="faq">
        <FaqAccordionSection />
      </div>

      {/* =========================================================================
          11. CLOSING CALL TO ACTION + BENTO MEGA FOOTER (Frame 012 & 035)
          ========================================================================= */}
      <footer className="relative bg-gradient-to-b from-[#2A3343] via-[#3B4454] to-[#232A37] text-white pt-20 pb-10 px-6 sm:px-10 overflow-hidden">
        {/* Top Centered CTA (Matching Frame 012) */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            Let&apos;s Upgrade Your
            <br />
            Team with AI.
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-white/75 max-w-md mx-auto leading-relaxed">
            Let TraineeIQ Agents handle the busywork, so your instructional team can focus on what truly moves your cohorts forward.
          </p>
          <div className="mt-7">
            <Link
              to={user ? dashboardPath : "/login"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>{user ? "Open Dashboard" : "Book a Demo"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Collaborators Partner Bar (Matching Frame 012) */}
        <div className="max-w-5xl mx-auto mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px] text-white/60">
          <div>
            <div className="font-bold text-white/85">Collaborators & Integrations</div>
            <div>Over a hundred reliable partner ecosystems supported.</div>
          </div>
          <div className="flex flex-wrap items-center gap-6 font-bold uppercase tracking-widest text-white/70 text-[10px]">
            <span>FastAPI</span>
            <span>React 18</span>
            <span>PostgreSQL</span>
            <span>Docker</span>
            <span>WebSockets</span>
            <span>Scikit-Learn</span>
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
                  › Live Ingestion
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection("features")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  › Key Features
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

        {/* Repeating Watermark Pattern Backdrop (Matching Frame 035) */}
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

export default LandingPage;
