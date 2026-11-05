// src/components/states/ErrorState.jsx
// Reusable, theme-consistent error state component with optional actionable retry trigger.
// Employs subtle rose accent borders and banners matching the design system with no emojis.

import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export function ErrorState({
  title = "Unable to Load Data",
  message = "An error occurred while retrieving this analytical feed.",
  error = null,
  onRetry = null,
  compact = false,
  className = "",
}) {
  const displayMessage = error || message;

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 ${className}`}
        role="alert"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold truncate">{displayMessage}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shrink-0 transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 space-y-3.5 ${className}`}
      role="alert"
    >
      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 shadow-2xs">
        <AlertTriangle className="w-6 h-6 stroke-[1.75]" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h4 className="text-xs font-bold text-slate-900 tracking-tight">{title}</h4>
        {displayMessage && (
          <p className="text-[11px] text-rose-700 bg-rose-50/70 py-1.5 px-3 rounded-lg border border-rose-200/60 font-medium leading-relaxed break-words">
            {displayMessage}
          </p>
        )}
      </div>
      {onRetry && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry Request</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;

