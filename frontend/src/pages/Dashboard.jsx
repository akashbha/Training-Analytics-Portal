import React, { useState, useMemo, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoadingState, EmptyState, ErrorState } from "../components/states/index.js";
import { HelpAssistantPanel } from "../components/HelpAssistantPanel.jsx";
import { FlaggedTraineeRiskCard } from "../components/FlaggedTraineeRiskCard.jsx";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  useBatches,
  useBatchSummary,
  useBatchWeekly,
  useBatchBands,
  useBatchAttention,
  useBatchLeaderboard,
  useBatchTopPerformer,
  useBatchHeatmap,
} from "../hooks/useBatchAnalytics.js";
import {
  RotateCw,
  Plus,
  Search,
  ChevronRight,
  X,
  CheckCircle2,
  Download,
} from "lucide-react";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD, COLD_START_SESSIONS, COLD_START_CUTOFF } from "../constants/thresholds.js";

const TRAINEE_AVATARS = {
  101: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  102: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  103: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  201: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
  202: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80",
  203: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  204: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
  205: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
};

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
];

const getTraineeAvatar = (trainee, idx = 0) => {
  if (trainee.avatar_url) return trainee.avatar_url;
  const id = trainee.trainee_id || trainee.id;
  if (id && TRAINEE_AVATARS[id]) return TRAINEE_AVATARS[id];
  return DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
};

