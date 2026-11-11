import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BrainCircuit,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Info,
  User,
  Target,
} from "lucide-react";
import { apiClient } from "../api/client.js";
import { LoadingState } from "./states/LoadingState.jsx";
import { ErrorState } from "./states/ErrorState.jsx";
import { PASS_THRESHOLD, COLD_START_CUTOFF } from "../constants/thresholds.js";

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
        label: "Critical Risk",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        dot: "bg-rose-500",
      };
    }
    if (riskData.probability >= 0.40) {
      return {
        label: "Moderate Risk",
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
      label: "Critical Risk",
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
    };
  }

  const isHigh =
    item.risk_level === "Moderate" ||
    item.trend === "falling" ||
    item.trend === "struggling" ||
    (item.attention_probability && item.attention_probability >= 40) ||
    (avg != null && avg < PASS_THRESHOLD);

  if (isHigh) {
    return {
      label: "Moderate Risk",
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    };
  }

  return {
    label: "Cold Start Watch",
    bg: "bg-[#FEF4E8] text-[#D97718] border-[#FBD1A7]",
    dot: "bg-[#F09A3E]",
  };
}

export function FlaggedTraineeRiskCard({
  trainee,
  rank = 1,
  avatarUrl,
  batchAvgDisplay = "-",
  onAssignDrill,
  onMessageTrainee,
}) {
  const navigate = useNavigate();
  const traineeId = trainee.trainee_id || trainee.id;
  const traineeName = trainee.trainee_name || trainee.name || "Trainee";
  const sessionCountVal = trainee.session_count ?? trainee.metrics?.session_count ?? 0;
  const recentScore = trainee.metrics?.recent_avg_score ?? trainee.metrics?.overall_avg_score ?? trainee.avg_score_pct;

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

  const initials = useMemo(() => {
    return traineeName
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "TR";
  }, [traineeName]);

  const isMl = riskData?.method === "ml";
  const sev = getRiskSeverity(trainee, riskData);

  const plainReason = useMemo(() => {
    if (riskData?.reason) {
      return riskData.reason;
    }
    if (trainee.top_risk_factors && trainee.top_risk_factors.length > 0) {
      return trainee.top_risk_factors.join(". ");
    }
    if (isMl) {
      return "Flagged by Random Forest model v1.0 based on session trajectories and score variance.";
    }
    return `Trainee has ${sessionCountVal} session(s) logged (minimum 5 required for ML inference); evaluated using deterministic 60% passing cutoff.`;
  }, [riskData, trainee, isMl, sessionCountVal]);

  const handleRowClick = () => {
    if (traineeId) {
      navigate(`/trainees/${traineeId}`);
    }
  };

  if (loading) {
    return (
      <div className="p-5 rounded-2xl border border-[#F0E3D5] bg-white shadow-[0_2px_12px_rgba(28,27,23,0.03)]">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#1C1B17] text-white font-mono text-xs font-bold flex items-center justify-center">
              #{rank}
            </span>
            <span className="font-bold text-[#1C1B17] text-sm">
              {traineeName}
            </span>
          </div>
          <span className="text-xs text-[#787063] font-mono">
            Sessions: {sessionCountVal}
          </span>
        </div>
        <LoadingState compact message="Retrieving risk telemetry and ML inference..." className="mt-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl border border-[#F0E3D5] bg-white shadow-[0_2px_12px_rgba(28,27,23,0.03)]">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#1C1B17] text-white font-mono text-xs font-bold flex items-center justify-center">
              #{rank}
            </span>
            <span className="font-bold text-[#1C1B17] text-sm">
              {traineeName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onAssignDrill && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignDrill(trainee);
                }}
                className="px-3 py-1.5 rounded-xl text-white bg-[#F09A3E] hover:bg-[#D97718] text-xs font-bold transition-all cursor-pointer"
              >
                Assign Drill
              </button>
            )}
            <Link
              to={`/trainees/${traineeId}`}
              className="px-3 py-1.5 rounded-xl text-[#1C1B17] hover:bg-[#FEF4E8] border border-[#F0E3D5] text-xs font-bold transition-all"
            >
              View Dossier
            </Link>
          </div>
        </div>
        <ErrorState compact message={error} onRetry={fetchRisk} className="mt-4" />
      </div>
    );
  }

  return (
    <div
      onClick={handleRowClick}
      className="group p-5 rounded-2xl border border-[#F0E3D5] bg-white shadow-[0_2px_12px_rgba(28,27,23,0.03)] hover:border-[#D97718]/50 hover:shadow-[0_8px_24px_rgba(28,27,23,0.07)] transition-all cursor-pointer"
      title={`Click to view dossier for ${traineeName}`}
    >
      {/* 1. Header Row: Rank, Avatar, Identity, Severity Badge, Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E3D5]">
        <div className="flex items-center gap-3.5">
          {/* Priority Rank Pill */}
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-xs font-black shadow-2xs shrink-0 ${
              rank === 1
                ? "bg-[#F09A3E] text-white"
                : "bg-[#1C1B17] text-white"
            }`}
            title={`Priority Rank #${rank}`}
          >
            #{rank}
          </div>

          {/* Photographic Portrait Avatar / Initials Fallback */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={traineeName}
                className="w-11 h-11 rounded-xl object-cover border border-[#F0E3D5] shadow-2xs"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`w-11 h-11 rounded-xl bg-[#1C1B17] text-[#F09A3E] font-extrabold flex items-center justify-center text-sm shadow-2xs border border-[#272520] ${
                avatarUrl ? "hidden" : "flex"
              }`}
            >
              {initials}
            </div>
          </div>

          {/* Identity & Secondary Meta */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/trainees/${traineeId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-base font-extrabold text-[#1C1B17] hover:text-[#D97718] transition-colors tracking-tight"
              >
                {traineeName}
              </Link>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${sev.bg}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sev.dot}`} />
                {sev.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#787063] font-medium mt-1">
              <span className="font-mono text-[11px] bg-[#FEF4E8] text-[#D97718] px-2 py-0.5 rounded-md border border-[#FBD1A7]/60 font-bold">
                N = {sessionCountVal} sessions
              </span>
              {recentScore != null && (
                <span>
                  Recent avg: <strong className="text-[#1C1B17]">{Number(recentScore).toFixed(1)}%</strong>
                </span>
              )}
              {batchAvgDisplay !== "-" && (
                <span className="text-[#A2998A]">
                  (Cohort mean: {batchAvgDisplay})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Assign Drill, Direct Message, View Dossier */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {onAssignDrill && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAssignDrill(trainee);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Assign Drill</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onMessageTrainee) {
                onMessageTrainee(trainee);
              } else {
                navigate(`/messages?user=${traineeId}&name=${encodeURIComponent(traineeName)}`);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FEF4E8] text-[#1C1B17] border border-[#F0E3D5] text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title={`Direct message ${traineeName}`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#D97718]" />
            <span>Message</span>
          </button>

          <Link
            to={`/trainees/${traineeId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FEF4E8] text-[#1C1B17] border border-[#F0E3D5] text-xs font-bold shadow-2xs transition-all"
            title="Open comprehensive dossier"
          >
            <span>Dossier</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#A2998A]" />
          </Link>
        </div>
      </div>

      {/* 2. Method Badge and Honest Plain Reason Sentence */}
      <div className="mt-4">
        <div className="flex items-center gap-2">
          {isMl ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#1C1B17] text-white border border-[#272520] shadow-2xs">
              <BrainCircuit className="w-3.5 h-3.5 text-[#F09A3E]" />
              <span>ML Model (Random Forest v1.0)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FEF4E8] text-[#D97718] border border-[#FBD1A7]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#D97718]" />
              <span>Rule Fallback (Cold Start)</span>
            </span>
          )}

          <span className="text-[11px] text-[#A2998A] font-medium hidden sm:inline">
            {isMl
              ? "Inference evaluated via dedicated ML microservice"
              : "Rule fallback active: trainee has fewer than 5 evaluations"}
          </span>
        </div>

        {/* Plain Reason Sentence */}
        <div className="mt-2.5 p-3.5 bg-[#FDF8F2] rounded-xl border border-[#F0E3D5] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#D97718] shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-[#4A443B] font-medium leading-relaxed">
            {plainReason}
          </p>
        </div>
      </div>

      {/* 3. Metrics Strip: Probability strictly on ML rows, Cutoff threshold for all */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3.5">
        {/* Probability Card: STRICTLY for ML Model rows only */}
        {isMl && riskData?.probability != null ? (
          <div className="p-3.5 bg-[#FAF6F0] rounded-xl border border-[#F0E3D5] flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[#787063] uppercase tracking-wider flex items-center justify-between">
              <span>Model Probability</span>
              <span className="text-[10px] text-[#D97718] font-bold uppercase tracking-wider">
                ML Inference
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-[#1C1B17] tabular-nums">
                {Math.round(riskData.probability * 100)}%
              </span>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                At-Risk Likelihood
              </span>
            </div>
            <div className="text-[11px] text-[#A2998A] mt-1 font-medium">
              Probability estimated by Random Forest classifier
            </div>
          </div>
        ) : (
          /* For Rule Fallback: Explicitly stating that probability is not computed */
          <div className="p-3.5 bg-[#FAF6F0] rounded-xl border border-[#F0E3D5] flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[#787063] uppercase tracking-wider flex items-center justify-between">
              <span>Model Probability</span>
              <span className="text-[10px] text-[#787063] font-bold uppercase tracking-wider">
                Deterministic
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-sm font-bold text-[#787063] italic">
                No probability (Rule Fallback)
              </span>
            </div>
            <div className="text-[11px] text-[#A2998A] mt-1 font-medium">
              ML inference requires at least 5 logged sessions
            </div>
          </div>
        )}

        {/* Decision / Benchmark Cutoff Card */}
        <div className="p-3.5 bg-[#FAF6F0] rounded-xl border border-[#F0E3D5] flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-[#787063] uppercase tracking-wider flex items-center justify-between">
            <span>{isMl ? "Decision Criterion" : "Evaluation Cutoff"}</span>
            <span className="text-[10px] text-[#787063] font-mono">
              {isMl ? "Microservice" : "Roster Policy"}
            </span>
          </div>
          <div className="text-sm sm:text-base font-bold text-[#1C1B17] mt-1">
            {formatThresholdWithUnit(riskData)}
          </div>
          <div className="text-[11px] text-[#A2998A] mt-1 font-medium">
            {isMl
              ? "Positive risk threshold configured on model endpoint"
              : `Minimum passing standard (${PASS_THRESHOLD}% benchmark)`}
          </div>
        </div>
      </div>

      {/* 4. Top Influencing Features (Model Audit Trail for ML inference only) */}
      {isMl && riskData?.top_features && riskData.top_features.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-[#F0E3D5]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-[#787063] uppercase tracking-wider">
              Top Influencing Model Features
            </span>
            <span className="text-[10px] font-mono text-[#A2998A]">
              Model Card Version {riskData.model_version || "1.0.0"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {riskData.top_features.map((feat, idx) => {
              const importancePct = Math.round(Number(feat.importance) * 100);
              const featureName = feat.feature ? feat.feature.replace(/_/g, " ") : "Feature";
              return (
                <div
                  key={feat.feature || idx}
                  className="p-3 bg-white rounded-xl border border-[#F0E3D5] flex items-center justify-between shadow-2xs"
                >
                  <div className="pr-2">
                    <div className="text-xs font-bold text-[#1C1B17] capitalize">
                      {featureName}
                    </div>
                    <div className="text-[10px] text-[#A2998A] mt-0.5 truncate" title={feat.explanation}>
                      {feat.explanation || "Global model card feature weight"}
                    </div>
                  </div>
                  <div className="text-right pl-3 shrink-0">
                    <span className="text-xs font-extrabold text-[#D97718] font-mono">
                      {importancePct}%
                    </span>
                    <span className="block text-[9px] uppercase tracking-wider text-[#A2998A] font-medium">
                      Weight
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#A2998A] mt-2 font-medium">
            Global feature importance from the trained model, not an individual counterfactual attribution.
          </p>
        </div>
      )}
    </div>
  );
}

export default FlaggedTraineeRiskCard;
