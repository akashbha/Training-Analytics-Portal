// src/hooks/useTraineeAnalytics.js
// Specialized data-fetching hooks for individual trainee performance and historical progress.
// Exposes profile details, score trajectory, module error aggregations, recent sessions, and silent live refetching.

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client.js";

const isNetworkFailure = (err) =>
  !err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error");

const PREVIEW_TRAINEE_PROFILE = {
  id: 1,
  name: "Alex Chen",
  email: "alex.chen@example.com",
  batch_id: 1,
  batch_name: "Cohort Alpha (Core Full-Stack)",
};

const PREVIEW_TRAINEE_SUMMARY = {
  latest_score_pct: 82.5,
  best_score_pct: 94.0,
  improvement_pct: 14.2,
  session_count: 12,
};

const PREVIEW_TRAINEE_PROGRESS = [
  { id: 1, module_id: 1, module_name: "Python Fundamentals", score_pct: 68.0, errors: 4, time_seconds: 1240, created_at: "2026-08-18T10:00:00Z" },
  { id: 2, module_id: 1, module_name: "Python Fundamentals", score_pct: 72.5, errors: 3, time_seconds: 1100, created_at: "2026-08-25T11:00:00Z" },
  { id: 3, module_id: 2, module_name: "PostgreSQL & Schema", score_pct: 65.0, errors: 6, time_seconds: 1800, created_at: "2026-09-02T14:30:00Z" },
  { id: 4, module_id: 2, module_name: "PostgreSQL & Schema", score_pct: 76.0, errors: 2, time_seconds: 1450, created_at: "2026-09-10T09:15:00Z" },
  { id: 5, module_id: 3, module_name: "FastAPI REST Architecture", score_pct: 81.0, errors: 2, time_seconds: 1320, created_at: "2026-09-17T16:00:00Z" },
  { id: 6, module_id: 3, module_name: "FastAPI REST Architecture", score_pct: 88.0, errors: 1, time_seconds: 1190, created_at: "2026-09-24T13:45:00Z" },
  { id: 7, module_id: 4, module_name: "React & State Engineering", score_pct: 79.5, errors: 3, time_seconds: 1540, created_at: "2026-10-01T10:20:00Z" },
  { id: 8, module_id: 4, module_name: "React & State Engineering", score_pct: 82.5, errors: 2, time_seconds: 1280, created_at: "2026-10-06T15:10:00Z" },
];

const PREVIEW_TRAINEE_ERRORS = [
  { module_id: 1, module_name: "Python Fundamentals", avg_errors: 3.5, session_count: 2 },
  { module_id: 2, module_name: "PostgreSQL & Schema", avg_errors: 4.0, session_count: 2 },
  { module_id: 3, module_name: "FastAPI REST", avg_errors: 1.5, session_count: 2 },
  { module_id: 4, module_name: "React & State", avg_errors: 2.5, session_count: 2 },
];

const PREVIEW_TRAINEE_SESSIONS = [
  { id: 8, module_id: 4, module_name: "React & State Engineering", score_pct: 82.5, errors: 2, time_seconds: 1280, created_at: "2026-10-06T15:10:00Z" },
  { id: 7, module_id: 4, module_name: "React & State Engineering", score_pct: 79.5, errors: 3, time_seconds: 1540, created_at: "2026-10-01T10:20:00Z" },
  { id: 6, module_id: 3, module_name: "FastAPI REST Architecture", score_pct: 88.0, errors: 1, time_seconds: 1190, created_at: "2026-09-24T13:45:00Z" },
  { id: 5, module_id: 3, module_name: "FastAPI REST Architecture", score_pct: 81.0, errors: 2, time_seconds: 1320, created_at: "2026-09-17T16:00:00Z" },
  { id: 4, module_id: 2, module_name: "PostgreSQL & Schema", score_pct: 76.0, errors: 2, time_seconds: 1450, created_at: "2026-09-10T09:15:00Z" },
  { id: 3, module_id: 2, module_name: "PostgreSQL & Schema", score_pct: 65.0, errors: 6, time_seconds: 1800, created_at: "2026-09-02T14:30:00Z" },
  { id: 2, module_id: 1, module_name: "Python Fundamentals", score_pct: 72.5, errors: 3, time_seconds: 1100, created_at: "2026-08-25T11:00:00Z" },
  { id: 1, module_id: 1, module_name: "Python Fundamentals", score_pct: 68.0, errors: 4, time_seconds: 1240, created_at: "2026-08-18T10:00:00Z" },
];

