// src/hooks/useBatchAnalytics.js
// Specialized data-fetching hooks for trainer analytics dashboards.
// Seamlessly interfaces with backend analytics APIs with graceful fallback dataset when local server is offline.

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client.js";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD } from "../constants/thresholds.js";

const isNetworkFailure = (err) =>
  !err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error");

// Sample cohorts for preview environments when backend on localhost:8000 is not reachable
const PREVIEW_BATCHES = [
  { id: 1, name: "Batch A - Web Core", start_date: "2026-07-01", end_date: "2026-11-18", trainee_count: 10 },
  { id: 2, name: "Batch B - Data Systems", start_date: "2026-07-15", end_date: "2026-12-02", trainee_count: 10 },
  { id: 3, name: "Batch C - Cloud Native", start_date: "2026-07-22", end_date: "2026-12-09", trainee_count: 10 },
  { id: 4, name: "Batch D - Full Stack", start_date: "2026-07-29", end_date: "2026-12-16", trainee_count: 10 },
  { id: 5, name: "Batch E - DevOps & Architecture", start_date: "2026-07-29", end_date: "2026-12-16", trainee_count: 10 },
];

const PREVIEW_SUMMARY = {
  1: { trainee_count: 10, avg_score_pct: 78.4, pass_rate_pct: 87.5, session_count: 142, avg_score_change_pct: 5.2 },
  2: { trainee_count: 10, avg_score_pct: 71.2, pass_rate_pct: 79.0, session_count: 98, avg_score_change_pct: -2.1 },
  3: { trainee_count: 10, avg_score_pct: 84.0, pass_rate_pct: 93.3, session_count: 65, avg_score_change_pct: 8.4 },
  4: { trainee_count: 10, avg_score_pct: 76.5, pass_rate_pct: 82.0, session_count: 84, avg_score_change_pct: 3.1 },
  5: { trainee_count: 10, avg_score_pct: 86.8, pass_rate_pct: 95.0, session_count: 112, avg_score_change_pct: 6.7 },
};

const PREVIEW_WEEKLY = {
  1: [
    { week_start: "2026-08-15", avg_score_pct: 64.2, session_count: 12 },
    { week_start: "2026-08-22", avg_score_pct: 68.5, session_count: 15 },
    { week_start: "2026-08-29", avg_score_pct: 71.0, session_count: 18 },
    { week_start: "2026-09-05", avg_score_pct: 73.8, session_count: 20 },
    { week_start: "2026-09-12", avg_score_pct: 76.4, session_count: 22 },
    { week_start: "2026-09-19", avg_score_pct: 79.1, session_count: 25 },
    { week_start: "2026-09-26", avg_score_pct: 84.5, session_count: 30 },
    { week_start: "2026-10-03", avg_score_pct: 82.0, session_count: 20 },
  ],
  2: [
    { week_start: "2026-08-15", avg_score_pct: 58.0, session_count: 8 },
    { week_start: "2026-08-22", avg_score_pct: 62.4, session_count: 11 },
    { week_start: "2026-08-29", avg_score_pct: 66.8, session_count: 14 },
    { week_start: "2026-09-05", avg_score_pct: 68.0, session_count: 16 },
    { week_start: "2026-09-12", avg_score_pct: 71.5, session_count: 18 },
    { week_start: "2026-09-19", avg_score_pct: 74.0, session_count: 20 },
    { week_start: "2026-09-26", avg_score_pct: 72.8, session_count: 22 },
    { week_start: "2026-10-03", avg_score_pct: 75.2, session_count: 15 },
  ],
  3: [
    { week_start: "2026-08-15", avg_score_pct: 72.0, session_count: 10 },
    { week_start: "2026-08-22", avg_score_pct: 75.5, session_count: 12 },
    { week_start: "2026-08-29", avg_score_pct: 78.0, session_count: 15 },
    { week_start: "2026-09-05", avg_score_pct: 81.2, session_count: 18 },
    { week_start: "2026-09-12", avg_score_pct: 83.6, session_count: 20 },
    { week_start: "2026-09-19", avg_score_pct: 85.0, session_count: 24 },
    { week_start: "2026-09-26", avg_score_pct: 88.4, session_count: 26 },
    { week_start: "2026-10-03", avg_score_pct: 86.5, session_count: 21 },
  ],
  4: [
    { week_start: "2026-08-15", avg_score_pct: 62.5, session_count: 9 },
    { week_start: "2026-08-22", avg_score_pct: 65.0, session_count: 12 },
    { week_start: "2026-08-29", avg_score_pct: 69.2, session_count: 15 },
    { week_start: "2026-09-05", avg_score_pct: 72.1, session_count: 17 },
    { week_start: "2026-09-12", avg_score_pct: 75.0, session_count: 21 },
    { week_start: "2026-09-19", avg_score_pct: 77.8, session_count: 23 },
    { week_start: "2026-09-26", avg_score_pct: 80.2, session_count: 25 },
    { week_start: "2026-10-03", avg_score_pct: 79.5, session_count: 18 },
  ],
  5: [
    { week_start: "2026-08-15", avg_score_pct: 75.0, session_count: 14 },
    { week_start: "2026-08-22", avg_score_pct: 78.4, session_count: 17 },
    { week_start: "2026-08-29", avg_score_pct: 81.6, session_count: 20 },
    { week_start: "2026-09-05", avg_score_pct: 84.2, session_count: 22 },
    { week_start: "2026-09-12", avg_score_pct: 87.0, session_count: 26 },
    { week_start: "2026-09-19", avg_score_pct: 89.5, session_count: 28 },
    { week_start: "2026-09-26", avg_score_pct: 92.1, session_count: 32 },
    { week_start: "2026-10-03", avg_score_pct: 90.8, session_count: 25 },
  ],
};

