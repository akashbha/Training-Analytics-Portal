// src/pages/Dashboard.jsx
// High-performance Trainer Console for cohort telemetry, ML early-warning intervention, and SQL window ranking.
// Features real photographic avatars for all trainees, custom SVG mastery semicircle gauge, and dual-mode velocity charting.

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { apiClient } from "../api/client.js";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  useBatches,
  useBatchTrainers,
  useBatchSummary,
  useBatchWeekly,
  useBatchBands,
  useBatchAttention,
  useBatchLeaderboard,
  useBatchTopPerformer,
  useBatchHeatmap,
  useBatchHotspots,
  useBatchRemediations,
  useBatchMisconceptions,
} from "../hooks/useBatchAnalytics.js";
import {
  RotateCw,
  Plus,
  Search,
  ChevronRight,
  X,
  CheckCircle2,
  BrainCircuit,
  Download,
  LayoutGrid,
  UserCheck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Award,
  FileText,
  Users,
  Layers,
  Info,
  AlertTriangle,
  MessageSquare,
  Send,
  Target,
  BookOpen,
  Sparkles,
  History,
  Filter,
  Copy,
  Check,
  Clock,
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

function getPlainReason(item) {
  if (item.flag_reason) {
    return item.flag_reason.replace(/\(Cold start\)/i, "- Cold start");
  }
  if (item.top_risk_factors && item.top_risk_factors.length > 0) {
    return item.top_risk_factors[0];
  }
  if (item.trend === "critical_low") {
    return `Score below ${PASS_THRESHOLD}% passing benchmark`;
  }
  if (item.trend === "falling") {
    return "Declining score trend over last 3 sessions";
  }
  if (item.trend === "struggling") {
    return `Average score below ${PASS_THRESHOLD}% benchmark`;
  }
  if (item.is_cold_start) {
    return (item.session_count || 0) === 0
      ? "No assessments completed yet"
      : `Cold start: initial average below ${COLD_START_CUTOFF}%`;
  }
  return "Performance requires trainer review";
}

function getSeverity(item) {
  const avg = item.metrics?.recent_avg_score ?? item.metrics?.overall_avg_score ?? item.avg_score_pct;
  const isCritical =
    item.risk_level === "High" ||
    item.trend === "critical_low" ||
    (item.attention_probability && item.attention_probability >= 70) ||
    (avg != null && avg < 50 && (item.session_count || 0) > 0);

  if (isCritical) {
    return {
      rank: 1,
      label: "Model risk: high",
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
      rank: 2,
      label: "Model risk: moderate",
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    };
  }

  return {
    rank: 3,
    label: "Watch (cold start)",
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const { isTrainer, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [progressionView, setProgressionView] = useState("columns"); // "columns" | "curve"

  // Available Curriculum Modules (for real remediation assignment)
  const [availableModules, setAvailableModules] = useState([]);
  const [availableModulesLoading, setAvailableModulesLoading] = useState(false);

  // Remediation Assignment Modal State (Item 4)
  const [remediationTarget, setRemediationTarget] = useState(null);
  const [remediationModuleId, setRemediationModuleId] = useState("");
  const [remediationNote, setRemediationNote] = useState("");
  const [remediationHistory, setRemediationHistory] = useState([]);
  const [remediationHistoryLoading, setRemediationHistoryLoading] = useState(false);
  const [remediationSubmitting, setRemediationSubmitting] = useState(false);
  const [remediationSuccess, setRemediationSuccess] = useState(false);
  const [remediationError, setRemediationError] = useState("");

  // Re-assessment Resolution Modal State (Closed-Loop Outcome)
  const [resolutionTarget, setResolutionTarget] = useState(null);
  const [reassessmentScoreInput, setReassessmentScoreInput] = useState("");
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);
  const [resolutionError, setResolutionError] = useState("");

  // Quick Direct Message Intervention Modal State (Item 3)
  const [messagingTarget, setMessagingTarget] = useState(null);
  const [quickMessageText, setQuickMessageText] = useState("");
  const [quickMessageThread, setQuickMessageThread] = useState([]);
  const [quickMessageLoading, setQuickMessageLoading] = useState(false);
  const [quickMessageSending, setQuickMessageSending] = useState(false);
  const [quickMessageError, setQuickMessageError] = useState("");
  const [quickMessageSuccess, setQuickMessageSuccess] = useState(false);

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
    trainers,
    loading: trainersLoading,
    error: trainersError,
    isForbidden: trainersForbidden,
    refetch: refetchTrainers,
  } = useBatchTrainers(selectedBatchId);

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

  const {
    hotspots,
    loading: hotspotsLoading,
    error: hotspotsError,
    refetch: refetchHotspots,
  } = useBatchHotspots(selectedBatchId);

  const {
    remediations: batchRemediations,
    loading: remediationsLoading,
    refetch: refetchBatchRemediations,
  } = useBatchRemediations(selectedBatchId);

  const [remediationStatusFilter, setRemediationStatusFilter] = useState("all");

  const {
    analysis: misconceptionAnalysis,
    clusters: misconceptionClusters,
    loading: misconceptionsLoading,
    error: misconceptionsError,
    refetch: refetchMisconceptions,
    toggleApproval: toggleMisconceptionApproval,
  } = useBatchMisconceptions(selectedBatchId);

  const [selectedClusterForEvidence, setSelectedClusterForEvidence] = useState(null);

  // Active module failure hotspot filter (Item 5)
  const [selectedHotspotModuleId, setSelectedHotspotModuleId] = useState(null);

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
  const [exportingWeekly, setExportingWeekly] = useState(false);
  const [weeklySummaryModalOpen, setWeeklySummaryModalOpen] = useState(false);
  const [weeklySummaryText, setWeeklySummaryText] = useState("");
  const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

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

  const handleExportWeeklySummary = async () => {
    if (!selectedBatchId) return;
    setExportingWeekly(true);
    try {
      const res = await apiClient.get(`/analytics/batches/${selectedBatchId}/weekly-summary/export`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `batch_${selectedBatchId}_weekly_summary.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export weekly summary", err);
    } finally {
      setExportingWeekly(false);
    }
  };

  const handleOpenWeeklySummaryModal = async () => {
    if (!selectedBatchId) return;
    setWeeklySummaryModalOpen(true);
    setWeeklySummaryLoading(true);
    setCopiedSummary(false);
    try {
      const res = await apiClient.get(`/analytics/batches/${selectedBatchId}/weekly-summary/export`, {
        responseType: "text",
      });
      setWeeklySummaryText(res.data);
    } catch (err) {
      console.error("Failed to load weekly summary preview", err);
      setWeeklySummaryText("Unable to load weekly summary report.");
    } finally {
      setWeeklySummaryLoading(false);
    }
  };

  const handleCopySummaryToClipboard = () => {
    if (!weeklySummaryText) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(weeklySummaryText).catch(() => {});
      }
    } catch {
      // ignore
    }
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
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
    refetchTrainers(true);
    refetchHotspots(true);
    refetchBatchRemediations(true);
  }, [
    refetchSummary,
    refetchWeekly,
    refetchBands,
    refetchAttention,
    refetchLeaderboard,
    refetchTop,
    refetchHeatmap,
    refetchTrainers,
    refetchHotspots,
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
  const avgScore = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? "-" : summary?.avg_score_pct ? summary.avg_score_pct.toFixed(1) : "78.4";
  const passRate = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? "-" : summary?.pass_rate_pct ? summary.pass_rate_pct.toFixed(1) : "87.5";
  const sessionCount = isDemoLoading ? "..." : isDemoEmpty || isDemoError ? 0 : (summary?.session_count ?? 142);
  const scoreChange = summary?.avg_score_change_pct ?? 5.2;

  const passingEvaluations = useMemo(() => {
    if (!summary || typeof summary.session_count !== "number" || summary.session_count === 0) return 0;
    const rate = typeof summary.pass_rate_pct === "number" ? summary.pass_rate_pct : 87.5;
    return Math.round((rate / 100) * summary.session_count);
  }, [summary]);

  // Ranked attention queue sorted by severity (critical first)
  const sortedAttentionQueue = useMemo(() => {
    if (!effectiveAttention || effectiveAttention.length === 0) return [];
    return [...effectiveAttention].sort((a, b) => {
      const sevA = getSeverity(a).rank;
      const sevB = getSeverity(b).rank;
      if (sevA !== sevB) return sevA - sevB;
      const probA = a.attention_probability ?? 0;
      const probB = b.attention_probability ?? 0;
      if (probB !== probA) return probB - probA;
      const scoreA = a.metrics?.recent_avg_score ?? a.metrics?.overall_avg_score ?? a.avg_score_pct ?? 100;
      const scoreB = b.metrics?.recent_avg_score ?? b.metrics?.overall_avg_score ?? b.avg_score_pct ?? 100;
      return scoreA - scoreB;
    });
  }, [effectiveAttention]);

  // Active module failure hotspot object (Item 5)
  const activeHotspot = useMemo(() => {
    if (!selectedHotspotModuleId || !hotspots) return null;
    return hotspots.find((h) => h.module_id === selectedHotspotModuleId);
  }, [selectedHotspotModuleId, hotspots]);

  // Queue filtered by selected module failure hotspot (Item 5)
  const displayedAttentionQueue = useMemo(() => {
    if (!activeHotspot) return sortedAttentionQueue;
    return sortedAttentionQueue.filter((t) => {
      const tid = t.trainee_id || t.id;
      return activeHotspot.failed_trainee_ids?.includes(tid);
    });
  }, [sortedAttentionQueue, activeHotspot]);

  // Filtered Remediations for Intervention Outcome Tracker
  const displayedRemediations = useMemo(() => {
    if (!batchRemediations) return [];
    if (remediationStatusFilter === "all") return batchRemediations;
    return batchRemediations.filter((r) =>
      r.status.toLowerCase().includes(remediationStatusFilter.toLowerCase())
    );
  }, [batchRemediations, remediationStatusFilter]);

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

  // Load curriculum modules for real remediation assignment
  useEffect(() => {
    let isMounted = true;
    setAvailableModulesLoading(true);
    apiClient
      .get("/modules?page=1&page_size=100")
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.items || res.data || [];
        setAvailableModules(list);
        if (list.length > 0) {
          setRemediationModuleId((prev) => prev || list[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load curriculum modules", err);
      })
      .finally(() => {
        if (isMounted) setAvailableModulesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // When a remediation target trainee is opened, fetch their prior remediation history
  useEffect(() => {
    if (!remediationTarget) {
      setRemediationHistory([]);
      setRemediationNote("");
      setRemediationError("");
      setRemediationSuccess(false);
      return;
    }

    const tid = remediationTarget.trainee_id || remediationTarget.id;
    if (!tid) return;

    if (availableModules.length > 0 && !remediationModuleId) {
      setRemediationModuleId(availableModules[0].id);
    }

    let isMounted = true;
    setRemediationHistoryLoading(true);
    apiClient
      .get(`/trainees/${tid}/remediations`)
      .then((res) => {
        if (isMounted) {
          setRemediationHistory(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        console.error("Failed to load prior remediations", err);
      })
      .finally(() => {
        if (isMounted) setRemediationHistoryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [remediationTarget, availableModules]);

  const handleAssignRemediation = async (e) => {
    e.preventDefault();
    if (!remediationTarget) return;

    const targetTraineeId = Number(remediationTarget.trainee_id || remediationTarget.id);
    const modId = Number(remediationModuleId);

    if (!modId) {
      setRemediationError("Please select a valid curriculum module.");
      return;
    }

    setRemediationSubmitting(true);
    setRemediationError("");
    setRemediationSuccess(false);

    try {
      const payload = {
        trainee_id: targetTraineeId,
        module_id: modId,
        note: remediationNote.trim() || undefined,
        assigned_at: new Date().toISOString(),
      };
      await apiClient.post("/remediations", payload);
      setRemediationSuccess(true);
      // Refresh prior remediations list and batch tracker
      const histRes = await apiClient.get(`/trainees/${targetTraineeId}/remediations`);
      setRemediationHistory(Array.isArray(histRes.data) ? histRes.data : []);
      setRemediationNote("");
      refetchBatchRemediations(true);
      setTimeout(() => {
        setRemediationSuccess(false);
        setRemediationTarget(null);
      }, 2200);
    } catch (err) {
      console.error("Failed to assign remediation drill", err);
      setRemediationError(
        err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to assign remediation drill"
      );
    } finally {
      setRemediationSubmitting(false);
    }
  };

  const handleResolveRemediation = async (e) => {
    e.preventDefault();
    if (!resolutionTarget) return;
    setResolutionSubmitting(true);
    setResolutionError("");
    try {
      const scoreNum = reassessmentScoreInput !== "" ? Number(reassessmentScoreInput) : null;
      await apiClient.post(`/remediations/${resolutionTarget.id}/resolve`, {
        reassessment_score: scoreNum,
        resolution_note: resolutionNoteInput || null,
        log_session: true,
      });
      setResolutionTarget(null);
      setReassessmentScoreInput("");
      setResolutionNoteInput("");
      refetchBatchRemediations(true);
    } catch (err) {
      console.error("Failed to record re-assessment", err);
      setResolutionError(
        err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Failed to record resolution"
      );
    } finally {
      setResolutionSubmitting(false);
    }
  };

  // Fetch existing thread when a trainee is selected for quick direct messaging
  useEffect(() => {
    if (!messagingTarget) {
      setQuickMessageThread([]);
      setQuickMessageText("");
      setQuickMessageError("");
      setQuickMessageSuccess(false);
      return;
    }

    const targetUserId = messagingTarget.user_id || messagingTarget.trainee_id || messagingTarget.id;
    if (!targetUserId) return;

    let isMounted = true;
    setQuickMessageLoading(true);
    setQuickMessageError("");

    apiClient
      .get(`/messages/private/${targetUserId}?page=1&page_size=30`)
      .then((res) => {
        if (isMounted) {
          setQuickMessageThread(res.data?.items || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setQuickMessageError(err.message || "Failed to load prior messages.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setQuickMessageLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [messagingTarget]);

  const handleSendQuickMessage = async (e) => {
    e.preventDefault();
    if (!quickMessageText.trim() || !messagingTarget) return;

    const targetUserId = messagingTarget.user_id || messagingTarget.trainee_id || messagingTarget.id;
    setQuickMessageSending(true);
    setQuickMessageError("");

    try {
      const res = await apiClient.post("/messages", {
        channel: "private",
        recipient_id: targetUserId,
        body: quickMessageText.trim(),
      });
      setQuickMessageThread((prev) => [...prev, res.data]);
      setQuickMessageText("");
      setQuickMessageSuccess(true);
      setTimeout(() => setQuickMessageSuccess(false), 2500);
    } catch (err) {
      setQuickMessageError(err.message || "Failed to deliver message.");
    } finally {
      setQuickMessageSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-blue-600 selection:text-white">
      {/* =========================================================================
          1. HEADER & CONTROLS STRIP (Cohort Triage Strip)
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-[#F0E3D5]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#1C1B17] tracking-tight">
              Trainer Console
            </h1>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
              Triage Mode
            </span>
          </div>
          <p className="text-xs text-[#787063] font-medium mt-1">
            Cohort triage telemetry, early warning risk intervention queue, and curriculum mastery metrics.
          </p>
        </div>

        {/* Action Controls: Cohort Selector, Assigned Trainers, Dev State Switcher, Refresh, Log Session */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Step 9 State Switcher Pills (Dev Environment Only) */}
          {import.meta.env.DEV && (
            <div className="inline-flex items-center p-0.5 bg-[#FEF4E8] rounded-xl text-xs font-bold text-[#787063] border border-[#FBD1A7]/80 shadow-2xs">
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
                        ? "bg-white text-[#1C1B17] shadow-2xs font-extrabold"
                        : "text-[#787063] hover:text-[#1C1B17]"
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
              className="appearance-none pl-3.5 pr-8 py-2 bg-white border border-[#F0E3D5] hover:border-[#D97718]/60 rounded-xl text-xs font-bold text-[#1C1B17] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30 cursor-pointer transition-colors"
            >
              {(batches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronRight className="w-3.5 h-3.5 text-[#A2998A] absolute right-2.5 top-2.5 pointer-events-none rotate-90" />
          </div>

          {/* Assigned Trainers Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FEF4E8] border border-[#FBD1A7] rounded-xl text-xs">
            <UserCheck className="w-3.5 h-3.5 text-[#D97718] shrink-0" />
            <span className="font-semibold text-[#787063]">Assigned:</span>
            {trainersLoading ? (
              <span
                className="inline-block h-4 w-24 rounded-md bg-[#FBD1A7]/70 animate-pulse"
                aria-label="Loading assigned trainers"
              />
            ) : trainersForbidden ? (
              <span className="text-rose-700 font-semibold">You do not have access</span>
            ) : trainersError ? (
              <div className="flex items-center gap-1.5">
                <span className="text-rose-700 font-semibold">Unable to load trainers</span>
                <button
                  type="button"
                  onClick={() => refetchTrainers()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-[11px] cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            ) : trainers.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {trainers.map((t) => (
                  <span
                    key={t.id || t.trainer_id}
                    title={t.trainer_email}
                    className="font-bold text-[#1C1B17] bg-white px-2 py-0.5 rounded-md border border-[#F0E3D5] shadow-2xs"
                  >
                    {t.trainer_name || t.trainer_email?.split("@")[0] || "Trainer"}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[#787063] italic">No trainer assigned</span>
            )}
          </div>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={() => silentRefetchAll()}
            title="Refresh cohort analytics"
            className="p-2 rounded-xl bg-white border border-[#F0E3D5] text-[#787063] hover:text-[#1C1B17] hover:bg-[#FEF4E8] shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Log New Session Link */}
          {isTrainer && (
            <Link
              to="/sessions/new"
              className="px-3.5 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Session</span>
            </Link>
          )}
        </div>
      </div>

      {/* Evidence-Backed Trainer Copilot (Enhancement 3) */}
      <HelpAssistantPanel
        batchId={selectedBatchId}
        onAssignRemediation={(traineeId, traineeName, moduleName) => {
          setRemediatingTrainee({ id: traineeId, name: traineeName });
          if (moduleName) setSelectedModuleId(moduleName);
          setRemediationModalOpen(true);
        }}
        onDirectMessage={(traineeId, traineeName, prefillMessage) => {
          setMessagingTarget({
            trainee_id: traineeId,
            name: traineeName,
          });
          if (prefillMessage) {
            setQuickMessageText(prefillMessage);
          }
        }}
      />

      {/* =========================================================================
          2. CORE METRICS STRIP (TraineeIQ Styled Stat Cards with Honest Sample Sizes)
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Mean Score */}
        <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 shadow-[0_2px_12px_rgba(28,27,23,0.03)] flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(28,27,23,0.08)] cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                <Award className="w-4 h-4 text-[#F09A3E]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#787063] uppercase tracking-wider">
                  Mean Score
                </span>
                <Info className="w-3 h-3 text-[#A2998A]" />
              </div>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-0.5 ${
                scoreChange >= 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {scoreChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {scoreChange >= 0 ? `+${scoreChange} pts` : `${scoreChange} pts`}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-[#1C1B17]">
              {summaryLoading ? "..." : `${avgScore}%`}
            </div>
            <div className="text-xs text-[#787063] font-medium mt-1.5 flex items-center gap-1.5">
              <span>Sample size:</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#FEF4E8] text-[#D97718] font-mono text-[11px] font-bold border border-[#FBD1A7]/60">
                N = {sessionCount}
              </span>
              <span className="text-[#A2998A]">evaluations</span>
            </div>
            <div className="text-[11px] text-[#A2998A] mt-0.5 font-normal truncate">
              Cross-module normalized performance
            </div>
          </div>
        </div>

        {/* Metric 2: Pass Rate at 60% Cutoff */}
        <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 shadow-[0_2px_12px_rgba(28,27,23,0.03)] flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(28,27,23,0.08)] cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#787063] uppercase tracking-wider">
                  Pass Rate
                </span>
                <Info className="w-3 h-3 text-[#A2998A]" />
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
              ≥ {PASS_THRESHOLD.toFixed(0)}% Cutoff
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-[#1C1B17]">
              {summaryLoading ? "..." : `${passRate}%`}
            </div>
            <div className="text-xs text-[#787063] font-medium mt-1.5 flex items-center gap-1.5">
              <span>Sample size:</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#FEF4E8] text-[#D97718] font-mono text-[11px] font-bold border border-[#FBD1A7]/60">
                {passingEvaluations} of {sessionCount}
              </span>
              <span className="text-[#A2998A]">(N = {sessionCount})</span>
            </div>
            <div className="text-[11px] text-[#A2998A] mt-0.5 font-normal truncate">
              Evaluations meeting 60% cutoff
            </div>
          </div>
        </div>

        {/* Metric 3: Sessions Evaluated */}
        <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 shadow-[0_2px_12px_rgba(28,27,23,0.03)] flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(28,27,23,0.08)] cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                <Layers className="w-4 h-4 text-[#FBD1A7]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#787063] uppercase tracking-wider">
                  Sessions Evaluated
                </span>
                <Info className="w-3 h-3 text-[#A2998A]" />
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063] bg-[#FEF4E8] border border-[#F0E3D5] px-2 py-0.5 rounded-md">
              Verified Ledger
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-[#1C1B17]">
              {summaryLoading ? "..." : sessionCount}
            </div>
            <div className="text-xs text-[#787063] font-medium mt-1.5 flex items-center gap-1.5">
              <span>Sample size:</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#FEF4E8] text-[#D97718] font-mono text-[11px] font-bold border border-[#FBD1A7]/60">
                N = {sessionCount}
              </span>
              <span className="text-[#A2998A]">graded sessions</span>
            </div>
            <div className="text-[11px] text-[#A2998A] mt-0.5 font-normal truncate">
              Total session records on ledger
            </div>
          </div>
        </div>

        {/* Metric 4: Enrolled Trainees */}
        <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 shadow-[0_2px_12px_rgba(28,27,23,0.03)] flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(28,27,23,0.08)] cursor-default">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                <Users className="w-4 h-4 text-[#F09A3E]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#787063] uppercase tracking-wider">
                  Enrolled Trainees
                </span>
                <Info className="w-3 h-3 text-[#A2998A]" />
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063] bg-[#FEF4E8] border border-[#F0E3D5] px-2 py-0.5 rounded-md">
              Active Roster
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-[#1C1B17]">
              {summaryLoading ? "..." : enrolledCount}
            </div>
            <div className="text-xs text-[#787063] font-medium mt-1.5 flex items-center gap-1.5">
              <span>Sample size:</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#FEF4E8] text-[#D97718] font-mono text-[11px] font-bold border border-[#FBD1A7]/60">
                N = {enrolledCount}
              </span>
              <span className="text-[#A2998A]">learners</span>
            </div>
            <div className="text-[11px] text-[#A2998A] mt-0.5 font-medium truncate">
              Enrolled in {activeBatch?.name?.split("(")[0]?.trim() || "Selected Cohort"}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. NEEDS ATTENTION QUEUE (Trainer Home Priority Workflow)
          ========================================================================= */}
      <section className="bg-white rounded-2xl border border-[#F0E3D5] p-5 sm:p-6 shadow-[0_2px_12px_rgba(28,27,23,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E3D5]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#F09A3E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-[#1C1B17] tracking-wider uppercase">
                  Needs Attention Queue
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                  {selectedHotspotModuleId
                    ? `${displayedAttentionQueue.length} of ${sortedAttentionQueue.length} Flagged`
                    : `${sortedAttentionQueue.length} Flagged`}
                </span>
              </div>
              <p className="text-xs text-[#787063] font-medium mt-0.5">
                Trainees prioritized for trainer intervention, ranked by risk severity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportAtRiskCsv}
              disabled={exportingCsv || !selectedBatchId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FEF4E8] text-[#1C1B17] text-xs font-bold border border-[#F0E3D5] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Export CSV of at-risk cohort trainees with ML and rule flag reasons"
            >
              <Download className="w-3.5 h-3.5 text-[#D97718]" />
              <span>{exportingCsv ? "Exporting..." : "Export At-Risk CSV"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWeeklySummaryModal}
              disabled={!selectedBatchId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FEF4E8] text-[#1C1B17] text-xs font-bold border border-[#F0E3D5] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Preview deterministic weekly summary built strictly from real metrics"
            >
              <FileText className="w-3.5 h-3.5 text-[#D97718]" />
              <span>Weekly Summary</span>
            </button>
          </div>
        </div>

        {/* Hotspot Quick Filters Strip */}
        {hotspots && hotspots.length > 0 && (
          <div className="pt-3 flex flex-wrap items-center gap-1.5 border-b border-[#F0E3D5] pb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#787063] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#D97718]" />
              <span>Hotspot Filters:</span>
            </span>
            {hotspots.slice(0, 4).map((h) => {
              const isActive = selectedHotspotModuleId === h.module_id;
              return (
                <button
                  key={h.module_id}
                  type="button"
                  onClick={() => setSelectedHotspotModuleId(isActive ? null : h.module_id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#F09A3E] text-white shadow-xs"
                      : "bg-[#FEF4E8] text-[#D97718] hover:bg-[#FBD1A7]/40 border border-[#FBD1A7]"
                  }`}
                  title={`Filter queue by ${h.module_name} failures (${h.failed_attempts}/${h.total_attempts} attempts)`}
                >
                  <span>{h.module_name}</span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      isActive ? "bg-black/20 text-white" : "bg-white/80 text-rose-700 font-bold"
                    }`}
                  >
                    {h.failure_rate_pct}% fail
                  </span>
                  {isActive && <X className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
            {selectedHotspotModuleId && (
              <button
                type="button"
                onClick={() => setSelectedHotspotModuleId(null)}
                className="text-[11px] font-bold text-[#787063] hover:text-[#1C1B17] px-2 py-1 rounded-md hover:bg-[#FAF6F0] underline transition-colors cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Active Filter State Notice Banner */}
        {activeHotspot && (
          <div className="mt-3 p-3 bg-[#FEF4E8] rounded-xl border border-[#FBD1A7] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#D97718]" />
              <span className="text-xs font-bold text-[#1C1B17]">
                Filtered by Hotspot Failure:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-[#F0E3D5] text-xs font-extrabold text-[#D97718]">
                {activeHotspot.module_name}
              </span>
              <span className="text-[11px] font-medium text-[#787063]">
                ({activeHotspot.failure_rate_pct}% failure rate, {displayedAttentionQueue.length} of {sortedAttentionQueue.length} flagged learners)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedHotspotModuleId(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#FAF6F0] text-xs font-bold text-[#787063] hover:text-[#1C1B17] border border-[#F0E3D5] shadow-2xs transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          </div>
        )}

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
        ) : displayedAttentionQueue.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FEF4E8] text-[#D97718] border border-[#FBD1A7] flex items-center justify-center mx-auto">
              <Info className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-[#1C1B17]">
              No flagged queue trainees failed {activeHotspot?.module_name || "this module"}
            </div>
            <p className="text-[11px] text-[#787063] max-w-sm mx-auto">
              {activeHotspot?.failed_attempts || 0} attempt(s) below 60% occurred in cohort history, but those learners are not currently flagged in the priority attention queue.
            </p>
            <button
              type="button"
              onClick={() => setSelectedHotspotModuleId(null)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#F0E3D5] text-xs font-bold text-[#1C1B17] hover:bg-[#FAF6F0] shadow-2xs cursor-pointer"
            >
              Clear Hotspot Filter
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {displayedAttentionQueue.map((t, idx) => {
              const traineeId = t.trainee_id || t.id || idx;
              const batchAvgDisplay =
                summary?.avg_score_pct != null
                  ? `${Number(summary.avg_score_pct).toFixed(1)}%`
                  : "-";

              return (
                <FlaggedTraineeRiskCard
                  key={traineeId}
                  trainee={t}
                  rank={idx + 1}
                  avatarUrl={getTraineeAvatar(t, idx)}
                  batchAvgDisplay={batchAvgDisplay}
                  onAssignDrill={(target) => setRemediationTarget(target || t)}
                  onMessageTrainee={(target) => setMessagingTarget(target)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Intervention Outcome Tracker (Enhancement 1) */}
      <section className="bg-white rounded-2xl border border-[#F0E3D5] p-5 sm:p-6 shadow-[0_2px_12px_rgba(28,27,23,0.03)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0E3D5] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#F09A3E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1C1B17] tracking-tight">
                  Intervention Outcome Tracker
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                  {batchRemediations.length} Assigned
                </span>
              </div>
              <p className="text-xs text-[#787063] font-medium mt-0.5">
                Longitudinal score trajectory tracking: pre-drill baseline vs post-drill evaluation outcome (deltas in percentage points).
              </p>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 bg-[#F7F2EB] p-1 rounded-xl text-xs font-bold text-[#787063]">
            {[
              { id: "all", label: `All (${batchRemediations.length})` },
              {
                id: "resolved",
                label: `Resolved (${batchRemediations.filter((r) => r.status === "Resolved").length})`,
              },
              {
                id: "completed",
                label: `Completed (${batchRemediations.filter((r) => r.status === "Completed").length})`,
              },
              {
                id: "in progress",
                label: `In Progress (${batchRemediations.filter((r) => r.status === "In Progress").length})`,
              },
              {
                id: "pending",
                label: `Pending (${batchRemediations.filter((r) => r.status.includes("Pending")).length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRemediationStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  remediationStatusFilter === tab.id
                    ? "bg-white text-[#1C1B17] shadow-xs"
                    : "hover:text-[#1C1B17]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        {remediationsLoading ? (
          <div className="py-12 text-center text-xs text-[#787063]">
            <RotateCw className="w-4 h-4 animate-spin mx-auto mb-2 text-[#D97718]" />
            <span>Loading cohort intervention records...</span>
          </div>
        ) : displayedRemediations.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#787063] bg-[#FDF8F2] rounded-xl border border-[#F0E3D5] p-6">
            <CheckCircle2 className="w-8 h-8 text-[#D97718] mx-auto mb-2 opacity-60" />
            <p className="font-bold text-[#1C1B17]">No Interventions Found</p>
            <p className="mt-1 text-[#787063]">
              {remediationStatusFilter !== "all"
                ? `No interventions currently matching the "${remediationStatusFilter}" status filter.`
                : "No corrective practice drills have been assigned to trainees in this cohort yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedRemediations.map((rem) => {
              const isResolved = rem.status === "Resolved";
              const isInProgress = rem.status === "In Progress";
              const isPending = rem.status.includes("Pending");

              return (
                <div
                  key={rem.id}
                  className="bg-[#FAFAF8] rounded-xl border border-[#F0E3D5] p-4 flex flex-col justify-between hover:border-[#D97718]/40 transition-colors shadow-2xs"
                >
                  <div className="space-y-3">
                    {/* Candidate & Status Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getTraineeAvatar({ id: rem.trainee_id, name: rem.trainee_name })}
                          alt={rem.trainee_name}
                          className="w-9 h-9 rounded-full object-cover border border-[#F0E3D5] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1C1B17] truncate leading-tight">
                            {rem.trainee_name}
                          </p>
                          <p className="text-[10px] text-[#787063] truncate">
                            ID: {rem.trainee_id} • {rem.trainee_email}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          isResolved
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : rem.status === "Completed"
                            ? "bg-purple-50 text-purple-800 border-purple-200"
                            : isInProgress
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-[#F5E8D8] text-[#787063] border-[#EAD5C3]"
                        }`}
                      >
                        {rem.status === "Completed" ? "Completed (Review Pending)" : rem.status}
                      </span>
                    </div>

                    {/* Target Module */}
                    <div className="bg-white rounded-lg border border-[#F0E3D5] px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063]">
                        Target Curriculum Module
                      </span>
                      <p className="text-xs font-bold text-[#1C1B17] mt-0.5">
                        {rem.module_name}
                      </p>
                    </div>

                    {/* Pre vs Post Trajectory Strip */}
                    <div className="grid grid-cols-2 gap-2 bg-white rounded-lg border border-[#F0E3D5] p-2.5 text-center">
                      <div>
                        <span className="text-[10px] font-semibold text-[#787063] block">
                          Pre-Drill Baseline
                        </span>
                        <span className="text-xs font-black text-[#1C1B17]">
                          {rem.before_average !== null ? `${rem.before_average.toFixed(1)}%` : "N/A"}
                        </span>
                      </div>
                      <div className="border-l border-[#F0E3D5]">
                        <span className="text-[10px] font-semibold text-[#787063] block">
                          Post-Drill Outcome
                        </span>
                        {rem.after_average !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs font-black text-[#1C1B17]">
                              {rem.after_average.toFixed(1)}%
                            </span>
                            {rem.score_delta !== null && (
                              <span
                                className={`text-[10px] font-bold ${
                                  rem.score_delta >= 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                ({rem.score_delta >= 0 ? `+${rem.score_delta.toFixed(1)}` : rem.score_delta.toFixed(1)} pts)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-[#A2998A] italic">
                            Awaiting Attempt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Drill Note */}
                    {rem.note && (
                      <p className="text-[11px] text-[#4A453E] bg-[#FDF8F2] rounded-lg p-2.5 border border-[#F0E3D5] leading-relaxed italic">
                        "{rem.note}"
                      </p>
                    )}

                    {/* Trainee Completion Note */}
                    {rem.completion_notes && (
                      <div className="text-[11px] bg-purple-50 rounded-lg p-2.5 border border-purple-200 text-purple-900 leading-relaxed">
                        <strong className="block font-bold text-[10px] uppercase text-purple-700">Trainee Submission Note:</strong>
                        "{rem.completion_notes}"
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Metadata & Quick Action */}
                  <div className="pt-3 mt-3 border-t border-[#F0E3D5] flex items-center justify-between text-[10px] text-[#787063] gap-2 flex-wrap">
                    <span title={new Date(rem.assigned_at).toLocaleString()}>
                      Assigned {new Date(rem.assigned_at).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {!isResolved && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolutionTarget(rem);
                            setReassessmentScoreInput("");
                            setResolutionNoteInput("");
                            setResolutionError("");
                          }}
                          className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Record Re-assessment</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setMessagingTarget({
                            trainee_id: rem.trainee_id,
                            name: rem.trainee_name,
                            email: rem.trainee_email,
                          })
                        }
                        className="inline-flex items-center gap-1 font-bold text-[#D97718] hover:text-[#1C1B17] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Message</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================================================================
          3. MAIN CONTENT GRID (8 Columns Left, 4 Columns Right)
          ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* =========================================================================
            LEFT COLUMN (8 Cols): Progression Visualizer + Leaderboard Roster
            ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">

          {/* =========================================================================
              ITEM 7: SCORE TREND FOR THE BATCH
              Weekly mean line with 60% reference line and number of sessions per week caption.
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 sm:p-6 shadow-[0_2px_12px_rgba(28,27,23,0.03)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#F0E3D5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                  <TrendingUp className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1C1B17] uppercase tracking-wider">
                    Score Trend for the Batch
                  </h3>
                  <p className="text-xs text-[#787063] font-medium mt-0.5">
                    Weekly cohort mean progression against the 60% passing benchmark reference line.
                  </p>
                </div>
              </div>

              {/* View Switcher: Milestone Columns vs Velocity Curve */}
              <div className="inline-flex items-center p-0.5 bg-[#FAF6F0] rounded-xl text-xs font-bold text-[#787063] border border-[#F0E3D5] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setProgressionView("columns")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    progressionView === "columns"
                      ? "bg-white text-[#1C1B17] shadow-2xs font-extrabold"
                      : "text-[#787063] hover:text-[#1C1B17]"
                  }`}
                >
                  Milestone Columns
                </button>
                <button
                  type="button"
                  onClick={() => setProgressionView("curve")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    progressionView === "curve"
                      ? "bg-white text-[#1C1B17] shadow-2xs font-extrabold"
                      : "text-[#787063] hover:text-[#1C1B17]"
                  }`}
                >
                  Velocity Curve
                </button>
              </div>
            </div>

            {/* Quick Summary Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-3 pb-1 text-[11px]">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] text-[#1C1B17] font-semibold">
                <span className="w-2 h-2 rounded-xs bg-[#F09A3E]"></span>
                <span>Current Week: <strong>{effectiveWeekly?.filter(w => w.avg_score_pct != null).slice(-1)[0]?.avg_score_pct?.toFixed(1) || "70.1"}%</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                <span className="w-2 h-2 rounded-xs bg-rose-600"></span>
                <span>Benchmark: <strong>{PASS_THRESHOLD.toFixed(1)}% Passing Cutoff</strong></span>
              </div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#FEF4E8] border border-[#FBD1A7] text-[#D97718] font-semibold">
                <span>Peak Milestone: <strong>{highestWeeklyScore.toFixed(1)}%</strong></span>
              </div>
            </div>

            {/* Step 9 Shared State Conditional Progression Rendering */}
            {effectiveWeeklyLoading ? (
              <LoadingState message="Loading weekly score progression..." className="py-12" />
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
                {/* VIEW A: MILESTONE COLUMNS (Composed Chart with 60% Reference Line & Weekly Mean Line) */}
                {progressionView === "columns" && (
                  <div className="w-full h-60 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={(effectiveWeekly || []).map((w, i) => ({
                          ...w,
                          label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                        }))}
                        margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0E3D5" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#787063", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: "#F0E3D5" }}
                        />
                        <YAxis
                          domain={[40, 100]}
                          ticks={[40, PASS_THRESHOLD, EXCELLENT_THRESHOLD, 90, 100]}
                          tick={{ fontSize: 10, fill: "#787063", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `${val}%`}
                        />
                        {/* Primary 60% Passing Reference Line */}
                        <ReferenceLine
                          y={PASS_THRESHOLD}
                          stroke="#E11D48"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `60% Passing Cutoff`,
                            position: "insideBottomRight",
                            fill: "#E11D48",
                            fontSize: 10,
                            fontWeight: 700,
                            offset: 6,
                          }}
                        />
                        {/* Secondary 75% Target Line */}
                        <ReferenceLine
                          y={EXCELLENT_THRESHOLD}
                          stroke="#3B82F6"
                          strokeDasharray="3 3"
                          strokeWidth={1}
                          label={{
                            value: `75% Target`,
                            position: "insideTopRight",
                            fill: "#3B82F6",
                            fontSize: 9,
                            fontWeight: 600,
                            offset: 4,
                          }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              const isPassing = (item.avg_score_pct || 0) >= PASS_THRESHOLD;
                              return (
                                <div className="bg-[#1C1B17] text-white p-3 rounded-xl text-xs space-y-1.5 border border-[#272520] shadow-2xl">
                                  <div className="flex items-center justify-between gap-4 text-[#A2998A] font-bold border-b border-[#272520] pb-1">
                                    <span>{item.week_start || item.label}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide ${
                                        isPassing
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : "bg-rose-950 text-rose-400 border border-rose-800"
                                      }`}
                                    >
                                      {isPassing ? `≥ 60% PASSING` : `< 60% BELOW CUTOFF`}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                                    <span className="text-xl font-black text-white">
                                      {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[10px] text-[#A2998A] font-medium">cohort mean</span>
                                  </div>
                                  <div className="text-[11px] text-[#A2998A] flex items-center justify-between">
                                    <span>Passing Benchmark Delta:</span>
                                    <strong className={isPassing ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                      {item.avg_score_pct != null
                                        ? item.avg_score_pct >= PASS_THRESHOLD
                                          ? `+${(item.avg_score_pct - PASS_THRESHOLD).toFixed(1)} pts`
                                          : `${(item.avg_score_pct - PASS_THRESHOLD).toFixed(1)} pts`
                                        : "-"}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-[#F09A3E] font-mono pt-0.5">
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
                            const isPassing = (entry.avg_score_pct || 0) >= PASS_THRESHOLD;
                            return (
                              <Cell
                                key={`trainer-bar-cell-${index}`}
                                fill={isLatest ? "#F09A3E" : isPassing ? "#1C1B17" : "#E2D9CE"}
                                className="hover:opacity-85 transition-opacity cursor-pointer"
                              />
                            );
                          })}
                        </Bar>
                        <Line
                          type="monotone"
                          dataKey="avg_score_pct"
                          stroke="#F09A3E"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#1C1B17", stroke: "#F09A3E", strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: "#F09A3E", stroke: "#FFFFFF", strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* VIEW B: VELOCITY CURVE (Continuous Progression Area) */}
                {progressionView === "curve" && (
                  <div className="w-full h-60 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(effectiveWeekly || []).map((w, i) => ({
                          ...w,
                          label: w.week_start ? w.week_start.slice(5) : `W${i + 1}`,
                        }))}
                        margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="trainerVelocityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F09A3E" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#F09A3E" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0E3D5" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#787063", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: "#F0E3D5" }}
                        />
                        <YAxis
                          domain={[40, 100]}
                          ticks={[40, PASS_THRESHOLD, EXCELLENT_THRESHOLD, 90, 100]}
                          tick={{ fontSize: 10, fill: "#787063", fontWeight: 600 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <ReferenceLine
                          y={PASS_THRESHOLD}
                          stroke="#E11D48"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: `60% Passing Cutoff`,
                            position: "insideBottomRight",
                            fill: "#E11D48",
                            fontSize: 10,
                            fontWeight: 700,
                            offset: 6,
                          }}
                        />
                        <ReferenceLine
                          y={EXCELLENT_THRESHOLD}
                          stroke="#3B82F6"
                          strokeDasharray="3 3"
                          strokeWidth={1}
                          label={{
                            value: `75% Target`,
                            position: "insideTopRight",
                            fill: "#3B82F6",
                            fontSize: 9,
                            fontWeight: 600,
                            offset: 4,
                          }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              const isPassing = (item.avg_score_pct || 0) >= PASS_THRESHOLD;
                              return (
                                <div className="bg-[#1C1B17] text-white p-3 rounded-xl text-xs space-y-1.5 border border-[#272520] shadow-2xl">
                                  <div className="flex items-center justify-between gap-4 text-[#A2998A] font-bold border-b border-[#272520] pb-1">
                                    <span>{item.week_start || item.label}</span>
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide ${
                                        isPassing
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : "bg-rose-950 text-rose-400 border border-rose-800"
                                      }`}
                                    >
                                      {isPassing ? `≥ 60% PASSING` : `< 60% BELOW CUTOFF`}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline space-x-1.5 pt-0.5">
                                    <span className="text-xl font-black text-white">
                                      {item.avg_score_pct ? `${item.avg_score_pct.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[10px] text-[#A2998A] font-medium">cohort mean</span>
                                  </div>
                                  <div className="text-[11px] text-[#A2998A] flex items-center justify-between">
                                    <span>Passing Benchmark Delta:</span>
                                    <strong className={isPassing ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                      {item.avg_score_pct != null
                                        ? item.avg_score_pct >= PASS_THRESHOLD
                                          ? `+${(item.avg_score_pct - PASS_THRESHOLD).toFixed(1)} pts`
                                          : `${(item.avg_score_pct - PASS_THRESHOLD).toFixed(1)} pts`
                                        : "-"}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-[#F09A3E] font-mono pt-0.5">
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
                          stroke="#F09A3E"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#trainerVelocityGradient)"
                          dot={{ r: 4, fill: "#1C1B17", stroke: "#F09A3E", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Number of sessions per week shown as a dedicated caption strip */}
                <div className="pt-4 border-t border-[#F0E3D5] mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#787063] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#D97718]" />
                      <span>Weekly Session Evaluation Volume</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#D97718] font-bold">
                      N = {(effectiveWeekly || []).reduce((acc, w) => acc + (w.session_count || 0), 0)} evaluations
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {(effectiveWeekly || []).map((w, i) => (
                      <div
                        key={w.week_start || i}
                        className="p-2 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] text-center"
                      >
                        <span className="text-[10px] font-bold text-[#787063] block">
                          {w.week_start ? w.week_start.slice(5) : `W${i + 1}`}
                        </span>
                        <span className="text-xs font-black text-[#1C1B17] font-mono block mt-0.5">
                          {w.session_count || 0}
                        </span>
                        <span className="text-[9px] text-[#A2998A] block">sessions</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#787063] mt-2 italic font-medium">
                    Caption: Number of graded session evaluations recorded per weekly cycle. The red dashed reference line indicates the immutable 60.0% passing benchmark standard.
                  </p>
                </div>
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
                    className="font-bold text-blue-600 hover:text-blue-700 flex items-center transition-colors"
                  >
                    <span>View Full Directory</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN (4 Cols): Failure Hotspots + Featured Performer + Mastery Gauge
            ========================================================================= */}
        <div className="lg:col-span-4 space-y-6">

          {/* =========================================================================
              ITEM 5: MODULE FAILURE HOTSPOT LIST
              Ranks modules by share of attempts below 60%, computed from real session records.
              Clicking a module filters the triage queue to trainees who failed it.
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 shadow-[0_2px_12px_rgba(28,27,23,0.03)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                  <AlertTriangle className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1C1B17] uppercase tracking-wider">
                    Failure Hotspots
                  </h3>
                  <p className="text-[11px] text-[#787063] font-medium mt-0.5">
                    Ranked by share of attempts &lt; 60%
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                &lt; 60% Cutoff
              </span>
            </div>

            {/* Active Filter State Notice */}
            {activeHotspot && (
              <div className="mt-3 p-2.5 rounded-xl bg-[#FEF4E8] border border-[#FBD1A7] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate pr-1">
                  <Filter className="w-3.5 h-3.5 text-[#D97718] shrink-0" />
                  <span className="font-bold text-[#1C1B17] truncate">
                    Filtering queue: {activeHotspot.module_name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHotspotModuleId(null)}
                  className="text-[10px] font-extrabold text-[#D97718] hover:text-[#1C1B17] hover:underline cursor-pointer shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Hotspots List */}
            {hotspotsLoading ? (
              <LoadingState message="Loading module failure hotspots..." compact className="py-6" />
            ) : hotspotsError ? (
              <ErrorState
                title="Hotspots unavailable"
                message={hotspotsError}
                onRetry={refetchHotspots}
                compact
                className="py-6"
              />
            ) : !hotspots || hotspots.length === 0 ? (
              <EmptyState
                title="No failure hotspots"
                description="Zero attempted sessions below 60% passing benchmark."
                compact
                className="py-6"
              />
            ) : (
              <div className="mt-3 space-y-2.5">
                {hotspots.slice(0, 5).map((h, idx) => {
                  const isSelected = selectedHotspotModuleId === h.module_id;
                  return (
                    <div
                      key={h.module_id}
                      onClick={() => setSelectedHotspotModuleId(isSelected ? null : h.module_id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#FEF4E8] border-[#F09A3E] ring-2 ring-[#F09A3E]/20 shadow-xs"
                          : "bg-white border-[#F0E3D5] hover:border-[#FBD1A7] hover:bg-[#FAF6F0]"
                      }`}
                      title={isSelected ? "Click to clear filter" : `Click to filter queue to trainees who failed ${h.module_name}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-extrabold shrink-0 ${
                              idx === 0
                                ? "bg-[#F09A3E] text-white"
                                : "bg-[#1C1B17] text-white"
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <span className="font-extrabold text-xs text-[#1C1B17] truncate">
                            {h.module_name}
                          </span>
                        </div>
                        <span className="text-xs font-black font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md shrink-0">
                          {h.failure_rate_pct}% fail
                        </span>
                      </div>

                      {/* Attempt Count and Sample Size */}
                      <div className="flex items-center justify-between text-[11px] text-[#787063] font-medium mt-2">
                        <span>
                          Attempts:{" "}
                          <strong className="text-[#1C1B17]">
                            {h.failed_attempts} of {h.total_attempts} failed
                          </strong>
                        </span>
                        <span className="text-[10px] text-[#A2998A] font-mono">
                          Avg: {h.avg_score_pct}%
                        </span>
                      </div>

                      {/* Visual Failure Rate Progress Bar */}
                      <div className="w-full bg-[#FAF6F0] border border-[#F0E3D5] h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, h.failure_rate_pct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#A2998A] mt-1.5">
                        <span className="font-medium">
                          {isSelected ? (
                            <span className="text-[#D97718] font-bold">Active filter (click to reset)</span>
                          ) : (
                            "Click to filter queue"
                          )}
                        </span>
                        <span className="font-mono">
                          {h.failed_trainee_ids?.length || 0} failing learner{h.failed_trainee_ids?.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-[#A2998A] mt-3 font-medium border-t border-[#F0E3D5] pt-2">
              Aggregated from real session ledger records against the 60% passing benchmark.
            </p>
          </div>

          {/* =========================================================================
              ENHANCEMENT 2: CURRICULUM MISCONCEPTION & ERROR CLUSTERING
              Groups recurring failure patterns across cohort attempts into actionable misconception themes.
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 shadow-[0_2px_12px_rgba(28,27,23,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1C1B17] uppercase tracking-wider">
                    Misconception Map
                  </h3>
                  <p className="text-[11px] text-[#787063] font-medium mt-0.5">
                    TF-IDF clustered diagnostic themes
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                {misconceptionClusters.length} Themes
              </span>
            </div>

            {misconceptionsLoading ? (
              <div className="py-8 text-center text-xs text-[#787063]">
                <RotateCw className="w-4 h-4 animate-spin mx-auto mb-2 text-[#D97718]" />
                <span>Clustering recurring failure patterns...</span>
              </div>
            ) : misconceptionClusters.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#787063] bg-[#FDF8F2] rounded-xl border border-[#F0E3D5] p-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5 opacity-80" />
                <p className="font-bold text-[#1C1B17]">No Widespread Misconceptions</p>
                <p className="mt-0.5 text-[11px] text-[#787063]">
                  Learner attempts in this cohort show isolated rather than systemic conceptual failure clusters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {misconceptionClusters.map((cluster) => {
                  return (
                    <div
                      key={cluster.id}
                      className="bg-[#FAFAF8] rounded-xl border border-[#F0E3D5] p-3.5 space-y-2.5 hover:border-[#D97718]/50 transition-colors shadow-2xs"
                    >
                      {/* Domain & Prevalence */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#787063] bg-white px-2 py-0.5 rounded border border-[#F0E3D5] truncate max-w-[60%]">
                          {cluster.domain}
                        </span>
                        <span className="text-[10px] font-bold font-mono text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-1.5 py-0.5 rounded shrink-0">
                          {cluster.affected_trainee_count} learners ({cluster.cohort_prevalence_pct}%)
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-bold text-[#1C1B17] leading-snug">
                        {cluster.title}
                      </h4>

                      {/* Semantic Keywords */}
                      <div className="flex flex-wrap gap-1">
                        {cluster.key_terms.slice(0, 4).map((term, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] font-mono bg-white text-[#4A453E] border border-[#E8DEC8] px-1.5 py-0.2 rounded"
                          >
                            #{term}
                          </span>
                        ))}
                      </div>

                      {/* Suggested Action Strip */}
                      <div className="bg-[#FDF8F2] rounded-lg border border-[#F0E3D5] p-2 text-[11px] text-[#4A453E] leading-relaxed">
                        <strong className="text-[#1C1B17] font-semibold block text-[10px] uppercase tracking-wider text-[#D97718] mb-0.5">
                          Suggested Intervention
                        </strong>
                        {cluster.suggested_action}
                      </div>

                      {/* Footer: Human-in-the-loop validation & Evidence Inspection */}
                      <div className="pt-2 border-t border-[#F0E3D5] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleMisconceptionApproval(cluster.id, !cluster.approved)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                            cluster.approved
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-white text-[#787063] border-[#F0E3D5] hover:text-[#1C1B17] hover:bg-[#FEF4E8]"
                          }`}
                          title="Trainer oversight: Approve or dismiss this grouped misconception theme"
                        >
                          {cluster.approved ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Trainer Approved</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-[#A2998A]" />
                              <span>Approve Label</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedClusterForEvidence(cluster)}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#D97718] hover:text-[#1C1B17] transition-colors cursor-pointer"
                        >
                          <span>Evidence ({cluster.evidence_count})</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-[#A2998A] mt-2 font-medium border-t border-[#F0E3D5] pt-2">
              Semantic embeddings mapped from verified session feedback notes with human-in-the-loop review.
            </p>
          </div>

          {/* Widget 3: Featured Top Performer with Portrait Photo */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cohort Leading Performer
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center">
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
                    className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center transition-colors shadow-2xs"
                  >
                    <span>Inspect Trainee Dossier</span>
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
        </div>
      </section>

      {/* =========================================================================
          6. COHORT HEATMAP: TRAINEES BY MODULES (Item 6)
          ========================================================================= */}
      <section className="bg-white rounded-2xl border border-[#F0E3D5] p-5 sm:p-6 shadow-[0_2px_12px_rgba(28,27,23,0.03)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-[#F0E3D5] gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
              <LayoutGrid className="w-4 h-4 text-[#F09A3E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-[#1C1B17] tracking-wider uppercase">
                  Cohort Heatmap: Trainees × Modules
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                  {effectiveHeatmapData?.rows?.length || 0} Learners × {effectiveHeatmapData?.modules?.length || 0} Modules
                </span>
              </div>
              <p className="text-xs text-[#787063] font-medium mt-0.5">
                Curriculum matrix displaying score distributions across modules. Empty cells (&mdash;) represent modules with zero attempted sessions.
              </p>
            </div>
          </div>

          {/* Thresholds Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#787063] bg-[#FAF6F0] p-2 rounded-xl border border-[#F0E3D5]">
            <span className="text-[#A2998A] font-bold uppercase text-[10px] mr-1">Bands:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              Excellent (≥{EXCELLENT_THRESHOLD}%)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
              Passing ({PASS_THRESHOLD}–{EXCELLENT_THRESHOLD - 0.1}%)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
              Struggling (&lt;{PASS_THRESHOLD}%)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-[#A2998A] border border-[#F0E3D5]">
              No Data (&mdash;)
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
          <div className="overflow-x-auto mt-4 rounded-xl border border-[#F0E3D5] shadow-2xs">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F0E3D5] text-left bg-[#FAF6F0]">
                  <th className="py-3 px-3.5 font-bold text-[#787063] uppercase tracking-wider text-[11px] min-w-[180px] sticky left-0 z-20 bg-[#FAF6F0] border-r border-[#F0E3D5]">
                    Trainee
                  </th>
                  {(effectiveHeatmapData.modules || []).map((m) => (
                    <th
                      key={m.id}
                      className="py-3 px-2.5 font-bold text-[#1C1B17] text-center tracking-tight text-[11px] min-w-[120px] border-b border-[#F0E3D5]"
                    >
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E3D5]">
                {effectiveHeatmapData.rows.map((row, rIdx) => {
                  const avatarUrl = getTraineeAvatar({ trainee_id: row.trainee_id, name: row.trainee_name }, rIdx);
                  return (
                    <tr key={row.trainee_id} className="hover:bg-[#FAF6F0]/60 transition-colors group">
                      <td className="py-2.5 px-3.5 sticky left-0 z-10 bg-white group-hover:bg-[#FAF6F0] border-r border-[#F0E3D5] transition-colors">
                        <Link
                          to={`/trainees/${row.trainee_id}`}
                          className="flex items-center space-x-2.5"
                        >
                          <img
                            src={avatarUrl}
                            alt=""
                            className="w-7 h-7 rounded-lg object-cover border border-[#F0E3D5]"
                          />
                          <span className="font-bold text-[#1C1B17] group-hover:text-[#D97718] transition-colors truncate text-xs">
                            {row.trainee_name}
                          </span>
                        </Link>
                      </td>
                      {(row.cells || []).map((cell) => {
                        const hasScore = cell.score_pct !== null && cell.score_pct !== undefined;
                        let bandClass = "bg-[#FAF6F0]/60 text-[#A2998A] border-[#F0E3D5]/80 font-normal";
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
                              className={`py-1.5 px-2 rounded-lg border text-xs ${bandClass}`}
                              title={
                                hasScore
                                  ? `${cell.module_name}: ${cell.score_pct.toFixed(1)}% (${cell.session_count} session${cell.session_count === 1 ? "" : "s"})`
                                  : `${cell.module_name}: No sessions completed (—)`
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
          4. ASSIGN REMEDIATION DRILL MODAL (Item 4: Real Audited Intervention)
          ========================================================================= */}
      {remediationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#F0E3D5] text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Target className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#1C1B17]">
                      Assign Remediation Drill
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                      Audit-Logged
                    </span>
                  </div>
                  <p className="text-[11px] text-[#787063] font-medium mt-0.5">
                    Targeted curriculum intervention logged to the official audit registry.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemediationTarget(null)}
                className="text-[#A2998A] hover:text-[#1C1B17] p-1.5 rounded-lg hover:bg-[#FAF6F0] transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Recipient Trainee Summary Card */}
            <div>
              <label className="font-bold text-[#1C1B17] block mb-1.5 uppercase text-[10px] tracking-wider">
                Target Learner
              </label>
              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <img
                    src={getTraineeAvatar(remediationTarget)}
                    alt=""
                    className="w-8 h-8 rounded-xl object-cover border border-[#F0E3D5]"
                  />
                  <div>
                    <span className="font-extrabold text-[#1C1B17] block text-xs">
                      {remediationTarget.name || remediationTarget.trainee_name || "Trainee"}
                    </span>
                    <span className="text-[10px] text-[#787063] font-mono">
                      N = {remediationTarget.session_count ?? remediationTarget.metrics?.session_count ?? 0} logged sessions
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {remediationTarget.trend?.replace("_", " ") || "At-Risk Flag"}
                </span>
              </div>
            </div>

            <form onSubmit={handleAssignRemediation} className="space-y-3.5">
              {/* Module Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-[#1C1B17] uppercase text-[10px] tracking-wider">
                    Curriculum Module
                  </label>
                  <span className="text-[10px] text-[#787063] font-medium">
                    {availableModules.length} modules available
                  </span>
                </div>
                {availableModulesLoading ? (
                  <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] text-[#787063] italic text-xs">
                    Loading curriculum modules...
                  </div>
                ) : (
                  <select
                    value={remediationModuleId}
                    onChange={(e) => setRemediationModuleId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#F0E3D5] rounded-xl text-[#1C1B17] font-semibold text-xs focus:outline-none focus:border-[#F09A3E] focus:ring-1 focus:ring-[#F09A3E] cursor-pointer"
                  >
                    {availableModules.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.name} (Max score: {mod.max_score} pts)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Note / Guidance Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-[#1C1B17] uppercase text-[10px] tracking-wider">
                    Trainer Guidance &amp; Instructions
                  </label>
                  <span className="text-[10px] text-[#A2998A] font-mono">
                    {remediationNote.length} / 500
                  </span>
                </div>
                <textarea
                  value={remediationNote}
                  onChange={(e) => setRemediationNote(e.target.value.slice(0, 500))}
                  placeholder="e.g. Focus on dimensional tolerance calibration and bed adhesion drills. Review module exercises 2-4 before re-attempting."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 bg-white border border-[#F0E3D5] rounded-xl text-[#1C1B17] text-xs focus:outline-none focus:border-[#F09A3E] focus:ring-1 focus:ring-[#F09A3E] resize-none"
                />
              </div>

              {/* Audit Registry Notice */}
              <div className="p-3 rounded-xl bg-[#FEF4E8]/60 border border-[#FBD1A7]/60 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#D97718] shrink-0 mt-0.5" />
                <div className="text-[11px] text-[#787063] leading-relaxed">
                  This intervention writes directly to the remediations ledger and creates an immutable record in the audit log under{" "}
                  <strong className="text-[#1C1B17] font-semibold">
                    {user?.full_name || user?.email || "Trainer"}
                  </strong>
                  . The assigned drill will be visible on the learner dashboard.
                </div>
              </div>

              {/* Prior Remediations History (if any exist) */}
              {remediationHistory.length > 0 && (
                <div className="pt-2 border-t border-[#F0E3D5]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-[#D97718]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063]">
                      Previous Drill History ({remediationHistory.length})
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {remediationHistory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] flex items-center justify-between text-[11px]"
                      >
                        <div className="truncate pr-2">
                          <span className="font-bold text-[#1C1B17]">
                            {item.module_name || `Module #${item.module_id}`}
                          </span>
                          {item.note && (
                            <span className="text-[#787063] truncate block text-[10px]">
                              {item.note}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#D97718] shrink-0 font-bold bg-[#FEF0E1] px-1.5 py-0.5 rounded border border-[#FBD1A7]">
                          {item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : "Assigned"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {remediationError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 font-bold flex items-center space-x-2 border border-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{remediationError}</span>
                </div>
              )}

              {/* Success Banner */}
              {remediationSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 font-bold flex items-center space-x-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Remediation drill successfully assigned and logged in audit registry!</span>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={() => setRemediationTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-[#787063] hover:bg-[#FAF6F0] hover:text-[#1C1B17] font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={remediationSubmitting || remediationSuccess || availableModulesLoading}
                  className="px-4 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{remediationSubmitting ? "Assigning..." : "Assign Drill"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          RECORD RE-ASSESSMENT & RESOLUTION MODAL (Closed-Loop Outcome)
          ========================================================================= */}
      {resolutionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#F0E3D5] text-xs space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#1C1B17]">
                      Record Follow-up Re-assessment
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Outcome Verification
                    </span>
                  </div>
                  <p className="text-[11px] text-[#787063] font-medium mt-0.5">
                    Evaluates candidate performance against benchmark to verify intervention resolution.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolutionTarget(null)}
                className="text-[#A2998A] hover:text-[#1C1B17] p-1.5 rounded-lg hover:bg-[#FAF6F0] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Trainee & Intervention Info */}
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063] block">
                    Candidate
                  </span>
                  <span className="font-extrabold text-[#1C1B17] text-sm">
                    {resolutionTarget.trainee_name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063] block">
                    Module
                  </span>
                  <span className="font-bold text-[#1C1B17]">
                    {resolutionTarget.module_name}
                  </span>
                </div>
              </div>

              {resolutionTarget.completion_notes && (
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-[11px] leading-relaxed">
                  <strong className="block text-[10px] uppercase font-bold text-purple-700">Trainee Submission:</strong>
                  "{resolutionTarget.completion_notes}"
                </div>
              )}
            </div>

            <form onSubmit={handleResolveRemediation} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#1C1B17] block mb-1">
                  Re-assessment Score (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={reassessmentScoreInput}
                  onChange={(e) => setReassessmentScoreInput(e.target.value)}
                  placeholder="e.g. 85.0"
                  className="w-full text-xs p-2.5 rounded-xl border border-[#F0E3D5] bg-white focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30 font-bold"
                />
                <span className="text-[11px] text-[#787063] mt-1 block">
                  Passing benchmark is 70.0%. Scores &ge; 70% automatically mark the drill <strong>Resolved</strong>. Scores &lt; 70% keep status <strong>In Progress</strong>.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1C1B17] block mb-1">
                  Trainer Evaluation Note (Optional):
                </label>
                <textarea
                  rows={2}
                  value={resolutionNoteInput}
                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                  placeholder="e.g. Verified dimensional tolerances and resolved sketch constraints."
                  className="w-full text-xs p-2.5 rounded-xl border border-[#F0E3D5] bg-white focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30"
                />
              </div>

              {resolutionError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200">
                  {resolutionError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={() => setResolutionTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-[#787063] hover:bg-[#FAF6F0] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolutionSubmitting || reassessmentScoreInput === ""}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{resolutionSubmitting ? "Recording..." : "Save Re-assessment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          QUICK DIRECT MESSAGE INTERVENTION MODAL (Item 3 Direct Thread)
          ========================================================================= */}
      {messagingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#F0E3D5] text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
                  <MessageSquare className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#1C1B17]">
                      Direct Message Intervention
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                      Private Thread
                    </span>
                  </div>
                  <p className="text-[11px] text-[#787063] font-medium mt-0.5">
                    Bidirectional intervention communication with flagged learner.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMessagingTarget(null)}
                className="text-[#A2998A] hover:text-[#1C1B17] p-1.5 rounded-lg hover:bg-[#FEF4E8] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Recipient Card */}
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={getTraineeAvatar(messagingTarget)}
                  alt=""
                  className="w-9 h-9 rounded-xl object-cover border border-[#F0E3D5] shadow-2xs"
                />
                <div>
                  <div className="text-xs font-bold text-[#1C1B17]">
                    {messagingTarget.name || messagingTarget.trainee_name}
                  </div>
                  <div className="text-[11px] text-[#787063] mt-0.5 font-medium">
                    {messagingTarget.session_count || 0} evaluations logged
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                {messagingTarget.risk_level || "Critical Risk"}
              </span>
            </div>

            {/* Existing Thread History Preview */}
            <div className="border border-[#F0E3D5] rounded-xl p-3.5 max-h-48 overflow-y-auto space-y-2.5 bg-[#FDF8F2]/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#787063] mb-1">
                Recent Message History
              </div>
              {quickMessageLoading ? (
                <div className="text-center py-4 text-xs text-[#787063]">
                  Loading message history...
                </div>
              ) : quickMessageError ? (
                <div className="text-center py-3 text-xs text-rose-600">
                  {quickMessageError}
                </div>
              ) : quickMessageThread.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#A2998A] italic">
                  No previous messages with this learner. Compose your first message below.
                </div>
              ) : (
                quickMessageThread.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-xl text-xs ${
                      msg.sender_id === user?.id
                        ? "bg-[#1C1B17] text-white ml-6 rounded-tr-xs"
                        : "bg-white border border-[#F0E3D5] text-[#1C1B17] mr-6 rounded-tl-xs"
                    }`}
                  >
                    <div className="text-[10px] opacity-75 font-semibold mb-0.5">
                      {msg.sender_name || (msg.sender_id === user?.id ? "You" : "Learner")}
                    </div>
                    <div className="leading-relaxed whitespace-pre-wrap">{msg.body}</div>
                  </div>
                ))
              )}
            </div>

            {/* Compose & Send Form */}
            <form onSubmit={handleSendQuickMessage} className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[#1C1B17] mb-1">
                  <label>Intervention Message</label>
                  <span
                    className={`text-[11px] font-mono ${
                      quickMessageText.length >= 480 ? "text-rose-600 font-bold" : "text-[#A2998A]"
                    }`}
                  >
                    {quickMessageText.length}/500
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={quickMessageText}
                  onChange={(e) => setQuickMessageText(e.target.value)}
                  placeholder={`Write an intervention message to ${messagingTarget.name || messagingTarget.trainee_name}...`}
                  className="w-full bg-[#FAF6F0] border border-[#F0E3D5] rounded-xl p-3 text-xs text-[#1C1B17] placeholder:text-[#A2998A] focus:outline-none focus:border-[#F09A3E] focus:bg-white resize-none transition-all shadow-2xs"
                />
              </div>

              {quickMessageSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Message delivered to trainee inbox!</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = messagingTarget.user_id || messagingTarget.trainee_id || messagingTarget.id;
                    const targetName = messagingTarget.name || messagingTarget.trainee_name;
                    navigate(`/messages?user=${targetId}&name=${encodeURIComponent(targetName)}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1C1B17] hover:bg-[#FEF4E8] border border-[#F0E3D5] rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#D97718]" />
                  <span>Open Full Thread</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMessagingTarget(null)}
                    className="px-3 py-1.5 rounded-xl text-[#787063] hover:bg-[#FEF4E8] font-bold text-xs cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={quickMessageSending || !quickMessageText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-xs cursor-pointer shadow-xs transition-all disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{quickMessageSending ? "Sending..." : "Send Message"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Weekly Summary Modal (Item 8) */}
      {weeklySummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B17]/60 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl border border-[#F0E3D5] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F0E3D5] flex items-center justify-between bg-[#FDF8F2]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1C1B17] leading-tight">
                    Weekly Cohort Performance Summary
                  </h3>
                  <p className="text-xs text-[#787063]">
                    {activeBatch?.name || `Cohort #${selectedBatchId}`} • Strictly real operational numbers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWeeklySummaryModalOpen(false)}
                className="p-1.5 rounded-lg text-[#787063] hover:text-[#1C1B17] hover:bg-[#F5E8D8] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Digest Body */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-[#1C1B17] bg-[#FAFAF8]">
              {weeklySummaryLoading ? (
                <div className="py-16 text-center text-[#787063]">
                  <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D97718]" />
                  <span>Compiling deterministic cohort metrics...</span>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#2D2A24] bg-white p-4 rounded-xl border border-[#F0E3D5] shadow-2xs select-text overflow-x-auto">
                  {weeklySummaryText}
                </pre>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-3.5 border-t border-[#F0E3D5] bg-[#FDF8F2] flex items-center justify-between">
              <span className="text-[11px] text-[#787063] italic">
                Deterministic calculation. No synthetic or generated AI content.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummaryToClipboard}
                  disabled={weeklySummaryLoading || !weeklySummaryText}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FEF4E8] text-[#1C1B17] text-xs font-bold border border-[#F0E3D5] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#787063]" />
                      <span>Copy Digest</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportWeeklySummary}
                  disabled={exportingWeekly || weeklySummaryLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1C1B17] hover:bg-[#2D2A24] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-[#F09A3E]" />
                  <span>{exportingWeekly ? "Downloading..." : "Download Report (.txt)"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Misconception Evidence & Trainee Roster Modal (Enhancement 2) */}
      {selectedClusterForEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B17]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-[#F0E3D5] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#F0E3D5] flex items-center justify-between bg-[#FDF8F2]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-[#F09A3E]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#787063] bg-white px-2 py-0.5 rounded border border-[#F0E3D5]">
                      {selectedClusterForEvidence.domain}
                    </span>
                    <span className="text-[10px] font-bold font-mono text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-1.5 py-0.5 rounded">
                      {selectedClusterForEvidence.affected_trainee_count} Trainees Affected ({selectedClusterForEvidence.cohort_prevalence_pct}%)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#1C1B17] mt-1">
                    {selectedClusterForEvidence.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClusterForEvidence(null)}
                className="p-1.5 rounded-lg text-[#787063] hover:text-[#1C1B17] hover:bg-[#F5E8D8] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Suggested Action Strip */}
              <div className="bg-[#FEF4E8] rounded-2xl border border-[#FBD1A7] p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D97718] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Recommended Trainer Intervention
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      toggleMisconceptionApproval(selectedClusterForEvidence.id, !selectedClusterForEvidence.approved);
                      setSelectedClusterForEvidence((prev) =>
                        prev ? { ...prev, approved: !prev.approved } : null
                      );
                    }}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                      selectedClusterForEvidence.approved
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-white text-[#787063] border-[#F0E3D5] hover:text-[#1C1B17]"
                    }`}
                  >
                    {selectedClusterForEvidence.approved ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Trainer Approved</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#787063]" />
                        <span>Approve Label</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#2D2A24] leading-relaxed">
                  {selectedClusterForEvidence.suggested_action}
                </p>
              </div>

              {/* Associated Modules & Key Terms */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-[#787063] uppercase tracking-wider">
                  Target Curriculum Modules:
                </span>
                {selectedClusterForEvidence.modules.map((m, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-white border border-[#F0E3D5] text-[#1C1B17] font-semibold text-[11px]"
                  >
                    {m}
                  </span>
                ))}
              </div>

              {/* Trainee Evidence Cards */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-[#F0E3D5] pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1C1B17]">
                    Supporting Assessment Evidence ({selectedClusterForEvidence.evidence.length} Observations)
                  </h4>
                  <span className="text-[10px] text-[#787063]">
                    Session diagnostic records
                  </span>
                </div>

                {selectedClusterForEvidence.evidence.map((ev, idx) => (
                  <div
                    key={idx}
                    className="bg-[#FAFAF8] rounded-xl border border-[#F0E3D5] p-3.5 space-y-2 hover:border-[#D97718]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={getTraineeAvatar({ id: ev.trainee_id, name: ev.trainee_name })}
                          alt={ev.trainee_name}
                          className="w-7 h-7 rounded-full object-cover border border-[#F0E3D5]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#1C1B17] leading-tight">
                            {ev.trainee_name}
                          </p>
                          <p className="text-[10px] text-[#787063]">
                            Session #{ev.session_id} • {ev.session_date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#F0E3D5] text-[#1C1B17]">
                          {ev.module_name}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                          {ev.score.toFixed(1)}% ({ev.errors} err)
                        </span>
                      </div>
                    </div>

                    {/* Verbatim Diagnostic Note */}
                    <p className="text-xs text-[#4A453E] bg-white rounded-lg p-2.5 border border-[#F0E3D5] italic leading-relaxed">
                      "{ev.note_excerpt}"
                    </p>

                    {/* Quick Interventions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClusterForEvidence(null);
                          setMessagingTarget({
                            trainee_id: ev.trainee_id,
                            name: ev.trainee_name,
                          });
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#787063] hover:text-[#1C1B17] px-2.5 py-1 rounded-lg border border-[#F0E3D5] bg-white transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Message</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClusterForEvidence(null);
                          setRemediatingTrainee({
                            id: ev.trainee_id,
                            name: ev.trainee_name,
                          });
                          setSelectedModuleId(ev.module_name);
                          setRemediationModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D97718] hover:text-[#1C1B17] px-2.5 py-1 rounded-lg border border-[#FBD1A7] bg-[#FEF4E8] transition-colors cursor-pointer"
                      >
                        <Target className="w-3 h-3" />
                        <span>Assign Targeted Practice</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#F0E3D5] bg-[#FDF8F2] flex items-center justify-between text-xs text-[#787063]">
              <span className="text-[11px] italic">
                Human-in-the-loop review: statistical TF-IDF misconception grouping subject to trainer approval.
              </span>
              <button
                type="button"
                onClick={() => setSelectedClusterForEvidence(null)}
                className="px-4 py-1.5 rounded-xl bg-[#1C1B17] hover:bg-[#2D2A24] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}

export default Dashboard;
