// src/components/StatCard.jsx
// Metric display widget showcasing KPIs with animated loading skeletons, dark mode support, and value-change flash highlights.
// Smoothly pulses with a brand purple glow when real-time updates modify the card's value.

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
  const isDarkVariant = variant === "dark";

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
          <div className={`h-4 w-24 rounded ${isDarkVariant ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700/60"}`}></div>
          {Icon && <div className={`w-8 h-8 rounded-full ${isDarkVariant ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700/60"}`}></div>}
        </div>
        <div className={`h-9 w-32 rounded mt-4 ${isDarkVariant ? "bg-white/30" : "bg-slate-300 dark:bg-slate-700"}`}></div>
        {subtext && <div className={`h-3 w-40 rounded mt-2 ${isDarkVariant ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700/60"}`}></div>}
      </Card>
    );
  }

  const flashStyles = flashing
    ? isDarkVariant
      ? "ring-2 ring-purple-300 bg-white/15 scale-[1.02] transition-all duration-300"
      : "ring-2 ring-brand/60 bg-purple-50/90 dark:bg-purple-900/40 shadow-md scale-[1.02] transition-all duration-300"
    : "transition-all duration-300";

  return (
    <Card
      variant={variant}
      className={`flex flex-col justify-between ${flashStyles} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold tracking-wide uppercase ${
            isDarkVariant ? "text-purple-200" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {title}
        </span>
        {badge ? (
          <div className="shrink-0">{badge}</div>
        ) : Icon ? (
          <div
            className={`p-2 rounded-xl ${
              isDarkVariant
                ? "bg-white/10 text-white"
                : "bg-brand-light dark:bg-purple-950/60 text-brand dark:text-purple-300"
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <div className={`text-3xl font-extrabold tracking-tight transition-transform duration-300 ${
          isDarkVariant ? "text-white" : "text-slate-900 dark:text-slate-100"
        }`}>
          {value !== null && value !== undefined ? value : "—"}
        </div>
        {subtext && (
          <div
            className={`text-xs mt-1.5 font-medium ${
              isDarkVariant ? "text-purple-200/80" : "text-slate-500 dark:text-slate-400"
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
