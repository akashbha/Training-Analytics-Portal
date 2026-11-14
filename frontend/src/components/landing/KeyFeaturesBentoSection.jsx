import React from "react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";
import featureDatacenterImg from "../../assets/feature-datacenter.jpg";
import { Mic, MessageSquare, FileText, Bell, Check } from "lucide-react";

const STACK_APPS = [
  { name: "VS Code", tag: "Editor", icon: "💻" },
  { name: "GitHub", tag: "Version Ctrl", icon: "🐙" },
  { name: "FastAPI", tag: "REST API", icon: "⚡" },
  { name: "Python", tag: "Core Lang", icon: "🐍" },
  { name: "React", tag: "Frontend", icon: "⚛️" },
  { name: "PostgreSQL", tag: "3NF DB", icon: "🐘" },
  { name: "Docker", tag: "Containers", icon: "🐳" },
  { name: "Jupyter", tag: "Lab Drills", icon: "🪐" },
];

const MULTIMODAL_CHANNELS = [
  { label: "Voice Viva Speech", Icon: Mic, tag: "Audio" },
  { label: "Mentor & Peer Chat", Icon: MessageSquare, tag: "Chat" },
  { label: "Diagnostic PDF Ledgers", Icon: FileText, tag: "Docs" },
  { label: "Remediation Notifications", Icon: Bell, tag: "Alerts" },
];

export function KeyFeaturesBentoSection() {
  const [sectionRef, sectionVisible] = useRevealOnScroll();

  return (
    <section className="bg-[#FAF8F5] py-20 sm:py-28 px-6 sm:px-10 border-b border-black/[0.05]">
      <div
        ref={sectionRef}
        className={`tiq-reveal ${sectionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12 sm:space-y-14`}
      >
        {/* Section Header (Matching Frame 008) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549] mb-3">
              WHY TRAINEEIQ?
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17] leading-tight">
              Key Features That Power Smarter Technical Training
            </h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-[#787063] leading-relaxed">
            TraineeIQ deploys intelligent, cohort-specific capabilities into your workflow, handling trainee evaluations,
            mistake clustering, syllabus pacing, and instructional coordination.
          </p>
        </div>

        {/* 4-Card Horizontal Bento Deck (Matching Frame 008) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {/* Card 1: Keep your existing stack */}
          <div className="rounded-3xl bg-[#F0F2F6] p-6 flex flex-col justify-between border border-black/[0.04] shadow-sm hover:-translate-y-1 transition-all duration-300">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5C5549]">
                INTEGRATED STACK
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
              <h3 className="text-sm font-extrabold text-[#1C1B17]">Keep your existing stack</h3>
              <p className="text-[11px] text-[#5C5549] mt-1.5 leading-relaxed">
                TraineeIQ integrates directly with your code repositories, rubrics, and CI/CD pipelines so mentors focus on coaching.
              </p>
            </div>
          </div>

          {/* Card 2: Scale without new hires (Real Photography!) */}
          <div className="rounded-3xl relative overflow-hidden flex flex-col justify-between p-6 text-white min-h-[380px] border border-black/[0.06] shadow-sm group hover:-translate-y-1 transition-all duration-300">
            {/* Background Photographic Image */}
            <img
              src={featureDatacenterImg}
              alt="Cloud Datacenter Infrastructure"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121926]/95 via-[#182234]/70 to-[#121926]/40" />

            <div className="relative z-10">
              <span className="px-2.5 py-1 rounded bg-white/20 backdrop-blur-sm text-[10px] font-extrabold uppercase tracking-wider text-white">
                HIGH CONCURRENCY
              </span>
            </div>

            <div className="relative z-10 space-y-2">
              <h3 className="text-lg font-extrabold text-white leading-tight">Scale cohorts without burnout</h3>
              <p className="text-[11px] text-white/80 leading-relaxed">
                Automated viva scoring, defect ledgers, and practice set recommendations run 24/7 on autopilot as cohort size doubles.
              </p>
            </div>
          </div>

          {/* Card 3: Always-on multimodal reps */}
          <div className="rounded-3xl bg-[#FAF0E6] p-6 flex flex-col justify-between border border-[#F3DFC9] shadow-sm hover:-translate-y-1 transition-all duration-300">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A26229]">
                MULTIMODAL EVALUATION
              </span>
              <div className="space-y-2 mt-4">
                {MULTIMODAL_CHANNELS.map(({ label, Icon, tag }) => (
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

            <div className="mt-8 pt-4 border-t border-[#EDD5BD]">
              <h3 className="text-sm font-extrabold text-[#1C1B17]">Always-on multimodal reps</h3>
              <p className="text-[11px] text-[#5C5549] mt-1.5 leading-relaxed">
                Viva audio transcripts, pull requests, SQL query logs, and unit test results handled around the clock with zero latency.
              </p>
            </div>
          </div>

          {/* Card 4: No more tribal knowledge (Clean Dark Panel) */}
          <div className="rounded-3xl bg-[#1C2331] text-white p-6 flex flex-col justify-between border border-white/10 shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 80% 20%, rgba(228,88,38,0.7) 0%, transparent 60%)",
              }}
            />
            <div className="relative z-10">
              <span className="px-2.5 py-1 rounded bg-white/10 text-[10px] font-extrabold uppercase tracking-wider text-[#FBD1A7]">
                INSTITUTIONAL MEMORY
              </span>
              <div className="mt-5 space-y-2">
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-2 text-[11px]">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Centralized Question Rubrics</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-2 text-[11px]">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Cross-Cohort Error Ledger</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-2 text-[11px]">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Audit-Logged Interventions</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-8 pt-4 border-t border-white/10">
              <h3 className="text-sm font-extrabold text-white">No more tribal knowledge</h3>
              <p className="text-[11px] text-white/75 mt-1.5 leading-relaxed">
                Grading standards, rubric criteria, and trainee misconception trends live in one place that continuously updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default KeyFeaturesBentoSection;

