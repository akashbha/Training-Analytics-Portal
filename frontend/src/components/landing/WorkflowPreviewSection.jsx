import React, { useEffect, useState } from "react";
import {
  Activity,
  BrainCircuit,
  MessageSquare,
  Play,
  Sliders,
  UserCheck,
  Code2,
} from "lucide-react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";

const WORKFLOW_NODES = [
  {
    id: 0,
    title: "Session Recorded",
    desc: "Validates drill score (>= 0), errors, and positive completion duration.",
    badge: "INGEST",
    badgeStyle: "bg-[#EAE8E3] text-[#5C5549]",
    Icon: Activity,
  },
  {
    id: 1,
    title: "ML Risk Advisory",
    desc: "Random Forest model flags early struggle patterns with explicit rule fallback.",
    badge: "ADVISORY",
    badgeStyle: "bg-[#EAE8E3] text-[#5C5549]",
    Icon: BrainCircuit,
  },
  {
    id: 2,
    title: "Human in the Loop",
    desc: "Trainer reviews cohort error hotspots and authorizes targeted remediation.",
    badge: "REVIEW",
    badgeStyle: "bg-[#EAE8E3] text-[#5C5549]",
    Icon: UserCheck,
  },
  {
    id: 3,
    title: "Direct Feedback",
    desc: "Broadcasts cohort updates or opens private trainer-trainee threads.",
    badge: "COMMUNICATION",
    badgeStyle: "bg-[#E45826] text-white",
    Icon: MessageSquare,
  },
];

/**
 * Interactive workflow & remediation configurator preview matching the middle
 * product showcase frames (agent config card + 2x2 animated signal pipeline).
 */
