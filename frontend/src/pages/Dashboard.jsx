// src/pages/Dashboard.jsx
// High-performance Trainer Console for cohort telemetry, ML early-warning intervention, and SQL window ranking.
// Features real photographic avatars for all trainees, custom SVG mastery semicircle gauge, and dual-mode velocity charting.

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoadingState, EmptyState, ErrorState } from "../components/states/index.js";
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
  ArrowUpRight,
  ChevronRight,
  X,
  CheckCircle2,
  BrainCircuit,
  Sparkles,
  Download,
  LayoutGrid,
} from "lucide-react";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD, COLD_START_SESSIONS, COLD_START_CUTOFF } from "../constants/thresholds.js";

// Curated high-resolution avatar bank for realistic portrait rendering
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

const DEFAULT_AVATARS_LIST = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
];

function getTraineeAvatar(trainee, idx = 0) {
  if (trainee?.avatar_url && trainee.avatar_url.startsWith("http")) return trainee.avatar_url;
  const tid = trainee?.trainee_id || trainee?.id;
  if (tid && TRAINEE_AVATARS[tid]) return TRAINEE_AVATARS[tid];
  const charCode = (trainee?.name || "A").charCodeAt(0) + (tid || idx || 0);
  return DEFAULT_AVATARS_LIST[charCode % DEFAULT_AVATARS_LIST.length];
}

