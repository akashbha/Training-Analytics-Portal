// src/components/ModuleDiagnosticLedger.jsx
// Curriculum Module Mastery & Defect Diagnostics Grid
// Replaces polar radar chart with a structured curriculum matrix comparing trainee module scores and defect rates against thresholds.

import React, { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD } from "../constants/thresholds.js";

function getCategoryPill(name = "") {
  const n = name.toLowerCase();
  if (n.includes("docker") || n.includes("deployment") || n.includes("ci/cd")) {
    return { label: "DevOps & Infra", bg: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  if (n.includes("fastapi") || n.includes("rest") || n.includes("security") || n.includes("auth")) {
    return { label: "Backend API", bg: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (n.includes("sql") || n.includes("postgres") || n.includes("data")) {
    return { label: "Data & Storage", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: "Core Logic", bg: "bg-amber-50 text-amber-700 border-amber-200" };
}

export function ModuleDiagnosticLedger({
  errorStats = [],
  sessions = [],
  toleranceBenchmark = 2.0,
  onStartPractice,
  onAskTutor,
}) {
  const moduleMatrix = useMemo(() => {
    const map = {};

    (errorStats || []).forEach((item) => {
      map[item.module_name] = {
        module_name: item.module_name,
        avg_errors: item.avg_errors != null ? item.avg_errors : 0,
        session_count: item.session_count || 0,
        scores: [],
      };
    });

    (sessions || []).forEach((s) => {
      const name = s.module_name;
      if (!name) return;
      if (!map[name]) {
        map[name] = {
          module_name: name,
          avg_errors: s.errors != null ? s.errors : 0,
          session_count: 0,
          scores: [],
        };
      }
      const scoreVal =
        s.score_percentage != null
          ? s.score_percentage
          : s.score_pct != null
          ? s.score_pct
          : s.module_max_score && s.module_max_score > 0
          ? (s.score / s.module_max_score) * 100
          : s.score;
      if (scoreVal != null && !isNaN(scoreVal)) {
        map[name].scores.push(scoreVal);
      }
    });

    return Object.values(map)
      .map((mod) => {
        const avgScore =
          mod.scores.length > 0
            ? mod.scores.reduce((a, b) => a + b, 0) / mod.scores.length
            : null;
        const totalSessions = mod.session_count || mod.scores.length || 0;
        return {
          ...mod,
          avg_score: avgScore,
          session_count: totalSessions,
        };
      })
      .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));
  }, [errorStats, sessions]);

  const defectExtremes = useMemo(() => {
    if (!errorStats || errorStats.length === 0) return null;
    const sorted = [...errorStats].sort((a, b) => a.avg_errors - b.avg_errors);
    return {
      lowest: sorted[0],
      highest: sorted[sorted.length - 1],
    };
  }, [errorStats]);

  if (moduleMatrix.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        No module performance records available.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Metric Legend & Benchmarks */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-700">Mastery (&gt;= {EXCELLENT_THRESHOLD}%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="font-semibold text-slate-700">Competent (&gt;= {PASS_THRESHOLD}%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="font-semibold text-slate-700">Needs Focus (&lt; {PASS_THRESHOLD}%)</span>
          </div>
        </div>

        {defectExtremes && (
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              Lowest Defects: {defectExtremes.lowest.module_name.split(" ")[0]} ({defectExtremes.lowest.avg_errors.toFixed(1)})
            </span>
            {defectExtremes.highest.avg_errors > toleranceBenchmark && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200">
                Focus Need: {defectExtremes.highest.module_name.split(" ")[0]} ({defectExtremes.highest.avg_errors.toFixed(1)} errs)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Curriculum Module Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Module</th>
              <th className="py-2.5 px-3">Sessions</th>
              <th className="py-2.5 px-3 min-w-[160px]">Score & Progress</th>
              <th className="py-2.5 px-3">Defects / Session</th>
              <th className="py-2.5 px-3 text-center">Competency Status</th>
              <th className="py-2.5 px-3 text-right">Self-Practice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {moduleMatrix.map((mod, idx) => {
              const cat = getCategoryPill(mod.module_name);
              const score = mod.avg_score != null ? mod.avg_score : null;
              const isMastery = score != null && score >= EXCELLENT_THRESHOLD;
              const isCompetent = score != null && score >= PASS_THRESHOLD && score < EXCELLENT_THRESHOLD;
              const isFocus = score != null && score < PASS_THRESHOLD;
              const isDefectOver = mod.avg_errors > toleranceBenchmark;

              return (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  {/* Module Name & Category */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-bold text-slate-900">{mod.module_name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 w-fit ${cat.bg}`}>
                        {cat.label}
                      </span>
                    </div>
                  </td>

                  {/* Sessions */}
                  <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                    {mod.session_count} {mod.session_count === 1 ? "session" : "sessions"}
                  </td>

                  {/* Score & Progress Bar */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900">
                          {score != null ? `${score.toFixed(1)}%` : "No scores"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Pass: {PASS_THRESHOLD}%
                        </span>
                      </div>
                      <div className="relative w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isMastery
                              ? "bg-emerald-500"
                              : isCompetent
                              ? "bg-blue-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(3, score || 0))}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Defects */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <span className={`font-mono font-bold text-xs ${isDefectOver ? "text-rose-600" : "text-slate-700"}`}>
                        {mod.avg_errors.toFixed(1)} errs
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (target: &lt;= {toleranceBenchmark.toFixed(1)})
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {score == null ? (
                      <span className="text-[10px] text-slate-400 font-medium">Pending Drills</span>
                    ) : isMastery ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Mastery</span>
                      </span>
                    ) : isCompetent ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span>Competent</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Needs Focus</span>
                      </span>
                    )}
                  </td>

                  {/* Practice Action */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        type="button"
                        onClick={() => onStartPractice && onStartPractice(mod.module_name)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold text-blue-700 hover:text-white hover:bg-blue-600 bg-blue-50/70 border border-blue-200 hover:border-blue-600 transition-colors cursor-pointer shadow-2xs"
                      >
                        Practice Drill
                      </button>
                      <button
                        type="button"
                        onClick={() => onAskTutor && onAskTutor(mod.module_name)}
                        title={`Review ${mod.module_name} tutor notes`}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ModuleDiagnosticLedger;
