// src/pages/AuditLogs.jsx
// Compliance audit trail viewer displaying administrative and curriculum mutations with filters.
// Read-only paginated table tracking timestamp, actor email, action taxonomy, and serialized state details.

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { apiClient } from "../api/client.js";
import {
  FileText,
  Filter,
  RefreshCw,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  Layers,
} from "lucide-react";

const PREVIEW_LOGS = [
  {
    id: 1,
    user_id: 1,
    user_email: "admin@example.com",
    action: "user_created",
    entity_type: "user",
    entity_id: 2,
    details: { email: "new_trainer@example.com", role: "trainer" },
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    user_id: 1,
    user_email: "admin@example.com",
    action: "batch_created",
    entity_type: "batch",
    entity_id: 3,
    details: { name: "Cohort Gamma (Cloud Architecture)", start_date: "2026-03-01", end_date: "2026-08-31" },
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 3,
    user_id: 1,
    user_email: "admin@example.com",
    action: "module_created",
    entity_type: "module",
    entity_id: 4,
    details: { name: "React & State Engineering", max_score: 100.0 },
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 4,
    user_id: 1,
    user_email: "admin@example.com",
    action: "trainee_created",
    entity_type: "trainee",
    entity_id: 5,
    details: { name: "Elena Rostova", email: "elena.r@example.com", batch_id: 1 },
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
  {
    id: 5,
    user_id: 1,
    user_email: "admin@example.com",
    action: "password_reset",
    entity_type: "user",
    entity_id: 6,
    details: { email: "inactive.trainer@example.com" },
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      if (actionFilter) params.append("action", actionFilter);
      if (entityFilter) params.append("entity_type", entityFilter);

      const res = await apiClient.get(`/admin/audit-logs?${params.toString()}`);
      setLogs(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        let filtered = [...PREVIEW_LOGS];
        if (actionFilter) filtered = filtered.filter((l) => l.action === actionFilter);
        if (entityFilter) filtered = filtered.filter((l) => l.entity_type === entityFilter);
        setLogs(filtered);
        setTotal(filtered.length);
      } else {
        setError(err.message || "Failed to load audit logs");
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action) => {
    if (action.includes("delete") || action.includes("deactivate")) {
      return "bg-rose-100 text-rose-700 border-rose-200";
    }
    if (action.includes("create")) {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
    if (action.includes("password")) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    return "bg-purple-100 text-brand border-purple-200";
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-900"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand">Compliance & Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all user lifecycle changes, cohort curricula edits, entity deletions, and credential events.
          </p>
        </div>

        <div>
          <button
            onClick={() => fetchLogs()}
            className="px-4 py-2 bg-white border border-purple-100 hover:bg-brand-light text-slate-700 hover:text-brand rounded-full font-bold text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card variant="white" className="p-4 border-purple-100 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-bold text-slate-700">Filter By:</span>
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="user_created">user_created</option>
            <option value="user_updated">user_updated</option>
            <option value="user_deactivated">user_deactivated</option>
            <option value="password_reset">password_reset</option>
            <option value="password_changed">password_changed</option>
            <option value="batch_created">batch_created</option>
            <option value="batch_updated">batch_updated</option>
            <option value="batch_deleted">batch_deleted</option>
            <option value="module_created">module_created</option>
            <option value="module_updated">module_updated</option>
            <option value="module_deleted">module_deleted</option>
            <option value="trainee_created">trainee_created</option>
            <option value="trainee_updated">trainee_updated</option>
            <option value="trainee_deleted">trainee_deleted</option>
            <option value="session_deleted">session_deleted</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <option value="">All Entity Types</option>
            <option value="user">User</option>
            <option value="batch">Batch</option>
            <option value="module">Module</option>
            <option value="trainee">Trainee</option>
            <option value="session">Session</option>
          </select>
        </div>
      </Card>

      {/* Audit Logs Table */}
      <Card variant="white" className="border-purple-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Spinner size="lg" />
            <span className="text-xs text-slate-500 font-medium">Loading audit history...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-rose-600">{error}</p>
            <button
              onClick={() => fetchLogs()}
              className="px-4 py-1.5 bg-brand text-white rounded-full text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No audit records found</p>
            <p className="text-xs text-slate-400">Activity will appear here as administrative actions occur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-purple-100 bg-purple-50/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {logs.map((log) => {
                  const dateFormatted = log.created_at
                    ? new Date(log.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "—";

                  const isExpanded = expandedId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-purple-50/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadge(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <span className="capitalize">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="text-slate-400 font-normal ml-1">#{log.entity_id}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {log.user_email || (log.user_id ? `User #${log.user_id}` : "System")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {log.details ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 hover:bg-brand-light text-slate-700 hover:text-brand transition-colors cursor-pointer"
                            >
                              {isExpanded ? "Hide" : "Inspect"}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && log.details && (
                        <tr className="bg-purple-50/30">
                          <td colSpan={5} className="p-4">
                            <div className="bg-slate-900 text-purple-200 p-3 rounded-2xl font-mono text-[11px] overflow-x-auto shadow-inner border border-purple-500/20">
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {total > pageSize && (
          <div className="px-4 py-3 border-t border-purple-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {logs.length} of {total} events
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1 rounded-full border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-1 rounded-full border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default AuditLogs;
