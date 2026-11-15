import React, { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Cpu, Database, GitBranch, Radio, Terminal, FileCode2 } from "lucide-react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";

const INGESTION_STEPS = [
  {
    id: "ingest",
    title: "Connect & ingest",
    desc: "Link Viva evaluations, Git repos, and LMS rubrics; instantly turn training signals accessible and ready to act on.",
    activeBadge: "ACTIVE PIPELINE",
  },
  {
    id: "watch",
    title: "AI evaluator on watch",
    desc: "Background models analyze rubric score distributions, syntax hurdles, and logic misconceptions in real time.",
    activeBadge: "CONTINUOUS AUDIT",
  },
  {
    id: "human",
    title: "Human trainer in the loop",
    desc: "Instructional leads review flagged diagnostic patterns and authorize targeted remediation drills with 1 click.",
    activeBadge: "SUPERVISED REVIEW",
  },
  {
    id: "learning",
    title: "Continuous competency tracking",
    desc: "3NF relational records reflect student topic standing, attendance, and defect frequency without spreadsheet drift.",
    activeBadge: "3NF DATA STORE",
  },
  {
    id: "loop",
    title: "Closed-loop remediation",
    desc: "Dispatches practice exercises and schedules private 1:1 mentor syncs to close mastery gaps before finals.",
    activeBadge: "CLOSED LOOP",
  },
];

const SOURCE_PILLS = [
  { label: "VIVA", color: "bg-white/10 text-white" },
  { label: "GIT REPO", color: "bg-white/10 text-white" },
  { label: "REST API", color: "bg-white/10 text-white" },
  { label: "SQLITE", color: "bg-white/10 text-white" },
  { label: "RUBRICS", color: "bg-white/10 text-white" },
  { label: "WEBSOCKET", color: "bg-white/10 text-white" },
];

