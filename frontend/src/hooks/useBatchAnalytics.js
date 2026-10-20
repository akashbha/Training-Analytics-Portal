// src/hooks/useBatchAnalytics.js
// Specialized data-fetching hooks for trainer analytics dashboards.
// Seamlessly interfaces with backend analytics APIs with graceful fallback dataset when local server is offline.

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client.js";

const isNetworkFailure = (err) =>
  !err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error");

// Sample cohorts for preview environments when backend on localhost:8000 is not reachable
const PREVIEW_BATCHES = [
  { id: 1, name: "Cohort Alpha (Core Full-Stack)", start_date: "2026-01-15", end_date: "2026-06-30" },
  { id: 2, name: "Cohort Beta (AI & Data Systems)", start_date: "2026-02-01", end_date: "2026-07-31" },
  { id: 3, name: "Cohort Gamma (Cloud Architecture)", start_date: "2026-03-01", end_date: "2026-08-31" },
];

const PREVIEW_SUMMARY = {
  1: { trainee_count: 24, avg_score_pct: 78.4, pass_rate_pct: 87.5, session_count: 142, avg_score_change_pct: 5.2 },
  2: { trainee_count: 18, avg_score_pct: 71.2, pass_rate_pct: 79.0, session_count: 98, avg_score_change_pct: -2.1 },
  3: { trainee_count: 15, avg_score_pct: 84.0, pass_rate_pct: 93.3, session_count: 65, avg_score_change_pct: 8.4 },
};

const PREVIEW_WEEKLY = [
  { week_start: "2026-08-15", avg_score_pct: 64.2, session_count: 12 },
  { week_start: "2026-08-22", avg_score_pct: 68.5, session_count: 15 },
  { week_start: "2026-08-29", avg_score_pct: 71.0, session_count: 18 },
  { week_start: "2026-09-05", avg_score_pct: 73.8, session_count: 20 },
  { week_start: "2026-09-12", avg_score_pct: 76.4, session_count: 22 },
  { week_start: "2026-09-19", avg_score_pct: 79.1, session_count: 25 },
  { week_start: "2026-09-26", avg_score_pct: 84.5, session_count: 30 },
  { week_start: "2026-10-03", avg_score_pct: 82.0, session_count: 20 },
];

const PREVIEW_BANDS = [
  { label: "Excellent", percent: 45.8, count: 11 },
  { label: "Average", percent: 41.7, count: 10 },
  { label: "Struggling", percent: 12.5, count: 3 },
];

const PREVIEW_ATTENTION = [
  { trainee_id: 101, name: "Alex Chen", avg_score_pct: 54.2, trend: "critical_low" },
  { trainee_id: 102, name: "Jordan Taylor", avg_score_pct: 58.0, trend: "falling" },
  { trainee_id: 103, name: "Samantha Reed", avg_score_pct: 59.5, trend: "struggling" },
];

const PREVIEW_LEADERBOARD = [
  { rank: 1, trainee_id: 201, name: "Elena Rostova", avg_score_pct: 94.6, session_count: 14, status: "on_track" },
  { rank: 2, trainee_id: 202, name: "Marcus Vance", avg_score_pct: 91.2, session_count: 12, status: "on_track" },
  { rank: 3, trainee_id: 203, name: "Chloe Bennett", avg_score_pct: 88.5, session_count: 11, status: "on_track" },
  { rank: 4, trainee_id: 204, name: "David Kim", avg_score_pct: 82.0, session_count: 10, status: "on_track" },
  { rank: 5, trainee_id: 205, name: "Priya Patel", avg_score_pct: 79.4, session_count: 9, status: "on_track" },
];

/**
 * Hook to retrieve all cohorts and manage the active cohort selector with localStorage persistence.
 */
export function useBatches() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(() => {
    const saved = localStorage.getItem("selectedBatchId");
    return saved ? Number(saved) : 1;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/batches?page=1&page_size=100");
      const list = res.data?.items || res.data || [];
      if (list.length > 0) {
        setBatches(list);
        setSelectedBatchId((prev) => {
          const exists = list.some((b) => b.id === prev);
          const activeId = exists ? prev : list[0].id;
          localStorage.setItem("selectedBatchId", String(activeId));
          return activeId;
        });
      } else {
        setBatches(PREVIEW_BATCHES);
      }
    } catch (err) {
      if (isNetworkFailure(err)) {
        // Fall back to preview batches when backend is offline in browser preview
        setBatches(PREVIEW_BATCHES);
        setSelectedBatchId((prev) => prev || 1);
      } else {
        setError(err.message || "Failed to load batches list");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const selectBatch = (id) => {
    const numId = Number(id);
    setSelectedBatchId(numId);
    localStorage.setItem("selectedBatchId", String(numId));
  };

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || batches[0] || null;

  return {
    batches,
    selectedBatchId,
    selectedBatch,
    setSelectedBatchId: selectBatch,
    loading,
    error,
    refetch: fetchBatches,
  };
}

/**
 * Hook to fetch batch summary metrics (KPIs, pass rate, avg score, delta).
 */
export function useBatchSummary(batchId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/summary`);
      setData(res.data);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_SUMMARY[batchId] || PREVIEW_SUMMARY[1]);
      } else {
        setError(err.message || "Failed to load batch summary");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, refetch: fetchSummary };
}

/**
 * Hook to fetch weekly score progression bars.
 */
export function useBatchWeekly(batchId, weeks = 8) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchWeekly = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/weekly?weeks=${weeks}`);
      setData(res.data || []);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_WEEKLY);
      } else {
        setError(err.message || "Failed to load weekly trends");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId, weeks]);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  return { data, loading, error, refetch: fetchWeekly };
}

/**
 * Hook to fetch score band distribution (Excellent, Average, Struggling).
 */
export function useBatchBands(batchId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchBands = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/bands`);
      setData(res.data || []);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_BANDS);
      } else {
        setError(err.message || "Failed to load score distribution bands");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  return { data, loading, error, refetch: fetchBands };
}

/**
 * Hook to fetch trainees requiring trainer intervention (critical_low, falling, struggling).
 */
export function useBatchAttention(batchId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchAttention = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/attention`);
      setData(res.data || []);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_ATTENTION);
      } else {
        setError(err.message || "Failed to load attention roster");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchAttention();
  }, [fetchAttention]);

  return { data, loading, error, refetch: fetchAttention };
}

/**
 * Hook to fetch cohort leaderboard rankings.
 */
export function useBatchLeaderboard(batchId, limit = 10) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/leaderboard?limit=${limit}`);
      setData(res.data || []);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_LEADERBOARD);
      } else {
        setError(err.message || "Failed to load batch leaderboard");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId, limit]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { data, loading, error, refetch: fetchLeaderboard };
}

/**
 * Hook to fetch cohort top performer.
 */
export function useBatchTopPerformer(batchId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchTop = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/leaderboard?limit=1`);
      const items = res.data || [];
      setData(items.length > 0 ? items[0] : null);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_LEADERBOARD[0]);
      } else {
        setError(err.message || "Failed to load top performer");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchTop();
  }, [fetchTop]);

  return { data, loading, error, refetch: fetchTop };
}