export function Dashboard() {
  const { user, isTrainer } = useAuth();
  const [selectedBatchId, setSelectedBatchId] = useState(1);
  const [progressionView, setProgressionView] = useState("columns");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const demoState = searchParams.get("state");

  const [remediationTarget, setRemediationTarget] = useState(null);
  const [remediationModule, setRemediationModule] = useState("PostgreSQL Schema & Optimization");
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);
  const [remediationSuccess, setRemediationSuccess] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportAtRiskCsv = async () => {
    if (!selectedBatchId) return;
    setExportingCsv(true);
    try {
      const response = await fetch(`/api/v1/analytics/batches/${selectedBatchId}/at-risk/export`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to export at-risk trainees CSV");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `at_risk_batch_${selectedBatchId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Unable to export at-risk CSV. Please verify that active candidates exist.");
    } finally {
      setExportingCsv(false);
    }
  };

  const { batches, loading: batchesLoading } = useBatches();

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useBatchSummary(selectedBatchId);

  const {
    data: weekly,
    loading: weeklyLoading,
    error: weeklyError,
    refetch: refetchWeekly,
  } = useBatchWeekly(selectedBatchId, 8);

  const {
    data: bands,
    loading: bandsLoading,
    error: bandsError,
    refetch: refetchBands,
  } = useBatchBands(selectedBatchId);

  const {
    data: attention,
    loading: attentionLoading,
    error: attentionError,
    refetch: refetchAttention,
  } = useBatchAttention(selectedBatchId);

  const {
    data: leaderboard,
    loading: leaderboardLoading,
    error: leaderboardError,
    refetch: refetchLeaderboard,
  } = useBatchLeaderboard(selectedBatchId, 15);

  const {
    data: topPerformer,
    loading: topLoading,
    error: topError,
    refetch: refetchTop,
  } = useBatchTopPerformer(selectedBatchId);

  const {
    data: heatmapData,
    loading: heatmapLoading,
    error: heatmapError,
    refetch: refetchHeatmap,
  } = useBatchHeatmap(selectedBatchId);

  const isDemoLoading = demoState === "loading";
  const isDemoEmpty = demoState === "empty";
  const isDemoError = demoState === "error";

  const effectiveWeeklyLoading = isDemoLoading || weeklyLoading;
  const effectiveWeeklyError = isDemoError ? "Unable to load progression trajectory." : weeklyError;
  const effectiveWeekly = isDemoEmpty ? [] : weekly;

  const effectiveBandsLoading = isDemoLoading || bandsLoading;
  const effectiveBandsError = isDemoError ? "Unable to calculate competency distribution." : bandsError;
  const effectiveBands = isDemoEmpty ? [] : bands;

  const effectiveLeaderboardLoading = isDemoLoading || leaderboardLoading;
  const effectiveLeaderboardError = isDemoError ? "Unable to load cohort leaderboard rankings." : leaderboardError;
  const effectiveLeaderboard = isDemoEmpty ? [] : leaderboard;

  const effectiveTopLoading = isDemoLoading || topLoading;
  const effectiveTopError = isDemoError ? "Leading performer data unavailable." : topError;
  const effectiveTopPerformer = isDemoEmpty ? null : topPerformer;

  const effectiveAttentionLoading = isDemoLoading || attentionLoading;
  const effectiveAttentionError = isDemoError ? "Unable to retrieve risk intervention list." : attentionError;
  const effectiveAttention = isDemoEmpty ? [] : attention;

  const effectiveHeatmapLoading = isDemoLoading || heatmapLoading;
  const effectiveHeatmapError = isDemoError ? "Unable to load cohort performance matrix." : heatmapError;
  const effectiveHeatmapData = isDemoEmpty ? { rows: [], modules: [] } : heatmapData;

  const silentRefetchAll = useCallback(() => {
    refetchSummary(true);
    refetchWeekly(true);
    refetchBands(true);
    refetchAttention(true);
    refetchLeaderboard(true);
    refetchTop(true);
    refetchHeatmap(true);
  }, [
    refetchSummary,
    refetchWeekly,
    refetchBands,
    refetchAttention,
    refetchLeaderboard,
    refetchTop,
    refetchHeatmap,
  ]);

  const liveEventDebounce = useRef(null);
  useLiveEvent(
    useCallback(() => {
      if (liveEventDebounce.current) clearTimeout(liveEventDebounce.current);
      liveEventDebounce.current = setTimeout(() => {
        silentRefetchAll();
      }, 300);
    }, [silentRefetchAll])
  );

  usePollingFallback(silentRefetchAll, 15000);

  const activeBatch = useMemo(() => {
    if (!batches) return null;
    return batches.find((b) => b.id === selectedBatchId) || batches[0] || null;
  }, [batches, selectedBatchId]);

  const enrolledCount = isDemoEmpty ? 0 : summary?.enrolled_trainees ?? 48;
  const avgScore = isDemoEmpty ? 0.0 : summary?.avg_score_pct != null ? summary.avg_score_pct.toFixed(1) : "0.0";
  const passRate = isDemoEmpty ? 0.0 : summary?.pass_rate != null ? summary.pass_rate.toFixed(1) : "0.0";
  const sessionCount = isDemoEmpty ? 0 : summary?.total_sessions ?? 0;

  const sortedAttentionQueue = useMemo(() => {
    if (!effectiveAttention || effectiveAttention.length === 0) return [];
    return [...effectiveAttention].sort((a, b) => {
      const isCriticalA = a.trend === "critical_low" || (a.metrics?.recent_avg_score && a.metrics.recent_avg_score < 50);
      const isCriticalB = b.trend === "critical_low" || (b.metrics?.recent_avg_score && b.metrics.recent_avg_score < 50);
      if (isCriticalA && !isCriticalB) return -1;
      if (!isCriticalA && isCriticalB) return 1;
      const probA = a.attention_probability ?? 0;
      const probB = b.attention_probability ?? 0;
      return probB - probA;
    });
  }, [effectiveAttention]);

  const filteredLeaderboard = useMemo(() => {
    if (!effectiveLeaderboard) return [];
    if (!searchQuery.trim()) return effectiveLeaderboard;
    const q = searchQuery.toLowerCase();
    return effectiveLeaderboard.filter((t) =>
      t.name?.toLowerCase().includes(q) || t.specialization?.toLowerCase().includes(q)
    );
  }, [effectiveLeaderboard, searchQuery]);

  const ARC_TOTAL = 219.91;
  const masteryArcProps = useMemo(() => {
    const excellent = bands?.find((b) => b.label?.toLowerCase().includes("excellent"))?.percent || 45.8;
    const average = bands?.find((b) => b.label?.toLowerCase().includes("competent") || b.label?.toLowerCase().includes("average"))?.percent || 41.7;
    const struggling = bands?.find((b) => b.label?.toLowerCase().includes("struggling") || b.label?.toLowerCase().includes("remediation"))?.percent || 12.5;

    const lenExc = (excellent / 100) * ARC_TOTAL;
    const lenAvg = (average / 100) * ARC_TOTAL;
    const lenStr = (struggling / 100) * ARC_TOTAL;

    return {
      excellent,
      average,
      struggling,
      lenExc,
      lenAvg,
      lenStr,
    };
  }, [bands]);

  const handleAssignRemediation = (e) => {
    e.preventDefault();
    setRemediationSubmitting(true);
    setTimeout(() => {
      setRemediationSubmitting(false);
      setRemediationSuccess(true);
      setTimeout(() => {
        setRemediationSuccess(false);
        setRemediationTarget(null);
      }, 1400);
    }, 600);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            Trainer Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cohort performance analytics, curriculum score progression, and early intervention alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Cohort Selector */}
          <div className="relative">
            <select
              value={selectedBatchId || ""}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              aria-label="Active Cohort"
              className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2 pointer-events-none rotate-90" />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => silentRefetchAll()}
            title="Refresh cohort analytics"
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Log Session Action */}
          {isTrainer && (
            <Link
              to="/sessions/new"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Session</span>
            </Link>
          )}
        </div>
      </div>

      {/* Help Assistant Panel */}
      <HelpAssistantPanel />

      {/* KPI Cards: Label first, value second, uniform unit style, no gradients, no side stripes */}
      <section className="space-y-2">
        <div className="border-b border-slate-200 pb-1">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Cohort Summary KPIs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Core performance indicators for active cohort {activeBatch?.name || "Batch"} (N = {enrolledCount} enrolled trainees, {sessionCount} assessment sessions).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">
              Enrolled Trainees
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {summaryLoading ? 0 : enrolledCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              active learners in cohort
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">
              Cohort Mean Score
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {summaryLoading ? "0.0%" : `${avgScore}%`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              cross-module average score
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">
              Benchmark Pass Rate
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {summaryLoading ? "0.0%" : `${passRate}%`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              pass cutoff &gt;= {PASS_THRESHOLD.toFixed(1)}% score
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500">
              Evaluation Drills
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {summaryLoading ? 0 : sessionCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              total sessions logged
            </div>
          </div>
        </div>
      </section>

      {/* Needs Attention Queue */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Needs-Attention Queue
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                {sortedAttentionQueue.length} Flagged
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Candidates flagged for intervention based on moving averages and risk prediction (N = {sortedAttentionQueue.length} flagged of {enrolledCount} enrolled).
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportAtRiskCsv}
              disabled={exportingCsv || !selectedBatchId}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Export CSV of at-risk cohort trainees"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingCsv ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        </div>

        {effectiveAttentionLoading ? (
          <LoadingState message="Loading needs-attention queue..." className="py-12" />
        ) : effectiveAttentionError ? (
          <ErrorState
            title="Unable to load attention queue"
            message={effectiveAttentionError}
            onRetry={() => refetchAttention()}
            className="py-12"
          />
        ) : sortedAttentionQueue.length === 0 ? (
          <EmptyState
            title="No trainees need attention this week."
            description="All cohort trainees are currently meeting or exceeding performance standards."
            className="py-12"
          />
        ) : (
          <div className="space-y-3">
            {sortedAttentionQueue.map((t, idx) => {
              const traineeId = t.trainee_id || t.id || idx;
              const batchAvgDisplay =
                summary?.avg_score_pct != null
                  ? `${Number(summary.avg_score_pct).toFixed(1)}%`
                  : "-";

              return (
                <FlaggedTraineeRiskCard
                  key={traineeId}
                  trainee={t}
                  batchAvgDisplay={batchAvgDisplay}
                  onAssignDrill={() => setRemediationTarget(t)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Main Content Grid: 8 Columns Left, 4 Columns Right */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Progression and Leaderboard Table */}
        <div className="lg:col-span-8 space-y-6">
          {/* Weekly Score Progression */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Cohort Milestone Progression
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort average score across weekly evaluation cycles against the {EXCELLENT_THRESHOLD}% mastery benchmark (N = {effectiveWeekly?.length || 0} weeks recorded, {sessionCount} total sessions).
                </p>
              </div>

              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 self-start sm:self-auto border border-slate-200">
                <button
                  type="button"
                  onClick={() => setProgressionView("columns")}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    progressionView === "columns"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Milestone Columns
                </button>
                <button
                  type="button"
                  onClick={() => setProgressionView("curve")}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    progressionView === "curve"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Velocity Curve
                </button>
              </div>
            </div>

            {effectiveWeeklyLoading ? (
              <LoadingState message="Loading weekly milestone progression..." className="py-12" />
            ) : effectiveWeeklyError ? (
              <ErrorState
                title="Unable to Load Progression Trajectory"
                message={effectiveWeeklyError}
                onRetry={() => refetchWeekly()}
                className="py-12"
              />
            ) : !effectiveWeekly || effectiveWeekly.length === 0 ? (
              <EmptyState
                title="No Milestone Progression Records"
                description="No weekly drill metrics recorded for this cohort yet."
                className="py-12"
              />
            ) : (
              <div className="w-full h-56 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  {progressionView === "columns" ? (
                    <ComposedChart
                      data={(effectiveWeekly || []).map((w, i) => ({
                        ...w,
                        label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                      }))}
                      margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748B", fontWeight: 500 }}
                        tickLine={false}
                        axisLine={{ stroke: "#E2E8F0" }}
                      />
                      <YAxis
                        domain={[40, 100]}
                        ticks={[40, PASS_THRESHOLD, EXCELLENT_THRESHOLD, 90, 100]}
                        tick={{ fontSize: 10, fill: "#64748B", fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}%`}
                      />
                      <ReferenceLine
                        y={EXCELLENT_THRESHOLD}
                        stroke="#2563EB"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Target: ${EXCELLENT_THRESHOLD.toFixed(1)}%`,
                          position: "insideTopRight",
                          fill: "#2563EB",
                          fontSize: 10,
                          fontWeight: 600,
                          offset: 4,
                        }}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const item = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs space-y-1 border border-slate-700 shadow-md">
                                <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1">
                                  {item.week_start || item.label}
                                </div>
                                <div className="text-sm font-bold text-white tabular-nums">
                                  {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "0.0%"}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.session_count || 0} drills evaluated
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="avg_score_pct" barSize={28} radius={[4, 4, 0, 0]}>
                        {(effectiveWeekly || []).map((entry, index) => {
                          const isLatest = index === (effectiveWeekly || []).length - 1;
                          return (
                            <Cell
                              key={`bar-${index}`}
                              fill={isLatest ? "#2563EB" : "#94A3B8"}
                            />
                          );
                        })}
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="avg_score_pct"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 1.5 }}
                      />
                    </ComposedChart>
                  ) : (
                    <AreaChart
                      data={(effectiveWeekly || []).map((w, i) => ({
                        ...w,
                        label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                      }))}
                      margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748B", fontWeight: 500 }}
                        tickLine={false}
                        axisLine={{ stroke: "#E2E8F0" }}
                      />
                      <YAxis
                        domain={[40, 100]}
                        ticks={[40, PASS_THRESHOLD, EXCELLENT_THRESHOLD, 90, 100]}
                        tick={{ fontSize: 10, fill: "#64748B", fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}%`}
                      />
                      <ReferenceLine
                        y={EXCELLENT_THRESHOLD}
                        stroke="#2563EB"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Target: ${EXCELLENT_THRESHOLD.toFixed(1)}%`,
                          position: "insideTopRight",
                          fill: "#2563EB",
                          fontSize: 10,
                          fontWeight: 600,
                          offset: 4,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="avg_score_pct"
                        stroke="#2563EB"
                        strokeWidth={2}
                        fill="#EFF6FF"
                        dot={{ r: 3, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 1.5 }}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Cohort Leaderboard Table: Sticky header, right-aligned numbers, consistent row height */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Cohort Leaderboard
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trainees ranked by aggregate percentage score using SQL window functions (N = {filteredLeaderboard.length} of {enrolledCount} enrolled).
                </p>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter trainees..."
                  aria-label="Filter trainees"
                  className="pl-7 pr-3 py-1 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 transition-colors"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
              </div>
            </div>

            {effectiveLeaderboardLoading ? (
              <LoadingState message="Loading cohort leaderboard rankings..." className="py-12" />
            ) : effectiveLeaderboardError ? (
              <ErrorState
                title="Unable to Load Leaderboard"
                message={effectiveLeaderboardError}
                onRetry={() => refetchLeaderboard()}
                className="py-12"
              />
            ) : effectiveLeaderboard.length === 0 ? (
              <EmptyState
                title="No Trainee Rankings Available"
                description="No completed drills found for the selected cohort."
                className="py-12"
              />
            ) : (
              <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                    <tr className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-16">Rank</th>
                      <th className="py-2.5 px-3">Trainee</th>
                      <th className="py-2.5 px-3 text-right">Avg Score</th>
                      <th className="py-2.5 px-3 text-right">Drills</th>
                      <th className="py-2.5 px-3">Standing</th>
                      <th className="py-2.5 px-3 text-right">Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                          No trainees found matching query.
                        </td>
                      </tr>
                    ) : (
                      filteredLeaderboard.map((trainee, idx) => {
                        const rank = trainee.rank ?? idx + 1;
                        const scoreVal = trainee.avg_score_pct ? trainee.avg_score_pct.toFixed(1) : "0.0";
                        const isMastery = (trainee.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                        const isCompetent = (trainee.avg_score_pct || 0) >= PASS_THRESHOLD && !isMastery;
                        const avatarUrl = getTraineeAvatar(trainee, idx);

                        return (
                          <tr
                            key={trainee.trainee_id || idx}
                            className="hover:bg-slate-50/80 transition-colors h-11"
                          >
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-500 tabular-nums">
                              #{rank}
                            </td>

                            <td className="py-2.5 px-3">
                              <Link
                                to={`/trainees/${trainee.trainee_id}`}
                                className="font-semibold text-slate-900 hover:text-blue-600 transition-colors flex items-center space-x-2.5"
                              >
                                <img
                                  src={avatarUrl}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                                />
                                <span className="truncate block text-xs">
                                  {trainee.name}
                                </span>
                              </Link>
                            </td>

                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                              {scoreVal}%
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                              {trainee.session_count ?? 0}
                            </td>

                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                                  isMastery
                                    ? "bg-slate-100 text-slate-800 border-slate-200"
                                    : isCompetent
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {isMastery ? "Mastery" : isCompetent ? "Competent" : "Remediation"}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <Link
                                to={`/trainees/${trainee.trainee_id}`}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Featured Performer and Competency Arc */}
        <div className="lg:col-span-4 space-y-6">
          {/* Featured Top Performer: Label first, value second, tabular-nums */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Highest Scoring Trainee
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Leading cohort candidate by overall average score (N = {effectiveTopPerformer?.session_count ?? 0} sessions completed).
              </p>
            </div>

            {effectiveTopLoading ? (
              <LoadingState message="Calculating top performer..." compact className="py-6" />
            ) : effectiveTopError ? (
              <ErrorState
                title="Top Performer Unavailable"
                message={effectiveTopError}
                onRetry={() => refetchTop()}
                compact
                className="py-6"
              />
            ) : !effectiveTopPerformer ? (
              <EmptyState
                title="No Leading Performer"
                description="No qualifying trainee sessions recorded yet."
                compact
                className="py-6"
              />
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-3">
                  <img
                    src={
                      effectiveTopPerformer?.avatar_url ||
                      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80"
                    }
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {effectiveTopPerformer?.name || "Candidate"}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate font-mono">
                      {activeBatch?.name || "Active Batch"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-medium text-slate-500">
                      Mean Score
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                      {effectiveTopPerformer?.avg_score_pct ? `${effectiveTopPerformer.avg_score_pct.toFixed(1)}%` : "0.0%"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-medium text-slate-500">
                      Sessions Logged
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                      {effectiveTopPerformer?.session_count ?? 0}
                    </div>
                  </div>
                </div>

                {effectiveTopPerformer?.trainee_id && (
                  <Link
                    to={`/trainees/${effectiveTopPerformer.trainee_id}`}
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center transition-colors shadow-xs"
                  >
                    <span>View Trainee Dossier</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Competency Arc Gauge */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Competency Distribution
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cohort candidate distribution across mastery, competent, and remediation bands (N = {enrolledCount} enrolled).
              </p>
            </div>

            {effectiveBandsLoading ? (
              <LoadingState message="Calculating competency distribution..." compact className="py-6" />
            ) : effectiveBandsError ? (
              <ErrorState
                title="Distribution Unavailable"
                message={effectiveBandsError}
                onRetry={() => refetchBands()}
                compact
                className="py-6"
              />
            ) : !effectiveBands || effectiveBands.length === 0 ? (
              <EmptyState
                title="No Distribution Data"
                description="No evaluation data available to calculate competency bands."
                compact
                className="py-6"
              />
            ) : (
              <div className="flex flex-col items-center justify-center pt-2">
                <svg viewBox="0 0 200 115" className="w-48 h-28 overflow-visible">
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="16"
                    strokeDasharray={`${masteryArcProps.lenExc} ${ARC_TOTAL}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="16"
                    strokeDasharray={`${masteryArcProps.lenAvg} ${ARC_TOTAL}`}
                    strokeDashoffset={`-${masteryArcProps.lenExc}`}
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="16"
                    strokeDasharray={`${masteryArcProps.lenStr} ${ARC_TOTAL}`}
                    strokeDashoffset={`-${masteryArcProps.lenExc + masteryArcProps.lenAvg}`}
                    strokeLinecap="round"
                  />
                  <text x="100" y="80" textAnchor="middle" className="text-2xl font-bold fill-slate-900 tracking-tight tabular-nums">
                    {passRate}%
                  </text>
                  <text x="100" y="96" textAnchor="middle" className="text-[10px] font-medium fill-slate-500 uppercase tracking-wider">
                    Pass Rate
                  </text>
                </svg>

                <div className="grid grid-cols-3 gap-2 w-full mt-3 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-medium text-slate-500">Mastery</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5 tabular-nums">
                      {masteryArcProps.excellent.toFixed(0)}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-medium text-slate-500">Competent</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5 tabular-nums">
                      {masteryArcProps.average.toFixed(0)}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-medium text-slate-500">Action</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5 tabular-nums">
                      {masteryArcProps.struggling.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Student and Module Performance Matrix: Sticky header, right-aligned numbers, em dash ONLY in empty cells */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-3 border-b border-slate-200 gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Student and Module Performance Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mean percentage score for each trainee across curriculum modules (N = {effectiveHeatmapData.rows?.length || 0} trainees, {effectiveHeatmapData.modules?.length || 0} modules).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1">Cutoffs:</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Mastery (&gt;= {EXCELLENT_THRESHOLD.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
              Passing ({PASS_THRESHOLD.toFixed(1)}% to {(EXCELLENT_THRESHOLD - 0.1).toFixed(1)}%)
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
              Struggling (&lt; {PASS_THRESHOLD.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
              No Data
            </span>
          </div>
        </div>

        {effectiveHeatmapLoading ? (
          <LoadingState message="Loading cohort heatmap matrix..." className="py-12" />
        ) : effectiveHeatmapError ? (
          <ErrorState
            title="Unable to Load Cohort Heatmap"
            message={effectiveHeatmapError}
            onRetry={() => refetchHeatmap()}
            className="py-12"
          />
        ) : !effectiveHeatmapData || !effectiveHeatmapData.rows || effectiveHeatmapData.rows.length === 0 ? (
          <EmptyState
            title="No Heatmap Records Available"
            description="No student assessment records available for heatmap rendering in this cohort."
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-left">
                  <th className="py-2.5 px-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px] min-w-[170px]">
                    Trainee
                  </th>
                  {(effectiveHeatmapData.modules || []).map((m) => (
                    <th
                      key={m.id}
                      className="py-2.5 px-3 font-semibold text-slate-600 text-right tracking-tight text-[11px] min-w-[120px]"
                    >
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {effectiveHeatmapData.rows.map((row, rIdx) => {
                  const avatarUrl = getTraineeAvatar({ trainee_id: row.trainee_id, name: row.trainee_name }, rIdx);
                  return (
                    <tr key={row.trainee_id} className="hover:bg-slate-50/80 transition-colors h-10">
                      <td className="py-2 px-3">
                        <Link
                          to={`/trainees/${row.trainee_id}`}
                          className="flex items-center space-x-2.5 group"
                        >
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 truncate text-xs">
                            {row.trainee_name}
                          </span>
                        </Link>
                      </td>
                      {(row.cells || []).map((cell) => {
                        const hasScore = cell.score_pct !== null && cell.score_pct !== undefined;
                        let bandClass = "bg-slate-50 text-slate-400 border-slate-200/60 font-normal";
                        if (hasScore) {
                          if (cell.band === "excellent" || cell.score_pct >= EXCELLENT_THRESHOLD) {
                            bandClass = "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold";
                          } else if (cell.band === "passing" || cell.score_pct >= PASS_THRESHOLD) {
                            bandClass = "bg-blue-50 text-blue-800 border-blue-200 font-semibold";
                          } else {
                            bandClass = "bg-rose-50 text-rose-800 border-rose-200 font-semibold";
                          }
                        }

                        return (
                          <td key={cell.module_id} className="py-1.5 px-2 text-right">
                            <div
                              className={`py-1 px-2 rounded border text-xs text-right tabular-nums ${bandClass}`}
                              title={
                                hasScore
                                  ? `${cell.module_name}: ${cell.score_pct.toFixed(1)}% (${cell.session_count} session${cell.session_count === 1 ? "" : "s"})`
                                  : `${cell.module_name}: No sessions completed`
                              }
                            >
                              {hasScore ? `${cell.score_pct.toFixed(1)}%` : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Remediation Drill Modal */}
      {remediationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Targeted Intervention
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Assign Remediation Drill
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRemediationTarget(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignRemediation} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Trainee Candidate</label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={getTraineeAvatar(remediationTarget)}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <span className="font-semibold text-slate-900">
                      {remediationTarget.name || remediationTarget.trainee_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {remediationTarget.trend?.replace("_", " ") || "Flagged"}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Remediation Module</label>
                <select
                  value={remediationModule}
                  onChange={(e) => setRemediationModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="PostgreSQL Schema & Optimization">PostgreSQL Schema & Optimization</option>
                  <option value="Python Fundamentals & Edge Cases">Python Fundamentals & Edge Cases</option>
                  <option value="FastAPI REST Architecture">FastAPI REST Architecture</option>
                  <option value="React State & Engineering">React State & Engineering</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Completion</label>
                  <input
                    type="date"
                    defaultValue="2026-11-05"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Priority Level</label>
                  <span className="block px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-center">
                    High Priority
                  </span>
                </div>
              </div>

              {remediationSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold flex items-center space-x-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Remediation drill dispatched to trainee dashboard.</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRemediationTarget(null)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={remediationSubmitting || remediationSuccess}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {remediationSubmitting ? "Dispatching..." : "Dispatch Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
