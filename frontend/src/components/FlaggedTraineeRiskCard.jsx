import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { LoadingState } from "./states/LoadingState";
import { ErrorState } from "./states/ErrorState";

export function formatThresholdWithUnit(risk) {
  if (!risk) return "";
  const unit = risk.threshold_unit;
  const thresh = Number(risk.threshold);

  if (risk.method === "ml" || unit === "probability") {
    const pct = Math.round(thresh * 100);
    return `Decision threshold: ${pct}% probability`;
  }
  if (risk.method === "rule" || unit === "score_percentage") {
    const score = Math.round(thresh);
    return `Pass cutoff: ${score}% average score`;
  }
  return `Threshold: ${thresh}`;
}

function getRiskSeverity(item, riskData) {
  if (riskData && riskData.method === "ml" && riskData.probability != null) {
    if (riskData.probability >= 0.70) {
      return {
        label: "Model risk: high",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        dot: "bg-rose-500",
      };
    }
    if (riskData.probability >= 0.40) {
      return {
        label: "Model risk: moderate",
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
    }
  }

  const avg = item.metrics?.recent_avg_score ?? item.metrics?.overall_avg_score ?? item.avg_score_pct;
  const isCritical =
    item.risk_level === "High" ||
    item.trend === "critical_low" ||
    (item.attention_probability && item.attention_probability >= 70) ||
    (avg != null && avg < 50 && (item.session_count || 0) > 0);

  if (isCritical) {
    return {
      label: "Model risk: high",
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
    };
  }

  const isHigh =
    item.risk_level === "Moderate" ||
    item.trend === "falling" ||
    item.trend === "struggling" ||
    (item.attention_probability && item.attention_probability >= 40) ||
    (avg != null && avg < 60);

  if (isHigh) {
    return {
      label: "Model risk: moderate",
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    };
  }

  return {
    label: "Watch (cold start)",
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  };
}

export function FlaggedTraineeRiskCard({
  trainee,
  batchAvgDisplay = "-",
  onAssignDrill,
}) {
  const traineeId = trainee.trainee_id || trainee.id;
  const traineeName = trainee.trainee_name || trainee.name;
  const sessionCountVal = trainee.session_count ?? trainee.metrics?.session_count ?? 0;

  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRisk = useCallback(async () => {
    if (!traineeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/trainees/${traineeId}/risk`);
      setRiskData(res.data);
    } catch (err) {
      setError(err.message || "Failed to load risk prediction");
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Link
              to={`/trainees/${traineeId}`}
              className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors"
            >
              {traineeName}
            </Link>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Sessions: {sessionCountVal}
          </span>
        </div>
        <LoadingState compact message="Loading risk evaluation..." className="mt-3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Link
              to={`/trainees/${traineeId}`}
              className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors"
            >
              {traineeName}
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            {onAssignDrill && (
              <button
                type="button"
                onClick={onAssignDrill}
                className="px-2.5 py-1 rounded text-white bg-blue-600 hover:bg-blue-700 text-xs font-semibold cursor-pointer"
              >
                Assign Drill
              </button>
            )}
            <Link
              to={`/trainees/${traineeId}`}
              className="px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 border border-slate-200 text-xs font-medium"
            >
              View Dossier
            </Link>
          </div>
        </div>
        <ErrorState compact message={error} onRetry={fetchRisk} className="mt-3" />
      </div>
    );
  }

  const sev = getRiskSeverity(trainee, riskData);
  const isMl = riskData?.method === "ml";
  const plainReason =
    riskData?.reason ||
    (isMl
      ? "Evaluated using the trained machine learning model."
      : "Evaluated using rule fallback.");

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-slate-300">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/trainees/${traineeId}`}
              className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-sm"
            >
              {traineeName}
            </Link>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${sev.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sev.dot}`} />
              {sev.label}
            </span>
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 font-mono">
            <span>Sessions: {sessionCountVal}</span>
            {batchAvgDisplay !== "-" && <span>Batch Avg: {batchAvgDisplay}</span>}
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {onAssignDrill && (
            <button
              type="button"
              onClick={onAssignDrill}
              className="px-2.5 py-1 rounded text-white bg-blue-600 hover:bg-blue-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Assign Drill
            </button>
          )}
          <Link
            to={`/trainees/${traineeId}`}
            className="px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 border border-slate-200 text-xs font-medium transition-colors"
          >
            View Dossier
          </Link>
        </div>
      </div>

      {/* Method Badge and Reason Sentence */}
      <div className="mt-3">
        <div className="flex items-center space-x-2">
          {isMl ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              ML model
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Rule fallback
            </span>
          )}
        </div>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
          {plainReason}
        </p>
      </div>

      {/* Metrics Row: Probability and Threshold with Units */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {/* Probability is shown strictly for ML model only */}
        {isMl && riskData?.probability != null && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">
              Model probability of at-risk outcome
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
              {Math.round(riskData.probability * 100)}%
            </div>
          </div>
        )}

        {/* Threshold with explicit units */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
          <div className="text-[11px] font-medium text-slate-500">
            {isMl ? "Decision Criterion" : "Evaluation Cutoff"}
          </div>
          <div className="text-xs font-semibold text-slate-900 mt-0.5">
            {formatThresholdWithUnit(riskData)}
          </div>
        </div>

        {/* For rule fallback: secondary context without probability */}
        {!isMl && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">
              Evaluation Context
            </div>
            <div className="text-xs font-semibold text-slate-900 mt-0.5 font-mono">
              {sessionCountVal} session(s) logged
            </div>
          </div>
        )}
      </div>

      {/* Top Features (for ML model) */}
      {isMl && riskData?.top_features && riskData.top_features.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Top Model Features
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {riskData.top_features.map((feat, idx) => {
              const importancePct = Math.round(Number(feat.importance) * 100);
              const featureName = feat.feature ? feat.feature.replace(/_/g, " ") : "Feature";
              return (
                <div
                  key={feat.feature || idx}
                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-medium text-slate-800 capitalize">
                      {featureName}
                    </span>
                    {feat.explanation && (
                      <span
                        className="block text-[10px] text-slate-500 mt-0.5 line-clamp-1"
                        title={feat.explanation}
                      >
                        {feat.explanation}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-600">
                    <span>Importance</span>
                    <span className="font-semibold text-slate-900">{importancePct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Global feature importance from the trained model, not an explanation for this trainee specifically.
          </p>
        </div>
      )}
    </div>
  );
}

export default FlaggedTraineeRiskCard;
