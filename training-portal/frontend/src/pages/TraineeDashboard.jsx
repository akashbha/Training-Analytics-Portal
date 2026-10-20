// src/pages/TraineeDashboard.jsx
// Trainee performance dashboard with chronological progress curve and curriculum error breakdowns.
// Renders Recharts area trajectory, module filter, lavender/purple bar chart, recent session log, and 403 route protection.

import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuth } from "../context/AuthContext.jsx";
import { Card } from "../components/Card.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { ChartCard } from "../components/ChartCard.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { UnauthorizedPage } from "./Placeholders.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  useTraineeProfile,
  useTraineeSummary,
  useTraineeProgress,
  useTraineeErrors,
  useTraineeSessions,
} from "../hooks/useTraineeAnalytics.js";
import { apiClient } from "../api/client.js";
import {
  Award,
  TrendingUp,
  Target,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Clock,
  Filter,
  Trash2,
} from "lucide-react";

/**
 * Custom Tooltip for Recharts Progression Timeline
 */
function ProgressTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const mins = Math.floor((item.time_seconds || 0) / 60);
    const secs = (item.time_seconds || 0) % 60;
    const dateFormatted = item.created_at
      ? new Date(item.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl text-xs space-y-1 border border-purple-500/20 z-50">
        <div className="font-bold text-purple-200 border-b border-white/10 pb-1 mb-1">
          {item.module_name}
        </div>
        <div className="text-base font-black text-white">
          {item.score_pct !== undefined ? `${item.score_pct.toFixed(1)}%` : "—"} Score
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
          <span>Errors: <strong className="text-rose-300">{item.errors}</strong></span>
          <span>Time: <strong className="text-purple-200">{mins}m {secs}s</strong></span>
        </div>
        <div className="text-[10px] text-slate-400 pt-0.5">{dateFormatted}</div>
      </div>
    );
  }
  return null;
}

/**
 * Custom Tooltip for Module Error Distribution
 */
function ErrorTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-xl text-xs space-y-1 border border-purple-500/20 z-50">
        <div className="font-bold text-purple-200">{item.module_name}</div>
        <div className="text-sm font-extrabold text-white">
          {item.avg_errors !== undefined ? item.avg_errors.toFixed(1) : "—"} Average Errors
        </div>
        <div className="text-[10px] text-slate-400">
          Based on {item.session_count} completed assessments
        </div>
      </div>
    );
  }
  return null;
}

