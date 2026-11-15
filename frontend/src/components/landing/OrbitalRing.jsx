import React from "react";

export const HERO_STATS = [
  { metric: "3 Roles", label: "Admin · Trainer · Trainee" },
  { metric: "<15s", label: "Live WS & Sync Cadence" },
  { metric: "3NF", label: "Constraint-Backed Store" },
];

// Exact tapered curved wedge matching the circular arc R=593 of the conveyor track
const CURVED_TRAIL_D =
  "M -0.0 -35.0 L -25.8 -31.9 L -51.3 -27.8 L -76.6 -22.6 L -101.5 -16.4 L -126.0 -9.2 L -150.1 -1.1 L -173.8 8.1 L -196.9 18.2 L -219.5 29.1 L -241.6 41.0 L -263.0 53.7 L -256.9 66.3 L -233.9 58.5 L -210.8 51.7 L -187.4 45.8 L -164.0 41.0 L -140.5 37.2 L -116.9 34.4 L -93.3 32.5 L -69.8 31.7 L -46.4 31.8 L -23.1 32.9 L -0.0 35.0 Z";

/**
 * Sweeping 3D Conveyor Ramp with high-speed gliding pucks and cinematic curved blur trails.
 * Faithfully matches the exact 5U AI reference (Image 2 & reference video):
 * - Open sweeping circular conveyor ramp (208px wide) entering from bottom and sweeping up to exit right
 * - Zero return loop (leaving the metrics area wide open in the bottom-right quadrant)
 * - 3D extruded cylindrical pucks with real depth and aerodynamic curved motion blur speed tails
 * - Native 60 FPS compositor-accelerated SVG motion
 */
