// src/pages/Placeholders.jsx
// Foundation placeholder views for upcoming analytics, management, and session submission screens.
// Styled using the portal's purple theme and rounded-3xl cards awaiting Stage 8 implementation.

import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "../components/Card.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { ChartCard } from "../components/ChartCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Users, Award, Clock, AlertTriangle, Activity } from "lucide-react";

export function DashboardPlaceholder() {
  const { user, isTrainer } = useAuth();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  return (
    <div className="space-y-6">
      {/* Hero Dark Purple Card */}
      <Card variant="dark">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-semibold uppercase tracking-wider mb-2">
              Foundation Active • Stage 7
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Analytics Dashboard</h1>
            <p className="text-xs sm:text-sm text-purple-200 mt-1 max-w-xl">
              Welcome back, <span className="text-white font-bold">{user?.email}</span> ({user?.role}).
              The design token system, pill navigation, and responsive card hierarchy are operational.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSkeleton(!showSkeleton)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              {showSkeleton ? "Hide Skeletons" : "Test Skeletons"}
            </button>
            <button
              onClick={() => setShowEmpty(!showEmpty)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              {showEmpty ? "Hide Empty" : "Test Empty"}
            </button>
          </div>
        </div>
      </Card>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Batches"
          value="5"
          subtext="Cohorts A through E"
          icon={Users}
          loading={showSkeleton}
        />
        <StatCard
          title="Enrolled Trainees"
          value="50"
          subtext="10 trainees per cohort"
          icon={Award}
          loading={showSkeleton}
        />
        <StatCard
          title="Avg Assessment Score"
          value="74.2%"
          subtext="+4.8% vs previous month"
          icon={Activity}
          loading={showSkeleton}
        />
        <StatCard
          title="Attention Trainees"
          value="3"
          subtext="Declining 3-week average"
          icon={AlertTriangle}
          loading={showSkeleton}
        />
      </div>

      {/* Chart Containers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Batch Performance Trajectory"
            subtitle="Normalized 12-week progression percentage across modules"
            empty={showEmpty}
            emptyMessage="No weekly trajectory sessions recorded yet."
          >
            <div className="w-full h-56 flex flex-col items-center justify-center border border-dashed border-purple-200 rounded-2xl bg-brand-light/30 p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold mb-2">
                📈
              </div>
              <p className="text-sm font-bold text-slate-800">Weekly Score Trend Chart</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                SQL window aggregation endpoints ready. Stage 8 connects interactive Recharts time series.
              </p>
            </div>
          </ChartCard>
        </div>

        <div>
          <ChartCard
            title="Module Breakdown"
            subtitle="Curriculum completion rates"
            empty={showEmpty}
          >
            <div className="w-full h-56 flex flex-col items-center justify-center border border-dashed border-purple-200 rounded-2xl bg-brand-light/30 p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold mb-2">
                🎯
              </div>
              <p className="text-sm font-bold text-slate-800">Module Score Distribution</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                6 modules configured with strict score thresholds.
              </p>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isTrainer && (
          <>
            <Link to="/batches" className="block group">
              <Card variant="white" className="h-full hover:border-brand/40 transition-all">
                <h3 className="font-bold text-slate-900 group-hover:text-brand transition-colors">
                  Batches Management &rarr;
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage cohorts, timelines, and aggregate cohort comparisons.
                </p>
              </Card>
            </Link>
            <Link to="/trainees" className="block group">
              <Card variant="white" className="h-full hover:border-brand/40 transition-all">
                <h3 className="font-bold text-slate-900 group-hover:text-brand transition-colors">
                  Trainees Directory &rarr;
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Filter by batch, search by name or email, view performance bands.
                </p>
              </Card>
            </Link>
            <Link to="/sessions/new" className="block group">
              <Card variant="white" className="h-full hover:border-brand/40 transition-all">
                <h3 className="font-bold text-slate-900 group-hover:text-brand transition-colors">
                  Record Sessions &rarr;
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add single score sessions or bulk-upload CSV result files.
                </p>
              </Card>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export function BatchesPlaceholder() {
  return (
    <div className="space-y-6">
      <Card variant="dark">
        <h1 className="text-2xl font-black">Cohort Batches</h1>
        <p className="text-xs text-purple-200 mt-1">
          Full management view for all 5 training cohorts with date ranges and summary stats.
        </p>
      </Card>
      <Card variant="white">
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-light text-brand mx-auto flex items-center justify-center font-bold text-lg mb-3">
            📁
          </div>
          <h2 className="text-base font-bold text-slate-800">Batches Management Screen</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            CRUD modals, weekly cohort comparisons, and CSV batch exports arrive in Stage 8.
          </p>
          <div className="mt-4">
            <Link to="/" className="text-xs font-semibold px-4 py-2 bg-brand text-white rounded-full hover:bg-brand-dark transition-colors">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function TraineesPlaceholder() {
  return (
    <div className="space-y-6">
      <Card variant="dark">
        <h1 className="text-2xl font-black">Trainees Directory</h1>
        <p className="text-xs text-purple-200 mt-1">
          Filterable trainee roster with performance bands and individual profiles.
        </p>
      </Card>
      <Card variant="white">
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-light text-brand mx-auto flex items-center justify-center font-bold text-lg mb-3">
            👥
          </div>
          <h2 className="text-base font-bold text-slate-800">Trainees Roster Screen</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Search by name/email, filter by cohort, and flag trainees needing attention in Stage 8.
          </p>
          <div className="mt-4">
            <Link to="/" className="text-xs font-semibold px-4 py-2 bg-brand text-white rounded-full hover:bg-brand-dark transition-colors">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function TraineeDetailPlaceholder() {
  const { id } = useParams();
  const { isTrainer } = useAuth();
  return (
    <div className="space-y-6">
      <Card variant="dark">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Trainee Profile #{id}</h1>
            <p className="text-xs text-purple-200 mt-1">
              Chronological session logs, error trends, and skill trajectory.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-white">
            {isTrainer ? "Trainer View" : "Self View"}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Sessions" value="28" subtext="Across 6 modules" />
        <StatCard title="Average Score" value="78.5%" subtext="Band: Excellent (>=75%)" />
        <StatCard title="Average Errors" value="2.1" subtext="-35% over last 4 weeks" />
      </div>

      <Card variant="white">
        <div className="text-center py-10 border border-dashed border-purple-200 rounded-2xl">
          <p className="text-sm font-bold text-slate-800">Individual Progression Analytics</p>
          <p className="text-xs text-slate-500 mt-1">
            Real-time WebSocket session stream & historical breakdown arrive in Stage 8.
          </p>
        </div>
      </Card>
    </div>
  );
}

export function AddSessionPlaceholder() {
  return (
    <div className="space-y-6">
      <Card variant="dark">
        <h1 className="text-2xl font-black">Record Training Session</h1>
        <p className="text-xs text-purple-200 mt-1">
          Input individual session performance metrics or upload batch CSV results.
        </p>
      </Card>
      <Card variant="white">
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-light text-brand mx-auto flex items-center justify-center font-bold text-lg mb-3">
            📝
          </div>
          <h2 className="text-base font-bold text-slate-800">Session Entry & CSV Ingestion</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Single session entry form with real-time module max-score validation and bulk CSV dropzone arrive in Stage 8.
          </p>
          <div className="mt-4">
            <Link to="/" className="text-xs font-semibold px-4 py-2 bg-brand text-white rounded-full hover:bg-brand-dark transition-colors">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function UnauthorizedPage({ message }) {
  return (
    <div className="max-w-md mx-auto my-12">
      <Card variant="white" className="text-center p-8 space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center font-bold text-lg">
          🔒
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access Restricted</h1>
        <p className="text-xs text-slate-600">
          {message || "This section requires trainer or administrator privileges. Trainees are only permitted to view their own verified performance profile."}
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-brand text-white font-bold text-xs rounded-full hover:bg-brand-dark transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