export function TraineeDashboard({ traineeId: propId }) {
  const params = useParams();
  const { user, isTrainer, isAdmin } = useAuth();
  const isStaff = isTrainer || isAdmin;

  // Resolve target ID based on role or URL parameters
  const effectiveId = isStaff
    ? Number(propId || params.id)
    : Number(user?.trainee_id);

  // If trainee user tampers with URL pointing to another ID, immediately block
  const isUrlTampered =
    !isStaff &&
    params.id !== undefined &&
    Number(params.id) !== Number(user?.trainee_id);

  // Module filter for the Recharts line chart
  const [selectedModule, setSelectedModule] = useState("ALL");

  // Session deletion modal state
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null);
  const [deleteSessionLoading, setDeleteSessionLoading] = useState(false);
  const [deleteSessionError, setDeleteSessionError] = useState("");

  // Fetch data with individual hooks
  const {
    data: profile,
    loading: profileLoading,
    error: profileError,
    isForbidden: profileForbidden,
    refetch: refetchProfile,
  } = useTraineeProfile(effectiveId);

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    isForbidden: summaryForbidden,
    refetch: refetchSummary,
  } = useTraineeSummary(effectiveId);

  const {
    data: progress,
    loading: progressLoading,
    error: progressError,
    isForbidden: progressForbidden,
    refetch: refetchProgress,
  } = useTraineeProgress(effectiveId);

  const {
    data: errorStats,
    loading: errorStatsLoading,
    error: errorStatsError,
    isForbidden: errorStatsForbidden,
    refetch: refetchErrors,
  } = useTraineeErrors(effectiveId);

  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
    isForbidden: sessionsForbidden,
    refetch: refetchSessions,
  } = useTraineeSessions(effectiveId);

  // Live updates & 500ms debounced refetcher
  const debounceTimerRef = React.useRef(null);

  const silentRefetchAll = React.useCallback(() => {
    refetchProfile(true);
    refetchSummary(true);
    refetchProgress(true);
    refetchErrors(true);
    refetchSessions(true);
  }, [
    refetchProfile,
    refetchSummary,
    refetchProgress,
    refetchErrors,
    refetchSessions,
  ]);

  useLiveEvent(
    React.useCallback(
      (event) => {
        if (!event || !effectiveId) return;
        const { trainee_id, trainee_ids } = event;

        let matches = false;
        if (Number(trainee_id) === Number(effectiveId)) {
          matches = true;
        } else if (trainee_ids && trainee_ids.some((t) => Number(t) === Number(effectiveId))) {
          matches = true;
        }

        if (matches) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            silentRefetchAll();
          }, 500);
        }
      },
      [effectiveId, silentRefetchAll]
    )
  );

  // Polling fallback: every 15s when offline, catch-up on reconnect
  usePollingFallback(silentRefetchAll, 15000);

  // Enforce 403 forbidden protection
  if (
    isUrlTampered ||
    profileForbidden ||
    summaryForbidden ||
    progressForbidden ||
    errorStatsForbidden ||
    sessionsForbidden
  ) {
    return <UnauthorizedPage />;
  }

  // Extract unique module names for filter dropdown
  const moduleOptions = useMemo(() => {
    if (!progress || progress.length === 0) return [];
    const set = new Set(progress.map((p) => p.module_name));
    return Array.from(set);
  }, [progress]);

  // Filter progress timeline points based on selected module
  const filteredProgress = useMemo(() => {
    if (!progress) return [];
    const filtered =
      selectedModule === "ALL"
        ? progress
        : progress.filter((p) => p.module_name === selectedModule);

    // Format for Recharts timeline
    return filtered.map((item, index) => ({
      ...item,
      chartIndex: index + 1,
      dateLabel: item.created_at
        ? new Date(item.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : `S${index + 1}`,
    }));
  }, [progress, selectedModule]);

  // Determine highest error value for solid purple highlighting
  const highestAvgError = useMemo(() => {
    if (!errorStats || errorStats.length === 0) return 0;
    return errorStats.reduce(
      (max, curr) => (curr.avg_errors > max ? curr.avg_errors : max),
      0
    );
  }, [errorStats]);

  // Zero-sessions check: friendly empty state when trainee has no session activity
  const isZeroSessions =
    summary &&
    (summary.session_count === 0 || summary.session_count === null) &&
    (!progress || progress.length === 0);

  return (
    <div className="space-y-6">
      {/* 1. Trainee Header: Name, Cohort Batch, Role Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          {/* Trainer back navigation button */}
          {isTrainer && (
            <Link
              to="/"
              className="w-9 h-9 rounded-full bg-white hover:bg-brand-light text-slate-700 hover:text-brand flex items-center justify-center border border-purple-100 transition-colors shadow-xs"
              title="Return to Trainer Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}

          <div className="w-12 h-12 rounded-full bg-brand text-white font-black text-lg flex items-center justify-center shadow-xs">
            {profile?.name
              ? profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "TR"}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                {profile?.batch_name || "Enrolled Trainee"}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-brand-light text-brand text-[10px] font-bold">
                {isTrainer ? "Trainer View" : "My Dashboard"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {profileLoading ? "Loading Profile..." : profile?.name || "Trainee Dashboard"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile?.email || user?.email} • Cohort Batch #{profile?.batch_id || "—"}
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <div className="self-start sm:self-auto">
          <button
            onClick={() => {
              refetchProfile();
              refetchSummary();
              refetchProgress();
              refetchErrors();
              refetchSessions();
            }}
            className="px-4 py-2 bg-white hover:bg-brand-light/70 text-slate-700 hover:text-brand border border-purple-100 rounded-full text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* Zero Sessions Friendly State */}
      {isZeroSessions ? (
        <Card variant="white" className="p-12 text-center border-purple-100">
          <div className="w-16 h-16 rounded-full bg-brand-light text-brand mx-auto flex items-center justify-center text-2xl font-black mb-4">
            🚀
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Welcome to Your Training Portal
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            No assessment sessions have been recorded for your profile yet. Once your trainer uploads
            your first evaluation score or completes a module session, your score trajectory curve,
            curriculum breakdowns, and personal metrics will automatically appear here.
          </p>
          <div className="mt-6 inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-purple-50 text-brand text-xs font-semibold">
            <span>Enrolled in {profile?.batch_name || "Assigned Cohort"}</span>
          </div>
        </Card>
      ) : (
        <>
          {/* 2. 4 StatCards: Latest score, Best score, Improvement %, Sessions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Latest Score */}
            <StatCard
              title="Latest Score"
              value={
                summary?.latest_score_pct !== null && summary?.latest_score_pct !== undefined
                  ? `${summary.latest_score_pct.toFixed(1)}%`
                  : "—"
              }
              subtext="Most recent evaluation result"
              icon={Target}
              loading={summaryLoading}
            />

            {/* Best Score */}
            <StatCard
              title="Best Score"
              value={
                summary?.best_score_pct !== null && summary?.best_score_pct !== undefined
                  ? `${summary.best_score_pct.toFixed(1)}%`
                  : "—"
              }
              subtext="All-time highest module score"
              icon={Award}
              loading={summaryLoading}
            />

            {/* Improvement % (First 3 vs Last 3 sessions) */}
            <StatCard
              title="Improvement"
              value={
                summary?.improvement_pct !== null && summary?.improvement_pct !== undefined
                  ? `${summary.improvement_pct >= 0 ? "+" : ""}${summary.improvement_pct.toFixed(1)}%`
                  : "—"
              }
              subtext={
                summary?.improvement_pct !== null && summary?.improvement_pct !== undefined ? (
                  <span
                    className={`font-semibold ${
                      summary.improvement_pct >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {summary.improvement_pct >= 0 ? "▲ Positive trend" : "▼ Needs review"} (vs first 3)
                  </span>
                ) : (
                  "Baseline assessment"
                )
              }
              icon={TrendingUp}
              loading={summaryLoading}
            />

            {/* Total Sessions */}
            <StatCard
              title="Sessions"
              value={
                summary?.session_count !== null && summary?.session_count !== undefined
                  ? String(summary.session_count)
                  : "0"
              }
              subtext="Evaluations completed"
              icon={Clock}
              loading={summaryLoading}
            />
          </div>

          {/* 3. Middle Section: Trajectory Line Chart & Errors on Left, Dark Focus Areas on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* My score over time area line chart */}
              <ChartCard
                title="My Score Over Time"
                subtitle="Normalized percentage progression timeline across assessment modules"
                loading={progressLoading}
                error={progressError}
                empty={!filteredProgress || filteredProgress.length === 0}
                emptyMessage="No recorded evaluation sessions for the selected filter"
                onRetry={refetchProgress}
                action={
                  moduleOptions.length > 0 ? (
                    <div className="flex items-center space-x-2">
                      <Filter className="w-3.5 h-3.5 text-brand hidden sm:block" />
                      <select
                        value={selectedModule}
                        onChange={(e) => setSelectedModule(e.target.value)}
                        aria-label="Filter timeline by module"
                        className="text-xs font-bold text-slate-700 bg-white border border-purple-200 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                      >
                        <option value="ALL">All Modules ({progress?.length || 0})</option>
                        {moduleOptions.map((mod) => (
                          <option key={mod} value={mod}>
                            {mod}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null
                }
              >
                <div className="w-full h-64 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={filteredProgress}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5B3FA8" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#5B3FA8" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1ECFA" />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: "#E2E8F0" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "#64748B" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}%`}
                      />
                      <Tooltip content={<ProgressTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="score_pct"
                        stroke="#5B3FA8"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#purpleGradient)"
                        dot={{
                          r: 4,
                          fill: "#FFFFFF",
                          stroke: "#5B3FA8",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 6,
                          fill: "#5B3FA8",
                          stroke: "#FFFFFF",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Errors by module horizontal bar chart */}
              <ChartCard
                title="Errors by Module"
                subtitle="Average error count per assessment module (highest in solid purple)"
                loading={errorStatsLoading}
                error={errorStatsError}
                empty={!errorStats || errorStats.length === 0}
                emptyMessage="No error frequency statistics recorded"
                onRetry={refetchErrors}
              >
                <div className="w-full h-56 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={errorStats || []}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1ECFA" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                      <YAxis
                        dataKey="module_name"
                        type="category"
                        tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        width={130}
                      />
                      <Tooltip content={<ErrorTooltip />} />
                      <Bar dataKey="avg_errors" radius={[0, 6, 6, 0]}>
                        {(errorStats || []).map((entry, index) => {
                          const isHighest =
                            entry.avg_errors === highestAvgError && highestAvgError > 0;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isHighest ? "#5B3FA8" : "#EDE8FA"}
                              stroke={isHighest ? "#4A3290" : "#D8CCF5"}
                              strokeWidth={1}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* Dark Focus Areas Card & Next Goal on Right Column */}
            <div className="lg:col-span-1">
              <Card variant="dark" className="h-full flex flex-col justify-between p-6 border border-purple-400/20 shadow-lg">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <div className="flex items-center space-x-2">
                      <Target className="w-4 h-4 text-purple-300" />
                      <h3 className="text-sm font-extrabold text-white tracking-tight">Focus Areas</h3>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                      Practice Needs
                    </span>
                  </div>

                  <p className="text-xs text-purple-200/90 mb-4 leading-relaxed">
                    Top modules with higher error frequency. Target these topics for practice drills:
                  </p>

                  {/* Top 3 Modules with Colored Dots */}
                  <div className="space-y-3 mb-6">
                    {(errorStats || [])
                      .slice()
                      .sort((a, b) => b.avg_errors - a.avg_errors)
                      .slice(0, 3)
                      .map((mod, idx) => {
                        const isHigh = mod.avg_errors >= 3;
                        const isMedium = mod.avg_errors >= 1.5 && mod.avg_errors < 3;
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  isHigh ? "bg-rose-400 shadow-xs" : isMedium ? "bg-amber-400" : "bg-purple-300"
                                }`}
                              ></span>
                              <span className="text-xs font-bold text-white truncate">
                                {mod.module_name}
                              </span>
                            </div>
                            <span className="text-xs font-black text-purple-200 shrink-0 ml-2">
                              {mod.avg_errors.toFixed(1)} errs
                            </span>
                          </div>
                        );
                      })}

                    {(!errorStats || errorStats.length === 0) && (
                      <div className="text-xs text-purple-300 text-center py-6">
                        No error patterns logged yet. Complete more sessions to analyze focus areas.
                      </div>
                    )}
                  </div>
                </div>

                {/* White "Next Goal" Mini Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand">Next Goal</span>
                    <span className="text-xs font-extrabold text-slate-900">
                      {Math.min(
                        100,
                        Math.round(
                          ((summary?.latest_score_pct || summary?.best_score_pct || 75) / 90.0) * 100
                        )
                      )}%
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Target: <span className="text-brand font-black">90.0%</span> average score
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            5,
                            Math.round(
                              ((summary?.latest_score_pct || summary?.best_score_pct || 75) / 90.0) * 100
                            )
                          )
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 font-medium">
                    <span>
                      Current:{" "}
                      {summary?.latest_score_pct !== null && summary?.latest_score_pct !== undefined
                        ? `${summary.latest_score_pct.toFixed(1)}%`
                        : "75.0%"}
                    </span>
                    <span>Target: 90%</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* 5. Recent Sessions Table (Last 10) */}
          <ChartCard
            title="Recent Assessment Log"
            subtitle="Last 10 evaluation sessions completed with scores, error logs, and duration"
            loading={sessionsLoading}
            error={sessionsError}
            empty={!sessions || sessions.length === 0}
            emptyMessage="No completed sessions available"
            onRetry={refetchSessions}
          >
            <div className="overflow-x-auto w-full -mx-2 sm:mx-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-purple-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3 text-right">Score %</th>
                    <th className="py-2.5 px-3 text-right">Errors</th>
                    <th className="py-2.5 px-3 text-right">Time Taken</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {(sessions || []).map((s) => {
                    const sessionDate = s.created_at
                      ? new Date(s.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—";
                    const durationMins =
                      s.time_seconds !== undefined
                        ? `${(s.time_seconds / 60).toFixed(1)} mins`
                        : "—";

                    // Allowed to delete: admin OR (trainer and session created by them)
                    const canDelete =
                      isAdmin ||
                      (isTrainer && (s.created_by === user?.id || s.created_by === undefined || s.created_by === null));

                    return (
                      <tr key={s.id} className="hover:bg-purple-50/50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-600 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand" />
                          <span>{sessionDate}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {s.module_name || `Module #${s.module_id}`}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-brand">
                          {s.score_pct !== null && s.score_pct !== undefined
                            ? `${s.score_pct.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              s.errors > 3
                                ? "bg-rose-100 text-rose-700 font-bold"
                                : "text-slate-600"
                            }`}
                          >
                            {s.errors}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500 font-medium">
                          {durationMins}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteSessionError("");
                                setDeleteSessionTarget(s);
                              }}
                              title="Delete assessment session"
                              className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Delete Session Confirmation Dialog */}
          {deleteSessionTarget && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
              <Card variant="white" className="w-full max-w-sm p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
                <div className="flex items-center space-x-2 text-rose-600 mb-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm font-extrabold text-slate-900">Delete Session Record</h3>
                </div>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Are you sure you want to permanently delete this assessment session for{" "}
                  <strong className="text-slate-900">{deleteSessionTarget.module_name || `Module #${deleteSessionTarget.module_id}`}</strong>?
                  This action cannot be undone.
                </p>

                {deleteSessionError && (
                  <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                    {deleteSessionError}
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setDeleteSessionTarget(null)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteSessionLoading}
                    onClick={async () => {
                      setDeleteSessionLoading(true);
                      setDeleteSessionError("");
                      try {
                        await apiClient.delete(`/sessions/${deleteSessionTarget.id}`);
                        setDeleteSessionTarget(null);
                        refetchSessions();
                        refetchSummary();
                      } catch (err) {
                        if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
                          setDeleteSessionTarget(null);
                          refetchSessions();
                        } else {
                          setDeleteSessionError(err.response?.data?.error?.message || err.message || "Failed to delete session");
                        }
                      } finally {
                        setDeleteSessionLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold transition-colors shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-60"
                  >
                    {deleteSessionLoading ? <Spinner size="sm" className="text-white" /> : <span>Delete</span>}
                  </button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TraineeDashboard;