export function OrbitalScreenArc() {
  // Centerline motion path matching exact 5U AI geometry:
  // Center: (1440, 750), Radius: 593, from 165° to 285°
  const motionPathD = "M 867 904 A 593 593 0 0 1 1594 177";

  // Solid track polygon (outer arc R=697, inner arc R=489)
  const trackPolygonD =
    "M 761 907 A 697 697 0 0 1 1620 77 L 1567 278 A 489 489 0 0 0 972 893 Z";

  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dimensional ramp lighting gradient */}
          <linearGradient
            id="trackSurface"
            x1="800"
            y1="850"
            x2="1550"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#D9D5CC" stopOpacity="0.4" />
            <stop offset="20%" stopColor="#D5D1C7" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#DFDBD1" stopOpacity="0.98" />
            <stop offset="90%" stopColor="#E6E3DB" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#EDEAE2" stopOpacity="0.3" />
          </linearGradient>

          {/* Ramp ambient drop shadow */}
          <filter id="trackAmbientShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow
              dx="-8"
              dy="16"
              stdDeviation="22"
              floodColor="#1C1B17"
              floodOpacity="0.08"
            />
          </filter>

          {/* Aerodynamic Speed Blur Filter for Curved Wedge */}
          <filter id="wedgeBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>

          {/* 3D Puck Face Lighting Gradient */}
          <linearGradient id="puckFaceGrad" x1="20%" y1="10%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="#2A344E" />
            <stop offset="100%" stopColor="#141926" />
          </linearGradient>

          {/* Directional Speed Trail Gradient along curved chord */}
          <linearGradient id="wedgeGrad" x1="0" y1="0" x2="-260" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#101624" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#161F33" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#1C263E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#101624" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Centerline Path Reference for animateMotion */}
        <path id="orbitalCenterPath" d={motionPathD} fill="none" stroke="none" />

        {/* Outer ambient drop shadow under track */}
        <path
          d={trackPolygonD}
          fill="rgba(28,27,23,0.06)"
          filter="url(#trackAmbientShadow)"
        />

        {/* Sculpted solid warm-stone conveyor track (208px wide) */}
        <path d={trackPolygonD} fill="url(#trackSurface)" />

        {/* Machined Inner and Outer Bevel Edges */}
        <path
          d="M 1567 278 A 489 489 0 0 0 972 893"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5"
        />
        <path
          d="M 761 907 A 697 697 0 0 1 1620 77"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
        />

        {/* =========================================================================
            PUCK 1: 3D Extruded Cylinder + Curved Speed Trail (Telemetry Stream)
            ========================================================================= */}
        <g>
          <animateMotion dur="12s" repeatCount="indefinite" rotate="auto">
            <mpath href="#orbitalCenterPath" />
          </animateMotion>

          {/* Curved aerodynamic speed blur tail wrapping along the circular track */}
          <path d={CURVED_TRAIL_D} fill="url(#wedgeGrad)" filter="url(#wedgeBlur)" />

          {/* Puck Contact Shadow */}
          <ellipse cx="4" cy="12" rx="38" ry="32" fill="rgba(15,20,32,0.35)" />

          {/* 3D Extrusion Side Wall */}
          <ellipse cx="0" cy="6" rx="36" ry="34" fill="#0A0D15" />
          <path d="M -36 0 L -36 6 A 36 34 0 0 0 36 6 L 36 0 Z" fill="#0D111C" />

          {/* 3D Puck Top Face */}
          <ellipse
            cx="0"
            cy="0"
            rx="36"
            ry="33"
            fill="url(#puckFaceGrad)"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.5"
          />

          {/* Glowing White Data Stream Icon */}
          <g transform="translate(-12, -14)">
            <rect x="3" y="8" width="4" height="14" rx="2" fill="#FFFFFF" />
            <rect x="10" y="3" width="4" height="24" rx="2" fill="#FFFFFF" />
            <rect x="17" y="7" width="4" height="16" rx="2" fill="#FFFFFF" />
          </g>
        </g>

        {/* =========================================================================
            PUCK 2: 3D Extruded Cylinder + Curved Speed Trail (Execution / Code Stack)
            ========================================================================= */}
        <g>
          <animateMotion dur="12s" begin="-4s" repeatCount="indefinite" rotate="auto">
            <mpath href="#orbitalCenterPath" />
          </animateMotion>

          {/* Curved aerodynamic speed blur tail wrapping along the circular track */}
          <path d={CURVED_TRAIL_D} fill="url(#wedgeGrad)" filter="url(#wedgeBlur)" />

          {/* Puck Contact Shadow */}
          <ellipse cx="4" cy="12" rx="38" ry="32" fill="rgba(15,20,32,0.35)" />

          {/* 3D Extrusion Side Wall */}
          <ellipse cx="0" cy="6" rx="36" ry="34" fill="#0A0D15" />
          <path d="M -36 0 L -36 6 A 36 34 0 0 0 36 6 L 36 0 Z" fill="#0D111C" />

          {/* 3D Puck Top Face */}
          <ellipse
            cx="0"
            cy="0"
            rx="36"
            ry="33"
            fill="url(#puckFaceGrad)"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.5"
          />

          {/* Glowing White M-Shaped / Code Icon */}
          <g transform="translate(-12, -12)">
            <path
              d="M 3 18 L 3 6 L 12 14 L 21 6 L 21 18"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* =========================================================================
            PUCK 3: 3D Extruded Cylinder + Curved Speed Trail (Platform Governance / Teams)
            ========================================================================= */}
        <g>
          <animateMotion dur="12s" begin="-8s" repeatCount="indefinite" rotate="auto">
            <mpath href="#orbitalCenterPath" />
          </animateMotion>

          {/* Curved aerodynamic speed blur tail wrapping along the circular track */}
          <path d={CURVED_TRAIL_D} fill="url(#wedgeGrad)" filter="url(#wedgeBlur)" />

          {/* Puck Contact Shadow */}
          <ellipse cx="4" cy="12" rx="38" ry="32" fill="rgba(15,20,32,0.35)" />

          {/* 3D Extrusion Side Wall */}
          <ellipse cx="0" cy="6" rx="36" ry="34" fill="#0A0D15" />
          <path d="M -36 0 L -36 6 A 36 34 0 0 0 36 6 L 36 0 Z" fill="#0D111C" />

          {/* 3D Puck Top Face */}
          <ellipse
            cx="0"
            cy="0"
            rx="36"
            ry="33"
            fill="url(#puckFaceGrad)"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.5"
          />

          {/* Horizontal multi-band icon matching 5U AI upper puck */}
          <g transform="translate(-14, -12)">
            <rect x="4" y="4" width="20" height="4" rx="2" fill="#FFFFFF" />
            <rect x="4" y="11" width="14" height="4" rx="2" fill="#FFFFFF" />
            <circle cx="21" cy="13" r="2" fill="#FFFFFF" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Three vertical performance metrics nestled deeply inside the concave circle hollow.
 * Exact typography, leading, and open whitespace matching Image 2.
 */
export function HeroMetricsColumn() {
  return (
    <div className="relative z-10 flex flex-col justify-end space-y-6 sm:space-y-7 lg:space-y-8 pr-4 sm:pr-8 lg:pr-14 pointer-events-auto text-left">
      {HERO_STATS.map((item) => (
        <div key={item.metric}>
          <div className="text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-[#1C1B17] leading-none">
            {item.metric}
          </div>
          <div className="text-xs sm:text-[13px] text-[#787063] font-medium mt-1.5 leading-snug">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Backward compatibility wrapper
 */
export function OrbitalRing() {
  return (
    <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[620px] flex items-center justify-end select-none">
      <OrbitalScreenArc />
      <HeroMetricsColumn />
    </div>
  );
}
