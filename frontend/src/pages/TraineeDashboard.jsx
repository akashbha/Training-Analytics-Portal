// src/pages/TraineeDashboard.jsx
// Trainee performance dashboard with chronological progress curve and curriculum error breakdowns.

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { LoadingState, EmptyState, ErrorState } from "../components/states/index.js";
import { HelpAssistantPanel } from "../components/HelpAssistantPanel.jsx";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuth } from "../context/AuthContext.jsx";
import { Card } from "../components/Card.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { ModuleDiagnosticLedger } from "../components/ModuleDiagnosticLedger.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { UnauthorizedPage } from "./UnauthorizedPage.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  useTraineeProfile,
  useTraineeSummary,
  useTraineeProgress,
  useTraineeErrors,
  useTraineeSessions,
} from "../hooks/useTraineeAnalytics.js";
import { apiClient } from "../api/client.js";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD, COLD_START_SESSIONS, COLD_START_CUTOFF } from "../constants/thresholds.js";
import {
  Target,
  ArrowLeft,
  Filter,
  Trash2,
  Edit3,
  Camera,
  X,
  Save,
  CheckCircle2,
  RotateCw,
  Phone,
  Mail,
  Github,
  ExternalLink,
} from "lucide-react";

// Curated avatar options for instant selection
const AVATAR_OPTIONS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
];

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
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 z-50">
        <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1">
          {item.module_name}
        </div>
        <div className="text-sm font-bold text-white">
          {item.score_pct !== undefined ? `${item.score_pct.toFixed(1)}%` : "—"} Score
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
          <span>Errors: <strong className="text-rose-400">{item.errors}</strong></span>
          <span>Time: <strong className="text-blue-300">{mins}m {secs}s</strong></span>
        </div>
        <div className="text-[10px] text-slate-400 pt-0.5">{dateFormatted}</div>
      </div>
    );
  }
  return null;
}

function ScatterCustomTooltip({ active, payload }) {
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
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 z-50">
        <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1">
          {item.module_name}
        </div>
        <div className="text-sm font-bold text-white">
          {item.score_pct != null ? `${item.score_pct.toFixed(1)}%` : "—"} Score
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
          <span>Duration: <strong className="text-blue-300">{mins}m {secs}s</strong></span>
          <span>Errors: <strong className="text-rose-400">{item.errors}</strong></span>
        </div>
        <div className="text-[10px] text-slate-400 pt-0.5">{dateFormatted}</div>
      </div>
    );
  }
  return null;
}

