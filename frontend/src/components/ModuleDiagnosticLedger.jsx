// src/components/ModuleDiagnosticLedger.jsx
// Curriculum Defect Radar: Multi-axis diagnostic polygon comparing module error rates against benchmark tolerance.

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";

export function ModuleDiagnosticLedger({
  errorStats = [],
  sessions = [],
  toleranceBenchmark = 2.0,
}) {
  // Max scale for radar axis (ensures comfortable breathing room)
  const maxScale = useMemo(() => {
    if (!errorStats || errorStats.length === 0) return 6;
    const highest = Math.max(
      toleranceBenchmark * 2,
      ...errorStats.map((m) => m.avg_errors || 0)
    );
    return Math.max(6, Math.ceil(highest + 1));
  }, [errorStats, toleranceBenchmark]);

  // Formatted data for Polar RadarChart
  const radarData = useMemo(() => {
    if (!errorStats || errorStats.length === 0) return [];
    return errorStats.map((m) => {
      // Shortened name for clean polar angle labels
      const cleanLabel =
        m.module_name
          ?.replace(" Engineering", "")
          ?.replace(" Architecture", "") || "Module";

      return {
        module: cleanLabel,
        fullModuleName: m.module_name,
        errors: Number(m.avg_errors.toFixed(1)),
        benchmark: toleranceBenchmark,
        fullMark: maxScale,
        sessionCount: m.session_count,
      };
    });
  }, [errorStats, toleranceBenchmark, maxScale]);

  // Identify lowest error module (safest) & highest error module (needs focus)
  const insights = useMemo(() => {
    if (!errorStats || errorStats.length === 0) return null;
    const sorted = [...errorStats].sort((a, b) => a.avg_errors - b.avg_errors);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
    };
  }, [errorStats]);

  if (!errorStats || errorStats.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400">
        No module diagnostic records available. Complete drills to generate curriculum radar.
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Legend & Analytical Insight Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
        {/* Metric Legend */}
        <div className="flex items-center space-x-4 text-[11px] font-medium text-slate-600">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span className="text-slate-800 font-bold">Trainee Defect Rate</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500"></span>
            <span className="text-slate-800 font-bold">Target Limit (≤{toleranceBenchmark.toFixed(1)} errs)</span>
          </div>
        </div>

        {/* Quick Analytical Insights */}
        {insights && (
          <div className="flex items-center space-x-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              Lowest Defects: {insights.best.module_name.split(" ")[0]} ({insights.best.avg_errors.toFixed(1)})
            </span>
            {insights.worst.avg_errors > toleranceBenchmark && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200">
                Focus Need: {insights.worst.module_name.split(" ")[0]} ({insights.worst.avg_errors.toFixed(1)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dedicated Curriculum Radar Visualization */}
      <div className="w-full h-72 pt-1 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radarData}>
            <PolarGrid stroke="#E2E8F0" strokeDasharray="2 2" />
            <PolarAngleAxis
              dataKey="module"
              tick={{ fill: "#1E293B", fontSize: 11, fontWeight: 700 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, maxScale]}
              tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
              axisLine={false}
            />
            <Radar
              name="Trainee Errors"
              dataKey="errors"
              stroke="#2563EB"
              fill="#3B82F6"
              fillOpacity={0.35}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "#2563EB", strokeWidth: 1.5, stroke: "#FFFFFF" }}
            />
            <Radar
              name="Benchmark Tolerance"
              dataKey="benchmark"
              stroke="#EF4444"
              fill="#EF4444"
              fillOpacity={0.06}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const isExceeded = data.errors > data.benchmark;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 z-50">
                      <div className="font-bold text-slate-100 border-b border-slate-800 pb-1">
                        {data.fullModuleName}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-[11px]">
                        <span className="text-slate-400">Average Defect:</span>
                        <strong className={isExceeded ? "text-rose-400" : "text-emerald-400"}>
                          {data.errors} errors
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-[11px]">
                        <span className="text-slate-400">Benchmark Limit:</span>
                        <strong className="text-slate-200">≤ {data.benchmark} errors</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 pt-0.5">
                        Evaluated across {data.sessionCount} drills
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ModuleDiagnosticLedger;
