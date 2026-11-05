// src/components/states/EmptyState.jsx
// Reusable, theme-consistent empty state component for data tables, lists, and visualizers.
// Uses neutral slate theme accents with professional Lucide icons and no emojis.

import React from "react";
import { FolderOpen } from "lucide-react";

export function EmptyState({
  title = "No Data Recorded",
  description = "There are no records available for this selection.",
  icon: Icon = FolderOpen,
  action = null,
  compact = false,
  className = "",
}) {
  if (compact) {
    return (
      <div
        className={`flex items-center justify-center space-x-2.5 py-4 px-3 text-slate-400 text-xs text-center ${className}`}
      >
        <Icon className="w-4 h-4 shrink-0 text-slate-400" />
        <span className="font-medium">{title}</span>
        {action && <div className="ml-2">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-4 space-y-3.5 ${className}`}
    >
      <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200/80 text-slate-400 shadow-2xs">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-xs font-bold text-slate-800 tracking-tight">{title}</h4>
        {description && (
          <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;