const BAND_LABEL_EXCELLENT = `Excellent (≥${EXCELLENT_THRESHOLD}%)`;
const BAND_LABEL_AVERAGE = `Average (${PASS_THRESHOLD}-${EXCELLENT_THRESHOLD - 1}%)`;
const BAND_LABEL_STRUGGLING = `Struggling (<${PASS_THRESHOLD}%)`;

const PREVIEW_BANDS = {
  1: [
    { label: BAND_LABEL_EXCELLENT, percent: 45.8, count: 5 },
    { label: BAND_LABEL_AVERAGE, percent: 41.7, count: 4 },
    { label: BAND_LABEL_STRUGGLING, percent: 12.5, count: 1 },
  ],
  2: [
    { label: BAND_LABEL_EXCELLENT, percent: 30.0, count: 3 },
    { label: BAND_LABEL_AVERAGE, percent: 50.0, count: 5 },
    { label: BAND_LABEL_STRUGGLING, percent: 20.0, count: 2 },
  ],
  3: [
    { label: BAND_LABEL_EXCELLENT, percent: 60.0, count: 6 },
    { label: BAND_LABEL_AVERAGE, percent: 30.0, count: 3 },
    { label: BAND_LABEL_STRUGGLING, percent: 10.0, count: 1 },
  ],
  4: [
    { label: BAND_LABEL_EXCELLENT, percent: 40.0, count: 4 },
    { label: BAND_LABEL_AVERAGE, percent: 40.0, count: 4 },
    { label: BAND_LABEL_STRUGGLING, percent: 20.0, count: 2 },
  ],
  5: [
    { label: BAND_LABEL_EXCELLENT, percent: 70.0, count: 7 },
    { label: BAND_LABEL_AVERAGE, percent: 20.0, count: 2 },
    { label: BAND_LABEL_STRUGGLING, percent: 10.0, count: 1 },
  ],
};

