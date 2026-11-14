// src/components/PracticeHistoryTable.jsx
// Displays historical self-assessment practice drill attempts.
// Replaces static scatter plot with an auditable activity history.

import React, { useState, useEffect } from "react";
import { CheckCircle2, RotateCcw, Clock, BookOpen, AlertCircle } from "lucide-react";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD } from "../constants/thresholds.js";

export function PracticeHistoryTable({ onReviewDrill, onStartNewDrill }) {
  const [history, setHistory] = useState([]);

  const loadHistory = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("trainee_practice_history") || "[]");
      setHistory(stored);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => loadHistory();
    window.addEventListener("practice_drill_saved", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("practice_drill_saved", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("trainee_practice_history");
    setHistory([]);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2.5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Self-directed practice history
            </h2>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              {history.length} Attempt{history.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log of self-assessment drills and technical question evaluations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              Clear Log
            </button>
          )}
          <button
            type="button"
            onClick={onStartNewDrill}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center space-x-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Launch New Drill</span>
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-slate-700">No Self-Practice Drills Completed Yet</div>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Select any module in the Curriculum Mastery Grid above or click Launch New Drill to test your knowledge with verified technical questions.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Module</th>
                <th className="py-2.5 px-3">Score & Outcome</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Defects</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((record) => {
                const dateStr = record.timestamp
                  ? new Date(record.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Recorded";

                const mins = Math.floor((record.secondsElapsed || 0) / 60);
                const secs = (record.secondsElapsed || 0) % 60;
                const durStr = `${mins}m ${secs}s`;

                const score = record.scorePct != null ? record.scorePct : 0;
                const isMastery = score >= EXCELLENT_THRESHOLD;
                const isPass = score >= PASS_THRESHOLD && !isMastery;

                return (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium">
                      {dateStr}
                    </td>

                    {/* Module Name */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block truncate max-w-xs">
                        {record.moduleName}
                      </span>
                    </td>

                    {/* Score & Outcome */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold tabular-nums text-slate-900 text-xs">
                          {score.toFixed(1)}% ({record.correctCount}/{record.total})
                        </span>
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isMastery
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isPass
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          <span>{isMastery ? "Mastery" : isPass ? "Competent" : "Needs Review"}</span>
                        </span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums text-slate-600 text-[11px]">
                      {durStr}
                    </td>

                    {/* Defects */}
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums">
                      <span
                        className={`text-[11px] font-bold ${
                          record.defects === 0 ? "text-emerald-700" : "text-slate-700"
                        }`}
                      >
                        {record.defects} {record.defects === 1 ? "defect" : "defects"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onReviewDrill && onReviewDrill(record.moduleName)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold text-blue-700 hover:text-white hover:bg-blue-600 bg-blue-50/70 border border-blue-200 transition-colors cursor-pointer"
                      >
                        Retake Drill
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PracticeHistoryTable;