export function TelemetryIngestionSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [sectionRef, sectionVisible] = useRevealOnScroll();

  return (
    <section className="bg-[#1C2433] py-20 sm:py-28 px-6 sm:px-10 text-white border-b border-white/10 overflow-hidden">
      <div
        ref={sectionRef}
        className={`tiq-reveal ${sectionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12 sm:space-y-16`}
      >
        {/* Top Partner Logo Bar (Matching Video Frame 006) */}
        <div className="flex flex-wrap items-center justify-between gap-6 pb-12 border-b border-white/10 text-white/50 text-xs font-bold tracking-widest uppercase">
          <div className="flex items-center gap-2 text-white/70">
            <Terminal className="w-4 h-4 text-[#E45826]" />
            <span className="font-extrabold text-white text-sm">FastAPI</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Database className="w-4 h-4 text-[#F09A3E]" />
            <span className="font-extrabold text-white text-sm">PostgreSQL</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <FileCode2 className="w-4 h-4 text-[#FBD1A7]" />
            <span className="font-extrabold text-white text-sm">React 18</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Cpu className="w-4 h-4 text-[#E45826]" />
            <span className="font-extrabold text-white text-sm">Python 3.13</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Radio className="w-4 h-4 text-[#F09A3E]" />
            <span className="font-extrabold text-white text-sm">WebSockets</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <GitBranch className="w-4 h-4 text-white" />
            <span className="font-extrabold text-white text-sm">Docker Engine</span>
          </div>
        </div>

        {/* Section Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Interactive Step Selector */}
          <div className="lg:col-span-5 space-y-7">
            <div>
              <span className="inline-block px-3 py-1 rounded bg-white/10 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FBD1A7] mb-4">
                FROM DRILL TO MASTERY
              </span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-white leading-tight">
                See how the portal drives cohort mastery.
              </h2>
              <p className="mt-3.5 text-xs sm:text-sm text-white/70 leading-relaxed">
                The Training Analytics Portal provides objective diagnostics across cohort operations, giving mentors real-time
                intelligence, error clustering, and intervention tracking with zero manual logging.
              </p>
            </div>

            {/* Interactive Vertical Step List */}
            <div className="space-y-3 pt-2">
              {INGESTION_STEPS.map((step, idx) => {
                const isActive = activeStep === idx;
                return (
                  <div
                    key={step.id}
                    onClick={() => setActiveStep(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveStep(idx);
                      }
                    }}
                    className={`rounded-2xl p-4 transition-all duration-300 cursor-pointer border ${
                      isActive
                        ? "bg-white/10 border-white/20 shadow-lg"
                        : "bg-transparent border-transparent hover:bg-white/[0.04] text-white/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold tracking-tight ${isActive ? "text-white" : "text-white/80"}`}>
                        {step.title}
                      </span>
                      {isActive ? (
                        <ArrowRight className="w-4 h-4 text-[#E45826] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      )}
                    </div>
                    {isActive && (
                      <p className="text-xs text-white/75 mt-2 leading-relaxed animate-fadeIn">
                        {step.desc}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Ingestion Node Canvas (Matching Frame 006) */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-[#141B28] border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[520px]">
              {/* Top Source Pills Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 relative z-10">
                {SOURCE_PILLS.map((pill, i) => (
                  <div
                    key={pill.label}
                    className="py-2 px-2.5 rounded-xl bg-white/[0.07] border border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-center text-white/90 shadow-sm"
                  >
                    {pill.label}
                  </div>
                ))}
              </div>

              {/* Converging Signal Lines Diagram & Core Orb */}
              <div className="relative py-8 flex flex-col items-center justify-center my-auto">
                {/* SVG Wiring Converging down */}
                <svg
                  className="w-full h-32 text-white/20"
                  viewBox="0 0 600 120"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path d="M 50 0 C 50 60, 300 30, 300 100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                  <path d="M 150 0 C 150 60, 300 40, 300 100" stroke="currentColor" strokeWidth="2" />
                  <path d="M 250 0 C 250 60, 300 60, 300 100" stroke="currentColor" strokeWidth="2" />
                  <path d="M 350 0 C 350 60, 300 60, 300 100" stroke="currentColor" strokeWidth="2" />
                  <path d="M 450 0 C 450 60, 300 40, 300 100" stroke="currentColor" strokeWidth="2" />
                  <path d="M 550 0 C 550 60, 300 30, 300 100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                </svg>

                {/* Glowing Core Collector Orb */}
                <div className="relative -mt-4">
                  <div className="tiq-glow-core w-12 h-12 rounded-full bg-gradient-to-tr from-[#E45826] to-[#F59E0B] flex items-center justify-center shadow-[0_0_30px_rgba(228,88,38,0.8)] z-20 relative">
                    <span className="w-3.5 h-3.5 rounded-full bg-white shadow-inner" />
                  </div>
                </div>

                {/* Laser Pulse Beam streaming down to summary card */}
                <div
                  className="tiq-laser-beam w-1.5 h-12 my-1 rounded-full"
                  style={{
                    background: "linear-gradient(to bottom, #E45826 0%, #F59E0B 100%)",
                    boxShadow: "0 0 16px rgba(228,88,38,0.8)",
                  }}
                />
              </div>

              {/* Bottom White Summary Card (Matching "Freight Data Summary" in Frame 006) */}
              <div className="rounded-2xl bg-white text-[#1C1B17] p-5 sm:p-6 shadow-xl relative z-10 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#1C1B17]">
                    Cohort Telemetry Summary
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Real-Time Stream Active</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#F8F7F4] border border-black/[0.04] flex items-center gap-2.5">
                    <span className="text-base">📍</span>
                    <div>
                      <div className="font-bold text-[#1C1B17]">Batch A → Cloud & DevOps Track</div>
                      <div className="text-[10px] text-[#787063]">Assigned Faculty Mentor • Cloud Track</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8F7F4] border border-black/[0.04] flex items-center gap-2.5">
                    <span className="text-base">👥</span>
                    <div>
                      <div className="font-bold text-[#1C1B17]">42 Enrolled Trainees</div>
                      <div className="text-[10px] text-[#787063]">100% Verified Database Profiles</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8F7F4] border border-black/[0.04] flex items-center gap-2.5">
                    <span className="text-base">⚠️</span>
                    <div>
                      <div className="font-bold text-[#1C1B17]">SQL Joins Hotspot (64% avg)</div>
                      <div className="text-[10px] text-[#787063]">Remediation Set 2 auto-suggested</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8F7F4] border border-black/[0.04] flex items-center gap-2.5">
                    <span className="text-base">📅</span>
                    <div>
                      <div className="font-bold text-[#1C1B17]">Today · 15-Second Sync</div>
                      <div className="text-[10px] text-[#787063]">Zero phantom fallback metrics</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TelemetryIngestionSection;