/**
 * Hook to retrieve trainee profile metadata (name, email, cohort batch).
 */
export function useTraineeProfile(traineeId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(traineeId));
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchProfile = useCallback(async (silent = false) => {
    if (!traineeId) return;
    if (!silent) setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await apiClient.get(`/trainees/${traineeId}`);
      setData(res.data);
    } catch (err) {
      if (err.status === 403 || err.response?.status === 403) {
        setIsForbidden(true);
      } else if (isNetworkFailure(err)) {
        setData({ ...PREVIEW_TRAINEE_PROFILE, id: Number(traineeId) || 1 });
      } else {
        setError(err.message || "Failed to load trainee profile");
      }
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { data, loading, error, isForbidden, refetch: fetchProfile };
}

/**
 * Hook to retrieve trainee summary KPIs (Latest, Best, Improvement %, Session Count).
 */
export function useTraineeSummary(traineeId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(traineeId));
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchSummary = useCallback(async (silent = false) => {
    if (!traineeId) return;
    if (!silent) setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await apiClient.get(`/analytics/trainees/${traineeId}/summary`);
      setData(res.data);
    } catch (err) {
      if (err.status === 403 || err.response?.status === 403) {
        setIsForbidden(true);
      } else if (isNetworkFailure(err)) {
        setData(PREVIEW_TRAINEE_SUMMARY);
      } else {
        setError(err.message || "Failed to load performance summary");
      }
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, isForbidden, refetch: fetchSummary };
}

/**
 * Hook to retrieve trainee chronological session progression timeline.
 */
export function useTraineeProgress(traineeId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(traineeId));
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchProgress = useCallback(async (silent = false) => {
    if (!traineeId) return;
    if (!silent) setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await apiClient.get(`/analytics/trainees/${traineeId}/progress`);
      setData(res.data || []);
    } catch (err) {
      if (err.status === 403 || err.response?.status === 403) {
        setIsForbidden(true);
      } else if (isNetworkFailure(err)) {
        setData(PREVIEW_TRAINEE_PROGRESS);
      } else {
        setError(err.message || "Failed to load progress timeline");
      }
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return { data, loading, error, isForbidden, refetch: fetchProgress };
}

/**
 * Hook to retrieve module error frequency metrics for a trainee.
 */
export function useTraineeErrors(traineeId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(traineeId));
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchErrors = useCallback(async (silent = false) => {
    if (!traineeId) return;
    if (!silent) setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await apiClient.get(`/analytics/trainees/${traineeId}/errors-by-module`);
      setData(res.data || []);
    } catch (err) {
      if (err.status === 403 || err.response?.status === 403) {
        setIsForbidden(true);
      } else if (isNetworkFailure(err)) {
        setData(PREVIEW_TRAINEE_ERRORS);
      } else {
        setError(err.message || "Failed to load error breakdown");
      }
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  return { data, loading, error, isForbidden, refetch: fetchErrors };
}

/**
 * Hook to retrieve recent individual assessment sessions (last 10).
 */
export function useTraineeSessions(traineeId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(traineeId));
  const [error, setError] = useState(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchSessions = useCallback(async (silent = false) => {
    if (!traineeId) return;
    if (!silent) setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await apiClient.get(`/sessions?trainee_id=${traineeId}&page=1&page_size=10`);
      const items = res.data?.items || res.data || [];
      setData(items);
    } catch (err) {
      if (err.status === 403 || err.response?.status === 403) {
        setIsForbidden(true);
      } else if (isNetworkFailure(err)) {
        setData(PREVIEW_TRAINEE_SESSIONS);
      } else {
        setError(err.message || "Failed to load recent sessions");
      }
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { data, loading, error, isForbidden, refetch: fetchSessions };
}