export function WorkflowPreviewSection({ onInspectArchitecture }) {
  const [strategy, setStrategy] = useState("Targeted Remediation");
  const [threshold, setThreshold] = useState("70%");
  const [noteTemplate, setNoteTemplate] = useState(
    "Flag cohort hotspots below 70% mastery for guided trainer review..."
  );
  const [liveAlerts, setLiveAlerts] = useState(true);

  const [traceStep, setTraceStep] = useState(null);
  const [row1Ref, row1Visible] = useRevealOnScroll();
  const [row2Ref, row2Visible] = useRevealOnScroll();

  useEffect(() => {
    if (traceStep === null) return;
    if (traceStep >= WORKFLOW_NODES.length) {
      const doneTimer = setTimeout(() => setTraceStep(null), 900);
      return () => clearTimeout(doneTimer);
    }
    const stepTimer = setTimeout(() => {
      setTraceStep((prev) => (prev === null ? null : prev + 1));
    }, 650);
    return () => clearTimeout(stepTimer);
  }, [traceStep]);

  const startTrace = () => {
    setTraceStep(0);
  };

  return (
    <section id="workflows" className="relative py-20 sm:py-28 px-6 sm:px-10 max-w-6xl mx-auto">
      {/* Row 1: Configurator Card Left + Editorial Copy Right */}
      <div
        ref={row1Ref}
        className={`tiq-reveal ${row1Visible ? "tiq-revealed" : ""} grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center`}
      >
        {/* Interactive Rule Configurator Mockup */}
        <div className="lg:col-span-6">
          <div className="rounded-3xl bg-[#ECEAE5] p-6 sm:p-8 shadow-inner border border-black/[0.04]">
            <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-[0_20px_50px_-20px_rgba(28,27,23,0.16)] border border-black/[0.06] space-y-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1C1B17]">
                  <Sliders className="w-3.5 h-3.5 text-[#E45826]" />
                  <span>Cohort Policy Rule</span>
                </div>
                <span className="text-[10px] font-semibold text-[#787063] uppercase tracking-wider">
                  Advisory Preview
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-semibold text-[#787063] mb-1">
                    Workflow Mode
                  </span>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F6F3] border border-black/[0.08] text-xs font-semibold text-[#1C1B17]"
                  >
                    <option value="Targeted Remediation">Targeted Remediation</option>
                    <option value="Error Hotspot Audit">Error Hotspot Audit</option>
                    <option value="Reassessment Gate">Reassessment Gate</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[10px] font-semibold text-[#787063] mb-1">
                    Mastery Cutoff
                  </span>
                  <select
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F7F6F3] border border-black/[0.08] text-xs font-semibold text-[#1C1B17]"
                  >
                    <option value="60%">60% Baseline</option>
                    <option value="70%">70% Remediation</option>
                    <option value="80%">80% Distinction</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="block text-[10px] font-semibold text-[#787063] mb-1">
                  Trainer Action Prompt
                </span>
                <input
                  type="text"
                  value={noteTemplate}
                  onChange={(e) => setNoteTemplate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F7F6F3] border border-black/[0.08] text-xs text-[#1C1B17]"
                />
              </label>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-[#5C5549]">Live Signal Alerts</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={liveAlerts}
                  onClick={() => setLiveAlerts((v) => !v)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                    liveAlerts ? "bg-[#22A06B] justify-end" : "bg-stone-300 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <button
                type="button"
                onClick={startTrace}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E45826] hover:bg-[#cf4c1e] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{traceStep !== null ? "Tracing Signal Pipeline..." : "Preview Remediation Flow"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Copy */}
        <div className="lg:col-span-6 space-y-4">
          <span className="inline-block px-3 py-1 rounded-md bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
            COHORT GOVERNANCE
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1B17] leading-tight">
            Configure Remediation Flows in Minutes
          </h2>
          <p className="text-sm sm:text-base text-[#5C5549] leading-relaxed max-w-lg">
            Define pass benchmarks, surface misconception clusters per module, and keep
            every intervention trainer-reviewed before any cohort decision is made.
          </p>
        </div>
      </div>

      {/* Row 2: Copy Left + 2x2 Signal Workflow Canvas Right */}
      <div
        ref={row2Ref}
        className={`tiq-reveal ${row2Visible ? "tiq-revealed" : ""} mt-24 sm:mt-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center`}
      >
        <div className="lg:col-span-5 space-y-4">
          <span className="inline-block px-3 py-1 rounded-md bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
            SIGNAL PIPELINE
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1B17] leading-tight">
            Turn Raw Drills Into Guided Action
          </h2>
          <p className="text-sm sm:text-base text-[#5C5549] leading-relaxed">
            Every submitted assessment passes strict schema validation, updates cohort
            rankings, triggers advisory risk checks, and notifies assigned trainers inside
            scoped communication channels.
          </p>
        </div>

        {/* 2x2 Node Canvas */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl bg-[#ECEAE5] p-5 sm:p-7 border border-black/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WORKFLOW_NODES.map(({ id, title, desc, badge, badgeStyle, Icon }) => {
                const isHighlighted = traceStep === id;
                const isDone = traceStep !== null && traceStep > id;
                return (
                  <div
                    key={id}
                    className={`rounded-2xl p-5 bg-white border transition-all duration-300 flex flex-col justify-between min-h-[164px] ${
                      isHighlighted
                        ? "border-[#E45826] ring-2 ring-[#E45826]/20 shadow-lg -translate-y-0.5"
                        : isDone
                        ? "border-emerald-400/60 shadow-sm"
                        : "border-black/[0.05] shadow-[0_8px_24px_-16px_rgba(28,27,23,0.18)] hover:-translate-y-0.5"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-[#1C1B17]">
                        <Icon
                          className={`w-4 h-4 ${isHighlighted ? "text-[#E45826]" : "text-[#1C1B17]"}`}
                        />
                        <span className="text-xs font-bold">{title}</span>
                      </div>
                      <p className="text-[11px] text-[#787063] mt-2 leading-relaxed">{desc}</p>
                    </div>

                    <div className="pt-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeStyle}`}
                      >
                        {badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Floating Workflow Control Bar */}
            <div className="mt-4 rounded-2xl bg-white/95 border border-black/[0.06] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#F3F1ED] flex items-center justify-center text-[#1C1B17]">
                  <BrainCircuit className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-bold text-[#1C1B17]">{strategy}</div>
                  <div className="text-[10px] text-[#787063]">
                    Cutoff: {threshold} · {liveAlerts ? "Alerts enabled" : "Alerts paused"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onInspectArchitecture}
                  className="px-3 py-1.5 rounded-lg border border-black/10 text-[10px] font-bold uppercase tracking-wider text-[#5C5549] hover:text-[#1C1B17] hover:bg-[#F7F6F3] transition-colors flex items-center gap-1.5"
                >
                  <Code2 className="w-3 h-3" />
                  <span>Inspect Stack</span>
                </button>
                <button
                  type="button"
                  onClick={startTrace}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1F2735] hover:bg-[#141923] text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{traceStep !== null ? "Running..." : "Run Trace"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