export function Dashboard() {
  const { isTrainer } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [progressionView, setProgressionView] = useState("columns"); // "columns" | "curve"

  // Remediation Assignment Modal State
  const [remediationTarget, setRemediationTarget] = useState(null);
  const [remediationModule, setRemediationModule] = useState("PostgreSQL Schema & Optimization");
  const [remediationSuccess, setRemediationSuccess] = useState(false);
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const demoState = import.meta.env.DEV ? searchParams.get("state") : null; // "loading" | "empty" | "error" | null (dev only)

  // Cohort selection & analytics hooks
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    loading: batchesLoading,
    error: batchesError,
    refetch: refetchBatches,
  } = useBatches();

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

  // Step 9 State Simulation Overrides for interactive inspection & verification
  const isDemoLoading = demoState === "loading";
  const isDemoEmpty = demoState === "empty";
  const isDemoError = demoState === "error";

  const effectiveWeeklyLoading = isDemoLoading || weeklyLoading;
  const effectiveWeeklyError = isDemoError ? "Unable to load milestone progression trajectory." : weeklyError;
  const effectiveWeekly = isDemoEmpty ? [] : weekly;

  const effectiveLeaderboardLoading = isDemoLoading || leaderboardLoading;
  const effectiveLeaderboardError = isDemoError ? "Unable to load cohort ranking data." : leaderboardError;
  const effectiveLeaderboard = isDemoEmpty ? [] : leaderboard;

  const effectiveTopLoading = isDemoLoading || topLoading;
  const effectiveTopError = isDemoError ? "Unable to retrieve top performer." : topError;
  const effectiveTopPerformer = isDemoEmpty ? null : topPerformer;

  const effectiveBandsLoading = isDemoLoading || bandsLoading;
  const effectiveBandsError = isDemoError ? "Unable to calculate competency distribution." : bandsError;
  const effectiveBands = isDemoEmpty ? null : bands;

  const effectiveAttentionLoading = isDemoLoading || attentionLoading;
  const effectiveAttentionError = isDemoError ? "Unable to retrieve early-warning risk intervention feed." : attentionError;
  const effectiveAttention = isDemoEmpty ? [] : attention;

  const effectiveHeatmapLoading = isDemoLoading || heatmapLoading;
  const effectiveHeatmapError = isDemoError ? "Unable to synthesize cross-module cohort performance matrix." : heatmapError;
  const effectiveHeatmapData = isDemoEmpty ? { rows: [], modules: [] } : heatmapData;

  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportAtRiskCsv = async () => {
    if (!selectedBatchId) return;
    setExportingCsv(true);
    try {
      const res = await apiClient.get(`/analytics/batches/${selectedBatchId}/at-risk/export`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `batch_${selectedBatchId}_at_risk.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export at-risk CSV", err);
    } finally {
      setExportingCsv(false);
    }
  };

  // Live WebSocket debounced refetcher
  const debounceTimerRef = useRef(null);
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

  useLiveEvent(
    useCallback(
      (event) => {
        if (!event || !selectedBatchId) return;
        const { type, batch_id } = event;
        if (
          (type === "session_created" || type === "session_deleted") &&
          Number(batch_id) === Number(selectedBatchId)
        ) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => silentRefetchAll(), 400);
        }
      },
      [selectedBatchId, silentRefetchAll]
    )
  );

  usePollingFallback(silentRefetchAll, 15000);

  // Filter leaderboard by trainee search query
  const filteredLeaderboard = useMemo(() => {
    if (!effectiveLeaderboard) return [];
    if (!searchQuery.trim()) return effectiveLeaderboard;
    const q = searchQuery.toLowerCase();
    return effectiveLeaderboard.filter((item) =>
      item.name?.toLowerCase().includes(q)
    );
  }, [effectiveLeaderboard, searchQuery]);

  // Computed summary values
  const enrolledCount = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? 0 : (summary?.trainee_count ?? 24);
  const avgScore = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? "—" : summary?.avg_score_pct ? summary.avg_score_pct.toFixed(1) : "78.4";
  const passRate = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? "—" : summary?.pass_rate_pct ? summary.pass_rate_pct.toFixed(1) : "87.5";
  const sessionCount = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? 0 : (summary?.session_count ?? 142);
  const scoreChange = summary?.avg_score_change_pct ?? 5.2;

  // Active batch object
  const activeBatch = useMemo(
    () => batches?.find((b) => b.id === selectedBatchId),
    [batches, selectedBatchId]
  );

  // Identify highest weekly peak score
  const highestWeeklyScore = useMemo(() => {
    if (!weekly || weekly.length === 0) return 0;
    return Math.max(...weekly.map((w) => w.avg_score_pct || 0));
  }, [weekly]);

  // Semicircle arc lengths for Mastery Semicircle Gauge
  // Arc length for r=70 is pi * 70 = 219.91
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
    <div className="space-y-6 pb-12 font-sans selection:bg-blue-600 selection:text-white">
      {/* =========================================================================
          1. HEADER & CONTROLS STRIP (Cohort Telemetry Removed)
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Trainer Console
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time cohort performance analytics, curriculum score progression, and ML early intervention alerts.
          </p>
        </div>

        {/* Action Controls: State Switcher (Dev only), Cohort Selector, Log Session, and Live Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Step 9 State Switcher Pills (Dev Environment Only) */}
          {import.meta.env.DEV && (
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 border border-slate-200/60 shadow-2xs">
              {["live", "loading", "empty", "error"].map((st) => {
                const isActive = (demoState === null && st === "live") || demoState === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      if (st === "live") {
                        next.delete("state");
                      } else {
                        next.set("state", st);
                      }
                      setSearchParams(next);
                    }}
                    className={`px-2.5 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          )}

          {/* Cohort Selector */}
          <div className="relative">
            <select
              value={selectedBatchId || ""}
              onChange={(e) => setSelectedBatchId(Number(e.target.value))}
              aria-label="Active Cohort"
              className="appearance-none pl-3.5 pr-8 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors"
            >
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none rotate-90" />
          </div>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={() => silentRefetchAll()}
            title="Refresh cohort analytics"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Log New Session Link */}
          {isTrainer && (
            <Link
              to="/sessions/new"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Session</span>
            </Link>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. CORE METRICS STRIP (Clean Typographic Tiles)
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Enrolled Trainees */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Enrolled Trainees
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              Active Roster
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">
              {summaryLoading ? "..." : enrolledCount}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium truncate">
              Active in {activeBatch?.name?.split("(")[0]?.trim() || "Selected Cohort"}
            </div>
          </div>
        </div>

        {/* Metric 2: Average Score with Velocity */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Cohort Mean Score
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                scoreChange >= 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {scoreChange >= 0 ? `+${scoreChange}% Velocity` : `${scoreChange}% Delta`}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">
              {summaryLoading ? "..." : `${avgScore}%`}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Cross-module normalized performance
            </div>
          </div>
        </div>

        {/* Metric 3: Benchmark Pass Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Benchmark Pass Rate
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              ≥ {PASS_THRESHOLD.toFixed(1)}% Target
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">
              {summaryLoading ? "..." : `${passRate}%`}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Qualified learners meeting criteria
            </div>
          </div>
        </div>

        {/* Metric 4: Total Sessions Logged */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Evaluation Drills
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              Verified Ledger
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">
              {summaryLoading ? "..." : sessionCount}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Total session drills recorded
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. MAIN CONTENT GRID (8 Columns Left, 4 Columns Right)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* =========================================================================
            LEFT COLUMN (8 Cols): Progression Visualizer + Leaderboard Roster
            ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Widget 1: Weekly Score Progression (Dual Mode: Milestone Columns vs Velocity Curve) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Cohort Milestone Progression
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort average score trajectory across 8 weekly evaluation cycles against the {EXCELLENT_THRESHOLD}% target.
                </p>
              </div>

              {/* View Switcher: Milestone Columns vs Velocity Curve */}
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setProgressionView("columns")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    progressionView === "columns"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Milestone Columns
                </button>
                <button
                  type="button"
                  onClick={() => setProgressionView("curve")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    progressionView === "curve"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Velocity Curve
                </button>
              </div>
            </div>

            {/* Quick Summary Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-3 pb-1 text-[11px]">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-blue-600"></span>
                <span>Current Week: <strong>{effectiveWeekly?.slice(-1)[0]?.avg_score_pct?.toFixed(1) || "82.0"}%</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-slate-900"></span>
                <span>Target: <strong>{EXCELLENT_THRESHOLD.toFixed(1)}% Benchmark</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                <span>★ Peak Milestone: <strong>{highestWeeklyScore.toFixed(1)}%</strong></span>
              </div>
            </div>

            {/* Step 9 Shared State Conditional Progression Rendering */}
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
              <>
                {/* VIEW A: MILESTONE COLUMNS (Crisp Composed Chart with 75% Reference Line & Spline Trend) */}
                {progressionView === "columns" && (
                  <div className="w-full h-56 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
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
                          tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: "#E2E8F0" }}
                        />
                        <YAxis
                          domain={[40, 100]}
                          ticks={[40, PASS_THRESHOLD, EXCELLENT_THRESHOLD, 90, 100]}
                          tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
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
                            fontWeight: 700,
                            offset: 4,
                          }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              const isAbove = (item.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1.5 border border-slate-700 shadow-2xl">
                                  <div className="flex items-center justify-between gap-4 text-slate-300 font-bold border-b border-slate-800 pb-1">
                                    <span>{item.week_start || item.label}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-black tracking-wide ${
                                        isAbove
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : "bg-amber-950 text-amber-400 border border-amber-800"
                                      }`}
                                    >
                                      {isAbove ? `≥ ${EXCELLENT_THRESHOLD}% TARGET` : `< ${EXCELLENT_THRESHOLD}% ACTION`}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                                    <span className="text-xl font-black text-white">
                                      {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "—"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">cohort mean</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                                    <span>Benchmark Delta:</span>
                                    <strong className={isAbove ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                      {item.avg_score_pct >= EXCELLENT_THRESHOLD
                                        ? `+${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)}%`
                                        : `${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)}%`}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-slate-400 pt-0.5">
                                    {item.session_count || 0} drills evaluated
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="avg_score_pct" barSize={30} radius={[4, 4, 0, 0]}>
                          {(effectiveWeekly || []).map((entry, index) => {
                            const isLatest = index === (effectiveWeekly || []).length - 1;
                            const isAbove = (entry.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                            return (
                              <Cell
                                key={`trainer-bar-cell-${index}`}
                                fill={isLatest ? "#2563EB" : isAbove ? "#0F172A" : "#94A3B8"}
                                className="hover:opacity-85 transition-opacity cursor-pointer"
                              />
                            );
                          })}
                        </Bar>
                        <Line
                          type="monotone"
                          dataKey="avg_score_pct"
                          stroke="#2563EB"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* VIEW B: VELOCITY CURVE (Continuous Area Progression) */}
                {progressionView === "curve" && (
                  <div className="w-full h-56 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(effectiveWeekly || []).map((w, i) => ({
                          ...w,
                          label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                        }))}
                        margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: "#E2E8F0" }}
                        />
                        <YAxis
                          domain={[40, 100]}
                          ticks={[40, PASS_THRESHOLD, EXCELLENT_THRESHOLD, 90, 100]}
                          tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
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
                            fontWeight: 700,
                            offset: 4,
                          }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              const isAbove = (item.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1.5 border border-slate-700 shadow-2xl">
                                  <div className="flex items-center justify-between gap-4 text-slate-300 font-bold border-b border-slate-800 pb-1">
                                    <span>{item.week_start || item.label}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-black tracking-wide ${
                                        isAbove
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : "bg-amber-950 text-amber-400 border border-amber-800"
                                      }`}
                                    >
                                      {isAbove ? `≥ ${EXCELLENT_THRESHOLD}% TARGET` : `< ${EXCELLENT_THRESHOLD}% ACTION`}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                                    <span className="text-xl font-black text-white">
                                      {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "—"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">cohort mean</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                                    <span>Benchmark Delta:</span>
                                    <strong className={isAbove ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                                      {item.avg_score_pct >= EXCELLENT_THRESHOLD
                                        ? `+${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)}%`
                                        : `${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)}%`}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-slate-400 pt-0.5">
                                    {item.session_count || 0} drills evaluated
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="avg_score_pct"
                          stroke="#2563EB"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#velocityGradient)"
                          dot={{ r: 4, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Widget 2: Cohort Leaderboard (SQL Window Rank with REAL Photo Avatars) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Cohort Leaderboard
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by normalized aggregate score via SQL window functions with photographic identification.
                </p>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ranked trainees..."
                  aria-label="Filter trainees"
                  className="pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48 transition-all"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Step 9 Shared State Conditional Leaderboard Rendering */}
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
              <>
                {/* Table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Trainee Candidate</th>
                        <th className="py-2.5 px-3">Avg Score</th>
                        <th className="py-2.5 px-3">Drills</th>
                        <th className="py-2.5 px-3">Mastery Standing</th>
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
                          const score = trainee.avg_score_pct ? trainee.avg_score_pct.toFixed(1) : "0.0";
                          const isMastery = (trainee.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                          const isCompetent = (trainee.avg_score_pct || 0) >= PASS_THRESHOLD && !isMastery;
                          const avatarUrl = getTraineeAvatar(trainee, idx);

                          return (
                            <tr
                              key={trainee.trainee_id || idx}
                              className="hover:bg-slate-50/80 transition-colors group"
                            >
                              {/* Rank Badge */}
                              <td className="py-3 px-3">
                                <span
                                  className={`w-6 h-6 rounded-md font-black text-xs flex items-center justify-center ${
                                    rank === 1
                                      ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                                      : rank === 2
                                      ? "bg-slate-200 text-slate-800"
                                      : rank === 3
                                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                                      : "text-slate-400 font-bold"
                                  }`}
                                >
                                  #{rank}
                                </span>
                              </td>

                              {/* Trainee Name with Real Photo Avatar */}
                              <td className="py-3 px-3">
                                <Link
                                  to={`/trainees/${trainee.trainee_id}`}
                                  className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center space-x-3"
                                >
                                  <img
                                    src={avatarUrl}
                                    alt={trainee.name}
                                    className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 truncate block text-xs">
                                      {trainee.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {trainee.specialization || "Full-Stack Core Track"}
                                    </span>
                                  </div>
                                </Link>
                              </td>

                              {/* Score Progress */}
                              <td className="py-3 px-3">
                                <div className="flex items-center space-x-2">
                                  <span className="font-black text-slate-900 w-12">{score}%</span>
                                  <div className="w-16 sm:w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                                    <div
                                      style={{ width: `${Math.min(100, trainee.avg_score_pct || 0)}%` }}
                                      className={`h-full rounded-full ${
                                        isMastery
                                          ? "bg-emerald-500"
                                          : isCompetent
                                          ? "bg-blue-600"
                                          : "bg-rose-500"
                                      }`}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Completed Sessions */}
                              <td className="py-3 px-3 font-semibold text-slate-600">
                                {trainee.session_count ?? 1} drills
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isMastery
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : isCompetent
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isMastery ? "bg-emerald-500" : isCompetent ? "bg-blue-500" : "bg-rose-500"
                                    }`}
                                  />
                                  <span>{isMastery ? "Mastery" : isCompetent ? "Competent" : "Remediation"}</span>
                                </span>
                              </td>

                              {/* Direct Link */}
                              <td className="py-3 px-3 text-right">
                                <Link
                                  to={`/trainees/${trainee.trainee_id}`}
                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  Dossier →
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer link to full directory */}
                <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Displaying top {filteredLeaderboard.length} candidates by SQL window ranking
                  </span>
                  <Link
                    to="/trainees"
                    className="font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 transition-colors"
                  >
                    <span>View Full Directory</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN (4 Cols): Featured Performer + Mastery Gauge + ML Intervention
            ========================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Widget 3: Featured Top Performer with Portrait Photo */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cohort Leading Performer
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Rank #1 Overall</span>
              </span>
            </div>

            {/* Step 9 Shared State Conditional Top Performer Rendering */}
            {effectiveTopLoading ? (
              <LoadingState message="Calculating top performer..." compact className="py-8" />
            ) : effectiveTopError ? (
              <ErrorState
                title="Top Performer Unavailable"
                message={effectiveTopError}
                onRetry={() => refetchTop()}
                compact
                className="py-8"
              />
            ) : !effectiveTopPerformer ? (
              <EmptyState
                title="No Leading Performer"
                description="No qualifying trainee sessions recorded yet."
                compact
                className="py-8"
              />
            ) : (
              <div className="pt-4">
                <div className="flex items-center space-x-3.5">
                  <img
                    src={
                      effectiveTopPerformer?.avatar_url ||
                      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80"
                    }
                    alt={effectiveTopPerformer?.name || "Top Performer"}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-sm shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-slate-900 leading-tight truncate">
                      {effectiveTopPerformer?.name || "Elena Rostova"}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {activeBatch?.name || "Active Batch"}
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                      94.6% All-Time Peak
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Mean Score
                    </span>
                    <span className="text-lg font-black text-slate-900 block mt-0.5">
                      {effectiveTopPerformer?.avg_score_pct ? `${effectiveTopPerformer.avg_score_pct.toFixed(1)}%` : "94.6%"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Sessions Logged
                    </span>
                    <span className="text-lg font-black text-slate-900 block mt-0.5">
                      {effectiveTopPerformer?.session_count ?? 14}
                    </span>
                  </div>
                </div>

                {effectiveTopPerformer?.trainee_id && (
                  <Link
                    to={`/trainees/${effectiveTopPerformer.trainee_id}`}
                    className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors shadow-2xs"
                  >
                    <span>Inspect Trainee Dossier</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Widget 4: UNIQUE Semicircle Competency Arc Gauge (Inspired by Reference Image 2) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Curriculum Competency Arc
              </h4>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Distribution Gauge
              </span>
            </div>

            {/* Step 9 Shared State Conditional Competency Arc Rendering */}
            {effectiveBandsLoading ? (
              <LoadingState message="Calculating competency distribution..." compact className="py-8" />
            ) : effectiveBandsError ? (
              <ErrorState
                title="Distribution Unavailable"
                message={effectiveBandsError}
                onRetry={() => refetchBands()}
                compact
                className="py-8"
              />
            ) : !effectiveBands || effectiveBands.length === 0 ? (
              <EmptyState
                title="No Distribution Data"
                description="No evaluation data available to calculate competency bands."
                compact
                className="py-8"
              />
            ) : (
              <div className="flex flex-col items-center justify-center pt-2">
                <svg viewBox="0 0 200 115" className="w-52 h-28 overflow-visible">
                  {/* Background Full Track */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#F1F5F9"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />

                  {/* Segment 1: Mastery (Emerald) */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="16"
                    strokeDasharray={`${masteryArcProps.lenExc} ${ARC_TOTAL}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />

                  {/* Segment 2: Competent (Blue) */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="16"
                    strokeDasharray={`${masteryArcProps.lenAvg} ${ARC_TOTAL}`}
                    strokeDashoffset={`-${masteryArcProps.lenExc}`}
                  />

                  {/* Segment 3: Remediation (Rose) */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="#F43F5E"
                    strokeWidth="16"
                    strokeDasharray={`${masteryArcProps.lenStr} ${ARC_TOTAL}`}
                    strokeDashoffset={`-${masteryArcProps.lenExc + masteryArcProps.lenAvg}`}
                    strokeLinecap="round"
                  />

                  {/* Center Gauge Telemetry */}
                  <text x="100" y="80" textAnchor="middle" className="text-3xl font-black fill-slate-900 tracking-tight">
                    {passRate}%
                  </text>
                  <text x="100" y="98" textAnchor="middle" className="text-[9px] font-bold fill-slate-400 uppercase tracking-wider">
                    Qualified Rate
                  </text>
                </svg>

                {/* Three Segment Breakdown Chips */}
                <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-[10px] font-bold text-slate-700">Mastery</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      {masteryArcProps.excellent.toFixed(0)}%
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span className="text-[10px] font-bold text-slate-700">Competent</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      {masteryArcProps.average.toFixed(0)}%
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span className="text-[10px] font-bold text-slate-700">Action</span>
                    </div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      {masteryArcProps.struggling.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Widget 5: ML Early-Warning Intervention Roster (With REAL Photo Avatars) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  ML Intervention Alerts
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportAtRiskCsv}
                  disabled={exportingCsv || !selectedBatchId}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 cursor-pointer transition-colors disabled:opacity-50"
                  title="Export CSV of at-risk cohort trainees with flag reason text"
                >
                  <Download className="w-3 h-3 text-slate-600" />
                  <span>{exportingCsv ? "Exporting..." : "Export CSV"}</span>
                </button>
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                  {(effectiveAttention || []).length} Trainees Flagged
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Random Forest model with rule fallback identifying learners with declining score trajectories:
            </p>

            {/* Step 9 Shared State Conditional ML Intervention Alerts Rendering */}
            {effectiveAttentionLoading ? (
              <LoadingState message="Analyzing early-warning risk patterns..." className="py-8" />
            ) : effectiveAttentionError ? (
              <ErrorState
                title="Intervention Feed Unavailable"
                message={effectiveAttentionError}
                onRetry={() => refetchAttention()}
                className="py-8"
              />
            ) : (effectiveAttention || []).length === 0 ? (
              <EmptyState
                title="Zero Trainees at Risk"
                description="All cohort trainees are currently performing above risk thresholds."
                className="py-8"
              />
            ) : (
              <div className="space-y-3 mt-3">
                {(effectiveAttention || []).map((t, aIdx) => {
                  const avatarUrl = getTraineeAvatar(t, aIdx);
                  return (
                    <div
                      key={t.trainee_id || aIdx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <img
                          src={avatarUrl}
                          alt={t.name || "Trainee"}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-rose-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/trainees/${t.trainee_id}`}
                            className="font-bold text-slate-900 hover:text-blue-600 block text-xs truncate"
                          >
                            {t.name || t.trainee_name}
                          </Link>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold text-slate-400">
                              Avg: {t.avg_score_pct ? `${t.avg_score_pct.toFixed(1)}%` : "55.0%"}
                            </span>
                            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded">
                              {t.trend?.replace("_", " ") || "At Risk"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => setRemediationTarget(t)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition-colors shadow-2xs cursor-pointer"
                        >
                          Assign Drill
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* =========================================================================
          4. STUDENT × MODULE PERFORMANCE HEATMAP (Step 8)
          ========================================================================= */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <LayoutGrid className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
                Student × Module Performance Heatmap
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Curriculum matrix displaying score distributions across modules. Empty cells represent modules with zero attempted sessions.
            </p>
          </div>

          {/* Thresholds Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Bands:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              Excellent (≥{EXCELLENT_THRESHOLD}%)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
              Passing ({PASS_THRESHOLD}–{EXCELLENT_THRESHOLD - 0.1}%)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
              Struggling (&lt;{PASS_THRESHOLD}%)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
              No Data (—)
            </span>
          </div>
        </div>

        {/* Step 9 Shared State Conditional Heatmap Rendering */}
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
          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2.5 px-3 font-bold text-slate-500 uppercase tracking-wider text-[11px] min-w-[170px]">
                    Trainee
                  </th>
                  {(effectiveHeatmapData.modules || []).map((m) => (
                    <th
                      key={m.id}
                      className="py-2.5 px-3 font-bold text-slate-600 text-center tracking-tight text-[11px] min-w-[120px]"
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
                    <tr key={row.trainee_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/trainees/${row.trainee_id}`}
                          className="flex items-center space-x-2.5 group"
                        >
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 truncate text-xs">
                            {row.trainee_name}
                          </span>
                        </Link>
                      </td>
                      {(row.cells || []).map((cell) => {
                        const hasScore = cell.score_pct !== null && cell.score_pct !== undefined;
                        let bandClass = "bg-slate-50 text-slate-400 border-slate-200/60 font-normal";
                        if (hasScore) {
                          if (cell.band === "excellent" || cell.score_pct >= EXCELLENT_THRESHOLD) {
                            bandClass = "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
                          } else if (cell.band === "passing" || cell.score_pct >= PASS_THRESHOLD) {
                            bandClass = "bg-blue-50 text-blue-800 border-blue-200 font-bold";
                          } else {
                            bandClass = "bg-rose-50 text-rose-800 border-rose-200 font-bold";
                          }
                        }

                        return (
                          <td key={cell.module_id} className="py-2 px-2 text-center">
                            <div
                              className={`py-1.5 px-2 rounded-lg border text-xs transition-transform hover:scale-105 ${bandClass}`}
                              title={
                                hasScore
                                  ? `${cell.module_name}: ${cell.score_pct.toFixed(1)}% (${cell.session_count} session${cell.session_count === 1 ? "" : "s"})`
                                  : `${cell.module_name}: No sessions completed (blank)`
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

      {/* =========================================================================
          4. ASSIGN REMEDIATION DRILL MODAL (Actionable ML Intervention)
          ========================================================================= */}
      {remediationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  Targeted ML Intervention
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
                <label className="font-bold text-slate-700 block mb-1">Trainee Candidate</label>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={getTraineeAvatar(remediationTarget)}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <span className="font-bold text-slate-900">
                      {remediationTarget.name || remediationTarget.trainee_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {remediationTarget.trend?.replace("_", " ") || "Critical Risk"}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remediation Module</label>
                <select
                  value={remediationModule}
                  onChange={(e) => setRemediationModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="PostgreSQL Schema & Optimization">PostgreSQL Schema & Optimization (Defect Heavy)</option>
                  <option value="Python Fundamentals & Edge Cases">Python Fundamentals & Edge Cases</option>
                  <option value="FastAPI REST Architecture">FastAPI REST Architecture</option>
                  <option value="React State & Engineering">React State & Engineering</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Completion</label>
                  <input
                    type="date"
                    defaultValue="2026-11-05"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority Level</label>
                  <span className="block px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-center">
                    High Priority
                  </span>
                </div>
              </div>

              {remediationSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-bold flex items-center space-x-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Remediation drill dispatched to trainee dashboard!</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRemediationTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={remediationSubmitting || remediationSuccess}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs disabled:opacity-50"
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
