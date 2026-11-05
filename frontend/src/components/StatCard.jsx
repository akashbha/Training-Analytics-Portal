// src/components/StatCard.jsx
// Metric display widget showcasing KPIs with animated loading skeletons and value-change flash highlights.
// Smoothly pulses with an accent ring when real-time updates modify the card's value.

import React, { useState, useEffect, useRef } from "react";
import { Card } from "./Card.jsx";

export function StatCard({
  title,
  value,
  subtext,
  badge,
  icon: Icon,
  loading = false,
  variant = "white",
  className = "",
}) {
  const isDark = variant === "dark";

  // Flash highlight on live value update
  const prevValueRef = useRef(value);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (
      prevValueRef.current !== undefined &&
      prevValueRef.current !== null &&
      value !== undefined &&
      value !== null &&
      prevValueRef.current !== value
    ) {
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), 1000);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value]);

  if (loading) {
    return (
      <Card variant={variant} className={`animate-pulse ${className}`}>
        <div className="flex items-center justify-between">
          <div className={`h-4 w-24 rounded ${isDark ? "bg-white/20" : "bg-slate-200"}`}></div>
          <div className={`h-4 w-12 rounded ${isDark ? "bg-white/20" : "bg-slate-200"}`}></div>
        </div>
        <div className={`h-9 w-32 rounded mt-4 ${isDark ? "bg-white/30" : "bg-slate-300"}`}></div>
        {subtext && <div className={`h-3 w-40 rounded mt-2 ${isDark ? "bg-white/20" : "bg-slate-200"}`}></div>}
      </Card>
    );
  }

  const flashStyles = flashing
    ? isDark
      ? "ring-2 ring-blue-300 bg-white/15 scale-[1.02] transition-all duration-300"
      : "ring-2 ring-blue-500/50 bg-blue-50/50 scale-[1.02] transition-all duration-300"
    : "transition-all duration-300";

  return (
    <Card
      variant={variant}
      className={`flex flex-col justify-between ${flashStyles} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] font-bold tracking-wider uppercase ${
            isDark ? "text-slate-400" : "text-slate-400"
          }`}
        >
          {title}
        </span>
        {badge ? (
          <div className="shrink-0">{badge}</div>
        ) : Icon ? (
          <div
            className={`p-1.5 rounded-lg ${
              isDark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <div className="text-3xl font-extrabold tracking-tight transition-transform duration-300 text-slate-900">
          {value !== null && value !== undefined ? value : "—"}
        </div>
        {subtext && (
          <div
            className={`text-xs mt-1.5 font-medium ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {subtext}
          </div>
        )}
      </div>
    </Card>
  );
}

export default StatCard;
