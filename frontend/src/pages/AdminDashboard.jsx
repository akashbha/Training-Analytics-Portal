// src/pages/AdminDashboard.jsx
// Administrator Governance Console: Platform-wide telemetry, multi-cohort analytics,
// compliance audit trail, user onboarding/RBAC, and cohort batch governance.

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { apiClient } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  Shield,
  RotateCw,
  Plus,
  Pencil,
  Trash2,
  X,
  KeyRound,
  Check,
  Copy,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  UserX,
  UserPlus,
  BookOpen,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  Server,
  Cpu,
  Radio,
  Users,
  Search,
  Filter,
} from "lucide-react";
import { EXCELLENT_THRESHOLD, PASS_THRESHOLD } from "../constants/thresholds.js";

function formatRoleCount(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDateShort(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatTimeShort(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16) + " UTC";
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [progressionView, setProgressionView] = useState("columns"); // "columns" | "curve"
  const [governanceTab, setGovernanceTab] = useState("cohorts"); // "cohorts" | "users"

  // 1. Admin System KPIs
  const [adminStats, setAdminStats] = useState({
    activeUsers: 0,
    inactiveUsers: 0,
    roleBreakdown: { admin: 0, trainer: 0, trainee: 0 },
    totalTrainees: 0,
    totalSessions: 0,
    connectedClients: 0,
    messagesSent: 0,
    uptimeSeconds: 0,
    sessionsToday: 0,
    totalBatches: 0,
    batchesBelowTarget: 0,
    overallPassRate: null,
    weekly: [],
    overviewAvailable: false,
    realtimeAvailable: false,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Live Dependency Health Probe State
  const [serviceHealth, setServiceHealth] = useState({
    status: "unchecked", // "unchecked" | "loaded" | "error"
    data: null,
    error: null,
    loading: false,
  });

  // 2. Recent Activity (Audit logs limit 5)
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(null);

  // 3. Batches Table Data & Real Trainer Assignments
  const [batchesList, setBatchesList] = useState([]);
  const [comparisons, setComparisons] = useState({});
  const [batchTrainersMap, setBatchTrainersMap] = useState({});
  const [batchTrainersErrorMap, setBatchTrainersErrorMap] = useState({});
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState(null);

  // 4. RBAC Users Table Data
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userActionLoadingId, setUserActionLoadingId] = useState(null);

  // 5. Model Evaluation vs Baseline Benchmark Data
  const [evaluationData, setEvaluationData] = useState(null);
  const [evaluationLoading, setEvaluationLoading] = useState(true);
  const [evaluationError, setEvaluationError] = useState(null);

  // Step 9b State Simulation Parameters (Dev only)
  const [searchParams, setSearchParams] = useSearchParams();
  const demoState = import.meta.env.DEV ? searchParams.get("state") : null;

  const isDemoLoading = demoState === "loading";
  const isDemoEmpty = demoState === "empty";
  const isDemoError = demoState === "error";

  const effectiveStatsLoading = isDemoLoading || statsLoading;
  const effectiveStatsError = isDemoError ? "Unable to retrieve platform governance telemetry." : statsError;

  const effectiveWeeklyLoading = isDemoLoading || statsLoading;
  const effectiveWeeklyError = isDemoError ? "Unable to load milestone progression trajectory." : statsError;
  const effectiveWeekly = isDemoEmpty ? [] : adminStats.weekly;

  const effectiveBatchesLoading = isDemoLoading || batchesLoading;
  const effectiveBatchesError = isDemoError ? "Unable to load cohort directory." : batchesError;
  const effectiveBatchesList = isDemoEmpty ? [] : batchesList;

  const effectiveUsersLoading = isDemoLoading || usersLoading;
  const effectiveUsersError = isDemoError ? "Unable to load user accounts." : usersError;
  const effectiveUsersList = isDemoEmpty ? [] : usersList;

  const effectiveActivityLoading = isDemoLoading || activityLoading;
  const effectiveActivityError = isDemoError ? "Unable to load security audit stream." : activityError;
  const effectiveRecentActivity = isDemoEmpty ? [] : recentActivity;

  const effectiveEvaluationLoading = isDemoLoading || (evaluationLoading && !evaluationData);
  const effectiveEvaluationError = isDemoError ? "Unable to load model evaluation benchmark." : evaluationError;
  const effectiveEvaluationData = isDemoEmpty ? null : evaluationData;

  const activeUsersDisplay = effectiveStatsLoading ? "..." : isDemoEmpty || isDemoError ? 0 : adminStats.activeUsers;
  const connectedClientsDisplay = effectiveStatsLoading ? "..." : isDemoEmpty || isDemoError ? 0 : adminStats.connectedClients;
  const sessionsTodayDisplay = effectiveStatsLoading ? "..." : isDemoEmpty || isDemoError ? 0 : adminStats.sessionsToday;
  const overallPassRateDisplay = effectiveStatsLoading
    ? "..."
    : isDemoEmpty || isDemoError || adminStats.overallPassRate === null
    ? "-"
    : `${Number(adminStats.overallPassRate).toFixed(1)}%`;

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

  // Manage Trainers Modal state
  const [manageTrainersBatch, setManageTrainersBatch] = useState(null);
  const [assignedTrainers, setAssignedTrainers] = useState([]);
  const [assignedTrainersLoading, setAssignedTrainersLoading] = useState(false);
  const [assignedTrainersError, setAssignedTrainersError] = useState("");
  const [eligibleTrainers, setEligibleTrainers] = useState([]);
  const [inactiveTrainers, setInactiveTrainers] = useState([]);
  const [eligibleTrainersLoading, setEligibleTrainersLoading] = useState(false);
  const [eligibleTrainersError, setEligibleTrainersError] = useState("");
  const [trainerSearchQuery, setTrainerSearchQuery] = useState("");
  const [trainerMutationLoadingId, setTrainerMutationLoadingId] = useState(null);
  const [trainerMutationError, setTrainerMutationError] = useState("");
  const [removeConfirmTrainer, setRemoveConfirmTrainer] = useState(null);

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
        setTraineeOptions([]);
      });
  }, []);

  // Fetch live Service Health probe
  const fetchServiceHealth = useCallback(async (silent = false) => {
    if (!silent) {
      setServiceHealth((prev) => ({ ...prev, loading: true, error: null }));
    }
    try {
      const res = await apiClient.get("/admin/service-health");
      setServiceHealth({
        status: "loaded",
        data: res.data,
        error: null,
        loading: false,
      });
    } catch (err) {
      setServiceHealth((prev) => ({
        status: "error",
        data: silent ? prev.data : null,
        error: err.response?.data?.error?.message || err.message || "Health probe failed",
        loading: false,
      }));
    }
  }, []);

  // Fetch Admin KPI Stats
  const fetchAdminStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    setStatsError(null);
    try {
      const [overviewRes, healthRes] = await Promise.all([
        apiClient.get("/analytics/overview"),
        apiClient.get("/realtime/health").catch(() => apiClient.get("/health/realtime").catch(() => null)),
      ]);

      const overview = overviewRes?.data || {};
      const health = healthRes?.data || null;

      setAdminStats({
        activeUsers: overview.active_users ?? 0,
        inactiveUsers: overview.inactive_users ?? 0,
        roleBreakdown: overview.role_breakdown || { admin: 0, trainer: 0, trainee: 0 },
        totalTrainees: overview.total_trainees ?? 0,
        totalSessions: overview.total_sessions ?? 0,
        connectedClients: health ? (health.connected_clients ?? 0) : 0,
        messagesSent: health ? (health.messages_sent ?? 0) : 0,
        uptimeSeconds: health ? (health.uptime_seconds ?? 0) : 0,
        sessionsToday: overview.sessions_today ?? 0,
        totalBatches: overview.total_batches ?? 0,
        batchesBelowTarget: overview.batches_below_target ?? 0,
        overallPassRate:
          "mean_cohort_pass_rate_pct" in overview
            ? overview.mean_cohort_pass_rate_pct
            : overview.overall_pass_rate_pct ?? null,
        weekly: overview.weekly || [],
        overviewAvailable: Boolean(overviewRes?.data),
        realtimeAvailable: Boolean(health),
      });
    } catch (err) {
      setStatsError(err.response?.data?.error?.message || err.message || "Failed to load administrative overview.");
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
      setActivityError(err.response?.data?.error?.message || err.message || "Failed to load activity stream.");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Fetch assigned trainers for all loaded cohorts
  const fetchBatchTrainersForList = useCallback(async (batches) => {
    if (!batches || batches.length === 0) {
      setBatchTrainersMap({});
      setBatchTrainersErrorMap({});
      return;
    }
    const results = await Promise.allSettled(
      batches.map((b) => apiClient.get(`/batches/${b.id}/trainers`))
    );
    const nextMap = {};
    const nextErrMap = {};
    results.forEach((result, idx) => {
      const batchId = batches[idx].id;
      if (result.status === "fulfilled") {
        nextMap[batchId] = result.value.data || [];
      } else {
        nextErrMap[batchId] = true;
      }
    });
    setBatchTrainersMap(nextMap);
    setBatchTrainersErrorMap(nextErrMap);
  }, []);

  // Fetch Batches, Comparison Metrics & Assigned Trainers
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

      await fetchBatchTrainersForList(bList);
    } catch (err) {
      setBatchesError(err.response?.data?.error?.message || err.message || "Failed to load cohorts.");
    } finally {
      setBatchesLoading(false);
    }
  }, [fetchBatchTrainersForList]);

  // Fetch RBAC Users list
  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setUsersLoading(true);
    setUsersError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("page_size", "50");
      if (userSearch.trim()) params.append("search", userSearch.trim());
      if (userRoleFilter) params.append("role", userRoleFilter);
      const res = await apiClient.get(`/admin/users?${params.toString()}`);
      setUsersList(res.data?.items || []);
    } catch (err) {
      setUsersError(err.response?.data?.error?.message || err.message || "Failed to load user accounts.");
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, userRoleFilter]);

  // 1-Click Reset Password
  const handleResetPassword = async (targetUser) => {
    setUserActionLoadingId(targetUser.id);
    try {
      const res = await apiClient.post(`/admin/users/${targetUser.id}/reset-password`);
      setRevealModal({
        email: targetUser.email,
        tempPassword: res.data?.temporary_password,
        title: "Temporary Password Generated",
      });
      fetchRecentActivity(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || "Failed to reset password");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // 1-Click Toggle Active Status
  const handleToggleUserActive = async (targetUser) => {
    setUserActionLoadingId(targetUser.id);
    try {
      await apiClient.patch(`/admin/users/${targetUser.id}`, { is_active: !targetUser.is_active });
      fetchUsers(true);
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || "Failed to update user status");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Change Role
  const handleChangeUserRole = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;
    setUserActionLoadingId(targetUser.id);
    try {
      await apiClient.patch(`/admin/users/${targetUser.id}`, { role: newRole });
      fetchUsers(true);
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || "Failed to change user role");
    } finally {
      setUserActionLoadingId(null);
    }
  };

  // Fetch Model Evaluation vs Baseline Benchmark
  const fetchModelEvaluation = useCallback(async (isSilent = false) => {
    if (!isSilent) setEvaluationLoading(true);
    try {
      const res = await apiClient.get("/admin/model-evaluation");
      setEvaluationData(res.data);
      setEvaluationError(null);
    } catch (err) {
      if (!isSilent) {
        setEvaluationError(err.response?.data?.error?.message || err.message || "Failed to load model evaluation.");
      }
    } finally {
      if (!isSilent) setEvaluationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
    fetchServiceHealth();
    fetchRecentActivity();
    fetchBatches();
    fetchUsers();
    fetchModelEvaluation();
  }, [fetchAdminStats, fetchServiceHealth, fetchRecentActivity, fetchBatches, fetchUsers, fetchModelEvaluation]);

  // Live WebSocket debounced updates
  const debounceTimerRef = useRef(null);
  useLiveEvent(
    useCallback(() => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchAdminStats(true);
        fetchServiceHealth(true);
        fetchRecentActivity(true);
        fetchBatches(true);
        fetchUsers(true);
        fetchModelEvaluation(true);
      }, 500);
    }, [fetchAdminStats, fetchServiceHealth, fetchRecentActivity, fetchBatches, fetchUsers, fetchModelEvaluation])
  );

  // Polling fallback: 15s refresh
  usePollingFallback(
    useCallback(() => {
      fetchAdminStats(true);
      fetchServiceHealth(true);
      fetchRecentActivity(true);
      fetchBatches(true);
      fetchUsers(true);
    }, [fetchAdminStats, fetchServiceHealth, fetchRecentActivity, fetchBatches, fetchUsers]),
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
        return `Provisioned user ${item.details?.email || ""}`;
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
      case "assign_batch_trainer":
        return `Assigned trainer #${item.after?.trainer_id || item.details?.trainer_id || ""} to cohort #${item.after?.batch_id || item.details?.batch_id || ""}`;
      case "unassign_batch_trainer":
        return `Unassigned trainer #${item.before?.trainer_id || item.details?.trainer_id || ""} from cohort #${item.before?.batch_id || item.details?.batch_id || ""}`;
      case "module_created":
        return `Added curriculum module "${item.details?.name || ""}"`;
      case "module_deleted":
        return `Deleted module "${item.details?.name || ""}"`;
      case "trainee_created":
        return `Enrolled trainee ${item.details?.name || ""}`;
      case "trainee_deleted":
        return `Removed trainee record #${item.entity_id || ""}`;
      case "session_created":
        return `Recorded assessment for ${item.details?.module || "curriculum"}`;
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
        title: "User Account Provisioned",
      });
      setUserForm({ email: "", role: "trainer", trainee_id: "", password: "" });
      fetchUsers(true);
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      setUserFormError(err.response?.data?.error?.message || err.message || "Failed to create user");
    } finally {
      setUserSubmitting(false);
    }
  };

  // Manage Trainers Dialog Handlers
  const loadManageTrainersData = useCallback(async (batchId) => {
    setAssignedTrainersLoading(true);
    setAssignedTrainersError("");
    setEligibleTrainersLoading(true);
    setEligibleTrainersError("");

    const fetchAllTrainers = async () => {
      const byId = new Map();
      let currentPage = 1;
      let totalPages = 1;
      do {
        const res = await apiClient.get(
          `/admin/users?role=trainer&page=${currentPage}&page_size=100`
        );
        const data = res.data || {};
        for (const item of data.items || []) {
          byId.set(item.id, item);
        }
        totalPages = Math.max(1, Number(data.pages || 1));
        currentPage += 1;
      } while (currentPage <= totalPages);
      return Array.from(byId.values());
    };

    const [assignedResult, eligibleResult] = await Promise.allSettled([
      apiClient.get(`/batches/${batchId}/trainers`),
      fetchAllTrainers(),
    ]);

    if (assignedResult.status === "fulfilled") {
      const assignedList = assignedResult.value.data || [];
      setAssignedTrainers(assignedList);
      setBatchTrainersMap((prev) => ({ ...prev, [batchId]: assignedList }));
      setBatchTrainersErrorMap((prev) => {
        const copy = { ...prev };
        delete copy[batchId];
        return copy;
      });
    } else {
      setAssignedTrainersError(
        assignedResult.reason?.response?.data?.error?.message ||
          assignedResult.reason?.message ||
          "Failed to load assigned trainers."
      );
    }
    setAssignedTrainersLoading(false);

    if (eligibleResult.status === "fulfilled") {
      const trainers = eligibleResult.value || [];
      setEligibleTrainers(trainers.filter((u) => u.role === "trainer" && u.is_active));
      setInactiveTrainers(trainers.filter((u) => u.role === "trainer" && !u.is_active));
    } else {
      setInactiveTrainers([]);
      setEligibleTrainersError(
        eligibleResult.reason?.response?.data?.error?.message ||
          eligibleResult.reason?.message ||
          "Failed to load eligible trainers."
      );
    }
    setEligibleTrainersLoading(false);
  }, []);

  const handleOpenManageTrainers = (batch, e) => {
    if (e) e.stopPropagation();
    setManageTrainersBatch(batch);
    setTrainerSearchQuery("");
    setTrainerMutationError("");
    setRemoveConfirmTrainer(null);
    loadManageTrainersData(batch.id);
  };

  const handleAssignTrainerToBatch = async (trainerUser) => {
    if (!manageTrainersBatch || trainerMutationLoadingId !== null) return;
    if (assignedTrainers.some((t) => t.trainer_id === trainerUser.id)) {
      setTrainerMutationError("Trainer is already assigned to this batch.");
      return;
    }
    if (!trainerUser.is_active) {
      setTrainerMutationError("Inactive trainers cannot be assigned to batches.");
      return;
    }
    setTrainerMutationError("");
    setTrainerMutationLoadingId(trainerUser.id);
    try {
      await apiClient.post(`/batches/${manageTrainersBatch.id}/trainers`, {
        trainer_id: trainerUser.id,
      });
      await loadManageTrainersData(manageTrainersBatch.id);
      fetchBatches(true);
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      setTrainerMutationError(
        err.response?.data?.error?.message || err.message || "Failed to assign trainer."
      );
      await loadManageTrainersData(manageTrainersBatch.id);
      fetchBatches(true);
    } finally {
      setTrainerMutationLoadingId(null);
    }
  };

  const handleConfirmUnassignTrainer = async () => {
    if (!manageTrainersBatch || !removeConfirmTrainer || trainerMutationLoadingId !== null) return;
    setTrainerMutationError("");
    setTrainerMutationLoadingId(removeConfirmTrainer.trainer_id);
    try {
      await apiClient.delete(
        `/batches/${manageTrainersBatch.id}/trainers/${removeConfirmTrainer.trainer_id}`
      );
      setRemoveConfirmTrainer(null);
      await loadManageTrainersData(manageTrainersBatch.id);
      fetchBatches(true);
      fetchAdminStats(true);
      fetchRecentActivity(true);
    } catch (err) {
      setTrainerMutationError(
        err.response?.data?.error?.message || err.message || "Failed to remove trainer assignment."
      );
      setRemoveConfirmTrainer(null);
      await loadManageTrainersData(manageTrainersBatch.id);
      fetchBatches(true);
    } finally {
      setTrainerMutationLoadingId(null);
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
      setBatchFormError(err.response?.data?.error?.message || err.message || "Failed to save batch cohort.");
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Delete Batch handler with 409 cascade protection
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
    <div className="space-y-6 pb-12 font-sans bg-slate-50 selection:bg-blue-600 selection:text-white">
      {/* =========================================================================
          1. ADMIN HEADER & ACTION CONTROLS
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Administrator Console
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Platform governance, cross-cohort performance telemetry, compliance audit trails, and role management.
          </p>
        </div>

        {/* Action Controls: State Switcher (Dev only), Add User, Add Batch, Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Step 9b State Switcher Pills (Dev Environment Only) */}
          {import.meta.env.DEV && (
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600 border border-slate-200">
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
                    className={`px-2.5 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 font-semibold shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          )}

          {/* Refresh Data */}
          <button
            type="button"
            onClick={() => {
              fetchAdminStats(true);
              fetchServiceHealth(true);
              fetchRecentActivity(true);
              fetchBatches(true);
            }}
            title="Refresh system telemetry"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Add Cohort Batch */}
          <button
            type="button"
            onClick={handleOpenAddBatch}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Add Cohort</span>
          </button>

          {/* Provision User (Primary button) */}
          <button
            type="button"
            onClick={() => {
              setUserFormError("");
              setAddUserModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Provision User</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. PLATFORM TELEMETRY KPI STRIP (4 Honest Operational Cards)
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1: Active Accounts & Role Breakdown */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Active Accounts
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              RBAC Auth
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {effectiveStatsLoading
                ? "..."
                : effectiveStatsError
                ? "Unavailable"
                : `${activeUsersDisplay} Active`}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-normal truncate">
              {isDemoEmpty || isDemoError || effectiveStatsError
                ? "0 admin, 0 trainers, 0 trainees"
                : `${formatRoleCount(adminStats.roleBreakdown.admin, "admin", "admins")}, ${formatRoleCount(adminStats.roleBreakdown.trainer, "trainer", "trainers")}, ${formatRoleCount(adminStats.roleBreakdown.trainee, "trainee", "trainees")}`}
            </div>
            {!effectiveStatsError && adminStats.inactiveUsers > 0 && !isDemoEmpty && !isDemoError && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Inactive Accounts:</span>
                <span className="font-semibold text-slate-700 tabular-nums">{adminStats.inactiveUsers}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Live Realtime Stream */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Realtime Gateway
            </span>
            {effectiveStatsLoading ? (
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                Checking
              </span>
            ) : !adminStats.realtimeAvailable || isDemoError || effectiveStatsError ? (
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Unavailable
              </span>
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Socket</span>
              </span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {effectiveStatsLoading
                ? "..."
                : !adminStats.realtimeAvailable || effectiveStatsError
                ? "Unavailable"
                : `${connectedClientsDisplay} Connected`}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-normal">
              {!adminStats.realtimeAvailable || isDemoEmpty || isDemoError || effectiveStatsError
                ? "Realtime relay probe did not return metrics"
                : `${adminStats.messagesSent} events broadcast · ${Math.round(adminStats.uptimeSeconds / 60)}m uptime`}
            </div>
          </div>
        </div>

        {/* Metric 3: Assessments Recorded Today */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Assessments Recorded Today
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
              UTC Day
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {effectiveStatsLoading
                ? "..."
                : effectiveStatsError
                ? "Unavailable"
                : `${sessionsTodayDisplay} ${Number(sessionsTodayDisplay) === 1 ? "Session" : "Sessions"}`}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-normal">
              Recorded since 00:00 UTC today
            </div>
            {!effectiveStatsError && !isDemoEmpty && !isDemoError && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Total Assessments Logged:</span>
                <span className="font-semibold text-slate-700 tabular-nums">{adminStats.totalSessions}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 4: Total Cohorts & Pass Benchmark */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Total Cohorts
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              {effectiveStatsError ? "-" : isDemoEmpty || isDemoError ? 0 : adminStats.totalBatches} Cohorts
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {effectiveStatsError ? "Unavailable" : overallPassRateDisplay}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-normal">
              {overallPassRateDisplay === "-" ? "No assessed cohorts yet" : "Mean cohort pass rate"}
            </div>
            {!effectiveStatsError && !isDemoEmpty && !isDemoError && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <span>Cohorts with avg score &lt; {PASS_THRESHOLD}%:</span>
                <span className={`font-semibold tabular-nums ${adminStats.batchesBelowTarget > 0 ? "text-amber-700" : "text-slate-700"}`}>
                  {adminStats.batchesBelowTarget} {adminStats.batchesBelowTarget === 1 ? "cohort" : "cohorts"}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. MAIN GOVERNANCE GRID (8 Cols Left, 4 Cols Right)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* =========================================================================
            LEFT COLUMN (8 Cols): Cross-Cohort Progression + Cohort Directory
            ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">

          {/* Widget 1: Cross-Cohort Progression Visualizer */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Cross-Cohort Milestone Progression
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Normalized 8-week performance trajectory aggregated across all active training batches against the {EXCELLENT_THRESHOLD}% target.
                </p>
              </div>

              {/* View Switcher: Milestone Columns vs Velocity Curve */}
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setProgressionView("columns")}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    progressionView === "columns"
                      ? "bg-white text-slate-900 font-semibold shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Milestone Columns
                </button>
                <button
                  type="button"
                  onClick={() => setProgressionView("curve")}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    progressionView === "curve"
                      ? "bg-white text-slate-900 font-semibold shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Velocity Curve
                </button>
              </div>
            </div>

            {/* Quick Summary Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-3 pb-1 text-[11px]">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-medium tabular-nums">
                <span className="w-2 h-2 rounded-xs bg-blue-600"></span>
                <span>Current Week: <strong className="font-semibold text-slate-900">{effectiveWeekly?.slice(-1)[0]?.avg_score_pct !== undefined && effectiveWeekly?.slice(-1)[0]?.avg_score_pct !== null ? `${effectiveWeekly.slice(-1)[0].avg_score_pct.toFixed(1)}%` : "-"}</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-medium tabular-nums">
                <span className="w-2 h-2 rounded-xs bg-blue-500"></span>
                <span>Target: <strong className="font-semibold text-slate-900">{EXCELLENT_THRESHOLD}%</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-medium tabular-nums">
                <span className="w-2 h-2 rounded-xs bg-slate-500"></span>
                <span>Pass: <strong className="font-semibold text-slate-900">{PASS_THRESHOLD}%</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-medium tabular-nums">
                <span>Peak Milestone: <strong className="font-semibold text-slate-900">{highestWeeklyPct > 0 ? `${highestWeeklyPct.toFixed(1)}%` : "-"}</strong></span>
              </div>
            </div>

            {/* Step 9b Shared State Conditional Progression Rendering */}
            {effectiveWeeklyLoading ? (
              <LoadingState message="Loading platform milestone trajectory..." className="py-12" />
            ) : effectiveWeeklyError ? (
              <ErrorState
                title="Unable to Load Progression Trajectory"
                message={effectiveWeeklyError}
                onRetry={() => fetchAdminStats()}
                className="py-12"
              />
            ) : !effectiveWeekly || effectiveWeekly.length === 0 ? (
              <EmptyState
                title="No Milestone Progression Records"
                description="No platform-wide weekly evaluation data available."
                className="py-12"
              />
            ) : (
              <>
                {/* VIEW A: MILESTONE COLUMNS */}
                {progressionView === "columns" && (
                  <div className="w-full h-56 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(effectiveWeekly || []).map((w, i) => ({
                          ...w,
                          label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                        }))}
                        margin={{ top: 18, right: 88, left: -20, bottom: 0 }}
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
                          y={PASS_THRESHOLD}
                          stroke="#64748B"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Pass: ${PASS_THRESHOLD}%`,
                            position: "right",
                            fill: "#64748B",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                        <ReferenceLine
                          y={EXCELLENT_THRESHOLD}
                          stroke="#2563EB"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Target: ${EXCELLENT_THRESHOLD}%`,
                            position: "right",
                            fill: "#2563EB",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              const isAbove = (item.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-lg text-xs space-y-1.5 border border-slate-700 shadow-md">
                                  <div className="flex items-center justify-between gap-4 text-slate-300 font-semibold border-b border-slate-800 pb-1">
                                    <span>{item.week_start || item.label}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold tracking-wide ${
                                        isAbove
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : "bg-amber-950 text-amber-400 border border-amber-800"
                                      }`}
                                    >
                                      {isAbove ? `>= ${EXCELLENT_THRESHOLD}% TARGET` : `< ${EXCELLENT_THRESHOLD}% ACTION`}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                                    <span className="text-xl font-bold text-white tabular-nums">
                                      {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">cohort mean</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center justify-between tabular-nums">
                                    <span>Benchmark Delta:</span>
                                    <strong className={isAbove ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                                      {item.avg_score_pct >= EXCELLENT_THRESHOLD
                                        ? `+${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)} pts`
                                        : `${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)} pts`}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-slate-400 pt-0.5 tabular-nums">
                                    {item.session_count || 0} assessments evaluated
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
                            const isAbove = (entry.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                            return (
                              <Cell
                                key={`admin-bar-cell-${index}`}
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
                          strokeWidth={2}
                          dot={{ r: 3, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 2 }}
                          activeDot={{ r: 5, fill: "#2563EB", stroke: "#FFFFFF", strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* VIEW B: VELOCITY CURVE */}
                {progressionView === "curve" && (
                  <div className="w-full h-56 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(effectiveWeekly || []).map((w, i) => ({
                          ...w,
                          label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                        }))}
                        margin={{ top: 18, right: 88, left: -20, bottom: 0 }}
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
                          y={PASS_THRESHOLD}
                          stroke="#64748B"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Pass: ${PASS_THRESHOLD}%`,
                            position: "right",
                            fill: "#64748B",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                        <ReferenceLine
                          y={EXCELLENT_THRESHOLD}
                          stroke="#2563EB"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Target: ${EXCELLENT_THRESHOLD}%`,
                            position: "right",
                            fill: "#2563EB",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              const isAbove = (item.avg_score_pct || 0) >= EXCELLENT_THRESHOLD;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-lg text-xs space-y-1.5 border border-slate-700 shadow-md">
                                  <div className="flex items-center justify-between gap-4 text-slate-300 font-semibold border-b border-slate-800 pb-1">
                                    <span>{item.week_start || item.label}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold tracking-wide ${
                                        isAbove
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : "bg-amber-950 text-amber-400 border border-amber-800"
                                      }`}
                                    >
                                      {isAbove ? `>= ${EXCELLENT_THRESHOLD}% TARGET` : `< ${EXCELLENT_THRESHOLD}% ACTION`}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                                    <span className="text-xl font-bold text-white tabular-nums">
                                      {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">cohort mean</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center justify-between tabular-nums">
                                    <span>Benchmark Delta:</span>
                                    <strong className={isAbove ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                                      {item.avg_score_pct >= EXCELLENT_THRESHOLD
                                        ? `+${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)} pts`
                                        : `${(item.avg_score_pct - EXCELLENT_THRESHOLD).toFixed(1)} pts`}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-slate-400 pt-0.5 tabular-nums">
                                    {item.session_count || 0} assessments evaluated
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
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="#F8FAFC"
                          dot={{ r: 3, fill: "#FFFFFF", stroke: "#2563EB", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Explicit Chart Sample Size Caption */}
                <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 font-normal">
                  <span>Sample size: {(effectiveWeekly || []).reduce((acc, w) => acc + (w.session_count || 0), 0)} assessments evaluated across {(batchesList || []).length} cohorts</span>
                  <span className="text-slate-400">Chronological 8-week aggregation</span>
                </div>
              </>
            )}
          </div>

          {/* Widget 2: Platform Governance Ledger (Dual Tab: Cohort Directory vs RBAC User Accounts) */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              {/* Tab Switcher */}
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
                <button
                  type="button"
                  onClick={() => setGovernanceTab("cohorts")}
                  className={`px-3.5 py-1.5 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    governanceTab === "cohorts"
                      ? "bg-white text-slate-900 font-semibold shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Cohort Directory</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold tabular-nums">
                    {batchesList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGovernanceTab("users");
                    fetchUsers();
                  }}
                  className={`px-3.5 py-1.5 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    governanceTab === "users"
                      ? "bg-white text-slate-900 font-semibold shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>RBAC User Accounts</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold tabular-nums">
                    {usersList.length || adminStats.activeUsers}
                  </span>
                </button>
              </div>

              {/* Action buttons based on active tab */}
              {governanceTab === "cohorts" ? (
                <button
                  type="button"
                  onClick={handleOpenAddBatch}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors shadow-xs flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Cohort</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setUserFormError("");
                    setAddUserModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-sm flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Provision User</span>
                </button>
              )}
            </div>

            {/* TAB 1: COHORT DIRECTORY */}
            {governanceTab === "cohorts" && (
              <>
                {effectiveBatchesLoading ? (
                  <LoadingState message="Loading cohort directory..." className="py-12" />
                ) : effectiveBatchesError ? (
                  <ErrorState
                    title="Unable to Load Cohort Directory"
                    message={effectiveBatchesError}
                    onRetry={() => fetchBatches()}
                    className="py-12"
                  />
                ) : effectiveBatchesList.length === 0 ? (
                  <EmptyState
                    title="No Active Cohort Batches"
                    description="No active cohorts found. Create your first cohort using the button above."
                    className="py-12"
                  />
                ) : (
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-2">Cohort Batch</th>
                          <th className="py-2.5 px-2">Assigned Trainers</th>
                          <th className="py-2.5 px-2">Timeline</th>
                          <th className="py-2.5 px-1.5 text-center">Enrolled</th>
                          <th className="py-2.5 px-2 text-right">Avg</th>
                          <th className="py-2.5 px-2 text-right">Pass</th>
                          <th className="py-2.5 px-1.5 text-center">Staffing</th>
                          <th className="py-2.5 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {effectiveBatchesList.map((b) => {
                          const comp = comparisons[b.id];
                          const avg = comp?.avg_score_pct ?? null;
                          const pass = comp?.pass_rate_pct ?? null;
                          const isBelow = avg !== null && avg < PASS_THRESHOLD;
                          const trainersFetchFailed = Boolean(batchTrainersErrorMap[b.id]);
                          const assigned = batchTrainersMap[b.id];
                          const assignedLoaded = Array.isArray(assigned);
                          const count = b.trainee_count ?? comp?.trainee_count ?? 0;

                          return (
                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-2 font-semibold text-slate-900 text-[11px] max-w-[140px]">
                                {b.name}
                              </td>
                              <td className="py-2.5 px-2">
                                {trainersFetchFailed ? (
                                  <span className="text-[11px] text-rose-600 font-medium">
                                    Unavailable
                                  </span>
                                ) : !assignedLoaded ? (
                                  <span className="text-[11px] text-slate-400">
                                    Checking...
                                  </span>
                                ) : assigned.length === 0 ? (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium inline-block whitespace-nowrap">
                                    No trainer assigned
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 flex-nowrap max-w-[145px]">
                                    <span
                                      title={assigned[0].trainer_email || assigned[0].trainer_name}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-medium truncate"
                                    >
                                      {assigned[0].trainer_email || assigned[0].trainer_name}
                                    </span>
                                    {assigned.length > 1 && (
                                      <span
                                        title={assigned.map((t) => t.trainer_email || t.trainer_name).join(", ")}
                                        className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold shrink-0 tabular-nums"
                                      >
                                        +{assigned.length - 1}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-slate-500 text-[10px] font-normal whitespace-nowrap tabular-nums">
                                {b.start_date || "-"} – {b.end_date || "-"}
                              </td>
                              <td className="py-2.5 px-1.5 text-center">
                                <span
                                  title={`${count} ${count === 1 ? "trainee" : "trainees"} enrolled`}
                                  className="font-semibold text-slate-700 text-[11px] tabular-nums"
                                >
                                  {count}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold tabular-nums text-[11px]">
                                <div className="flex flex-col items-end">
                                  <span className={isBelow ? "text-rose-600" : "text-slate-900"}>
                                    {avg !== null ? `${avg.toFixed(1)}%` : "No data"}
                                  </span>
                                  {isBelow && (
                                    <span className="text-[9px] font-medium text-rose-600 uppercase tracking-wide whitespace-nowrap">
                                      &lt; {PASS_THRESHOLD}%
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-medium text-slate-700 tabular-nums text-[11px]">
                                {pass !== null ? `${pass.toFixed(1)}%` : "-"}
                              </td>
                              <td className="py-2.5 px-1.5 text-center">
                                {trainersFetchFailed ? (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium uppercase tracking-wider border border-slate-200">
                                    Unknown
                                  </span>
                                ) : !assignedLoaded ? (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 text-[10px] font-medium uppercase tracking-wider border border-slate-200">
                                    ...
                                  </span>
                                ) : assigned.length === 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-medium uppercase tracking-wider border border-amber-200">
                                    Unassigned
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium uppercase tracking-wider border border-emerald-200">
                                    Assigned
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenManageTrainers(b, e)}
                                    title="Manage Trainers"
                                    aria-label={`Manage Trainers for ${b.name}`}
                                    className="px-1.5 py-1 rounded bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-[10px] font-medium transition-colors cursor-pointer inline-flex items-center space-x-1 shrink-0"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    <span>Trainers</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditBatch(b, e)}
                                    title="Edit cohort"
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteBatchError("");
                                      setDeleteBatchTarget(b);
                                    }}
                                    title="Delete cohort"
                                    className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
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
              </>
            )}

            {/* TAB 2: RBAC USER ACCOUNTS */}
            {governanceTab === "users" && (
              <div className="space-y-3 pt-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search accounts by email or linked trainee..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 font-normal text-slate-900"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">All Roles</option>
                      <option value="admin">Administrators</option>
                      <option value="trainer">Trainers</option>
                      <option value="trainee">Trainees</option>
                    </select>
                  </div>
                </div>

                {effectiveUsersLoading ? (
                  <LoadingState message="Loading user accounts..." className="py-12" />
                ) : effectiveUsersError ? (
                  <ErrorState
                    title="Unable to Load User Accounts"
                    message={effectiveUsersError}
                    onRetry={() => fetchUsers()}
                    className="py-12"
                  />
                ) : effectiveUsersList.length === 0 ? (
                  <EmptyState
                    title="No User Accounts Found"
                    description="No accounts match the current query."
                    className="py-12"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Account Email</th>
                          <th className="py-2.5 px-3">Assigned Role</th>
                          <th className="py-2.5 px-3">Linked Profile</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {effectiveUsersList.map((u) => {
                          const isSelf = user?.id === u.id;
                          const isBusy = userActionLoadingId === u.id;

                          return (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                                  <span>{u.email}</span>
                                  {isSelf && (
                                    <span className="text-[9px] font-semibold uppercase text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 tabular-nums">User ID #{u.id}</div>
                              </td>

                              <td className="py-3 px-3">
                                <select
                                  disabled={isSelf || isBusy}
                                  value={u.role}
                                  onChange={(e) => handleChangeUserRole(u, e.target.value)}
                                  className={`text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 bg-white transition-colors cursor-pointer text-slate-800 ${
                                    isSelf ? "cursor-not-allowed opacity-80" : ""
                                  }`}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="trainer">Trainer</option>
                                  <option value="trainee">Trainee</option>
                                </select>
                              </td>

                              <td className="py-3 px-3 text-slate-600 font-normal">
                                {u.trainee_name ? (
                                  <span className="font-semibold text-slate-800">
                                    {u.trainee_name}{" "}
                                    <span className="text-[10px] text-slate-400 font-normal tabular-nums">
                                      (#{u.trainee_id})
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">
                                    Platform System Principal
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  disabled={isSelf || isBusy}
                                  onClick={() => handleToggleUserActive(u)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border cursor-pointer transition-colors ${
                                    u.is_active
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                      : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                                  } ${isSelf ? "cursor-not-allowed opacity-75" : ""}`}
                                  title={isSelf ? "Cannot deactivate yourself" : "Click to toggle active status"}
                                >
                                  <span className="inline-flex items-center space-x-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                                    <span>{u.is_active ? "Active" : "Inactive"}</span>
                                  </span>
                                </button>
                              </td>

                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleResetPassword(u)}
                                    title="Generate temporary password"
                                    className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 font-medium text-[11px] border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <KeyRound className="w-3 h-3" />
                                    <span>Reset Password</span>
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
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN (4 Cols): Security Audit Trail + Governance Shortcuts
            ========================================================================= */}
        <div className="lg:col-span-4 space-y-6">

          {/* Widget 3: Compliance & Security Audit Stream */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Security Audit Stream</h3>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Live Audit
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Real-time compliance activity log capturing user mutations, role assignments, and session events:
            </p>

            {effectiveActivityLoading ? (
              <LoadingState message="Loading audit activity stream..." className="py-8" />
            ) : effectiveActivityError ? (
              <ErrorState
                title="Audit Stream Unavailable"
                message={effectiveActivityError}
                onRetry={() => fetchRecentActivity()}
                className="py-8"
              />
            ) : effectiveRecentActivity.length === 0 ? (
              <EmptyState
                title="No Audit Events Recorded"
                description="No platform mutations or security events have occurred yet."
                className="py-8"
              />
            ) : (
              <div className="space-y-2.5">
                {effectiveRecentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-medium truncate max-w-[140px] text-slate-700">
                        {log.user_email || `User #${log.user_id}`}
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">{formatTimeAgo(log.created_at)}</span>
                    </div>
                    <div className="text-slate-900 font-semibold tracking-tight text-[11px]">
                      {formatActionTitle(log)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <Link
                to="/admin/audit-logs"
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <span>View Full Compliance Log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Widget 4: Live Dependency & Service Status Matrix */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-2">
                <Server className="w-4 h-4 text-slate-800" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Service Status
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                {serviceHealth.loading || serviceHealth.status === "unchecked" ? (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    Unchecked
                  </span>
                ) : serviceHealth.status === "error" ? (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    Probe Failed
                  </span>
                ) : serviceHealth.data?.database?.status !== "connected" ? (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    DB Unavailable
                  </span>
                ) : serviceHealth.data?.ml_service?.status === "available" ? (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>All Services Up</span>
                  </span>
                ) : (serviceHealth.data?.ml_service?.fallback_used_count || 0) > 0 ? (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Rule Fallback Used
                  </span>
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    ML Unavailable
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fetchServiceHealth(false)}
                  title="Run live service health probe"
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                >
                  <RotateCw className={`w-3 h-3 ${serviceHealth.loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Live dependency probe via <code className="text-[11px] font-mono text-slate-700">/admin/service-health</code>
              {serviceHealth.data?.checked_at
                ? ` · Checked ${formatTimeShort(serviceHealth.data.checked_at) || "recently"}`
                : " · Pending probe"}
            </p>

            <div className="space-y-2.5">
              {/* Service 1: Database */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">
                      Core Database ({serviceHealth.data?.database?.engine?.toUpperCase() || "SQLite"})
                    </div>
                    <div className="text-[10px] text-slate-500 tabular-nums truncate">
                      {adminStats.overviewAvailable
                        ? `${adminStats.totalTrainees} Trainees | ${adminStats.totalSessions} Sessions`
                        : "Overview totals unavailable"}
                    </div>
                  </div>
                </div>
                {serviceHealth.status === "unchecked" ? (
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    Unchecked
                  </span>
                ) : serviceHealth.data?.database?.status === "connected" ? (
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 shrink-0">
                    Unavailable
                  </span>
                )}
              </div>

              {/* Service 2: ML Early-Warning Service */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Cpu className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">ML Risk Service</div>
                    <div className="text-[10px] text-slate-500 leading-snug">
                      {serviceHealth.status === "unchecked"
                        ? "Awaiting health probe..."
                        : serviceHealth.data?.ml_service?.status === "available"
                        ? `Random Forest${serviceHealth.data?.ml_service?.model_version ? ` v${serviceHealth.data.ml_service.model_version}` : ""}${serviceHealth.data?.ml_service?.fallback_configured ? " · Rule fallback available" : ""}`
                        : (serviceHealth.data?.ml_service?.fallback_used_count || 0) > 0
                        ? `ML unavailable · Rule fallback used (${serviceHealth.data.ml_service.fallback_used_count}x since this backend process started${serviceHealth.data.ml_service.last_fallback_at ? `, last ${formatTimeShort(serviceHealth.data.ml_service.last_fallback_at)}` : ""})`
                        : serviceHealth.data?.ml_service?.fallback_configured !== false
                        ? "ML unavailable · Rule fallback available"
                        : serviceHealth.data?.ml_service?.detail || "ML unavailable"}
                    </div>
                  </div>
                </div>
                {serviceHealth.status === "unchecked" ? (
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    Unchecked
                  </span>
                ) : serviceHealth.data?.ml_service?.status === "available" ? (
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Available
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                    ML Unavailable
                  </span>
                )}
              </div>

              {/* Service 3: WebSocket Live Stream */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">WebSocket Relay</div>
                    <div className="text-[10px] text-slate-500 tabular-nums truncate">
                      {serviceHealth.status === "loaded" && serviceHealth.data?.websocket
                        ? `FastAPI /ws · ${serviceHealth.data.websocket.connected_clients ?? 0} clients · ${serviceHealth.data.websocket.messages_sent ?? 0} msgs`
                        : adminStats.realtimeAvailable
                        ? `FastAPI /ws · ${adminStats.connectedClients} clients`
                        : "Relay telemetry unavailable"}
                    </div>
                  </div>
                </div>
                {serviceHealth.status === "unchecked" ? (
                  <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    Unchecked
                  </span>
                ) : serviceHealth.data?.websocket?.status === "healthy" ||
                  serviceHealth.data?.websocket?.status === "active" ||
                  adminStats.realtimeAvailable ? (
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 shrink-0">
                    Unavailable
                  </span>
                )}
              </div>

              {/* Service 4: RBAC Policy Config */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Shield className="w-3.5 h-3.5 text-slate-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">RBAC Access Policy</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      JWT Bearer | Cohort &amp; Admin Scope Guards
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                  Configured
                </span>
              </div>
            </div>

            {/* Quick Navigation Strip */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium">
              <Link to="/modules" className="text-slate-600 hover:text-blue-600 transition-colors">
                Modules Library
              </Link>
              <Link to="/batches" className="text-slate-600 hover:text-blue-600 transition-colors">
                Cohort Archive
              </Link>
              <Link to="/admin/audit-logs" className="text-slate-600 hover:text-blue-600 transition-colors">
                Audit Trail
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          MODEL EVALUATION & BASELINE BENCHMARK PANEL (Step 7)
          ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Model Evaluation & Baseline Benchmark
                </h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Holdout Audit
                </span>
                {effectiveEvaluationData?.evaluated_at ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                    Evaluated: {formatDateShort(effectiveEvaluationData.evaluated_at)}
                  </span>
                ) : effectiveEvaluationData?.artifact_modified_at ? (
                  <>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                      Evaluation artifact modified: {formatDateShort(effectiveEvaluationData.artifact_modified_at)}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
                      Execution time: not recorded
                    </span>
                  </>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Chronological holdout evaluation comparing the ML early-warning predictor against the baseline rule on held-out test sessions
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto text-xs">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200 tabular-nums">
              Sample Size: {evaluationData?.sample_size ?? "-"} Trainees
            </span>
            <button
              type="button"
              onClick={() => fetchModelEvaluation(false)}
              className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
              title="Refresh Evaluation"
            >
              <RotateCw className={`w-3.5 h-3.5 ${evaluationLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Step 9b Shared State Conditional Model Evaluation Rendering */}
        {effectiveEvaluationLoading ? (
          <LoadingState message="Computing held-out cross-validation metrics..." className="py-12" />
        ) : effectiveEvaluationError ? (
          <ErrorState
            title="Unable to Load Model Evaluation"
            message={effectiveEvaluationError}
            onRetry={() => fetchModelEvaluation(false)}
            className="py-12"
          />
        ) : !effectiveEvaluationData ? (
          <EmptyState
            title="No Model Evaluation Available"
            description="Empirical benchmark data has not been computed yet."
            className="py-12"
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: Metrics Comparison Table (7 Cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Metric</th>
                      <th className="py-2.5 px-3 text-right">Baseline Rule (Avg &lt; 60%)</th>
                      <th className="py-2.5 px-3 text-right">ML Predictor ({effectiveEvaluationData.model_name || "Random Forest"})</th>
                      <th className="py-2.5 px-3 text-center">Delta / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Precision</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                        {(effectiveEvaluationData.baseline.precision * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                        {(effectiveEvaluationData.model.precision * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {(() => {
                          const precDiffPts =
                            (effectiveEvaluationData.baseline.precision - effectiveEvaluationData.model.precision) * 100;
                          if (precDiffPts > 0.05) {
                            return (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
                                Rule advantage: +{precDiffPts.toFixed(1)} pts
                              </span>
                            );
                          }
                          if (precDiffPts < -0.05) {
                            return (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                                ML advantage: +{Math.abs(precDiffPts).toFixed(1)} pts
                              </span>
                            );
                          }
                          return (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 tabular-nums">
                              Tied (0.0 pts)
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">Recall</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                        {(effectiveEvaluationData.baseline.recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                        {(effectiveEvaluationData.model.recall * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {(() => {
                          const recallDiffPts =
                            (effectiveEvaluationData.model.recall - effectiveEvaluationData.baseline.recall) * 100;
                          if (Math.abs(recallDiffPts) < 0.05) {
                            return (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 tabular-nums">
                                Tied ({(effectiveEvaluationData.model.recall * 100).toFixed(1)}%)
                              </span>
                            );
                          }
                          return (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 tabular-nums">
                              {recallDiffPts > 0 ? "ML" : "Rule"} +{Math.abs(recallDiffPts).toFixed(1)} pts
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">F1-Score</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 tabular-nums">
                        {effectiveEvaluationData.baseline.f1.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                        {effectiveEvaluationData.model.f1.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {(() => {
                          const f1Diff = effectiveEvaluationData.model.f1 - effectiveEvaluationData.baseline.f1;
                          if (f1Diff > 0.0001) {
                            return (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ML Higher (+{f1Diff.toFixed(4)})
                              </span>
                            );
                          }
                          if (f1Diff < -0.0001) {
                            return (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Baseline Higher (+{Math.abs(f1Diff).toFixed(4)})
                              </span>
                            );
                          }
                          return (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              Tied
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500">True Positives / Negatives</td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600 tabular-nums">
                        {effectiveEvaluationData.baseline.true_positives} TP / {effectiveEvaluationData.baseline.true_negatives} TN
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600 tabular-nums">
                        {effectiveEvaluationData.model.true_positives} TP / {effectiveEvaluationData.model.true_negatives} TN
                      </td>
                      <td className="py-2 px-3 text-center text-[10px] text-slate-500">
                        Confusion Matrix
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-500">False Positives (Type I)</td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600 tabular-nums">
                        {effectiveEvaluationData.baseline.false_positives}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-rose-600 font-semibold tabular-nums">
                        {effectiveEvaluationData.model.false_positives}
                      </td>
                      <td className="py-2 px-3 text-center text-[10px] text-slate-500">
                        False alarms
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Status Alert Banner */}
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start space-x-2.5 ${
                  effectiveEvaluationData.model_beats_baseline
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                {effectiveEvaluationData.model_beats_baseline ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {effectiveEvaluationData.model_beats_baseline
                      ? "Model outperforms baseline rule on holdout set"
                      : "Model does NOT beat the baseline rule"}
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed font-normal ${
                      effectiveEvaluationData.model_beats_baseline ? "text-emerald-800" : "text-amber-800"
                    }`}
                  >
                    {effectiveEvaluationData.summary ||
                      `The simple threshold rule (average < ${effectiveEvaluationData.pass_threshold}%) achieved ${(
                        effectiveEvaluationData.baseline.precision * 100
                      ).toFixed(1)}% precision vs ${(effectiveEvaluationData.model.precision * 100).toFixed(
                        1
                      )}% for the ML predictor.`}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Sample Size, Ground Truth, and Label Definitions (5 Cols) */}
            <div className="lg:col-span-5 space-y-3.5">
              {/* Card 1: Sample Size Breakdown */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 border-b border-slate-200/80 pb-2">
                  <span>Evaluation Cohort Sample</span>
                  <span className="font-mono text-slate-800 tabular-nums">{effectiveEvaluationData.sample_size} Trainees</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-md bg-white border border-slate-200">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Positive Labels</span>
                    <div className="text-base font-bold text-rose-600 mt-0.5 tabular-nums">
                      {effectiveEvaluationData.positive_labels} <span className="text-[10px] text-slate-400 font-normal">({((effectiveEvaluationData.positive_labels / effectiveEvaluationData.sample_size) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">At Risk in test set</div>
                  </div>
                  <div className="p-2.5 rounded-md bg-white border border-slate-200">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Negative Labels</span>
                    <div className="text-base font-bold text-emerald-600 mt-0.5 tabular-nums">
                      {effectiveEvaluationData.negative_labels} <span className="text-[10px] text-slate-400 font-normal">({((effectiveEvaluationData.negative_labels / effectiveEvaluationData.sample_size) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">On Track in test set</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Label & Rule Definitions */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-900 border-b border-slate-200/80 pb-2">
                  Experimental Setup & Definitions
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Ground Truth Label Definition</div>
                  <p className="text-[11px] text-slate-700 mt-0.5 font-normal leading-relaxed">
                    {effectiveEvaluationData.label_definition}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Baseline Rule Formulation</div>
                  <p className="text-[11px] text-slate-700 mt-0.5 font-normal leading-relaxed">
                    {effectiveEvaluationData.baseline_rule}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Test Methodology</div>
                  <p className="text-[11px] text-slate-700 mt-0.5 font-normal leading-relaxed">
                    Chronological holdout: last {effectiveEvaluationData.held_out_sessions} sessions held out for testing; predictor trained/evaluated on earlier sessions only (min {effectiveEvaluationData.min_sessions_required} sessions required).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          5. MODALS
          ========================================================================= */}

      {/* MODAL: Provision User Account */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-lg border border-slate-200 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Account Management
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">Provision User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {userFormError && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {userFormError}
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="user@portal.com"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Role Assignment *
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
                >
                  <option value="trainer">Trainer (Curriculum & Sessions)</option>
                  <option value="admin">Administrator (Full Governance)</option>
                  <option value="trainee">Trainee (Scoped to Profile)</option>
                </select>
              </div>

              {userForm.role === "trainee" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Link to Enrolled Trainee Record *
                  </label>
                  <select
                    required
                    value={userForm.trainee_id}
                    onChange={(e) => setUserForm({ ...userForm, trainee_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Temporary Password (Optional)
                </label>
                <input
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Leave blank to auto-generate secure password"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-md text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-1"
                >
                  {userSubmitting ? <Spinner size="sm" className="text-white" /> : <span>Create Account</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Temporary Credentials Reveal */}
      {revealModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 shadow-lg border border-slate-200 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center mb-3">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{revealModal.title}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Temporary credentials for <strong className="text-slate-800">{revealModal.email}</strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between mb-4">
              <span className="font-mono text-sm font-bold text-slate-900 tracking-wider tabular-nums">
                {revealModal.tempPassword}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(revealModal.tempPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="p-1.5 text-slate-500 hover:text-blue-600 cursor-pointer"
                title="Copy password"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRevealModal(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 cursor-pointer shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Batch */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-lg border border-slate-200 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Cohort Governance
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {editingBatch ? "Edit Cohort Batch" : "Create New Training Cohort"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {batchFormError && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {batchFormError}
              </div>
            )}

            <form onSubmit={handleBatchFormSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cohort Name *
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  placeholder="e.g. Batch D - Full Stack (Foundational)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={batchForm.start_date}
                    onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-normal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={batchForm.end_date}
                    onChange={(e) => setBatchForm({ ...batchForm, end_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-normal focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-md text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-1"
                >
                  {batchSubmitting ? <Spinner size="sm" className="text-white" /> : <span>{editingBatch ? "Update" : "Save Cohort"}</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Batch Confirmation with 409 protection */}
      {deleteBatchTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 shadow-lg border border-slate-200 text-xs">
            <div className="flex items-center space-x-2 text-rose-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Delete Cohort Batch</h3>
            </div>
            <p className="text-slate-600 mb-4 leading-relaxed font-normal">
              Are you sure you want to delete cohort <strong className="text-slate-900">"{deleteBatchTarget.name}"</strong>?
              If trainees are currently enrolled in this batch, deletion will be rejected to protect data integrity.
            </p>

            {deleteBatchError && (
              <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium leading-relaxed">
                {deleteBatchError}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteBatchTarget(null)}
                className="px-3.5 py-1.5 rounded-md text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBatchSubmitting}
                onClick={handleDeleteBatchConfirm}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-medium shadow-sm cursor-pointer disabled:opacity-60 flex items-center space-x-1"
              >
                {deleteBatchSubmitting ? <Spinner size="sm" className="text-white" /> : <span>Confirm Delete</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Manage Cohort Trainers */}
      {manageTrainersBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 shadow-lg border border-slate-200 text-xs space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Cohort Staffing
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Manage Trainers — {manageTrainersBatch.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManageTrainersBatch(null);
                  setRemoveConfirmTrainer(null);
                }}
                aria-label="Close Manage Trainers dialog"
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {trainerMutationError && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium shrink-0">
                {trainerMutationError}
              </div>
            )}

            {/* Confirmation prompt before removing assigned trainer */}
            {removeConfirmTrainer && (
              <div className="p-3.5 rounded-md bg-amber-50 border border-amber-300 space-y-2.5 shrink-0">
                <div className="flex items-start space-x-2 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {assignedTrainers.length <= 1
                        ? "This cohort will have no assigned trainer. Continue?"
                        : `Remove ${removeConfirmTrainer.trainer_name || removeConfirmTrainer.trainer_email} from this cohort?`}
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Unassigning {removeConfirmTrainer.trainer_email} immediately revokes cohort-scoped trainer access.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setRemoveConfirmTrainer(null)}
                    disabled={trainerMutationLoadingId !== null}
                    className="px-3 py-1 rounded-md bg-white border border-amber-300 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUnassignTrainer}
                    disabled={trainerMutationLoadingId !== null}
                    className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer disabled:opacity-60 inline-flex items-center space-x-1"
                  >
                    {trainerMutationLoadingId === removeConfirmTrainer.trainer_id ? (
                      <Spinner size="sm" className="text-white" />
                    ) : (
                      <span>Confirm Remove</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-y-auto space-y-4 pr-0.5">
              {/* Section 1: Currently Assigned Trainers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Assigned Trainers ({assignedTrainers.length})
                  </span>
                </div>
                {assignedTrainersLoading ? (
                  <div className="p-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                    Loading assigned trainers...
                  </div>
                ) : assignedTrainersError ? (
                  <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700">
                    {assignedTrainersError}
                  </div>
                ) : assignedTrainers.length === 0 ? (
                  <div className="p-3 rounded-md border border-amber-200 bg-amber-50/70 text-amber-800 font-medium">
                    No trainer assigned to this cohort yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
                    {assignedTrainers.map((t) => (
                      <div
                        key={t.trainer_id}
                        className="p-2.5 bg-white flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {t.trainer_name || t.trainer_email}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{t.trainer_email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmTrainer(t)}
                          disabled={trainerMutationLoadingId !== null}
                          className="px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-medium cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Available Active Trainers */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block">
                  Assign Eligible Trainer
                </span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={trainerSearchQuery}
                    onChange={(e) => setTrainerSearchQuery(e.target.value)}
                    placeholder="Filter trainers by email..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {eligibleTrainersLoading ? (
                  <div className="p-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                    Loading trainer directory...
                  </div>
                ) : eligibleTrainersError ? (
                  <div className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-700">
                    {eligibleTrainersError}
                  </div>
                ) : (() => {
                    const assignedIds = new Set(assignedTrainers.map((t) => t.trainer_id));
                    const q = trainerSearchQuery.trim().toLowerCase();
                    const candidates = eligibleTrainers.filter(
                      (u) => !assignedIds.has(u.id) && (!q || u.email.toLowerCase().includes(q))
                    );
                    const matchingInactive = q
                      ? inactiveTrainers.filter(
                          (u) => !assignedIds.has(u.id) && u.email.toLowerCase().includes(q)
                        )
                      : [];
                    if (candidates.length === 0 && matchingInactive.length === 0) {
                      return (
                        <div className="space-y-1.5">
                          <div className="p-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                            {eligibleTrainers.length === 0
                              ? "No active trainer accounts found."
                              : q
                              ? "No unassigned trainers match your filter."
                              : "All active trainers are already assigned to this cohort."}
                          </div>
                          {inactiveTrainers.length > 0 && (
                            <p className="text-[11px] text-slate-500">
                              {inactiveTrainers.length} inactive trainer{" "}
                              {inactiveTrainers.length === 1 ? "account" : "accounts"} excluded from
                              assignment.
                            </p>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden max-h-48 overflow-y-auto">
                          {candidates.map((u) => (
                            <div
                              key={u.id}
                              className="p-2.5 bg-white flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 truncate">{u.email}</div>
                                <div className="text-[10px] text-slate-500">Active Trainer · ID #{u.id}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAssignTrainerToBatch(u)}
                                disabled={trainerMutationLoadingId !== null}
                                className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer disabled:opacity-60 inline-flex items-center space-x-1 shrink-0"
                              >
                                {trainerMutationLoadingId === u.id ? (
                                  <Spinner size="sm" className="text-white" />
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" />
                                    <span>Assign</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                          {matchingInactive.map((u) => (
                            <div
                              key={u.id}
                              className="p-2.5 bg-slate-50/70 flex items-center justify-between gap-2 opacity-75"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-600 truncate">{u.email}</div>
                                <div className="text-[10px] text-slate-400">
                                  Inactive account · ID #{u.id}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-medium shrink-0">
                                Inactive
                              </span>
                            </div>
                          ))}
                        </div>
                        {inactiveTrainers.length > 0 && (
                          <p className="text-[11px] text-slate-500">
                            {inactiveTrainers.length} inactive trainer{" "}
                            {inactiveTrainers.length === 1 ? "account" : "accounts"} excluded from
                            assignment.
                          </p>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setManageTrainersBatch(null);
                  setRemoveConfirmTrainer(null);
                }}
                className="px-3.5 py-1.5 rounded-md text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
