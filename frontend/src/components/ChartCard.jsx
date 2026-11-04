// src/components/ChartCard.jsx
// Specialized dashboard card supporting charts and analytical visualizations with dark mode integration.
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
  const isDarkVariant = variant === "dark";

  return (
    <Card variant={variant} className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${
            isDarkVariant ? "text-white" : "text-slate-900 dark:text-slate-100"
          }`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`text-xs mt-0.5 ${
              isDarkVariant ? "text-purple-200" : "text-slate-500 dark:text-slate-400"
            }`}>
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
            <Spinner size="lg" className={isDarkVariant ? "text-white" : "text-brand"} />
            <span className={`text-xs font-medium ${
              isDarkVariant ? "text-purple-200" : "text-slate-500 dark:text-slate-400"
            }`}>
              Loading analytics...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center text-sm font-bold">
              !
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400 max-w-sm">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-xs font-semibold px-4 py-2 bg-brand text-white rounded-full hover:bg-brand-dark transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isDarkVariant
                ? "bg-white/10"
                : "bg-brand-light dark:bg-purple-950/60 text-brand dark:text-purple-300"
            }`}>
              —
            </div>
            <p className={`text-sm font-medium ${
              isDarkVariant ? "text-purple-200" : "text-slate-500 dark:text-slate-400"
            }`}>
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

export default ChartCard;
