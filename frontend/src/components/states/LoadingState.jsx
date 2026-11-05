// src/components/states/LoadingState.jsx
// Reusable, theme-consistent loading state component for portal dashboards and analytical cards.
// Supports full-page, section, and compact container layouts.

import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingState({
  message = "Loading analytics...",
  description = null,
  size = "md",
  compact = false,
  className = "",
}) {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const iconSize = sizeMap[size] || sizeMap.md;

  if (compact) {
    return (
      <div
        className={`flex items-center justify-center space-x-2 py-4 px-3 text-slate-500 text-xs font-medium ${className}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className={`${iconSize} animate-spin text-blue-600 shrink-0`} />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 space-y-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 shadow-2xs">
        <Loader2 className={`${iconSize} animate-spin`} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-800 tracking-tight">{message}</p>
        {description && (
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoadingState;

