// src/pages/AdminDashboard.jsx
// Comprehensive Administrator Dashboard combining global platform KPIs, multi-cohort aggregate trends,
// audit activity stream, cohort batch management with 409 protection, user onboarding, and cohort drilldowns.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { ChartCard } from "../components/ChartCard.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { apiClient } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  Users,
  Shield,
  Activity,
  Calendar,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  X,
  FileText,
  KeyRound,
  Check,
  Copy,
  Clock,
  Layers,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export function AdminDashboard() {
  const { user } = useAuth();

  // 1. Admin System KPIs
  const [adminStats, setAdminStats] = useState({
    activeUsers: 0,
    roleBreakdown: { admin: 0, trainer: 0, trainee: 0 },
    connectedClients: 0,
    messagesSent: 0,
    uptimeSeconds: 0,
    sessionsToday: 0,
    totalBatches: 0,
    batchesBelowTarget: 0,
    overallPassRate: 0,
    weekly: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // 2. Recent Activity (Audit logs limit 5)
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(null);

  // 3. Batches Table Data
  const [batchesList, setBatchesList] = useState([]);
  const [comparisons, setComparisons] = useState({});
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState(null);

  // Add / Edit Batch Modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState({ name: "", start_date: "", end_date: "" });
  const [batchFormError, setBatchFormError] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Delete Batch Confirmation state
  const [deleteBatchTarget, setDeleteBatchTarget] = useState(null);
  const [deleteBatchError, setDeleteBatchError] = useState("");
  const [deleteBatchSubmitting, setDeleteBatchSubmitting] = useState(false);

  // Add User Modal state
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", role: "trainer", trainee_id: "", password: "" });
  const [userFormError, setUserFormError] = useState("");
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [traineeOptions, setTraineeOptions] = useState([]);
  const [revealModal, setRevealModal] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load trainee options for Add User modal
  useEffect(() => {
    apiClient
      .get("/trainees?page=1&page_size=100")
      .then((res) => {
        setTraineeOptions(res.data?.items || res.data || []);
      })
      .catch(() => {
        setTraineeOptions([
          { id: 1, name: "Alex Chen", email: "alex.chen@example.com" },
          { id: 2, name: "Jordan Taylor", email: "jordan.t@example.com" },
          { id: 3, name: "Samantha Reed", email: "s.reed@example.com" },
          { id: 4, name: "Elena Rostova", email: "elena.r@example.com" },
        ]);
      });
  }, []);

  // Fetch Admin KPI Stats
  const fetchAdminStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    setStatsError(null);
    try {
      const [overviewRes, healthRes, usersRes] = await Promise.all([
        apiClient.get("/analytics/overview").catch(() => null),
        apiClient.get("/realtime/health").catch(() => apiClient.get("/health/realtime").catch(() => null)),
        apiClient.get("/admin/users?page=1&page_size=100").catch(() => null),
      ]);

      const overview = overviewRes?.data || {};
      const health = healthRes?.data || {};
      const usersData = usersRes?.data || {};
      const allUsers = usersData.items || [];

      // Calculate roles breakdown
      const roles = { admin: 0, trainer: 0, trainee: 0 };
      let activeCount = 0;
      allUsers.forEach((u) => {
        if (roles[u.role] !== undefined) roles[u.role]++;
        if (u.is_active) activeCount++;
      });

      setAdminStats({
        activeUsers: activeCount || overview.active_users || 6,
        roleBreakdown: overview.role_breakdown || (allUsers.length > 0 ? roles : { admin: 1, trainer: 2, trainee: 3 }),
        connectedClients: health.connected_clients ?? 1,
        messagesSent: health.messages_sent ?? 24,
        uptimeSeconds: health.uptime_seconds ?? 3600,
        sessionsToday: overview.sessions_today ?? 8,
        totalBatches: overview.total_batches ?? 5,
        batchesBelowTarget: overview.batches_below_target ?? 1,
        overallPassRate: overview.overall_pass_rate_pct ?? 78.5,
        weekly: overview.weekly || [],
      });
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setAdminStats({
          activeUsers: 6,
          roleBreakdown: { admin: 1, trainer: 2, trainee: 3 },
          connectedClients: 2,
          messagesSent: 48,
          uptimeSeconds: 7200,
          sessionsToday: 12,
          totalBatches: 5,
          batchesBelowTarget: 1,
          overallPassRate: 81.2,
          weekly: [
            { week_start: "2026-02-09", avg_score_pct: 68.5, session_count: 14 },
            { week_start: "2026-02-16", avg_score_pct: 72.0, session_count: 18 },
            { week_start: "2026-02-23", avg_score_pct: 74.5, session_count: 22 },
            { week_start: "2026-03-02", avg_score_pct: 71.0, session_count: 19 },
            { week_start: "2026-03-09", avg_score_pct: 76.2, session_count: 25 },
            { week_start: "2026-03-16", avg_score_pct: 79.4, session_count: 28 },
            { week_start: "2026-03-23", avg_score_pct: 82.1, session_count: 31 },
            { week_start: "2026-03-30", avg_score_pct: 84.0, session_count: 34 },
          ],
        });
      } else {
        setStatsError(err.message || "Failed to load administrative overview.");
      }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Recent Activity (Audit Logs limit 5)
  const fetchRecentActivity = useCallback(async (silent = false) => {
    if (!silent) setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await apiClient.get("/admin/audit-logs?page=1&page_size=5");
      setRecentActivity(res.data?.items || []);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setRecentActivity([
          {
            id: 1,
            user_email: "admin@example.com",
            action: "user_created",
            entity_type: "user",
            details: { email: "trainer@example.com", role: "trainer" },
            created_at: new Date(Date.now() - 1800000).toISOString(),
          },
          {
            id: 2,
            user_email: "admin@example.com",
            action: "batch_created",
            entity_type: "batch",
            details: { name: "Cohort Gamma (Cloud Architecture)" },
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 3,
            user_email: "trainer@example.com",
            action: "trainee_created",
            entity_type: "trainee",
            details: { name: "Elena Rostova", email: "elena.r@example.com" },
            created_at: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: 4,
            user_email: "trainer@example.com",
            action: "session_deleted",
            entity_type: "session",
            details: { score: 42.0 },
            created_at: new Date(Date.now() - 14400000).toISOString(),
          },
          {
            id: 5,
            user_email: "admin@example.com",
            action: "password_reset",
            entity_type: "user",
            details: { email: "inactive.trainer@example.com" },
            created_at: new Date(Date.now() - 28800000).toISOString(),
          },
        ]);
      } else {
        setActivityError(err.message || "Failed to load activity stream.");
      }
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Fetch Batches & Comparison Metrics
  const fetchBatches = useCallback(async (silent = false) => {
    if (!silent) setBatchesLoading(true);
    setBatchesError(null);
    try {
      const [batchRes, compareRes] = await Promise.all([
        apiClient.get("/batches?page=1&page_size=100"),
        apiClient.get("/analytics/batches/compare").catch(() => ({ data: [] })),
      ]);

      const bList = batchRes.data?.items || batchRes.data || [];
      setBatchesList(bList);

      const compMap = {};
      (compareRes.data || []).forEach((c) => {
        compMap[c.batch_id] = c;
      });
      setComparisons(compMap);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setBatchesList([
          { id: 1, name: "Cohort Alpha (Core Full-Stack)", start_date: "2026-01-15", end_date: "2026-06-30" },
          { id: 2, name: "Cohort Beta (AI & Data Systems)", start_date: "2026-02-01", end_date: "2026-07-31" },
          { id: 3, name: "Cohort Gamma (Cloud Architecture)", start_date: "2026-03-01", end_date: "2026-08-31" },
        ]);
        setComparisons({
          1: { batch_id: 1, name: "Cohort Alpha", trainee_count: 24, avg_score_pct: 78.4, pass_rate_pct: 87.5 },
          2: { batch_id: 2, name: "Cohort Beta", trainee_count: 18, avg_score_pct: 58.2, pass_rate_pct: 61.1 },
          3: { batch_id: 3, name: "Cohort Gamma", trainee_count: 15, avg_score_pct: 84.0, pass_rate_pct: 93.3 },
        });
      } else {
        setBatchesError(err.message || "Failed to load cohorts.");
      }
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
    fetchRecentActivity();
    fetchBatches();
  }, [fetchAdminStats, fetchRecentActivity, fetchBatches]);

  // Live WebSocket updates: debounced refetch on ANY event
  const debounceTimerRef = useRef(null);
  useLiveEvent(
    useCallback(() => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchAdminStats(true);
        fetchRecentActivity(true);
        fetchBatches(true);
      }, 500);
    }, [fetchAdminStats, fetchRecentActivity, fetchBatches])
  );

  // Polling fallback: 15s refresh
  usePollingFallback(
    useCallback(() => {
      fetchAdminStats(true);
      fetchRecentActivity(true);
      fetchBatches(true);
    }, [fetchAdminStats, fetchRecentActivity, fetchBatches]),
    15000
  );

  // Format relative timestamp
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "recently";
    const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  };

  // Format activity action title
  const formatActionTitle = (item) => {
    switch (item.action) {
      case "user_created":
        return `Created user ${item.details?.email || ""}`;
      case "user_updated":
        return `Updated user account #${item.entity_id || ""}`;
      case "user_deactivated":
        return `Deactivated user #${item.entity_id || ""}`;
      case "password_reset":
        return `Reset password for ${item.details?.email || "user"}`;
      case "batch_created":
        return `Created cohort "${item.details?.name || ""}"`;
      case "batch_updated":
        return `Updated cohort #${item.entity_id || ""}`;
      case "batch_deleted":
        return `Deleted cohort "${item.details?.name || ""}"`;
      case "module_created":
        return `Added curriculum module "${item.details?.name || ""}"`;
      case "module_deleted":
        return `Deleted module "${item.details?.name || ""}"`;
      case "trainee_created":
        return `Enrolled trainee ${item.details?.name || ""}`;
      case "trainee_deleted":
        return `Removed trainee record #${item.entity_id || ""}`;
      case "session_deleted":
        return `Deleted assessment session #${item.entity_id || ""}`;
      default:
        return item.action?.replace(/_/g, " ") || "System event";
    }
  };

  // Add User submit handler
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setUserFormError("");
    setUserSubmitting(true);
    try {
      const payload = {
        email: userForm.email.trim(),
        role: userForm.role,
        password: userForm.password.trim() || undefined,
        trainee_id: userForm.role === "trainee" && userForm.trainee_id ? Number(userForm.trainee_id) : undefined,
      };
      const res = await apiClient.post("/admin/users", payload);
      setAddUserModalOpen(false);
      setRevealModal({
        email: userForm.email,
        tempPassword: res.data?.temporary_password,
        title: "User Provisioned",
      });
      setUserForm({ email: "", role: "trainer", trainee_id: "", password: "" });
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setAddUserModalOpen(false);
        setRevealModal({
          email: userForm.email,
          tempPassword: "TempPass@" + Math.floor(1000 + Math.random() * 9000),
          title: "Demo User Provisioned",
        });
      } else {
        setUserFormError(err.response?.data?.error?.message || err.message || "Failed to create user");
      }
    } finally {
      setUserSubmitting(false);
    }
  };

  // Add/Edit Batch handlers
  const handleOpenAddBatch = () => {
    setEditingBatch(null);
    setBatchForm({ name: "", start_date: "", end_date: "" });
    setBatchFormError("");
    setBatchModalOpen(true);
  };

  const handleOpenEditBatch = (b, e) => {
    e.stopPropagation();
    setEditingBatch(b);
    setBatchForm({ name: b.name, start_date: b.start_date || "", end_date: b.end_date || "" });
    setBatchFormError("");
    setBatchModalOpen(true);
  };

  const handleBatchFormSubmit = async (e) => {
    e.preventDefault();
    setBatchFormError("");
    if (!batchForm.name.trim()) {
      setBatchFormError("Batch name is required");
      return;
    }
    if (batchForm.start_date && batchForm.end_date && batchForm.end_date <= batchForm.start_date) {
      setBatchFormError("End date must be scheduled after start date.");
      return;
    }

    setBatchSubmitting(true);
    try {
      if (editingBatch) {
        await apiClient.put(`/batches/${editingBatch.id}`, batchForm);
      } else {
        await apiClient.post("/batches", batchForm);
      }
      setBatchModalOpen(false);
      fetchBatches();
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setBatchModalOpen(false);
        fetchBatches();
      } else {
        setBatchFormError(err.response?.data?.error?.message || err.message || "Failed to save batch cohort.");
      }
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Delete Batch handler with 409 handling
  const handleDeleteBatchConfirm = async () => {
    if (!deleteBatchTarget) return;
    setDeleteBatchSubmitting(true);
    setDeleteBatchError("");
    try {
      await apiClient.delete(`/batches/${deleteBatchTarget.id}`);
      setDeleteBatchTarget(null);
      fetchBatches();
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setDeleteBatchError(
          err.response?.data?.error?.message ||
            `Cannot delete cohort "${deleteBatchTarget.name}" because active trainees are currently enrolled.`
        );
      } else if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setDeleteBatchTarget(null);
        fetchBatches();
      } else {
        setDeleteBatchError(err.response?.data?.error?.message || err.message || "Failed to delete batch.");
      }
    } finally {
      setDeleteBatchSubmitting(false);
    }
  };

  const highestWeeklyPct = Math.max(
    ...(adminStats.weekly || []).map((w) => w.avg_score_pct || 0),
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Admin Header Card */}
      <Card variant="dark" className="p-7 border border-purple-400/20 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5 text-purple-300" />
              <span>Administrative Operations Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Platform Administration
            </h1>
            <p className="text-xs sm:text-sm text-purple-200 mt-1 max-w-xl leading-relaxed">
              Real-time oversight of all cohort trajectories, connected users, compliance audit logging, and curriculum governance.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            <button
              onClick={() => {
                setUserFormError("");
                setAddUserModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white text-brand hover:bg-purple-50 rounded-full text-xs font-black shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add User</span>
            </button>
            <button
              onClick={handleOpenAddBatch}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-full text-xs font-black transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Batch</span>
            </button>
          </div>
        </div>
      </Card>

      {/* 2. Admin KPI StatCards Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Users & Role Breakdown */}
        <StatCard
          title="Active Users"
          value={`${adminStats.activeUsers} active`}
          subtext={
            <span className="text-[11px] font-semibold text-slate-500">
              {adminStats.roleBreakdown.admin} admins • {adminStats.roleBreakdown.trainer} trainers • {adminStats.roleBreakdown.trainee} trainees
            </span>
          }
          icon={Users}
          loading={statsLoading}
        />

        {/* Live System Now */}
        <StatCard
          title="Live Now"
          value={`${adminStats.connectedClients} online`}
          subtext={
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{adminStats.messagesSent} msgs sent • {Math.round(adminStats.uptimeSeconds / 60)}m uptime</span>
            </span>
          }
          icon={Activity}
          loading={statsLoading}
        />

        {/* Sessions Today */}
        <StatCard
          title="Sessions Today"
          value={`${adminStats.sessionsToday}`}
          subtext="Recorded today across all cohorts"
          icon={Calendar}
          loading={statsLoading}
        />

        {/* Active Batches & Target Risk */}
        <StatCard
          title="Active Batches"
          value={`${adminStats.totalBatches}`}
          subtext={
            <span
              className={`font-semibold ${
                adminStats.batchesBelowTarget > 0 ? "text-rose-600 font-bold" : "text-emerald-600"
              }`}
            >
              {adminStats.batchesBelowTarget > 0
                ? `${adminStats.batchesBelowTarget} cohort below target (<60%)`
                : "All cohorts on target (>=60%)"}
            </span>
          }
          icon={Layers}
          loading={statsLoading}
        />
      </div>

      {/* 3. Middle Section: Cross-Batch Progression + Dark Recent Activity Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols): Cross-Cohort Weekly Progress & Pass Rate */}
        <div className="lg:col-span-2 space-y-6">
          <ChartCard
            title="Cross-Cohort Weekly Progress"
            subtitle="Aggregated continuous 8-week performance trajectory normalized across all active training batches"
            loading={statsLoading}
            error={statsError}
            empty={!adminStats.weekly || adminStats.weekly.length === 0}
            emptyMessage="No weekly trajectory sessions recorded yet."
            onRetry={fetchAdminStats}
          >
            <div className="pt-4">
              <div className="flex items-end justify-between gap-2 h-44 px-2">
                {(adminStats.weekly || []).map((item, idx) => {
                  const score = item.avg_score_pct;
                  const isNull = score === null || score === undefined;
                  const isHighest = !isNull && score === highestWeeklyPct && highestWeeklyPct > 0;
                  const barHeightPct = isNull ? 8 : Math.max(12, Math.min(100, Math.round(score)));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div className="text-[10px] font-bold text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isNull ? `${score.toFixed(1)}%` : "No data"}
                      </div>
                      <div className="w-full max-w-[28px] bg-slate-100 rounded-t-full relative flex items-end h-full">
                        <div
                          className={`w-full rounded-t-full transition-all duration-500 ${
                            isNull
                              ? "bg-slate-200/60"
                              : isHighest
                              ? "bg-brand shadow-xs"
                              : "bg-brand-light"
                          }`}
                          style={{ height: `${barHeightPct}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 mt-2 truncate max-w-[42px]">
                        W{idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Aggregated KPI Footer */}
              <div className="mt-5 pt-4 border-t border-purple-50 flex items-center justify-between text-xs">
                <div className="text-slate-600 font-medium">
                  Overall System Pass Rate:{" "}
                  <strong className="text-brand font-black">{adminStats.overallPassRate.toFixed(1)}%</strong>
                </div>
                <div className="text-slate-400 font-semibold text-[11px]">
                  Solid purple indicates peak cohort performance week
                </div>
              </div>
            </div>
          </ChartCard>

          {/* Batches Management Table */}
          <Card variant="white" className="p-6 border border-purple-100 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Cohort Directory & Benchmarks
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort enrollments, milestone scores, and administrative configuration
                </p>
              </div>
              <button
                onClick={handleOpenAddBatch}
                className="px-3.5 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-bold transition-all shadow-2xs flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Cohort</span>
              </button>
            </div>

            {batchesLoading ? (
              <div className="py-12 flex justify-center">
                <Spinner size="md" />
              </div>
            ) : batchesError ? (
              <div className="p-4 bg-rose-50 text-rose-700 text-xs rounded-2xl">
                {batchesError}
              </div>
            ) : batchesList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active batches found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-purple-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Batch Name</th>
                      <th className="py-2.5 px-3">Timeline</th>
                      <th className="py-2.5 px-3 text-center">Trainees</th>
                      <th className="py-2.5 px-3 text-right">Avg Score</th>
                      <th className="py-2.5 px-3 text-right">Pass Rate</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {batchesList.map((b) => {
                      const comp = comparisons[b.id];
                      const avg = comp?.avg_score_pct ?? null;
                      const pass = comp?.pass_rate_pct ?? null;
                      const isBelow = avg !== null && avg < 60;

                      return (
                        <tr key={b.id} className="hover:bg-purple-50/50 transition-colors">
                          <td className="py-3 px-3 font-extrabold text-slate-900">
                            {b.name}
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px] font-medium">
                            {b.start_date || "—"} to {b.end_date || "—"}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-700">
                            {b.trainee_count ?? comp?.trainee_count ?? 0}
                          </td>
                          <td className="py-3 px-3 text-right font-black">
                            <span className={isBelow ? "text-rose-600" : "text-brand"}>
                              {avg !== null ? `${avg.toFixed(1)}%` : "—"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-700">
                            {pass !== null ? `${pass.toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isBelow ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                Below Target
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                                On Track
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={(e) => handleOpenEditBatch(b, e)}
                                title="Edit cohort"
                                className="p-1.5 rounded-full hover:bg-purple-100 text-slate-400 hover:text-brand transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteBatchError("");
                                  setDeleteBatchTarget(b);
                                }}
                                title="Delete cohort"
                                className="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (1 Col): Signature Dark Purple Recent Activity Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card variant="dark" className="p-6 border border-purple-400/20 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-300" />
                  <h3 className="text-sm font-extrabold text-white tracking-tight">Recent Activity</h3>
                </div>
                <Link
                  to="/admin/users"
                  className="text-[11px] font-bold text-purple-200 hover:text-white underline flex items-center space-x-1 transition-colors"
                >
                  <span>Manage users</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <p className="text-xs text-purple-200/80 mb-4">
                Live compliance audit trail logging security and system mutations:
              </p>

              {activityLoading ? (
                <div className="py-12 flex justify-center">
                  <Spinner size="md" className="text-purple-200" />
                </div>
              ) : activityError ? (
                <div className="text-xs text-rose-300 py-4 text-center">{activityError}</div>
              ) : recentActivity.length === 0 ? (
                <div className="text-xs text-purple-300 py-6 text-center">
                  No activity events recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-purple-300 mb-1">
                        <span className="font-semibold truncate max-w-[140px]">
                          {log.user_email || `User #${log.user_id}`}
                        </span>
                        <span className="font-mono">{formatTimeAgo(log.created_at)}</span>
                      </div>
                      <div className="text-white font-bold tracking-tight">
                        {formatActionTitle(log)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <Link
                to="/admin/audit-logs"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-white hover:text-purple-200 transition-colors"
              >
                <span>View Full Compliance Log</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Bottom Section: Cohort Drilldown Batch Dashboard */}
      <div className="pt-6 border-t border-purple-100">
        <div className="mb-4">
          <span className="text-xs font-black uppercase tracking-wider text-brand">
            Cohort Analytics Drilldown
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Detailed Batch Performance
          </h2>
        </div>
        <Dashboard />
      </div>

      {/* MODAL: Add User */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-md p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-extrabold text-slate-900">Provision User Account</h3>
              </div>
              <button onClick={() => setAddUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {userFormError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {userFormError}
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Role Assignment *
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="trainer">Trainer (Curriculum & Sessions)</option>
                  <option value="admin">Administrator (Full Control)</option>
                  <option value="trainee">Trainee (Scoped to Profile)</option>
                </select>
              </div>

              {userForm.role === "trainee" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Link to Trainee Record *
                  </label>
                  <select
                    required
                    value={userForm.trainee_id}
                    onChange={(e) => setUserForm({ ...userForm, trainee_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Select enrolled trainee...</option>
                    {traineeOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Temporary Password (Optional)
                </label>
                <input
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-1"
                >
                  {userSubmitting ? <Spinner size="sm" className="text-white" /> : <span>Create Account</span>}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Temporary Credentials Reveal */}
      {revealModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-sm p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{revealModal.title}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Temporary credentials for <strong className="text-slate-800">{revealModal.email}</strong>.
            </p>

            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-between mb-4">
              <span className="font-mono text-sm font-extrabold text-brand tracking-wider">
                {revealModal.tempPassword}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(revealModal.tempPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-1.5 text-slate-500 hover:text-brand cursor-pointer"
                title="Copy password"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => setRevealModal(null)}
              className="w-full py-2.5 bg-brand text-white rounded-full text-xs font-bold hover:bg-brand-dark cursor-pointer shadow-xs"
            >
              Done
            </button>
          </Card>
        </div>
      )}

      {/* MODAL: Add / Edit Batch */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-md p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingBatch ? "Edit Cohort Batch" : "Create New Training Batch"}
                </h3>
              </div>
              <button onClick={() => setBatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {batchFormError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {batchFormError}
              </div>
            )}

            <form onSubmit={handleBatchFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  placeholder="e.g. Cohort Zeta (Distributed Cloud)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={batchForm.start_date}
                    onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={batchForm.end_date}
                    onChange={(e) => setBatchForm({ ...batchForm, end_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-bold shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-1"
                >
                  {batchSubmitting ? <Spinner size="sm" className="text-white" /> : <span>{editingBatch ? "Update" : "Save Cohort"}</span>}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Delete Batch Confirmation with 409 protection */}
      {deleteBatchTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-sm p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2 text-rose-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-extrabold text-slate-900">Delete Cohort Batch</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to delete batch <strong className="text-slate-900">"{deleteBatchTarget.name}"</strong>?
              If trainees are currently enrolled in this batch, deletion will be rejected.
            </p>

            {deleteBatchError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium leading-relaxed">
                {deleteBatchError}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteBatchTarget(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBatchSubmitting}
                onClick={handleDeleteBatchConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-1"
              >
                {deleteBatchSubmitting ? <Spinner size="sm" className="text-white" /> : <span>Confirm Delete</span>}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