const PREVIEW_ATTENTION = {
  1: [
    { trainee_id: 6, name: "Jeffery Wagner", avg_score_pct: 54.2, trend: "critical_low", avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80", focus_module: "PostgreSQL Schema & Query Optimization" },
    { trainee_id: 7, name: "Anthony Gonzalez", avg_score_pct: 58.0, trend: "falling", avatar_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80", focus_module: "Python Fundamentals & Loops" },
    { trainee_id: 8, name: "Debra Gardner", avg_score_pct: 59.5, trend: "struggling", avatar_url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80", focus_module: "React State Architecture" },
  ],
  2: [
    { trainee_id: 16, name: "Lindsay Blair", avg_score_pct: 52.4, trend: "critical_low", avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", focus_module: "Distributed Data Pipelines" },
    { trainee_id: 17, name: "Amanda Dudley", avg_score_pct: 56.8, trend: "falling", avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80", focus_module: "SQL Indexing & Query Tuning" },
    { trainee_id: 18, name: "Nicholas Arnold", avg_score_pct: 58.9, trend: "struggling", avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80", focus_module: "ETL Batch Ingestion Systems" },
  ],
  3: [
    { trainee_id: 26, name: "Mitchell Clark", avg_score_pct: 51.5, trend: "critical_low", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", focus_module: "Kubernetes Pod Lifecycle & Scheduling" },
    { trainee_id: 27, name: "Joseph Zuniga", avg_score_pct: 55.0, trend: "falling", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", focus_module: "Terraform Infrastructure Modules" },
    { trainee_id: 28, name: "Deborah Lynch", avg_score_pct: 58.2, trend: "struggling", avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", focus_module: "Service Mesh & Envoy Ingress" },
  ],
  4: [
    { trainee_id: 36, name: "Jason Hahn", avg_score_pct: 53.8, trend: "critical_low", avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80", focus_module: "Async Event Loop & Concurrency" },
    { trainee_id: 37, name: "Nancy Edwards", avg_score_pct: 57.4, trend: "falling", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", focus_module: "JWT Auth & API Gateways" },
    { trainee_id: 38, name: "Diana Foster", avg_score_pct: 59.1, trend: "struggling", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", focus_module: "React Redux State Synchronization" },
  ],
  5: [
    { trainee_id: 46, name: "Daniel Burton", avg_score_pct: 52.0, trend: "critical_low", avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80", focus_module: "CI/CD Pipeline Artifact Caching" },
    { trainee_id: 47, name: "Laura Henderson", avg_score_pct: 56.2, trend: "falling", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", focus_module: "Prometheus Metrics & Alerting" },
    { trainee_id: 48, name: "Bryan James", avg_score_pct: 58.5, trend: "struggling", avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80", focus_module: "Multi-Stage Docker Layer Optimization" },
  ],
};

const PREVIEW_LEADERBOARD = {
  1: [
    { rank: 1, trainee_id: 1, name: "Danielle Johnson", avg_score_pct: 94.6, session_count: 14, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", specialization: "Web Core Lead Architect" },
    { rank: 2, trainee_id: 2, name: "Joshua Walker", avg_score_pct: 91.2, session_count: 12, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", specialization: "TypeScript & State Engine" },
    { rank: 3, trainee_id: 3, name: "Jill Rhodes", avg_score_pct: 88.5, session_count: 11, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", specialization: "React Component Systems" },
    { rank: 4, trainee_id: 4, name: "Patricia Miller", avg_score_pct: 84.0, session_count: 10, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80", specialization: "RESTful API Integration" },
    { rank: 5, trainee_id: 5, name: "Robert Johnson", avg_score_pct: 81.4, session_count: 9, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80", specialization: "Frontend Performance Profiler" },
  ],
  2: [
    { rank: 1, trainee_id: 11, name: "Linda Wolfe", avg_score_pct: 95.8, session_count: 15, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", specialization: "Distributed Database Systems" },
    { rank: 2, trainee_id: 12, name: "Matthew Moore", avg_score_pct: 93.1, session_count: 13, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80", specialization: "PostgreSQL Engine Optimization" },
    { rank: 3, trainee_id: 13, name: "Susan Rogers", avg_score_pct: 89.4, session_count: 12, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", specialization: "Data Pipeline & ETL Streams" },
    { rank: 4, trainee_id: 14, name: "Christopher Davis", avg_score_pct: 85.2, session_count: 10, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", specialization: "ACID Transaction Engineering" },
    { rank: 5, trainee_id: 15, name: "Melanie Munoz", avg_score_pct: 82.7, session_count: 9, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80", specialization: "Columnar Storage Indexer" },
  ],
  3: [
    { rank: 1, trainee_id: 21, name: "Janet Williams", avg_score_pct: 96.4, session_count: 16, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80", specialization: "Cloud Native & Microservices" },
    { rank: 2, trainee_id: 22, name: "Jeremy Roberts", avg_score_pct: 92.5, session_count: 14, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80", specialization: "Kubernetes Cluster Orchestrator" },
    { rank: 3, trainee_id: 23, name: "Christopher Hall", avg_score_pct: 88.9, session_count: 11, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", specialization: "Terraform Infrastructure Lead" },
    { rank: 4, trainee_id: 24, name: "Craig Ramirez", avg_score_pct: 86.1, session_count: 10, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80", specialization: "gRPC & Service Mesh Networking" },
    { rank: 5, trainee_id: 25, name: "Cynthia Diaz", avg_score_pct: 83.0, session_count: 9, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80", specialization: "Distributed Resilience Patterns" },
  ],
  4: [
    { rank: 1, trainee_id: 31, name: "Veronica Bowman", avg_score_pct: 94.2, session_count: 13, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80", specialization: "Full-Stack System Design" },
    { rank: 2, trainee_id: 32, name: "Angela Cohen", avg_score_pct: 91.0, session_count: 12, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80", specialization: "Async Python & React State" },
    { rank: 3, trainee_id: 33, name: "Megan Parsons", avg_score_pct: 87.8, session_count: 11, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80", specialization: "API Security & JWT Systems" },
    { rank: 4, trainee_id: 34, name: "Jeremy Johnson", avg_score_pct: 84.5, session_count: 10, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80", specialization: "SQLAlchemy & ORM Patterns" },
    { rank: 5, trainee_id: 35, name: "Leslie Adams", avg_score_pct: 81.2, session_count: 9, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80", specialization: "Modern Frontend Bundlers" },
  ],
  5: [
    { rank: 1, trainee_id: 41, name: "Anna Baker", avg_score_pct: 97.1, session_count: 16, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80", specialization: "DevOps & SRE Principal" },
    { rank: 2, trainee_id: 42, name: "Brenda Hurst", avg_score_pct: 93.8, session_count: 14, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80", specialization: "Automated Deployment Pipelines" },
    { rank: 3, trainee_id: 43, name: "Reginald Robinson", avg_score_pct: 90.2, session_count: 13, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80", specialization: "Site Reliability & Prometheus" },
    { rank: 4, trainee_id: 44, name: "Whitney Hicks", avg_score_pct: 86.4, session_count: 11, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80", specialization: "Multi-Cloud Networking" },
    { rank: 5, trainee_id: 45, name: "Christopher Williams", avg_score_pct: 82.9, session_count: 10, status: "on_track", avatar_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80", specialization: "Docker Security & Hardening" },
  ],
};

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
        setData(PREVIEW_WEEKLY[batchId] || PREVIEW_WEEKLY[1] || []);
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
        setData(PREVIEW_BANDS[batchId] || PREVIEW_BANDS[1] || []);
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
      // Query the trained ML Early-Warning attention endpoint (Synopsis Section 10)
      const res = await apiClient.get(`/analytics/batches/${batchId}/ml-attention`);
      setData(res.data || []);
    } catch (err) {
      if (isNetworkFailure(err)) {
        setData(PREVIEW_ATTENTION[batchId] || PREVIEW_ATTENTION[1] || []);
      } else {
        // Fallback to traditional attention endpoint if ML service is cold
        try {
          const fallbackRes = await apiClient.get(`/analytics/batches/${batchId}/attention`);
          setData(fallbackRes.data || []);
        } catch {
          setError(err.message || "Failed to load ML attention roster");
        }
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
        setData(PREVIEW_LEADERBOARD[batchId] || PREVIEW_LEADERBOARD[1] || []);
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
        const cohortLeaderboard = PREVIEW_LEADERBOARD[batchId] || PREVIEW_LEADERBOARD[1] || [];
        setData(cohortLeaderboard[0] || null);
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

const PREVIEW_HEATMAP = {
  1: {
    batch_id: 1,
    batch_name: "Batch A - Web Core",
    modules: [
      { id: 1, name: "Web Foundations" },
      { id: 2, name: "React State" },
      { id: 3, name: "FastAPI REST" },
      { id: 4, name: "PostgreSQL" },
    ],
    rows: [
      {
        trainee_id: 1,
        trainee_name: "Danielle Johnson",
        cells: [
          { module_id: 1, module_name: "Web Foundations", score_pct: 95.0, session_count: 4, band: "excellent" },
          { module_id: 2, module_name: "React State", score_pct: 92.5, session_count: 3, band: "excellent" },
          { module_id: 3, module_name: "FastAPI REST", score_pct: 88.0, session_count: 4, band: "excellent" },
          { module_id: 4, module_name: "PostgreSQL", score_pct: 78.0, session_count: 3, band: "excellent" },
        ],
      },
      {
        trainee_id: 2,
        trainee_name: "Joshua Walker",
        cells: [
          { module_id: 1, module_name: "Web Foundations", score_pct: 88.0, session_count: 3, band: "excellent" },
          { module_id: 2, module_name: "React State", score_pct: 72.0, session_count: 3, band: "passing" },
          { module_id: 3, module_name: "FastAPI REST", score_pct: 68.0, session_count: 3, band: "passing" },
          { module_id: 4, module_name: "PostgreSQL", score_pct: null, session_count: 0, band: null },
        ],
      },
      {
        trainee_id: 3,
        trainee_name: "Jill Rhodes",
        cells: [
          { module_id: 1, module_name: "Web Foundations", score_pct: 64.0, session_count: 3, band: "passing" },
          { module_id: 2, module_name: "React State", score_pct: 54.0, session_count: 2, band: "struggling" },
          { module_id: 3, module_name: "FastAPI REST", score_pct: null, session_count: 0, band: null },
          { module_id: 4, module_name: "PostgreSQL", score_pct: null, session_count: 0, band: null },
        ],
      },
    ],
  },
};

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
      if (isNetworkFailure(err)) {
        setData(PREVIEW_HEATMAP[batchId] || PREVIEW_HEATMAP[1] || null);
      } else {
        setError(err.message || "Failed to load cohort heatmap");
      }
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
      if (isNetworkFailure(err) || err.response?.status === 404) {
        setHotspots([]);
      } else {
        setError(err.message || "Failed to load module hotspots");
      }
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
      if (isNetworkFailure(err) || err.response?.status === 404) {
        setRemediations([]);
      } else {
        setError(err.message || "Failed to load intervention outcomes");
      }
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
      if (isNetworkFailure(err) || err.response?.status === 404) {
        setAnalysis(null);
      } else {
        setError(err.message || "Failed to load misconception analysis");
      }
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
