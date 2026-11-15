import React from "react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";
import { ShieldCheck, HeartHandshake, Zap, Target, Database, Cpu, Lock, CheckCircle2 } from "lucide-react";

const ARCHITECTURAL_PILLARS = [
  {
    title: "Honest Session Lifecycle",
    desc: "Strict HTTP-only authentication tokens with automated 401/403 lifecycle interceptors—zero client-side mock bypasses.",
    Icon: Lock,
    badge: "SECURITY",
  },
  {
    title: "Multi-Tenant Cohort RBAC",
    desc: "Role-based authorization guarantees trainers inspect only trainees enrolled in their explicitly assigned batches.",
    Icon: ShieldCheck,
    badge: "ACCESS CONTROL",
  },
  {
    title: "Advisory-Only ML Governance",
    desc: "Ethical AI telemetry surfaces risk factors to human instructors; never automates disciplinary or grading decisions.",
    Icon: Cpu,
    badge: "GOVERNANCE",
  },
  {
    title: "Linear Alembic Foundations",
    desc: "20 relational models governed by a single linear migration chain, supporting least-privilege PostgreSQL roles.",
    Icon: Database,
    badge: "ARCHITECTURE",
  },
];

const PLATFORM_CAPABILITIES = [
  {
    title: "Automate Telemetry, Not Decisions",
    desc: "Capture drill scores, duration, and error patterns continuously while keeping instructors in full control of interventions.",
    Icon: Zap,
  },
  {
    title: "Curriculum Mastery & Playbooks",
    desc: "Integrated DevOps learning path with chunked video streaming, executable CLI playbooks, and capstone evidence submissions.",
    Icon: Target,
  },
  {
    title: "Assessment Integrity",
    desc: "Database-enforced partial indexes separate practice runs from official graded assessments to eliminate gaming vectors.",
    Icon: CheckCircle2,
  },
  {
    title: "Closed-Loop Remediation",
    desc: "Empower mentors with targeted 1:1 goals, session notes, and direct feedback to eliminate recurring skill deficiencies.",
    Icon: HeartHandshake,
  },
];

export function LeadershipAndMissionSection() {
  const [missionRef, missionVisible] = useRevealOnScroll();
  const [valuesRef, valuesVisible] = useRevealOnScroll();
  const [visionRef, visionVisible] = useRevealOnScroll();
  const [teamRef, teamVisible] = useRevealOnScroll();

  return (
    <section className="bg-[#FAF8F5] py-20 sm:py-28 px-6 sm:px-10 border-b border-black/[0.05] space-y-24 sm:space-y-32">
      {/* =========================================================================
          1. CORE MISSION
          ========================================================================= */}
      <div
        id="our-mission"
        ref={missionRef}
        className={`tiq-reveal ${missionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12`}
      >
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549] mb-3">
            PROJECT OBJECTIVE
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17] leading-tight">
            Objective Telemetry for Technical Engineering Cohorts
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#787063]">
            Eliminate administrative grading friction with verified analytics, giving engineering mentors the clarity to focus on personalized instruction.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLATFORM_CAPABILITIES.map(({ title, desc, Icon }) => (
            <div
              key={title}
              className="rounded-3xl bg-white p-6 sm:p-7 border border-black/[0.05] shadow-xs hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[220px]"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#F6F4EF] flex items-center justify-center text-[#E45826] mb-5">
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-[#1C1B17]">{title}</h3>
                <p className="text-[11px] text-[#5C5549] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          2. CORE ARCHITECTURAL PILLARS (Replaces Fake Team / Glitched Images)
          ========================================================================= */}
      <div
        id="architectural-pillars"
        ref={teamRef}
        className={`tiq-reveal ${teamVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12`}
      >
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549] mb-3">
            SYSTEM STANDARDS
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
            Engineered with Production-Grade Rigor
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#787063]">
            Every layer of the Training Analytics Portal is backed by explicit constraints, automated regression tests, and audited access controls.
          </p>
        </div>

        {/* 4 Architectural Cards with Clean SVG Icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ARCHITECTURAL_PILLARS.map((pillar) => {
            const Icon = pillar.Icon;
            return (
              <div
                key={pillar.title}
                className="rounded-3xl bg-white border border-black/[0.05] p-6 shadow-xs hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between min-h-[240px]"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FAF0E6] flex items-center justify-center text-[#E45826]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#A26229] px-2 py-0.5 rounded-full bg-[#FAF0E6]">
                      {pillar.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#1C1B17] tracking-tight">{pillar.title}</h3>
                  <p className="text-[11px] text-[#5C5549] mt-2.5 leading-relaxed">{pillar.desc}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-black/[0.05] flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified in Regression Suite</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default LeadershipAndMissionSection;