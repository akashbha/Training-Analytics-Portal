// src/hooks/useBatchAnalytics.js
// Specialized data-fetching hooks for trainer analytics dashboards.
// Exposes loading, empty, and error states cleanly without fabricated fallback datasets.

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client.js";

/**
 * Hook to retrieve all cohorts and manage the active cohort selector with localStorage persistence.
 */
export function useBatches() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(() => {
    const saved = localStorage.getItem("selectedBatchId");
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/batches?page=1&page_size=100");
      const list = res.data?.items || res.data || [];
      setBatches(list);
      if (list.length > 0) {
        setSelectedBatchId((prev) => {
          const exists = list.some((b) => b.id === prev);
          const activeId = exists ? prev : list[0].id;
          localStorage.setItem("selectedBatchId", String(activeId));
          return activeId;
        });
      } else {
        setSelectedBatchId(null);
        localStorage.removeItem("selectedBatchId");
      }
    } catch (err) {
      setBatches([]);
      setError(err.message || "Failed to load batches list");
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
      setData(null);
      setError(err.message || "Failed to load batch summary");
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
      setData(null);
      setError(err.message || "Failed to load weekly trends");
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
      setData(null);
      setError(err.message || "Failed to load score distribution bands");
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
      // Query the trained ML Early-Warning attention endpoint (Synopsis Section 10)
      const res = await apiClient.get(`/analytics/batches/${batchId}/ml-attention`);
      setData(res.data || []);
    } catch (err) {
      if (err.response) {
        // Fallback to traditional rule-based attention endpoint if ML service is unavailable
        try {
          const fallbackRes = await apiClient.get(`/analytics/batches/${batchId}/attention`);
          setData(fallbackRes.data || []);
        } catch (fallbackErr) {
          setData(null);
          setError(fallbackErr.message || err.message || "Failed to load ML attention roster");
        }
      } else {
        setData(null);
        setError(err.message || "Failed to load ML attention roster");
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
      setData(null);
      setError(err.message || "Failed to load batch leaderboard");
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
      setData(null);
      setError(err.message || "Failed to load top performer");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchTop();
  }, [fetchTop]);

  return { data, loading, error, refetch: fetchTop };
}

/**
 * Hook to fetch student x module performance heatmap matrix.
 */
export function useBatchHeatmap(batchId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchHeatmap = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/heatmap`);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err.message || "Failed to load cohort heatmap");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  return { data, loading, error, refetch: fetchHeatmap };
}

/**
 * Hook to retrieve assigned instructors for the active batch.
 * Distinguishes loading, empty, forbidden (403), and failed request states without synthetic fallbacks.
 */
export function useBatchTrainers(batchId) {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchTrainers = useCallback(async (silent = false) => {
    if (!batchId) {
      setTrainers([]);
      setError(null);
      setIsForbidden(false);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await apiClient.get(`/batches/${batchId}/trainers`);
      const list = Array.isArray(res.data) ? res.data : [];
      setTrainers(list);
    } catch (err) {
      setTrainers([]);
      if (err.response?.status === 403) {
        setIsForbidden(true);
        setError("You do not have access");
      } else {
        setError(err.response?.data?.error?.message || err.message || "Unable to load trainers");
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  return { trainers, loading, error, isForbidden, refetch: fetchTrainers };
}

/**
 * Hook to retrieve curriculum module failure hotspots for the active batch.
 * Ranks modules by failure rate (< 60% cutoff) with real attempt sample sizes.
 */
export function useBatchHotspots(batchId) {
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchHotspots = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/hotspots`);
      const list = Array.isArray(res.data) ? res.data : [];
      setHotspots(list);
    } catch (err) {
      setHotspots([]);
      setError(err.message || "Failed to load module hotspots");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchHotspots();
  }, [fetchHotspots]);

  return { hotspots, loading, error, refetch: fetchHotspots };
}

/**
 * Hook to retrieve intervention outcome tracking records for a batch.
 * Tracks remediations through Pending Re-assessment, In Progress, and Resolved states with real score deltas.
 */
export function useBatchRemediations(batchId) {
  const [remediations, setRemediations] = useState([]);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchRemediations = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/batches/${batchId}/remediations`);
      const list = Array.isArray(res.data) ? res.data : [];
      setRemediations(list);
    } catch (err) {
      setRemediations([]);
      setError(err.message || "Failed to load intervention outcomes");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchRemediations();
  }, [fetchRemediations]);

  return { remediations, loading, error, refetch: fetchRemediations };
}

/**
 * Hook to retrieve curriculum misconception and recurring error clusters for a batch.
 * Groups session failure diagnostic notes with TF-IDF semantic clustering and trainer approval toggle.
 */
export function useBatchMisconceptions(batchId) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(Boolean(batchId));
  const [error, setError] = useState(null);

  const fetchMisconceptions = useCallback(async (silent = false) => {
    if (!batchId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/batches/${batchId}/misconceptions`);
      setAnalysis(res.data);
    } catch (err) {
      setAnalysis(null);
      setError(err.message || "Failed to load misconception analysis");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const toggleApproval = useCallback(async (clusterId, approved) => {
    if (!batchId || !clusterId) return;
    try {
      await apiClient.post(`/analytics/batches/${batchId}/misconceptions/${clusterId}/approval?approved=${approved}`);
      setAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clusters: prev.clusters.map((c) =>
            c.id === clusterId ? { ...c, approved } : c
          ),
        };
      });
    } catch (err) {
      console.error("Failed to toggle misconception approval:", err);
    }
  }, [batchId]);

  useEffect(() => {
    fetchMisconceptions();
  }, [fetchMisconceptions]);

  return {
    analysis,
    clusters: analysis?.clusters || [],
    loading,
    error,
    refetch: fetchMisconceptions,
    toggleApproval,
  };
}
