import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

const ROLE_CARDS = [
  {
    id: "trainer",
    title: "TRAINER CONSOLE",
    desc: "Monitors cohort readiness, error hotspots & remediation outcomes.",
    tags: ["COHORTS", "HOTSPOTS", "REMEDIATION"],
  },
  {
    id: "trainee",
    title: "TRAINEE PORTAL",
    desc: "Tracks completed drills, module mastery & private mentor threads.",
    tags: ["DRILLS", "ASSESSMENTS", "MESSAGES"],
  },
  {
    id: "admin",
    title: "ADMIN GOVERNANCE",
    desc: "Controls user provisioning, batch assignments & audit compliance.",
    tags: ["USERS", "AUDIT LOGS", "ML HEALTH"],
  },
];

/**
 * Interactive stacked workspace card deck with smooth 3D depth cycling matching
 * the bottom-left hero stack in the reference preview.
 */
export function InteractiveRoleDeck() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ROLE_CARDS.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  const cycleNext = () => {
    setActiveIndex((prev) => (prev + 1) % ROLE_CARDS.length);
  };

  return (
    <div className="mt-10 sm:mt-12 max-w-[290px] select-none">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#787063]">
          YOUR WORKSPACE
        </span>
        <div className="flex items-center gap-1">
          {ROLE_CARDS.map((card, i) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Preview ${card.title}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-4 bg-[#E45826]" : "w-1.5 bg-black/15 hover:bg-black/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stacked Depth Cards */}
      <div
        onClick={cycleNext}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cycleNext();
          }
        }}
        aria-label="Cycle portal workspace card"
        className="relative h-[142px] cursor-pointer group"
      >
        {ROLE_CARDS.map((card, idx) => {
          const offset = (idx - activeIndex + ROLE_CARDS.length) % ROLE_CARDS.length;
          const isFront = offset === 0;
          const transformStyle =
            offset === 0
              ? "translateX(0px) translateY(0px) rotate(0deg) scale(1)"
              : offset === 1
              ? "translateX(-14px) translateY(8px) rotate(-3deg) scale(0.95)"
              : "translateX(-26px) translateY(15px) rotate(-6deg) scale(0.9)";

          return (
            <div
              key={card.id}
              className={`absolute inset-0 rounded-2xl p-4 border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isFront
                  ? "bg-white border-black/[0.08] shadow-[0_18px_38px_-14px_rgba(28,27,23,0.18)] z-30 group-hover:-translate-y-0.5"
                  : offset === 1
                  ? "bg-[#F4F2EE] border-black/[0.05] shadow-sm z-20"
                  : "bg-[#EAE7E1] border-black/[0.04] z-10"
              }`}
              style={{ transform: transformStyle }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold tracking-wide text-[#1C1B17]">
                  {card.title}
                </span>
                {isFront && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#787063] group-hover:text-[#E45826] group-hover:translate-x-0.5 transition-all" />
                )}
              </div>
              <p className="text-[11px] text-[#5C5549] mt-1.5 leading-relaxed line-clamp-2">
                {card.desc}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-[#EEECE7] text-[9px] font-bold tracking-wider text-[#5C5549]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

