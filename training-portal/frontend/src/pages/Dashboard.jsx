// src/pages/Dashboard.jsx
// Trainer analytics dashboard matching the purple design specification with independent widget loading.
// Features 3-column desktop layout, cohort selector, KPI summary cards, weekly bar charts, SVG donut, score bands, attention roster, and leaderboard rankings.

import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { ChartCard } from "../components/ChartCard.jsx";
import { Spinner } from "../components/Spinner.jsx";
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
  Users,
  Award,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Trophy,
  Filter,
} from "lucide-react";

/**
 * 1. Batch Selector Header Component
 */
function BatchHeader({ batches, selectedBatchId, onSelectBatch, loading, error, onRetry, isTrainer }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs uppercase font-extrabold tracking-wider text-brand">
            Cohort Performance Portal
          </span>
          {isTrainer && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider shadow-2xs">
              Can add sessions
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
          Training Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time aggregated analytics, score trajectories, and risk intervention rosters
        </p>
      </div>

      {/* Pill-shaped batch dropdown */}
      <div className="flex items-center space-x-2 self-start sm:self-auto">
        {loading ? (
          <div className="px-5 py-2.5 rounded-full bg-white border border-purple-100 flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <Spinner size="sm" />
            <span>Loading batches...</span>
          </div>
        ) : error ? (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-red-600 font-semibold">Failed to load cohorts</span>
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-brand text-white rounded-full text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="relative inline-flex items-center">
            <div className="absolute left-3.5 pointer-events-none text-brand">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedBatchId || ""}
              onChange={(e) => onSelectBatch(Number(e.target.value))}
              aria-label="Select cohort batch"
              className="appearance-none pl-9 pr-9 py-2.5 bg-white border border-purple-200/80 hover:border-brand rounded-full text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer transition-all"
            >
              {(batches || []).map((batch) => (
                <option key={batch.id} value={batch.id}>
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
        <div className="flex items-end justify-between gap-2 h-40 px-2 border-b border-purple-100 pb-2">
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
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-semibold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg">
                  {hasScore ? `${item.avg_score_pct.toFixed(1)}% (${item.session_count} ses.)` : "No sessions"}
                </div>

                {/* Vertical Bar */}
                <div className="w-full max-w-[28px] flex items-end justify-center h-full">
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-full rounded-full transition-all duration-300 ${
                      !hasScore
                        ? "bg-purple-100/60 border border-dashed border-purple-200"
                        : isHighest
                        ? "bg-brand shadow-sm shadow-brand/30"
                        : "bg-brand-light hover:bg-purple-200"
                    }`}
                  ></div>
                </div>

                {/* Week Label */}
                <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate w-full text-center">
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
              stroke="#EDE8FA"
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
                className="transition-all duration-700 ease-out"
              />
            )}
          </svg>

          {/* Centered Percentage Value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {hasData ? `${passRate.toFixed(1)}%` : "—"}
            </span>
            <span className="text-[10px] uppercase font-bold text-brand tracking-wider">
              Passed
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center space-x-4 text-xs font-semibold">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand"></span>
            <span className="text-slate-700">Pass (≥50%)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-light"></span>
            <span className="text-slate-500">Needs Retake</span>
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
          <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-brand"></span>
              <span className="text-xs font-bold text-slate-800">Excellent</span>
            </div>
            <div className="text-base font-black text-brand">{excellent.percent.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">{excellent.count} trainees (≥75%)</div>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#8E74D4]"></span>
              <span className="text-xs font-bold text-slate-800">Average</span>
            </div>
            <div className="text-base font-black text-[#6C4EB8]">{average.percent.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">{average.count} trainees (50-74%)</div>
          </div>

          <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-purple-300"></span>
              <span className="text-xs font-bold text-slate-800">Struggling</span>
            </div>
            <div className="text-base font-black text-slate-700">{struggling.percent.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">{struggling.count} trainees (&lt;50%)</div>
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
      <Card variant="white" className="border-purple-200/70 shadow-sm">
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-1.5 rounded-xl bg-amber-100 text-amber-600">
            <Trophy className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Top Cohort Performer
          </h3>
        </div>

        {topLoading ? (
          <div className="py-4 flex justify-center">
            <Spinner size="sm" />
          </div>
        ) : topError ? (
          <div className="text-center py-2 text-xs text-red-600">
            <span>Could not load top performer</span>
            <button
              onClick={onRetryTop}
              className="ml-2 font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !topPerformer ? (
          <div className="text-center py-4 text-xs text-slate-500 font-medium">
            No session records for this batch
          </div>
        ) : (
          <Link
            to={`/trainees/${topPerformer.trainee_id}`}
            className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 hover:bg-purple-100/70 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-brand text-white font-extrabold text-xs flex items-center justify-center">
                #{topPerformer.rank || 1}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-brand transition-colors">
                  {topPerformer.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {topPerformer.session_count} assessments taken
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-black text-brand">
                {topPerformer.avg_score_pct !== null && topPerformer.avg_score_pct !== undefined
                  ? `${topPerformer.avg_score_pct.toFixed(1)}%`
                  : "—"}
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">Top Band</span>
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
            <tr className="border-b border-purple-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Trainee Name</th>
              <th className="py-2.5 px-3 text-right">Avg Score</th>
              <th className="py-2.5 px-3 text-right">Sessions</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-50">
            {(leaderboard || []).map((item, idx) => {
              const displayRank = item.rank || idx + 1;
              const isTopThree = displayRank <= 3;

              return (
                <tr
                  key={item.trainee_id}
                  className="hover:bg-purple-50/50 transition-colors group cursor-pointer"
                >
                  {/* Rank */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-extrabold text-[11px] ${
                        isTopThree
                          ? "bg-brand-light text-brand"
                          : "text-slate-500 font-semibold"
                      }`}
                    >
                      {displayRank}
                    </span>
                  </td>

                  {/* Name */}
                  <td className="py-3 px-3 font-semibold text-slate-900 group-hover:text-brand transition-colors">
                    <Link
                      to={`/trainees/${item.trainee_id}`}
                      className="flex items-center space-x-1.5 focus:outline-none"
                    >
                      <span>{item.name}</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-brand" />
                    </Link>
                  </td>

                  {/* Avg Score */}
                  <td className="py-3 px-3 text-right font-extrabold text-slate-800">
                    {item.avg_score_pct !== null && item.avg_score_pct !== undefined
                      ? `${item.avg_score_pct.toFixed(1)}%`
                      : "—"}
                  </td>

                  {/* Sessions */}
                  <td className="py-3 px-3 text-right text-slate-500 font-medium">
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
export function Dashboard() {
  const { isTrainer } = useAuth();

  // 1. Cohorts list & selection state
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    loading: batchesLoading,
    error: batchesError,
    refetch: refetchBatches,
  } = useBatches();

  // 2. Data hooks keyed to selectedBatchId
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
  } = useBatchLeaderboard(selectedBatchId, 10);

  const {
    data: topPerformer,
    loading: topLoading,
    error: topError,
    refetch: refetchTop,
  } = useBatchTopPerformer(selectedBatchId);

  // 3. Silent live updates & 500ms debounced refetcher
  const debounceTimerRef = React.useRef(null);

  const silentRefetchAll = React.useCallback(() => {
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
    React.useCallback(
      (event) => {
        if (!event || !selectedBatchId) return;
        const { type, batch_id, batch_ids } = event;

        let shouldRefetch = false;
        if (type === "session_created" || type === "session_deleted") {
          if (Number(batch_id) === Number(selectedBatchId)) {
            shouldRefetch = true;
          }
        } else if (type === "sessions_bulk_created") {
          if (batch_ids && batch_ids.some((b) => Number(b) === Number(selectedBatchId))) {
            shouldRefetch = true;
          }
        }

        if (shouldRefetch) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            silentRefetchAll();
          }, 500);
        }
      },
      [selectedBatchId, silentRefetchAll]
    )
  );

  // Polling fallback: 15s interval when not connected; immediate catch-up on reconnect
  usePollingFallback(silentRefetchAll, 15000);

  return (
    <div className="space-y-6">
      {/* Top Header & Cohort Dropdown */}
      <BatchHeader
        batches={batches}
        selectedBatchId={selectedBatchId}
        onSelectBatch={setSelectedBatchId}
        loading={batchesLoading}
        error={batchesError}
        onRetry={refetchBatches}
        isTrainer={isTrainer}
      />

      {/* 4 Summary StatCards */}
      <SummaryStatsRow
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        onRetry={refetchSummary}
      />

      {/* 3-Column Layout on Desktop (2 columns left for analytics, 1 column right for dark card) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2-wide): Charts, Bands, and Leaderboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Score Progression Thin Bars */}
          <WeeklyBarsCard
            weekly={weekly}
            loading={weeklyLoading}
            error={weeklyError}
            onRetry={refetchWeekly}
          />

          {/* 2-Column Split: Donut Card and Segmented Bands */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DonutPassRateCard
              summary={summary}
              loading={summaryLoading}
              error={summaryError}
              onRetry={refetchSummary}
            />
            <SegmentedBandsCard
              bands={bands}
              loading={bandsLoading}
              error={bandsError}
              onRetry={refetchBands}
            />
          </div>

          {/* Leaderboard Ranking Table */}
          <LeaderboardTableCard
            leaderboard={leaderboard}
            loading={leaderboardLoading}
            error={leaderboardError}
            onRetry={refetchLeaderboard}
          />
        </div>

        {/* Right Column (1-wide): Signature Dark Purple Attention Card & Top Performer */}
        <div className="lg:col-span-1">
          <DarkAttentionColumn
            attention={attention}
            attentionLoading={attentionLoading}
            attentionError={attentionError}
            onRetryAttention={refetchAttention}
            topPerformer={topPerformer}
            topLoading={topLoading}
            topError={topError}
            onRetryTop={refetchTop}
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
