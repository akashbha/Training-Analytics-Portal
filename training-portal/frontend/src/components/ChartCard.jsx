// src/components/ChartCard.jsx
// Specialized dashboard card supporting charts and analytical visualizations.
// Encapsulates loading skeleton states, graceful empty conditions, and actionable retry errors.

import React from "react";
import { Card } from "./Card.jsx";
import { Spinner } from "./Spinner.jsx";

export function ChartCard({
  title,
  subtitle,
  children,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "No data recorded for this view",
  onRetry = null,
  action = null,
  className = "",
  variant = "white",
}) {
  const isDark = variant === "dark";

  return (
    <Card variant={variant} className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && (
            <p className={`text-xs mt-0.5 ${isDark ? "text-purple-200" : "text-slate-500"}`}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* State Transitions */}
      <div className="flex-1 min-h-[220px] flex items-center justify-center">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center py-10 space-y-3">
            <Spinner size="lg" className={isDark ? "text-white" : "text-brand"} />
            <span className={`text-xs font-medium ${isDark ? "text-purple-200" : "text-slate-500"}`}>
              Loading analytics...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">
              !
            </div>
            <p className="text-sm font-medium text-red-600 max-w-sm">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-xs font-semibold px-4 py-2 bg-brand text-white rounded-full hover:bg-brand-dark transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-brand-light text-brand"}`}>
              —
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-purple-200" : "text-slate-500"}`}>
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div className="w-full h-full">{children}</div>
        )}
      </div>
    </Card>
  );
}
