import React from "react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";
import { Terminal, ShieldAlert, BookOpen, Layers, Check, Database, Cpu } from "lucide-react";

const STACK_APPS = [
  { name: "FastAPI", tag: "REST API", icon: "⚡" },
  { name: "React 18", tag: "Vite SPA", icon: "⚛️" },
  { name: "PostgreSQL", tag: "3NF Relational", icon: "🐘" },
  { name: "SQLAlchemy", tag: "ORM Layer", icon: "🧱" },
  { name: "Alembic", tag: "Migrations", icon: "📐" },
  { name: "Docker", tag: "Containers", icon: "🐳" },
  { name: "Scikit-Learn", tag: "Advisory ML", icon: "🧠" },
  { name: "TailwindCSS", tag: "Styling", icon: "🎨" },
];

const CORE_CAPABILITIES = [
  { label: "Cohort Multi-Tenant RBAC", Icon: Layers, tag: "Auth" },
  { label: "DevOps Learning Path & CLI", Icon: BookOpen, tag: "Curriculum" },
  { label: "Anti-Gaming Practice Indexes", Icon: ShieldAlert, tag: "Integrity" },
  { label: "Advisory ML Telemetry Cards", Icon: Cpu, tag: "Governance" },
];

export function KeyFeaturesBentoSection() {
  const [sectionRef, sectionVisible] = useRevealOnScroll();

  return (
    <section className="bg-[#FAF8F5] py-20 sm:py-28 px-6 sm:px-10 border-b border-black/[0.05]">
      <div
        ref={sectionRef}
        className={`tiq-reveal ${sectionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12 sm:space-y-14`}
      >
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17] leading-tight">
              Key Features Powering Technical Training
            </h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-[#787063] leading-relaxed">
            The Training Analytics Portal gives mentors and administrators deep visibility into trainee progression, error hotspots, and curriculum pacing.
          </p>
        </div>

        {/* 4-Card Horizontal Bento Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {/* Card 1: Verified Stack */}
          <div className="rounded-3xl bg-[#F0F2F6] p-6 flex flex-col justify-between border border-black/[0.04] shadow-sm hover:-translate-y-1 transition-all duration-300">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5C5549]">
                VERIFIED TECH STACK
              </span>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {STACK_APPS.slice(0, 6).map((app) => (
                  <div
                    key={app.name}
                    className="p-2.5 rounded-xl bg-white border border-black/[0.05] shadow-xs flex items-center gap-2"
                  >
                    <span className="text-sm">{app.icon}</span>
                    <span className="text-[11px] font-bold text-[#1C1B17] truncate">{app.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-black/[0.06]">
              <h3 className="text-sm font-extrabold text-[#1C1B17]">Strictly Relational & Typed</h3>
              <p className="text-[11px] text-[#5C5549] mt-1.5 leading-relaxed">
                FastAPI endpoints with Pydantic validation backed by 20 SQLAlchemy relational models and Alembic migrations.
              </p>
            </div>
          </div>

          {/* Card 2: Clean High-Density Telemetry Card (Replaces glitchy datacenter photo) */}
          <div className="rounded-3xl bg-[#1C2331] text-white p-6 flex flex-col justify-between border border-white/10 shadow-sm hover:-translate-y-1 transition-all duration-300">
            <div>
              <span className="px-2.5 py-1 rounded bg-white/20 backdrop-blur-sm text-[10px] font-extrabold uppercase tracking-wider text-white">
                HIGH INTEGRITY
              </span>

              <div className="mt-5 space-y-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-white/80">
                    <span>Practice Session Split</span>
                    <span className="text-emerald-400 font-mono font-bold">is_practice: true</span>
                  </div>
                  <div className="text-[10px] text-white/50">Zero grade contamination on drills</div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-white/80">
                    <span>Anti-Gaming Constraint</span>
                    <span className="text-emerald-400 font-mono font-bold">1 Graded / Module</span>
                  </div>
                  <div className="text-[10px] text-white/50">Partial unique index protection</div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <h3 className="text-base font-extrabold text-white leading-tight">Assessment Anti-Gaming</h3>
              <p className="text-[11px] text-white/70 mt-1 leading-relaxed">
                Database-level partial unique indexes prevent retry abuse while allowing unlimited low-stakes practice drills.
              </p>
            </div>
          </div>

          {/* Card 3: Core Multimodal Capabilities */}
          <div className="rounded-3xl bg-[#FAF0E6] p-6 flex flex-col justify-between border border-[#F3DFC9] shadow-sm hover:-translate-y-1 transition-all duration-300">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A26229]">
                CORE WORKFLOWS
              </span>
              <div className="space-y-2 mt-4">
                {CORE_CAPABILITIES.map(({ label, Icon, tag }) => (
                  <div
                    key={label}
                    className="p-2.5 rounded-xl bg-white/90 border border-[#F3DFC9] flex items-center justify-between text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-[#E45826]" />
                      <span className="font-bold text-[#1C1B17] text-[11px]">{label}</span>
                    </div>
                    <span className="text-[9px] font-bold text-[#787063] uppercase">{tag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#F3DFC9]">
              <h3 className="text-sm font-extrabold text-[#1C1B17]">Role-Guarded Dashboards</h3>
              <p className="text-[11px] text-[#5C5549] mt-1.5 leading-relaxed">
                Administrators oversee batch allocations, trainers analyze competency arcs, and trainees execute structured learning modules.
              </p>
            </div>
          </div>

          {/* Card 4: DevOps Learning Track & Evidence Submissions */}
          <div className="rounded-3xl bg-[#ECEAE5] p-6 flex flex-col justify-between border border-black/[0.05] shadow-sm hover:-translate-y-1 transition-all duration-300">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5C5549]">
                CURRICULUM MODULES
              </span>
              <div className="mt-4 p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1C1B17]">
                  <Terminal className="w-4 h-4 text-[#E45826]" />
                  <span>Docker CLI Playbooks</span>
                </div>
                <div className="text-[10px] text-[#5C5549] leading-relaxed">
                  Video lessons, synchronized CLI command sheets, and terminal log evidence submissions.
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                  <Check className="w-3 h-3" />
                  <span>6 Relational Models</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-black/[0.06]">
              <h3 className="text-sm font-extrabold text-[#1C1B17]">Structured Capstone Drills</h3>
              <p className="text-[11px] text-[#5C5549] mt-1.5 leading-relaxed">
                Trainees submit real command outputs for mentor review, building verifiable hands-on engineering competence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default KeyFeaturesBentoSection;