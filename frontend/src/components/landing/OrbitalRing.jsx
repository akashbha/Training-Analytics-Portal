import React from "react";
import { Cpu, Database, MessageSquare, Radio, BarChart3, ShieldCheck } from "lucide-react";

const ORBIT_NODES = [
  { id: "ml", label: "ML Predictor", Icon: Cpu, angleDeg: -35, slow: false },
  { id: "ws", label: "Live Stream", Icon: Radio, angleDeg: 85, slow: false },
  { id: "db", label: "3NF Schema", Icon: Database, angleDeg: 205, slow: false },
  { id: "chat", label: "Mentor Chat", Icon: MessageSquare, angleDeg: 25, slow: true },
  { id: "analytics", label: "Cohort Metrics", Icon: BarChart3, angleDeg: 145, slow: true },
  { id: "auth", label: "RBAC Guard", Icon: ShieldCheck, angleDeg: 265, slow: true },
];

const HERO_STATS = [
  { metric: "3 Roles", label: "Admin · Trainer · Trainee" },
  { metric: "<15s", label: "Live WS & Sync Cadence" },
  { metric: "3NF", label: "Constraint-Backed Store" },
];

/**
 * Signature right-side sweeping orbital integration arc with trailing motion blur
 * and vertical capability metrics matching the reference motion layout.
 */
export function OrbitalRing() {
  return (
    <div className="relative h-[430px] sm:h-[500px] lg:h-[560px] w-full flex items-center justify-end select-none overflow-hidden">
      {/* Right-anchored Orbital Arc */}
      <div
        className="relative w-[430px] h-[430px] sm:w-[540px] sm:h-[540px] -mr-[180px] sm:-mr-[150px] lg:-mr-[110px]"
        aria-hidden="true"
      >
        {/* Sculpted thick warm-stone orbital ring track */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "54px solid rgba(214, 211, 204, 0.58)",
            boxShadow:
              "inset 0 12px 32px rgba(28, 27, 23, 0.08), inset 0 -10px 24px rgba(255,255,255,0.65), 0 18px 45px rgba(28, 27, 23, 0.06)",
          }}
        />

        {/* Subtle inner concentric guide ring */}
        <div className="absolute inset-[54px] rounded-full border border-black/[0.06]" />
        <div className="absolute inset-0 rounded-full border border-white/60" />

        {/* Fast Orbit Layer */}
        <div className="tiq-orbit-track absolute inset-0">
          {ORBIT_NODES.filter((n) => !n.slow).map(({ id, Icon, angleDeg }) => (
            <div
              key={id}
              className="absolute inset-0"
              style={{ transform: `rotate(${angleDeg}deg)` }}
            >
              {/* Placed right on the midpoint of the 54px ring border */}
              <div className="absolute left-1/2 top-[3px] -translate-x-1/2 flex items-center">
                {/* Motion blur trailing arc tail */}
                <div
                  className="w-16 h-11 rounded-full -mr-6 blur-[6px] opacity-40"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(28,27,23,0) 0%, rgba(28,27,23,0.55) 100%)",
                  }}
                />
                <div className="tiq-orbit-badge-upright w-12 h-12 rounded-full bg-[#1C2331] border border-white/15 shadow-lg flex items-center justify-center text-white">
                  <Icon className="w-5 h-5 text-[#F5F2EB]" strokeWidth={1.9} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Slower Secondary Orbit Layer */}
        <div className="tiq-orbit-track-slow absolute inset-0">
          {ORBIT_NODES.filter((n) => n.slow).map(({ id, Icon, angleDeg }) => (
            <div
              key={id}
              className="absolute inset-0"
              style={{ transform: `rotate(${angleDeg}deg)` }}
            >
              <div className="absolute left-1/2 top-[4px] -translate-x-1/2 flex items-center">
                <div
                  className="w-12 h-9 rounded-full -mr-5 blur-[5px] opacity-30"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(28,27,23,0) 0%, rgba(228,88,38,0.45) 100%)",
                  }}
                />
                <div className="tiq-orbit-badge-upright-slow w-11 h-11 rounded-full bg-[#242D3F] border border-white/15 shadow-md flex items-center justify-center text-white">
                  <Icon className="w-4 h-4 text-[#FBD1A7]" strokeWidth={2} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right-aligned vertical metric strip centered cleanly inside ring interior */}
      <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-5 text-left pointer-events-auto">
        {HERO_STATS.map((item, idx) => (
          <div
            key={item.metric}
            className={`pr-1 ${idx < HERO_STATS.length - 1 ? "pb-4 border-b border-black/10" : ""}`}
          >
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1B17]">
              {item.metric}
            </div>
            <div className="text-[11px] font-medium text-[#787063] mt-0.5 max-w-[130px] leading-snug">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

