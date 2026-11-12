// src/hooks/useTraineeAnalytics.js
// Specialized data-fetching hooks for individual trainee performance and historical progress.
// Exposes profile details, score trajectory, module error aggregations, recent sessions, and silent live refetching.

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client.js";

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
      } else {
        setData(null);
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
      } else {
        setData(null);
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
      } else {
        setData(null);
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
      } else {
        setData(null);
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
      } else {
        setData(null);
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

/**
 * Hook to retrieve trainee cohort batch standing and percentile band.
 */
export function useTraineeStanding(traineeId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(traineeId));
  const [error, setError] = useState(null);

  const fetchStanding = useCallback(async (silent = false) => {
    if (!traineeId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/analytics/trainees/${traineeId}/standing`);
      setData(res.data);
    } catch (err) {
      setData(null);
      setError(err.message || "Failed to load cohort standing");
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => {
    fetchStanding();
  }, [fetchStanding]);

  return { data, loading, error, refetch: fetchStanding };
}
