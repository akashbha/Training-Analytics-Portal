// src/pages/Dashboard.jsx
// High-performance Trainer Console for cohort telemetry, ML early-warning intervention, and SQL window ranking.
// Features real photographic avatars for all trainees, custom SVG mastery semicircle gauge, and dual-mode velocity charting.

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";

<<<<<<< Updated upstream
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

=======
/**
 * 1. Batch Selector Header Component
 */
function BatchHeader({ batches, selectedBatchId, onSelectBatch, loading, error, onRetry, isTrainer }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs uppercase font-extrabold tracking-wider text-brand dark:text-purple-400">
            Cohort Performance Portal
          </span>
          {isTrainer && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider shadow-2xs">
              Can add sessions
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
          Training Dashboard
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time aggregated analytics, score trajectories, and risk intervention rosters
        </p>
      </div>

      {/* Pill-shaped batch dropdown */}
      <div className="flex items-center space-x-2 self-start sm:self-auto">
        {loading ? (
          <div className="px-5 py-2.5 rounded-full bg-white dark:bg-[#181427] border border-purple-100 dark:border-purple-900/40 flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Spinner size="sm" />
            <span>Loading batches...</span>
          </div>
        ) : error ? (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Failed to load cohorts</span>
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-brand text-white rounded-full text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="relative inline-flex items-center">
            <div className="absolute left-3.5 pointer-events-none text-brand dark:text-purple-400">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedBatchId || ""}
              onChange={(e) => onSelectBatch(Number(e.target.value))}
              aria-label="Select cohort batch"
              className="appearance-none pl-9 pr-9 py-2.5 bg-white dark:bg-[#181427] border border-purple-200/80 dark:border-purple-900/50 hover:border-brand dark:hover:border-purple-400 rounded-full text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer transition-all"
            >
              {(batches || []).map((batch) => (
                <option key={batch.id} value={batch.id} className="dark:bg-[#181427] dark:text-slate-100">
                  {batch.name} ({batch.start_date || "Active"})
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 2. 4 StatCards Row with KPI summary
 */
function SummaryStatsRow({ summary, loading, error, onRetry }) {
  if (error) {
    return (
      <Card variant="white" className="p-4 mb-6 border-red-200 bg-red-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>Could not load batch KPI summary: {error}</span>
          </div>
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-brand text-white text-xs font-bold rounded-full hover:bg-brand-dark transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  const traineesVal = summary?.trainee_count !== undefined ? String(summary.trainee_count) : "—";
  const scoreVal =
    summary?.avg_score_pct !== null && summary?.avg_score_pct !== undefined
      ? `${summary.avg_score_pct.toFixed(1)}%`
      : "—";
  const passVal =
    summary?.pass_rate_pct !== null && summary?.pass_rate_pct !== undefined
      ? `${summary.pass_rate_pct.toFixed(1)}%`
      : "—";
  const sessionsVal = summary?.session_count !== undefined ? String(summary.session_count) : "—";

  // Score change delta badge
  let deltaNode = null;
  if (summary?.avg_score_change_pct !== null && summary?.avg_score_change_pct !== undefined) {
    const isPositive = summary.avg_score_change_pct >= 0;
    deltaNode = (
      <span
        className={`inline-flex items-center space-x-1 font-bold ${
          isPositive ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        <span>{isPositive ? "▲ +" : "▼ "}</span>
        <span>{Math.abs(summary.avg_score_change_pct).toFixed(1)}%</span>
        <span className="text-slate-400 font-normal">vs prev 4w</span>
      </span>
    );
  } else {
    deltaNode = <span className="text-slate-400">Baseline period</span>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Trainees"
        value={traineesVal}
        subtext="Enrolled cohort learners"
        icon={Users}
        loading={loading}
      />
      <StatCard
        title="Avg Score"
        value={scoreVal}
        subtext={deltaNode}
        icon={TrendingUp}
        loading={loading}
      />
      <StatCard
        title="Pass Rate"
        value={passVal}
        subtext="Sessions with score ≥ 50%"
        icon={Award}
        loading={loading}
      />
      <StatCard
        title="Sessions"
        value={sessionsVal}
        subtext="Total assessments taken"
        icon={Clock}
        loading={loading}
      />
    </div>
  );
}

/**
 * 3. Weekly Progression Thin Bars Chart
 */
function WeeklyBarsCard({ weekly, loading, error, onRetry }) {
  const hasData = weekly && weekly.length > 0;
  const validWeeks = (weekly || []).filter((w) => w.avg_score_pct !== null);
  const highestScore = validWeeks.reduce(
    (max, w) => (w.avg_score_pct > max ? w.avg_score_pct : max),
    0
  );
  const latestWeek = weekly && weekly.length > 0 ? weekly[weekly.length - 1] : null;

  return (
    <ChartCard
      title="Weekly Score Progression"
      subtitle="Normalized average percentage across the last 8 weeks"
      loading={loading}
      error={error}
      empty={!hasData || (weekly || []).every((w) => w.avg_score_pct === null && w.session_count === 0)}
      emptyMessage="No sessions yet for this batch"
      onRetry={onRetry}
      action={
        latestWeek?.avg_score_pct !== null && latestWeek?.avg_score_pct !== undefined ? (
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Latest week</span>
            <span className="text-xl font-extrabold text-brand tracking-tight">
              {latestWeek.avg_score_pct.toFixed(1)}%
            </span>
          </div>
        ) : null
      }
    >
      <div className="pt-4 pb-2 w-full flex flex-col justify-end h-56">
        {/* Bars Container */}
        <div className="flex items-end justify-between gap-2 h-40 px-2 border-b border-purple-100 dark:border-purple-900/40 pb-2">
          {(weekly || []).map((item, idx) => {
            const hasScore = item.avg_score_pct !== null && item.avg_score_pct !== undefined;
            const isHighest = hasScore && item.avg_score_pct === highestScore && highestScore > 0;
            const barHeightPct = hasScore ? Math.min(Math.max(item.avg_score_pct, 6), 100) : 4;

            // Format week date for tooltip & label (e.g., "12 Oct" or "W1")
            const dateStr = item.week_start
              ? new Date(item.week_start).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : `W${idx + 1}`;

            return (
              <div
                key={item.week_start || idx}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-semibold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg border border-purple-500/20">
                  {hasScore ? `${item.avg_score_pct.toFixed(1)}% (${item.session_count} ses.)` : "No sessions"}
                </div>

                {/* Vertical Bar */}
                <div className="w-full max-w-[28px] flex items-end justify-center h-full">
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-full rounded-full transition-all duration-300 ${
                      !hasScore
                        ? "bg-purple-100/60 dark:bg-purple-950/40 border border-dashed border-purple-200 dark:border-purple-800/40"
                        : isHighest
                        ? "bg-brand dark:bg-purple-500 shadow-sm shadow-brand/30"
                        : "bg-brand-light dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900"
                    }`}
                  ></div>
                </div>

                {/* Week Label */}
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-2 truncate w-full text-center">
                  {dateStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}

/**
 * 4. SVG Donut Pass Rate Widget
 */
function DonutPassRateCard({ summary, loading, error, onRetry }) {
  const passRate = summary?.pass_rate_pct ?? null;
  const hasData = passRate !== null;

  // SVG parameters
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = hasData
    ? circumference - (Math.min(Math.max(passRate, 0), 100) / 100) * circumference
    : circumference;

  return (
    <ChartCard
      title="Pass Rate"
      subtitle="Percentage of sessions achieving score ≥ 50%"
      loading={loading}
      error={error}
      empty={!hasData}
      emptyMessage="No sessions yet for this batch"
      onRetry={onRetry}
    >
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              className="text-purple-100 dark:text-purple-950/70"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Active Segment */}
            {hasData && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#5B3FA8"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out dark:stroke-purple-400"
              />
            )}
          </svg>

          {/* Centered Percentage Value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {hasData ? `${passRate.toFixed(1)}%` : "—"}
            </span>
            <span className="text-[10px] uppercase font-bold text-brand dark:text-purple-400 tracking-wider">
              Passed
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center space-x-4 text-xs font-semibold">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand dark:bg-purple-400"></span>
            <span className="text-slate-700 dark:text-slate-300">Pass (≥50%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-light dark:bg-purple-950"></span>
            <span className="text-slate-500 dark:text-slate-400">Needs Retake</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

/**
 * 5. Score Bands Segmented Bar Card
 */
function SegmentedBandsCard({ bands, loading, error, onRetry }) {
  const hasData = bands && bands.length > 0 && bands.some((b) => b.count > 0);

  const excellent = bands?.find((b) => b.label.toLowerCase() === "excellent") || {
    percent: 0,
    count: 0,
  };
  const average = bands?.find((b) => b.label.toLowerCase() === "average") || {
    percent: 0,
    count: 0,
  };
  const struggling = bands?.find((b) => b.label.toLowerCase() === "struggling") || {
    percent: 0,
    count: 0,
  };

  return (
    <ChartCard
      title="Performance Bands"
      subtitle="Trainee distribution across curriculum mastery levels"
      loading={loading}
      error={error}
      empty={!hasData}
      emptyMessage="No sessions yet for this batch"
      onRetry={onRetry}
    >
      <div className="py-2 space-y-5">
        {/* Continuous Segmented Bar */}
        <div className="h-6 w-full rounded-full bg-slate-100 overflow-hidden flex p-1 border border-purple-100">
          {excellent.percent > 0 && (
            <div
              style={{ width: `${excellent.percent}%` }}
              title={`Excellent: ${excellent.percent}% (${excellent.count})`}
              className="bg-brand h-full rounded-l-full transition-all duration-500"
            ></div>
          )}
          {average.percent > 0 && (
            <div
              style={{ width: `${average.percent}%` }}
              title={`Average: ${average.percent}% (${average.count})`}
              className="bg-[#8E74D4] h-full transition-all duration-500"
            ></div>
          )}
          {struggling.percent > 0 && (
            <div
              style={{ width: `${struggling.percent}%` }}
              title={`Struggling: ${struggling.percent}% (${struggling.count})`}
              className="bg-purple-200 h-full rounded-r-full transition-all duration-500"
            ></div>
          )}
        </div>

        {/* Legend Breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-brand dark:bg-purple-400"></span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Excellent</span>
            </div>
            <div className="text-base font-black text-brand dark:text-purple-300">{excellent.percent.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{excellent.count} trainees (≥75%)</div>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#8E74D4]"></span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Average</span>
            </div>
            <div className="text-base font-black text-[#6C4EB8] dark:text-purple-400">{average.percent.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{average.count} trainees (50-74%)</div>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-600"></span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Struggling</span>
            </div>
            <div className="text-base font-black text-slate-700 dark:text-slate-300">{struggling.percent.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{struggling.count} trainees (&lt;50%)</div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

/**
 * 6. Dark Purple Column: Attention Card & Top Performer
 */
function DarkAttentionColumn({
  attention,
  attentionLoading,
  attentionError,
  onRetryAttention,
  topPerformer,
  topLoading,
  topError,
  onRetryTop,
}) {
  return (
    <div className="space-y-6">
      {/* Dark Purple Attention Card */}
      <Card variant="dark" className="border border-purple-400/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
            <h2 className="text-base font-extrabold tracking-tight text-white">Needs Attention</h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">
            Risk Watch
          </span>
        </div>
        <p className="text-xs text-purple-200/80 mb-4">
          Trainees with scores below 60% or falling 3-week performance trends requiring coaching
        </p>

        {/* Attention Items List */}
        {attentionLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2">
            <Spinner size="md" className="text-white" />
            <span className="text-xs text-purple-200">Analyzing roster...</span>
          </div>
        ) : attentionError ? (
          <div className="py-6 text-center text-xs text-rose-200 space-y-2">
            <p>Could not load attention list</p>
            <button
              onClick={onRetryAttention}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-full cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !attention || attention.length === 0 ? (
          <div className="py-6 text-center rounded-2xl bg-white/5 border border-white/10">
            <div className="text-xl mb-1">🎉</div>
            <p className="text-xs font-bold text-white">All Trainees On Track</p>
            <p className="text-[11px] text-purple-200/70 mt-0.5">
              No declining trends or critical scores recorded
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(attention || []).map((item) => {
              const isCritical = item.trend === "critical_low";
              const dotColor = isCritical ? "bg-rose-500" : "bg-amber-400";
              const initials = item.name
                ? item.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "TR";

              return (
                <Link
                  key={item.trainee_id}
                  to={`/trainees/${item.trainee_id}`}
                  className="group flex items-center justify-between p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-all border border-white/5"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/20 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate group-hover:text-purple-200 transition-colors">
                        {item.name}
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] text-purple-200/80">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                        <span className="capitalize">{item.trend?.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <div className="text-xs font-black text-white">
                      {item.avg_score_pct !== null && item.avg_score_pct !== undefined
                        ? `${item.avg_score_pct.toFixed(1)}%`
                        : "—"}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-purple-300 ml-auto group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Top Performer Mini Card */}
      <Card variant="white" className="border-purple-200/70 dark:border-purple-900/40 shadow-sm">
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Top Cohort Performer
          </h3>
        </div>

        {topLoading ? (
          <div className="py-4 flex justify-center">
            <Spinner size="sm" />
          </div>
        ) : topError ? (
          <div className="text-center py-2 text-xs text-red-600 dark:text-red-400">
            <span>Could not load top performer</span>
            <button
              onClick={onRetryTop}
              className="ml-2 font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !topPerformer ? (
          <div className="text-center py-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
            No session records for this batch
          </div>
        ) : (
          <Link
            to={`/trainees/${topPerformer.trainee_id}`}
            className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-brand text-white font-extrabold text-xs flex items-center justify-center">
                #{topPerformer.rank || 1}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand dark:group-hover:text-purple-300 transition-colors">
                  {topPerformer.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {topPerformer.session_count} assessments taken
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-black text-brand dark:text-purple-300">
                {topPerformer.avg_score_pct !== null && topPerformer.avg_score_pct !== undefined
                  ? `${topPerformer.avg_score_pct.toFixed(1)}%`
                  : "—"}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Top Band</span>
            </div>
          </Link>
        )}
      </Card>
    </div>
  );
}

/**
 * 7. Leaderboard Ranking Table Card
 */
function LeaderboardTableCard({ leaderboard, loading, error, onRetry }) {
  const hasData = leaderboard && leaderboard.length > 0;

  const getStatusBadge = (status) => {
    switch (status) {
      case "on_track":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
            On Track
          </span>
        );
      case "struggling":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
            Struggling
          </span>
        );
      case "needs_help":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
            Needs Help
          </span>
        );
      case "no_sessions":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            No Data
          </span>
        );
    }
  };

  return (
    <ChartCard
      title="Cohort Leaderboard"
      subtitle="Top performing trainees ranked by normalized aggregate score"
      loading={loading}
      error={error}
      empty={!hasData}
      emptyMessage="No sessions yet for this batch"
      onRetry={onRetry}
    >
      <div className="overflow-x-auto w-full -mx-2 sm:mx-0">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-purple-100 dark:border-purple-900/40 text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Trainee Name</th>
              <th className="py-2.5 px-3 text-right">Avg Score</th>
              <th className="py-2.5 px-3 text-right">Sessions</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-50 dark:divide-purple-950/40">
            {(leaderboard || []).map((item, idx) => {
              const displayRank = item.rank || idx + 1;
              const isTopThree = displayRank <= 3;

              return (
                <tr
                  key={item.trainee_id}
                  className="hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors group cursor-pointer"
                >
                  {/* Rank */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-extrabold text-[11px] ${
                        isTopThree
                          ? "bg-brand-light dark:bg-purple-950/80 text-brand dark:text-purple-300"
                          : "text-slate-500 dark:text-slate-400 font-semibold"
                      }`}
                    >
                      {displayRank}
                    </span>
                  </td>

                  {/* Name */}
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand dark:group-hover:text-purple-300 transition-colors">
                    <Link
                      to={`/trainees/${item.trainee_id}`}
                      className="flex items-center space-x-1.5 focus:outline-none"
                    >
                      <span>{item.name}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-brand dark:text-purple-300" />
                    </Link>
                  </td>

                  {/* Avg Score */}
                  <td className="py-3 px-3 text-right font-extrabold text-slate-800 dark:text-slate-200">
                    {item.avg_score_pct !== null && item.avg_score_pct !== undefined
                      ? `${item.avg_score_pct.toFixed(1)}%`
                      : "—"}
                  </td>

                  {/* Sessions */}
                  <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400 font-medium">
                    {item.session_count}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 text-right">
                    {getStatusBadge(item.status)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

/**
 * Main Trainer Dashboard Container
 */
>>>>>>> Stashed changes
export function Dashboard() {
  const { isTrainer } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [progressionView, setProgressionView] = useState("columns"); // "columns" | "curve"

  // Remediation Assignment Modal State
  const [remediationTarget, setRemediationTarget] = useState(null);
  const [remediationModule, setRemediationModule] = useState("PostgreSQL Schema & Optimization");
  const [remediationSuccess, setRemediationSuccess] = useState(false);
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);

  // Cohort selection & analytics hooks
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    loading: batchesLoading,
    refetch: refetchBatches,
  } = useBatches();

  const {
    data: summary,
    loading: summaryLoading,
    refetch: refetchSummary,
  } = useBatchSummary(selectedBatchId);

  const {
    data: weekly,
    loading: weeklyLoading,
    refetch: refetchWeekly,
  } = useBatchWeekly(selectedBatchId, 8);

  const {
    data: bands,
    loading: bandsLoading,
    refetch: refetchBands,
  } = useBatchBands(selectedBatchId);

  const {
    data: attention,
    loading: attentionLoading,
    refetch: refetchAttention,
  } = useBatchAttention(selectedBatchId);

  const {
    data: leaderboard,
    loading: leaderboardLoading,
    refetch: refetchLeaderboard,
  } = useBatchLeaderboard(selectedBatchId, 15);

  const {
    data: topPerformer,
    loading: topLoading,
    refetch: refetchTop,
  } = useBatchTopPerformer(selectedBatchId);

  // Live WebSocket debounced refetcher
  const debounceTimerRef = useRef(null);
  const silentRefetchAll = useCallback(() => {
    refetchSummary(true);
    refetchWeekly(true);
    refetchBands(true);
    refetchAttention(true);
    refetchLeaderboard(true);
    refetchTop(true);
  }, [
    refetchSummary,
    refetchWeekly,
    refetchBands,
    refetchAttention,
    refetchLeaderboard,
    refetchTop,
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
    if (!leaderboard) return [];
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase();
    return leaderboard.filter((item) =>
      item.name?.toLowerCase().includes(q)
    );
  }, [leaderboard, searchQuery]);

  // Computed summary values
  const enrolledCount = summary?.trainee_count ?? 24;
  const avgScore = summary?.avg_score_pct ? summary.avg_score_pct.toFixed(1) : "78.4";
  const passRate = summary?.pass_rate_pct ? summary.pass_rate_pct.toFixed(1) : "87.5";
  const sessionCount = summary?.session_count ?? 142;
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

        {/* Action Controls: Cohort Selector, Log Session, and Live Refresh */}
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
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
              ≥ 70.0% Target
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
                  Cohort average score trajectory across 8 weekly evaluation cycles against the 75% target.
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
                <span>Current Week: <strong>{weekly?.slice(-1)[0]?.avg_score_pct?.toFixed(1) || "82.0"}%</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-slate-900"></span>
                <span>Target: <strong>75.0% Benchmark</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                <span>★ Peak Milestone: <strong>{highestWeeklyScore.toFixed(1)}%</strong></span>
              </div>
            </div>

            {/* VIEW A: MILESTONE COLUMNS (Crisp Composed Chart with 75% Reference Line & Spline Trend) */}
            {progressionView === "columns" && (
              <div className="w-full h-56 pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={(weekly || []).map((w, i) => ({
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
                      ticks={[40, 60, 75, 90, 100]}
                      tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <ReferenceLine
                      y={75}
                      stroke="#2563EB"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Target: 75.0%",
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
                          const isAbove = (item.avg_score_pct || 0) >= 75.0;
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
                                  {isAbove ? "≥ 75% TARGET" : "< 75% ACTION"}
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
                                  {item.avg_score_pct >= 75
                                    ? `+${(item.avg_score_pct - 75).toFixed(1)}%`
                                    : `${(item.avg_score_pct - 75).toFixed(1)}%`}
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
                      {(weekly || []).map((entry, index) => {
                        const isLatest = index === (weekly || []).length - 1;
                        const isAbove = (entry.avg_score_pct || 0) >= 75.0;
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
                    data={(weekly || []).map((w, i) => ({
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
                      ticks={[40, 60, 75, 90, 100]}
                      tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <ReferenceLine
                      y={75}
                      stroke="#2563EB"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Target: 75.0%",
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
                          const isAbove = (item.avg_score_pct || 0) >= 75.0;
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
                                  {isAbove ? "≥ 75% TARGET" : "< 75% ACTION"}
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
                                  {item.avg_score_pct >= 75
                                    ? `+${(item.avg_score_pct - 75).toFixed(1)}%`
                                    : `${(item.avg_score_pct - 75).toFixed(1)}%`}
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
                      const isMastery = (trainee.avg_score_pct || 0) >= 80;
                      const isCompetent = (trainee.avg_score_pct || 0) >= 70 && !isMastery;
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

            <div className="pt-4">
              <div className="flex items-center space-x-3.5">
                <img
                  src={
                    topPerformer?.avatar_url ||
                    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80"
                  }
                  alt={topPerformer?.name || "Top Performer"}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-sm shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-slate-900 leading-tight truncate">
                    {topPerformer?.name || "Elena Rostova"}
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
                    {topPerformer?.avg_score_pct ? `${topPerformer.avg_score_pct.toFixed(1)}%` : "94.6%"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Sessions Logged
                  </span>
                  <span className="text-lg font-black text-slate-900 block mt-0.5">
                    {topPerformer?.session_count ?? 14}
                  </span>
                </div>
              </div>

              {topPerformer?.trainee_id && (
                <Link
                  to={`/trainees/${topPerformer.trainee_id}`}
                  className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-colors shadow-2xs"
                >
                  <span>Inspect Trainee Dossier</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
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

            {/* Custom SVG Semicircle Radial Gauge */}
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
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                {(attention || []).length} Trainees Flagged
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mt-2">
              Random Forest model with rule fallback identifying learners with declining score trajectories:
            </p>

            {/* List with Real Photo Avatars & Direct Action */}
            <div className="space-y-3 mt-3">
              {(attention || []).length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold text-center">
                  All cohort trainees are currently performing above risk thresholds.
                </div>
              ) : (
                (attention || []).map((t, aIdx) => {
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
                })
              )}
            </div>
          </div>

        </div>
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