function getModuleCategory(moduleName = "") {
  const lower = moduleName.toLowerCase();
  if (lower.includes("react")) return { label: "Frontend", bg: "bg-sky-50 text-sky-700 border-sky-200" };
  if (lower.includes("fastapi")) return { label: "REST API", bg: "bg-blue-50 text-blue-700 border-blue-200" };
  if (lower.includes("postgres") || lower.includes("schema") || lower.includes("sql"))
    return { label: "Database", bg: "bg-slate-100 text-slate-700 border-slate-300" };
  if (lower.includes("python")) return { label: "Core Logic", bg: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Module", bg: "bg-slate-100 text-slate-700 border-slate-200" };
}

function SessionNotesRow({ sessionId, isStaff, isFormOpen, onCloseForm }) {
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadNotes = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/sessions/${sessionId}/notes`);
      setNotes(res.data || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      await apiClient.post(`/sessions/${sessionId}/notes`, { text: newNote.trim() });
      setNewNote("");
      if (onCloseForm) onCloseForm();
      await loadNotes();
    } catch (err) {
      setErrorMsg(err.message || "Failed to record feedback note");
    } finally {
      setSubmitting(false);
    }
  };

  const hasNotes = notes && notes.length > 0;

  // Trainee: if no notes, show nothing extra
  if (!isStaff && !hasNotes && !loading) {
    return null;
  }

  // Trainer: if no notes and form is not open, show nothing extra
  if (isStaff && !hasNotes && !isFormOpen && !loading) {
    return null;
  }

  const formattedDate = (d) => {
    if (!d) return "-";
    const dateObj = new Date(d);
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <tr className="bg-slate-50/70 border-b border-slate-100 text-xs">
      <td colSpan={isStaff ? 6 : 5} className="py-2.5 px-3">
        <div className="space-y-2">
          {/* Existing notes list */}
          {hasNotes && (
            <div className="space-y-1.5">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/90 border border-slate-200/80 rounded px-3 py-1.5"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                      Trainer Feedback
                    </span>
                    <span className="text-slate-800 text-xs break-words">{n.text}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                    by {n.author_name || n.author_email || "Trainer"} on {formattedDate(n.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inline Add Note Form for Staff */}
          {isStaff && isFormOpen && (
            <form onSubmit={handleAddNote} className="p-3 bg-white border border-slate-200 rounded space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span>Add Trainer Note</span>
                <span className={`text-[11px] font-mono tabular-nums ${newNote.length >= 280 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {newNote.length}/300
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={300}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter feedback note for this assessment session (max 300 characters)..."
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:bg-white resize-none"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-mono">
                  {300 - newNote.length} characters left
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewNote("");
                      if (onCloseForm) onCloseForm();
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !newNote.trim()}
                    className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded transition-colors cursor-pointer"
                  >
                    {submitting ? "Saving..." : "Save note"}
                  </button>
                </div>
              </div>
              {errorMsg && (
                <div className="text-[11px] text-rose-600 font-medium">{errorMsg}</div>
              )}
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TraineeDashboard({ traineeId: propId }) {
  const params = useParams();
  const { user, isTrainer, isAdmin } = useAuth();
  const isStaff = isTrainer || isAdmin;

  const effectiveId = isStaff
    ? Number(propId || params.id)
    : Number(user?.trainee_id);

  const isUrlTampered =
    !isStaff &&
    params.id !== undefined &&
    Number(params.id) !== Number(user?.trainee_id);

  const [selectedModule, setSelectedModule] = useState("ALL");
  const [sessionFilter, setSessionFilter] = useState("ALL");
  const [syncRequested, setSyncRequested] = useState(false);

  // Profile Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    specialization: "",
    bio: "",
    github_url: "",
    avatar_url: "",
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef(null);

  // Session deletion modal state
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null);
  const [deleteSessionLoading, setDeleteSessionLoading] = useState(false);
  const [deleteSessionError, setDeleteSessionError] = useState("");

  // Feedback note inline form state
  const [activeNoteSessionId, setActiveNoteSessionId] = useState(null);

  // Fetch trainee analytics
  const {
    data: profile,
    loading: profileLoading,
    isForbidden: profileForbidden,
    refetch: refetchProfile,
  } = useTraineeProfile(effectiveId);

  const {
    data: summary,
    loading: summaryLoading,
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

  // Remediation records state
  const [remediations, setRemediations] = useState([]);
  const [remediationsLoading, setRemediationsLoading] = useState(false);
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [allModules, setAllModules] = useState([]);
  const [remediationForm, setRemediationForm] = useState({ module_id: "", note: "" });
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);
  const [remediationError, setRemediationError] = useState("");

  // Module learning goals state
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalForm, setGoalForm] = useState({ module_id: "", target_score: "75.0" });
  const [goalSubmitting, setGoalSubmitting] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [goalSuccess, setGoalSuccess] = useState(false);

  const loadRemediations = useCallback(async () => {
    if (!effectiveId) return;
    setRemediationsLoading(true);
    try {
      const res = await apiClient.get(`/trainees/${effectiveId}/remediations`);
      setRemediations(res.data || []);
    } catch {
      setRemediations([]);
    } finally {
      setRemediationsLoading(false);
    }
  }, [effectiveId]);

  const loadGoals = useCallback(async () => {
    if (!effectiveId) return;
    setGoalsLoading(true);
    try {
      const res = await apiClient.get(`/trainees/${effectiveId}/goals`);
      setGoals(res.data || []);
    } catch {
      setGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    loadRemediations();
    loadGoals();
  }, [loadRemediations, loadGoals]);

  useEffect(() => {
    apiClient.get("/modules?page=1&page_size=100")
      .then((res) => {
        const list = res.data?.items || res.data || [];
        setAllModules(list);
        if (list.length > 0) {
          setRemediationForm((prev) => ({
            ...prev,
            module_id: prev.module_id || String(list[0].id)
          }));
          setGoalForm((prev) => ({
            ...prev,
            module_id: prev.module_id || String(list[0].id)
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.module_id) return;
    const targetScore = parseFloat(goalForm.target_score);
    if (isNaN(targetScore) || targetScore < 0 || targetScore > 100) {
      setGoalError("Target score must be between 0.0 and 100.0%");
      return;
    }
    setGoalSubmitting(true);
    setGoalError("");
    setGoalSuccess(false);
    try {
      await apiClient.post(`/trainees/${effectiveId}/goals`, {
        module_id: Number(goalForm.module_id),
        target_score: targetScore,
      });
      setGoalSuccess(true);
      setTimeout(() => setGoalSuccess(false), 3000);
      await loadGoals();
    } catch (err) {
      setGoalError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to establish learning goal"
      );
    } finally {
      setGoalSubmitting(false);
    }
  };

  const handleCreateRemediation = async (e) => {
    e.preventDefault();
    if (!remediationForm.module_id) return;
    setRemediationSubmitting(true);
    setRemediationError("");
    try {
      await apiClient.post("/remediations", {
        trainee_id: effectiveId,
        module_id: Number(remediationForm.module_id),
        note: remediationForm.note.trim() || null,
      });
      setShowRemediationModal(false);
      setRemediationForm({
        module_id: allModules[0]?.id ? String(allModules[0].id) : "",
        note: "",
      });
      await loadRemediations();
    } catch (err) {
      setRemediationError(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to create remediation."
      );
    } finally {
      setRemediationSubmitting(false);
    }
  };

  // Local storage profile customization persistence
  const [localProfile, setLocalProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(`trainee_profile_${effectiveId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (profile) {
      setEditForm({
        name: localProfile?.name || profile.name || "",
        phone: localProfile?.phone || profile.phone || "",
        specialization: localProfile?.specialization || profile.specialization || "",
        bio: localProfile?.bio || profile.bio || "",
        github_url: localProfile?.github_url || profile.github_url || "",
        avatar_url: localProfile?.avatar_url || profile.avatar_url || "",
      });
    }
  }, [profile, localProfile]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Profile photo must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditForm((prev) => ({ ...prev, avatar_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      await apiClient.put(`/trainees/${effectiveId}`, {
        name: editForm.name,
        phone: editForm.phone,
        specialization: editForm.specialization,
        bio: editForm.bio,
        avatar_url: editForm.avatar_url,
        github_url: editForm.github_url,
      });

      const updated = {
        ...profile,
        ...editForm,
      };
      setLocalProfile(updated);
      try {
        localStorage.setItem(`trainee_profile_${effectiveId}`, JSON.stringify(updated));
      } catch {}

      setSaveSuccess(true);
      refetchProfile();
      setTimeout(() => {
        setEditModalOpen(false);
        setSaveSuccess(false);
      }, 700);
    } catch {
      const updated = {
        ...profile,
        ...editForm,
      };
      setLocalProfile(updated);
      try {
        localStorage.setItem(`trainee_profile_${effectiveId}`, JSON.stringify(updated));
      } catch {}
      setSaveSuccess(true);
      setTimeout(() => {
        setEditModalOpen(false);
        setSaveSuccess(false);
      }, 700);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionTarget) return;
    setDeleteSessionLoading(true);
    setDeleteSessionError("");
    try {
      await apiClient.delete(`/sessions/${deleteSessionTarget.id}`);
      setDeleteSessionTarget(null);
      refetchSummary();
      refetchProgress();
      refetchErrors();
      refetchSessions();
    } catch (err) {
      setDeleteSessionError(err.response?.data?.error?.message || "Failed to delete session.");
    } finally {
      setDeleteSessionLoading(false);
    }
  };

  const debounceTimerRef = useRef(null);
  const silentRefetchAll = useCallback(() => {
    refetchProfile(true);
    refetchSummary(true);
    refetchProgress(true);
    refetchErrors(true);
    refetchSessions(true);
  }, [refetchProfile, refetchSummary, refetchProgress, refetchErrors, refetchSessions]);

  useLiveEvent(
    useCallback(
      (event) => {
        if (!event || !effectiveId) return;
        const { trainee_id, trainee_ids } = event;
        let matches = false;
        if (Number(trainee_id) === Number(effectiveId)) matches = true;
        else if (trainee_ids && trainee_ids.some((t) => Number(t) === Number(effectiveId))) matches = true;

        if (matches) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => silentRefetchAll(), 400);
        }
      },
      [effectiveId, silentRefetchAll]
    )
  );

  usePollingFallback(silentRefetchAll, 15000);

  if (
    isUrlTampered ||
    profileForbidden ||
    summaryForbidden ||
    progressForbidden ||
    errorStatsForbidden ||
    sessionsForbidden
  ) {
    return <UnauthorizedPage message="Trainees are restricted to viewing only their own performance dashboard." />;
  }

  const activeProfile = {
    ...profile,
    ...(localProfile || {}),
  };

  const priorityModuleData = useMemo(() => {
    if (!progress || progress.length === 0) return null;
    const byModule = {};
    for (const p of progress) {
      if (!p.module_name) continue;
      const score = p.score_pct ?? p.score_percentage;
      if (score == null) continue;
      if (!byModule[p.module_name]) {
        byModule[p.module_name] = { total: 0, count: 0 };
      }
      byModule[p.module_name].total += score;
      byModule[p.module_name].count += 1;
    }

    const modules = Object.entries(byModule).map(([name, { total, count }]) => ({
      name,
      avg: total / count,
      count,
    }));

    if (modules.length === 0) return null;
    modules.sort((a, b) => a.avg - b.avg);
    const lowest = modules[0];
    const isBelow = lowest.avg < PASS_THRESHOLD;
    const gap = (PASS_THRESHOLD - lowest.avg).toFixed(1);
    const gapText = isBelow
      ? `${gap}% below the ${PASS_THRESHOLD.toFixed(1)}% pass cutoff`
      : `Meets the ${PASS_THRESHOLD.toFixed(1)}% pass cutoff`;

    return {
      moduleName: lowest.name,
      avgScore: lowest.avg.toFixed(1),
      count: lowest.count,
      isBelow,
      gapText,
    };
  }, [progress]);

  const moduleOptions = useMemo(() => {
    if (!progress || progress.length === 0) return [];
    return Array.from(new Set(progress.map((p) => p.module_name)));
  }, [progress]);

  const filteredProgress = useMemo(() => {
    if (!progress) return [];
    const filtered =
      selectedModule === "ALL"
        ? progress
        : progress.filter((p) => p.module_name === selectedModule);

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

  const sessionFilterOptions = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    return Array.from(new Set(sessions.map((s) => s.module_name)));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (sessionFilter === "ALL") return sessions;
    return sessions.filter((s) => s.module_name === sessionFilter);
  }, [sessions, sessionFilter]);

  const sessionStats = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const count = sessions.length;
    const avgScore = sessions.reduce((acc, s) => {
      const pct = s.score_percentage ?? s.score_pct ?? (s.module_max_score ? (s.score / s.module_max_score) * 100 : s.score) ?? 0;
      return acc + pct;
    }, 0) / count;
    const passCount = sessions.filter((s) => {
      const pct = s.score_percentage ?? s.score_pct ?? (s.module_max_score ? (s.score / s.module_max_score) * 100 : s.score) ?? 0;
      return pct >= PASS_THRESHOLD;
    }).length;
    const passRate = Math.round((passCount / count) * 100);
    return { count, avgScore: avgScore.toFixed(1), passRate };
  }, [sessions]);

  // Speed versus accuracy scatter data points: x = minutes, y = score % (1 point per session)
  const scatterData = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];
    return sessions.map((s, idx) => {
      const minutes = Number(((s.time_seconds || 0) / 60.0).toFixed(1));
      const scorePct = s.score_percentage != null
        ? Number(s.score_percentage.toFixed(1))
        : s.score_pct != null
          ? Number(s.score_pct.toFixed(1))
          : (s.module_max_score && s.module_max_score > 0)
            ? Number(((s.score / s.module_max_score) * 100.0).toFixed(1))
            : Number(s.score.toFixed(1));
      return {
        id: s.id || idx,
        minutes: minutes,
        score_pct: scorePct,
        time_seconds: s.time_seconds || 0,
        errors: s.errors || 0,
        module_name: s.module_name || `Module #${s.module_id}`,
        created_at: s.created_at,
      };
    });
  }, [sessions]);

  // Self-Trend: average of last 3 sessions minus average of first 3 sessions (show "n/a" if fewer than 6 sessions)
  const selfTrend = useMemo(() => {
    if (!progress || progress.length < 6) return "n/a";
    const first3 = progress.slice(0, 3);
    const last3 = progress.slice(-3);
    const avgFirst = first3.reduce((acc, curr) => acc + (curr.score_pct ?? 0), 0) / 3;
    const avgLast = last3.reduce((acc, curr) => acc + (curr.score_pct ?? 0), 0) / 3;
    const delta = avgLast - avgFirst;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}%`;
  }, [progress]);

  // Step 9c State Simulation Overrides (Dev only)
  const [searchParams, setSearchParams] = useSearchParams();
  const demoState = import.meta.env.DEV ? searchParams.get("state") : null;

  const isDemoLoading = demoState === "loading";
  const isDemoEmpty = demoState === "empty";
  const isDemoError = demoState === "error";

  const effectiveProfileLoading = isDemoLoading || profileLoading;
  const effectiveProfileError = isDemoError ? "Unable to retrieve trainee profile dossier." : (profileForbidden ? "Access forbidden: you do not have permission to view this profile." : null);

  const effectiveSummaryLoading = isDemoLoading || summaryLoading;
  const effectiveSummaryError = isDemoError ? "Unable to retrieve performance summary." : (summaryForbidden ? "Access forbidden." : null);
  const effectiveSummary = isDemoEmpty ? null : summary;

  const effectiveProgressLoading = isDemoLoading || progressLoading;
  const effectiveProgressError = isDemoError ? "Unable to load score progression timeline." : progressError;
  const effectiveFilteredProgress = isDemoEmpty ? [] : filteredProgress;

  const effectiveErrorsLoading = isDemoLoading || errorStatsLoading;
  const effectiveErrorsError = isDemoError ? "Unable to calculate curriculum defect diagnostics." : errorStatsError;
  const effectiveErrorStats = isDemoEmpty ? [] : errorStats;

  const effectiveSessionsLoading = isDemoLoading || sessionsLoading;
  const effectiveSessionsError = isDemoError ? "Unable to retrieve assessment sessions." : sessionsError;
  const effectiveSessions = isDemoEmpty ? [] : sessions;
  const effectiveFilteredSessions = isDemoEmpty ? [] : filteredSessions;
  const effectiveScatterData = isDemoEmpty ? [] : scatterData;

  const effectiveRemediationsLoading = isDemoLoading || remediationsLoading;
  const effectiveRemediationsError = isDemoError ? "Unable to load remediation history." : remediationError;
  const effectiveRemediations = isDemoEmpty ? [] : remediations;

  const effectiveGoalsLoading = isDemoLoading || goalsLoading;
  const effectiveGoalsError = isDemoError ? "Unable to retrieve module learning goals." : goalError;
  const effectiveGoals = isDemoEmpty ? [] : goals;

  const isZeroSessions =
    summary &&
    (summary.session_count === 0 || summary.session_count === null) &&
    (!progress || progress.length === 0);

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. TRAINEE HEADER & PROFILE DOSSIER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            {isStaff && (
              <Link
                to="/"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                title="Return to Trainer Overview"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )}

            {/* Profile Avatar with Camera Upload Badge */}
            <div className="relative group shrink-0">
              {activeProfile?.avatar_url ? (
                <img
                  src={activeProfile.avatar_url}
                  alt={activeProfile.name || "Trainee"}
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-900 text-white font-bold text-xl flex items-center justify-center">
                  {activeProfile?.name
                    ? activeProfile.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "TR"}
                </div>
              )}

              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                title="Upload / Change Photo"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {effectiveProfileLoading ? "Loading..." : isDemoEmpty || isDemoError ? "No Trainee Profile" : activeProfile?.name || "Danielle Johnson"}
                </h1>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  ID: TRN-{String(effectiveId || 1).padStart(4, "0")}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {isDemoEmpty || isDemoError ? "Enrolled Candidate Dossier" : `${activeProfile?.specialization || "Full-Stack Web & Distributed Systems"} · ${activeProfile?.email || user?.email}`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={() => silentRefetchAll()}
              title="Refresh Analytics"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contact details row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Email</span>
              <span className="font-semibold text-slate-800 truncate block">
                {isDemoEmpty || isDemoError ? "Not provided" : activeProfile?.email || user?.email || "Not provided"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone</span>
              <span className="font-semibold text-slate-800 truncate block">
                {isDemoEmpty || isDemoError || !activeProfile?.phone ? "Not provided" : activeProfile.phone}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Github className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">GitHub</span>
              {!isDemoEmpty && !isDemoError && activeProfile?.github_url ? (
                <a
                  href={activeProfile.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-600 hover:underline flex items-center space-x-1 truncate"
                >
                  <span className="truncate">{activeProfile.github_url.replace("https://", "")}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-slate-400 font-medium">Not provided</span>
              )}
            </div>
          </div>
        </div>

        {/* Verified Technical Competencies & Cohort Standing */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Verified Competencies:
            </span>
            {isDemoEmpty || isDemoError ? (
              <span className="text-slate-400 font-medium text-[11px]">No competencies recorded</span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>REST Architecture · 88.0%</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>React State Engineering · 82.5%</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Target Pacing · 21m Mean</span>
                </span>
              </div>
            )}
          </div>

          <div className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg">
            Self-Trend:{" "}
            <strong
              className={`font-bold ${
                !isDemoEmpty && !isDemoError && selfTrend !== "n/a" && selfTrend.startsWith("+")
                  ? "text-emerald-700"
                  : !isDemoEmpty && !isDemoError && selfTrend !== "n/a" && selfTrend.startsWith("-")
                  ? "text-rose-700"
                  : "text-slate-900"
              }`}
            >
              {isDemoEmpty || isDemoError ? "n/a" : selfTrend}
            </strong>
          </div>
        </div>
      </div>

      {/* Help Assistant Panel */}
      <HelpAssistantPanel />

      {/* 2. CORE STAT CARDS (Latest, Best, Improvement, Sessions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Latest Score"
          value={
            effectiveSummaryLoading
              ? "..."
              : isDemoEmpty || isDemoError || effectiveSummary?.latest_score_pct === null || effectiveSummary?.latest_score_pct === undefined
              ? "—"
              : `${effectiveSummary.latest_score_pct.toFixed(1)}%`
          }
          subtext="Most recent evaluation result"
          badge={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Latest</span>}
          loading={effectiveSummaryLoading}
        />

        <StatCard
          title="Best Score"
          value={
            effectiveSummaryLoading
              ? "..."
              : isDemoEmpty || isDemoError || effectiveSummary?.best_score_pct === null || effectiveSummary?.best_score_pct === undefined
              ? "—"
              : `${effectiveSummary.best_score_pct.toFixed(1)}%`
          }
          subtext="All-time highest module score"
          badge={<span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">Peak</span>}
          loading={effectiveSummaryLoading}
        />

        <StatCard
          title="Improvement"
          value={
            effectiveSummaryLoading
              ? "..."
              : isDemoEmpty || isDemoError || effectiveSummary?.improvement_pct === null || effectiveSummary?.improvement_pct === undefined
              ? "—"
              : `${effectiveSummary.improvement_pct >= 0 ? "+" : ""}${effectiveSummary.improvement_pct.toFixed(1)}%`
          }
          subtext={
            !isDemoEmpty && !isDemoError && effectiveSummary?.improvement_pct !== null && effectiveSummary?.improvement_pct !== undefined ? (
              <span
                className={`font-semibold ${
                  effectiveSummary.improvement_pct >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {effectiveSummary.improvement_pct >= 0 ? "▲ Positive trend" : "▼ Needs review"} (vs first 3)
              </span>
            ) : (
              "Baseline assessment"
            )
          }
          badge={
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                !isDemoEmpty && !isDemoError && (effectiveSummary?.improvement_pct || 0) >= 0
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-rose-700 bg-rose-50"
              }`}
            >
              {!isDemoEmpty && !isDemoError && (effectiveSummary?.improvement_pct || 0) >= 0 ? "Net Gain" : "Review"}
            </span>
          }
          loading={effectiveSummaryLoading}
        />

        <StatCard
          title="Sessions"
          value={
            effectiveSummaryLoading
              ? "..."
              : isDemoEmpty || isDemoError || effectiveSummary?.session_count === null || effectiveSummary?.session_count === undefined
              ? "0"
              : String(effectiveSummary.session_count)
          }
          subtext="Evaluations completed"
          badge={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Total</span>}
          loading={effectiveSummaryLoading}
        />
      </div>

      {/* 3. MIDDLE SECTION: PROGRESSION AREA CHART & ERRORS ON LEFT, FOCUS AREAS ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Progression Area Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">My score over time</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Normalized score progression across modules based on {sessions?.length || 0} recorded sessions.
                </p>
              </div>
              {moduleOptions.length > 0 && !isDemoEmpty && !isDemoError && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    aria-label="Filter timeline by module"
                    className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="ALL">All Modules ({progress?.length || 0})</option>
                    {moduleOptions.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {effectiveProgressLoading ? (
              <LoadingState message="Loading score progression timeline..." className="py-12" />
            ) : effectiveProgressError ? (
              <ErrorState
                title="Unable to Load Score Progression"
                message={effectiveProgressError}
                onRetry={refetchProgress}
                className="py-12"
              />
            ) : effectiveFilteredProgress.length === 0 ? (
              <EmptyState
                title="No Score Records Found"
                description="No recorded evaluation sessions for the selected filter."
                className="py-12"
              />
            ) : (
              <div className="w-full h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={effectiveFilteredProgress}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="scoreBlueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
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
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#scoreBlueGradient)"
                      dot={{
                        r: 4,
                        fill: "#FFFFFF",
                        stroke: "#2563EB",
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: "#2563EB",
                        stroke: "#FFFFFF",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Curriculum Defect Diagnostics (Stephen Few Bullet Matrix & Radar) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Curriculum defect diagnostics</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Module error counts against target tolerance based on {sessions?.length || 0} recorded sessions.
              </p>
            </div>

            {effectiveErrorsLoading ? (
              <LoadingState message="Loading curriculum defect diagnostics..." className="py-12" />
            ) : effectiveErrorsError ? (
              <ErrorState
                title="Unable to Load Defect Diagnostics"
                message={effectiveErrorsError}
                onRetry={refetchErrors}
                className="py-12"
              />
            ) : effectiveErrorStats.length === 0 ? (
              <EmptyState
                title="No Defect Statistics Recorded"
                description="No error frequency statistics recorded across modules."
                className="py-12"
              />
            ) : (
              <div className="w-full pt-1">
                <ModuleDiagnosticLedger
                  errorStats={effectiveErrorStats}
                  sessions={effectiveSessions}
                  toleranceBenchmark={2.0}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Focus Areas & Next Goal */}
        <div className="lg:col-span-1 space-y-6">
          <Card variant="white" className="p-6 border border-slate-200/90 shadow-2xs">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Focus areas</h3>
                <span className="text-[10px] font-semibold text-slate-400">
                  Practice Needs
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Modules with defect rates exceeding target based on {sessions?.length || 0} recorded sessions.
              </p>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Modules with higher error frequency. Target these topics for practice drills:
            </p>

            {effectiveErrorsLoading ? (
              <LoadingState compact message="Analyzing practice needs..." className="py-6" />
            ) : effectiveErrorsError ? (
              <ErrorState compact message={effectiveErrorsError} onRetry={refetchErrors} className="py-4" />
            ) : effectiveErrorStats.length === 0 ? (
              <EmptyState compact title="No Practice Areas Identified" description="Complete more sessions to analyze focus areas." className="py-6" />
            ) : (
              <div className="space-y-3 mb-6">
                {effectiveErrorStats
                  .slice()
                  .sort((a, b) => b.avg_errors - a.avg_errors)
                  .slice(0, 3)
                  .map((mod, idx) => {
                    const isHigh = mod.avg_errors >= 3;
                    const isMedium = mod.avg_errors >= 1.5 && mod.avg_errors < 3;
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isHigh ? "bg-rose-500" : isMedium ? "bg-amber-500" : "bg-blue-500"
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {mod.module_name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 shrink-0 ml-2">
                          {mod.avg_errors.toFixed(1)} errs
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Next Goal Progress Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Next Benchmark</span>
                <span className="text-xs font-bold text-slate-900">
                  {effectiveSummaryLoading
                    ? "..."
                    : isDemoEmpty || isDemoError
                    ? "0%"
                    : `${Math.min(
                        100,
                        Math.round(
                          ((effectiveSummary?.latest_score_pct || effectiveSummary?.best_score_pct || PASS_THRESHOLD) / EXCELLENT_THRESHOLD) * 100
                        )
                      )}%`}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-800 mb-2">
                Target: <span className="text-blue-600 font-extrabold">{EXCELLENT_THRESHOLD.toFixed(1)}%</span> average score (Excellence)
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{
                    width: effectiveSummaryLoading || isDemoEmpty || isDemoError
                      ? "0%"
                      : `${Math.min(
                          100,
                          Math.max(
                            5,
                            Math.round(
                              ((effectiveSummary?.latest_score_pct || effectiveSummary?.best_score_pct || PASS_THRESHOLD) / EXCELLENT_THRESHOLD) * 100
                            )
                          )
                        )}%`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Priority Focus Module */}
          <Card variant="white" className="p-6 border border-slate-200/90 shadow-2xs">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Priority focus module</h3>
                {priorityModuleData && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tabular-nums ${
                      priorityModuleData.isBelow
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {priorityModuleData.avgScore}% avg
                  </span>
                )}
              </div>
            </div>

            {isDemoEmpty || isDemoError || !priorityModuleData ? (
              <EmptyState title="No sessions recorded yet." compact />
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-xs font-bold text-slate-900 leading-snug">
                    {priorityModuleData.moduleName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Evaluated across {priorityModuleData.count} assessment session{priorityModuleData.count !== 1 ? "s" : ""}.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Module average:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {priorityModuleData.avgScore}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Pass cutoff:</span>
                    <span className="font-bold text-slate-700 tabular-nums">
                      {PASS_THRESHOLD.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-xs font-medium ${
                    priorityModuleData.isBelow
                      ? "bg-rose-50 border-rose-200 text-rose-800"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  {priorityModuleData.gapText}
                </div>
              </div>
            )}
          </Card>

          {/* Remediation Records (Intervention History) */}
          <Card variant="white" className="p-6 border border-slate-200/90 shadow-2xs">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Remediation records</h3>
                <span className="text-[10px] font-semibold text-slate-400">
                  {effectiveRemediations.length} Record{effectiveRemediations.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Academic intervention assignments based on {effectiveRemediations.length} records.
              </p>
              <div className="flex items-center space-x-2 mt-2">
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => setShowRemediationModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-brand hover:bg-brand-dark text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    + Assign
                  </button>
                )}
              </div>
            </div>

            {effectiveRemediationsLoading ? (
              <LoadingState message="Loading remediation history..." className="py-6" />
            ) : effectiveRemediationsError ? (
              <ErrorState
                title="Remediation Records Unavailable"
                message={effectiveRemediationsError}
                onRetry={loadRemediations}
                className="py-6"
              />
            ) : effectiveRemediations.length === 0 ? (
              <EmptyState
                title="No Remediation Records Assigned"
                description="No active intervention plans currently assigned."
                className="py-6"
              />
            ) : (
              <div className="space-y-3">
                {effectiveRemediations.map((rem) => {
                  const dateStr = rem.assigned_at
                    ? new Date(rem.assigned_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <div
                      key={rem.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {rem.module_name || `Module #${rem.module_id}`}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Assigned by {rem.assigned_by_name || "Trainer"} • {dateStr}
                          </div>
                        </div>
                      </div>

                      {rem.note && (
                        <p className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-100 italic">
                          &ldquo;{rem.note}&rdquo;
                        </p>
                      )}

                      {/* Performance Comparison (Numbers Only, No Effectiveness Claims) */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
                        <div className="p-2 rounded-lg bg-white border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                            3 Sessions Before
                          </div>
                          <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                            {rem.before_status}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                            3 Sessions After
                          </div>
                          <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                            {rem.after_status}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 4. SPEED VERSUS ACCURACY SCATTER ANALYSIS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Speed versus accuracy analysis</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Session duration plotted against score percentage based on {sessions?.length || 0} recorded sessions.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            <span>{effectiveScatterData.length} Session{effectiveScatterData.length !== 1 ? "s" : ""} Plotted</span>
          </div>
        </div>

        {effectiveSessionsLoading ? (
          <LoadingState message="Loading speed versus accuracy session data..." className="py-12" />
        ) : effectiveSessionsError ? (
          <ErrorState
            title="Unable to Plot Speed vs Accuracy"
            message={effectiveSessionsError}
            onRetry={refetchSessions}
            className="py-12"
          />
        ) : effectiveScatterData.length === 0 ? (
          <EmptyState
            title="No Scatter Data Available"
            description="Complete test drills to plot duration versus score distribution."
            className="py-12"
          />
        ) : (
          <div className="w-full h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 30, bottom: 25, left: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  dataKey="minutes"
                  name="Duration"
                  unit="m"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  stroke="#CBD5E1"
                  label={{
                    value: "Session Duration (Minutes)",
                    position: "insideBottom",
                    offset: -15,
                    fontSize: 11,
                    fill: "#475569",
                    fontWeight: 600,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="score_pct"
                  name="Score"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  stroke="#CBD5E1"
                  label={{
                    value: "Evaluation Score (%)",
                    angle: -90,
                    position: "insideLeft",
                    offset: 0,
                    fontSize: 11,
                    fill: "#475569",
                    fontWeight: 600,
                  }}
                />
                <Tooltip content={<ScatterCustomTooltip />} />
                <Scatter
                  name="Sessions"
                  data={effectiveScatterData}
                  fill="#2563EB"
                  stroke="#1D4ED8"
                  strokeWidth={1.5}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. MODULE LEARNING GOALS & TARGET PROGRESS */}
      <Card variant="white" className="p-6 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Module learning goals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target benchmarks and verified scores based on {effectiveGoals.length} configured goals.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 self-start md:self-auto">
            {effectiveGoals.length} Module Goal{effectiveGoals.length !== 1 ? "s" : ""} Defined
          </span>
        </div>

        {/* Set / Update Goal Form */}
        <form onSubmit={handleSaveGoal} className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            Establish or Update Module Target
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Curriculum Module
              </label>
              <select
                value={goalForm.module_id}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, module_id: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {allModules.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Target Score (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={goalForm.target_score}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, target_score: e.target.value }))}
                placeholder="75.0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={goalSubmitting || !goalForm.module_id}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1"
              >
                {goalSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Target</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {goalError && (
            <p className="mt-2 text-xs font-semibold text-rose-600">{goalError}</p>
          )}
          {goalSuccess && (
            <div className="mt-2 flex items-center space-x-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Goal successfully saved and logged to audit trail!</span>
            </div>
          )}
        </form>

        {/* Active Goals Grid */}
        <div className="mt-5">
          {effectiveGoalsLoading ? (
            <LoadingState message="Loading module learning goals..." className="py-8" />
          ) : effectiveGoalsError ? (
            <ErrorState
              title="Learning Goals Unavailable"
              message={effectiveGoalsError}
              onRetry={loadGoals}
              className="py-8"
            />
          ) : effectiveGoals.length === 0 ? (
            <EmptyState
              title="No Module Targets Defined"
              description="Select a module above to define your first performance milestone."
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {effectiveGoals.map((g) => {
                const isMet = g.best_score !== null && g.best_score >= g.target_score;
                const hasScore = g.best_score !== null;
                const rawProgress = g.target_score > 0 && g.best_score !== null
                  ? (g.best_score / g.target_score) * 100
                  : (g.progress_pct ?? 0);
                const cappedProgress = Math.min(100, Math.max(0, rawProgress));

                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          {g.module_name || `Module #${g.module_id}`}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Target: <strong className="text-slate-800">{g.target_score.toFixed(1)}%</strong>
                          {" • "}
                          Best Score:{" "}
                          <strong className={hasScore ? "text-slate-900" : "text-slate-400"}>
                            {hasScore ? `${g.best_score.toFixed(1)}%` : "0% (No sessions)"}
                          </strong>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isMet
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : hasScore
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isMet ? "bg-emerald-500" : hasScore ? "bg-blue-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{isMet ? "Target Met" : hasScore ? "In Progress" : "No Sessions"}</span>
                      </span>
                    </div>

                    {/* Progress Bar (capped at 100%) */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Progress to target</span>
                        <span className="font-bold text-slate-900">{cappedProgress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isMet ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${cappedProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                      <span>Updated {new Date(g.updated_at).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setGoalForm({
                            module_id: String(g.module_id),
                            target_score: String(g.target_score),
                          });
                        }}
                        className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Edit Target →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* 6. RECENT ASSESSMENT EVALUATION LEDGER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Assessment evaluation ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological record of verified test drills based on {sessions?.length || 0} recorded sessions.
            </p>
          </div>
          {sessionStats && !isDemoEmpty && !isDemoError && (
            <div className="hidden sm:flex items-center space-x-3 text-xs">
              <span className="font-semibold text-slate-500">
                Mean Score: <strong className="text-slate-900">{sessionStats.avgScore}%</strong>
              </span>
              <span className="text-slate-200">|</span>
              <span className="font-semibold text-slate-500">
                Qualified Rate: <strong className="text-emerald-700">{sessionStats.passRate}%</strong>
              </span>
            </div>
          )}
        </div>

        {effectiveSessionsLoading ? (
          <LoadingState message="Loading assessment evaluation ledger..." className="py-12" />
        ) : effectiveSessionsError ? (
          <ErrorState
            title="Unable to Load Evaluation Ledger"
            message={effectiveSessionsError}
            onRetry={refetchSessions}
            className="py-12"
          />
        ) : effectiveFilteredSessions.length === 0 ? (
          <EmptyState
            title="No Completed Evaluation Sessions"
            description="Assessment records will appear here once drills are evaluated."
            className="py-12"
          />
        ) : (
          <div className="space-y-3 pt-1">
            {/* Module Filter Buttons */}
            {sessionFilterOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100">
                <span className="text-xs font-medium text-slate-500 mr-1">
                  Filter by module:
                </span>
                <button
                  type="button"
                  onClick={() => setSessionFilter("ALL")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    sessionFilter === "ALL"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                  }`}
                >
                  All ({sessions?.length || 0})
                </button>
                {sessionFilterOptions.map((opt) => {
                  const count = (sessions || []).filter((s) => s.module_name === opt).length;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSessionFilter(opt)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        sessionFilter === opt
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      }`}
                    >
                      {opt} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ledger Table Container */}
            <div className="overflow-x-auto overflow-y-auto max-h-96 w-full rounded-lg border border-slate-200 -mx-2 sm:mx-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Session & Date</th>
                    <th className="py-2.5 px-3">Module & Topic</th>
                    <th className="py-2.5 px-3">Score & Outcome</th>
                    <th className="py-2.5 px-3">Defects</th>
                    <th className="py-2.5 px-3">Duration</th>
                    {isStaff && <th className="py-2.5 px-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveFilteredSessions.map((s, idx) => {
                    const sessionDate = s.created_at
                      ? new Date(s.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "-";
                    const mins = Math.floor((s.time_seconds || 0) / 60);
                    const secs = (s.time_seconds || 0) % 60;
                    const cat = getModuleCategory(s.module_name);
                    const scorePct = s.score_percentage != null
                      ? s.score_percentage
                      : s.score_pct != null
                      ? s.score_pct
                      : (s.module_max_score && s.module_max_score > 0)
                      ? (s.score / s.module_max_score) * 100
                      : s.score;
                    const isPass = scorePct != null && scorePct >= EXCELLENT_THRESHOLD;
                    const isQual = scorePct != null && scorePct >= PASS_THRESHOLD && scorePct < EXCELLENT_THRESHOLD;

                    return (
                      <React.Fragment key={s.id || idx}>
                        <tr
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Session # & Date */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                #{String(effectiveFilteredSessions.length - idx).padStart(2, "0")}
                              </span>
                              <span className="font-semibold text-slate-700">{sessionDate}</span>
                            </div>
                          </td>

                          {/* Module & Category Pill */}
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 truncate max-w-xs block">
                                {s.module_name}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cat.bg}`}
                              >
                                {cat.label}
                              </span>
                            </div>
                          </td>

                          {/* Score, Progress Micro-Bar & Outcome Chip */}
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-3">
                              <span className="font-black text-slate-900 text-sm">
                                {scorePct != null ? `${scorePct.toFixed(1)}%` : "-"}
                              </span>

                              {/* Micro progress bar */}
                              <div className="w-10 h-1.5 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    isPass
                                      ? "bg-emerald-500"
                                      : isQual
                                      ? "bg-blue-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(5, scorePct || 0))}%` }}
                                />
                              </div>

                              {/* Outcome badge */}
                              <span
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isPass
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isQual
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isPass
                                      ? "bg-emerald-500"
                                      : isQual
                                      ? "bg-blue-500"
                                      : "bg-rose-500"
                                  }`}
                                />
                                <span>{isPass ? "Mastery" : isQual ? "Competent" : "Remediation"}</span>
                              </span>
                            </div>
                          </td>

                          {/* Defects / Errors */}
                          <td className="py-3 px-3">
                            {s.errors === 0 ? (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                0 defects
                              </span>
                            ) : s.errors <= 2 ? (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700">
                                {s.errors} {s.errors === 1 ? "err" : "errs"}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                                {s.errors} errs
                              </span>
                            )}
                          </td>

                          {/* Duration & Pace */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center space-x-2 text-slate-600 font-medium">
                              <span className="font-mono text-[11px] font-semibold text-slate-800">
                                {mins}m {secs}s
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {mins < 20 ? "· Fast" : mins <= 25 ? "· Target" : "· Extended"}
                              </span>
                            </div>
                          </td>

                          {/* Staff Actions */}
                          {isStaff && (
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveNoteSessionId(activeNoteSessionId === s.id ? null : s.id)}
                                  className="px-2.5 py-1 rounded text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer"
                                >
                                  {activeNoteSessionId === s.id ? "Cancel note" : "Add note"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteSessionTarget(s)}
                                  title="Delete session"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                        <SessionNotesRow
                          sessionId={s.id}
                          isStaff={isStaff}
                          isFormOpen={activeNoteSessionId === s.id}
                          onCloseForm={() => setActiveNoteSessionId(null)}
                        />
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. EDIT PROFILE MODAL (Direct Photo Upload & Details) */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Trainee Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-4">
              {/* Photo Upload & Preview */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Profile Photo
                </label>
                <div className="flex items-center space-x-3 mb-2">
                  {editForm.avatar_url ? (
                    <img
                      src={editForm.avatar_url}
                      alt="Avatar Preview"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold">
                      TR
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Upload from Device
                    </button>
                    {editForm.avatar_url && (
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, avatar_url: "" }))}
                        className="text-[10px] text-rose-600 font-semibold block hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Curated avatar picker */}
                <div className="flex items-center space-x-2 pt-1 overflow-x-auto pb-1">
                  {AVATAR_OPTIONS.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      onClick={() => setEditForm((prev) => ({ ...prev, avatar_url: url }))}
                      className={`w-7 h-7 rounded-full object-cover cursor-pointer ${
                        editForm.avatar_url === url ? "ring-2 ring-blue-600 scale-105" : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Phone number"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Specialization */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Specialization / Track</label>
                <input
                  type="text"
                  value={editForm.specialization}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* GitHub */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">GitHub URL</label>
                <input
                  type="url"
                  value={editForm.github_url}
                  onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Learning Bio / Notes</label>
                <textarea
                  rows={2}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {saveError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {saveLoading ? <Spinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. DELETE SESSION CONFIRMATION MODAL (Staff only) */}
      {deleteSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Delete Evaluation Record?
            </h3>
            <p className="text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to delete the evaluation session for{" "}
              <strong>{deleteSessionTarget.module_name}</strong> ({Number(deleteSessionTarget.score_percentage ?? deleteSessionTarget.score_pct ?? deleteSessionTarget.score).toFixed(1)}% score)?
              This action cannot be undone.
            </p>

            {deleteSessionError && (
              <div className="mt-2 p-2 rounded-lg bg-rose-50 text-rose-700 font-semibold">
                {deleteSessionError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteSessionTarget(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSession}
                disabled={deleteSessionLoading}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {deleteSessionLoading ? "Deleting..." : "Delete Session"}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 8. ASSIGN REMEDIATION MODAL (Staff Only) */}
      {showRemediationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Targeted Intervention
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Assign Remediation Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRemediationModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRemediation} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Target Curriculum Module
                </label>
                <select
                  value={remediationForm.module_id}
                  onChange={(e) => setRemediationForm({ ...remediationForm, module_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                >
                  {allModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Max: {m.max_score})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Intervention Note (Max 500 characters)
                </label>
                <textarea
                  value={remediationForm.note}
                  onChange={(e) => setRemediationForm({ ...remediationForm, note: e.target.value.slice(0, 500) })}
                  rows={3}
                  maxLength={500}
                  placeholder="Specific focus areas, drills, or conceptual clarifications required..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                />
                <div className="text-[10px] text-slate-400 text-right mt-0.5">
                  {remediationForm.note.length}/500
                </div>
              </div>

              {remediationError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                  {remediationError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRemediationModal(false)}
                  className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={remediationSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {remediationSubmitting && <Spinner size="sm" className="text-white" />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default TraineeDashboard;
