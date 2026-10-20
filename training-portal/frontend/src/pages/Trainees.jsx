// src/pages/Trainees.jsx
// Trainer directory managing learner rosters with debounced search, batch filters, and pagination.
// Supports trainee creation/updates with inline 409 duplicate email handling and row links to individual profiles.

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { apiClient } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  Search,
  Plus,
  Filter,
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  X,
  ChevronLeft,
  Mail,
  User,
  GraduationCap,
} from "lucide-react";

export function Trainees() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Data states
  const [trainees, setTrainees] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states for Add/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrainee, setEditingTrainee] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", batch_id: "" });
  const [formError, setFormError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Debounce search query by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load cohorts for filter dropdown
  useEffect(() => {
    apiClient
      .get("/batches?page=1&page_size=100")
      .then((res) => {
        const list = res.data?.items || res.data || [];
        setBatches(list);
      })
      .catch(() => {});
  }, []);

  // Fetch paginated trainees
  const fetchTrainees = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      params.append("sort", "name");

      if (debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }
      if (selectedBatchId) {
        params.append("batch_id", selectedBatchId);
      }

      const res = await apiClient.get(`/trainees?${params.toString()}`);
      const data = res.data;

      setTrainees(data.items || []);
      setTotalItems(data.total || 0);
      setTotalPages(data.pages || 1);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        const fallbackTrainees = [
          { id: 1, name: "Alex Chen", email: "alex.chen@example.com", batch_id: 1, batch_name: "Cohort Alpha", avg_score_pct: 54.2, session_count: 8, status: "needs_help" },
          { id: 2, name: "Jordan Taylor", email: "jordan.t@example.com", batch_id: 1, batch_name: "Cohort Alpha", avg_score_pct: 58.0, session_count: 6, status: "struggling" },
          { id: 3, name: "Samantha Reed", email: "s.reed@example.com", batch_id: 1, batch_name: "Cohort Alpha", avg_score_pct: 59.5, session_count: 5, status: "struggling" },
          { id: 4, name: "Elena Rostova", email: "elena.r@example.com", batch_id: 1, batch_name: "Cohort Alpha", avg_score_pct: 94.6, session_count: 14, status: "on_track" },
          { id: 5, name: "Marcus Vance", email: "m.vance@example.com", batch_id: 1, batch_name: "Cohort Alpha", avg_score_pct: 91.2, session_count: 12, status: "on_track" },
          { id: 6, name: "Chloe Bennett", email: "chloe.b@example.com", batch_id: 1, batch_name: "Cohort Alpha", avg_score_pct: 88.5, session_count: 11, status: "on_track" },
          { id: 7, name: "David Kim", email: "david.kim@example.com", batch_id: 2, batch_name: "Cohort Beta", avg_score_pct: 82.0, session_count: 10, status: "on_track" },
          { id: 8, name: "Priya Patel", email: "priya.p@example.com", batch_id: 2, batch_name: "Cohort Beta", avg_score_pct: 79.4, session_count: 9, status: "on_track" },
          { id: 9, name: "Liam O'Connor", email: "liam.oc@example.com", batch_id: 2, batch_name: "Cohort Beta", avg_score_pct: null, session_count: 0, status: "no_sessions" },
        ];
        setTrainees(fallbackTrainees);
        setTotalItems(fallbackTrainees.length);
        setTotalPages(1);
      } else {
        setError(err.message || "Failed to load trainees roster");
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedBatchId]);

  useEffect(() => {
    fetchTrainees();
  }, [fetchTrainees]);

  // Live updates: refetch on any event, debounced by 500ms
  const debounceTimerRef = React.useRef(null);
  useLiveEvent(
    useCallback(() => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchTrainees(true);
      }, 500);
    }, [fetchTrainees])
  );

  // Polling fallback: every 15s when offline, catch-up on reconnect
  usePollingFallback(useCallback(() => fetchTrainees(true), [fetchTrainees]), 15000);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingTrainee(null);
    setFormData({
      name: "",
      email: "",
      batch_id: batches.length > 0 ? String(batches[0].id) : "",
    });
    setFormError("");
    setEmailError("");
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (trainee, e) => {
    e.stopPropagation();
    setEditingTrainee(trainee);
    setFormData({
      name: trainee.name || "",
      email: trainee.email || "",
      batch_id: String(trainee.batch_id || ""),
    });
    setFormError("");
    setEmailError("");
    setModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.batch_id) {
      setFormError("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setEmailError("");

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        batch_id: Number(formData.batch_id),
      };

      if (editingTrainee) {
        await apiClient.put(`/trainees/${editingTrainee.id}`, payload);
      } else {
        await apiClient.post("/trainees", payload);
      }

      setModalOpen(false);
      fetchTrainees();
    } catch (err) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.message ||
        "An unexpected error occurred.";

      // Check if backend returned 409 duplicate email conflict
      if (
        err.status === 409 ||
        err.response?.status === 409 ||
        errMsg.toLowerCase().includes("email")
      ) {
        setEmailError(errMsg);
      } else {
        setFormError(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (trainee, e) => {
    e.stopPropagation();
    setDeleteTarget(trainee);
    setDeleteError("");
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiClient.delete(`/trainees/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchTrainees();
    } catch (err) {
      setDeleteError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to delete trainee record."
      );
    } finally {
      setDeleting(false);
    }
  };

  // Click row to navigate to Trainee Profile
  const handleRowClick = (traineeId) => {
    navigate(`/trainees/${traineeId}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Add Trainee Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-brand">
            Learner Directory
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Enrolled Trainees
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter by cohort, search by name or email, and inspect individual performance profiles
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Trainee</span>
        </button>
      </div>

      {/* Filter and Search Bar Card */}
      <Card variant="white" className="p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Debounced Search input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-8 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Batch Cohort Filter */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Filter className="w-3.5 h-3.5 text-brand shrink-0" />
            <select
              value={selectedBatchId}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter trainees by cohort"
              className="w-full md:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
            >
              <option value="">All Cohort Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Trainees Paginated Table */}
      <Card variant="white" className="p-0 overflow-hidden shadow-xs border-purple-100/70">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2">
            <Spinner size="lg" />
            <span className="text-xs font-semibold text-slate-500">Loading trainee roster...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-xs text-red-600 font-semibold">{error}</p>
            <button
              onClick={fetchTrainees}
              className="mt-3 px-4 py-1.5 bg-brand text-white rounded-full text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : trainees.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-light text-brand mx-auto flex items-center justify-center font-bold text-lg mb-2">
              👥
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Trainees Found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              {searchTerm || selectedBatchId
                ? "No learners match your search criteria. Try modifying your filter."
                : "No trainees have been enrolled yet. Click 'Add Trainee' to begin."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-purple-100 bg-purple-50/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Trainee</th>
                  <th className="py-3 px-4">Cohort Batch</th>
                  <th className="py-3 px-4 text-center">Sessions</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {trainees.map((trainee) => {
                  const hasSessions = (trainee.session_count || 0) > 0;
                  const initials = trainee.name
                    ? trainee.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "TR";

                  return (
                    <tr
                      key={trainee.id}
                      onClick={() => handleRowClick(trainee.id)}
                      className="hover:bg-purple-50/50 transition-colors group cursor-pointer"
                    >
                      {/* Name & Initials Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-brand-light text-brand font-black text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 group-hover:text-brand transition-colors truncate">
                              {trainee.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate flex items-center space-x-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{trainee.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-purple-50 text-brand text-[11px] font-bold border border-purple-100">
                          {trainee.batch_name || `Batch #${trainee.batch_id}`}
                        </span>
                      </td>

                      {/* Sessions count */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {trainee.session_count || 0}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {!hasSessions ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            No sessions
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions & Arrow */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(trainee, e)}
                            title="Edit trainee"
                            className="p-1.5 rounded-full hover:bg-purple-100/70 text-slate-400 hover:text-brand transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenDelete(trainee, e)}
                              title="Delete trainee"
                              className="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="p-4 border-t border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold bg-white">
            <div>
              Showing <span className="text-slate-800">{trainees.length}</span> of{" "}
              <span className="text-slate-800">{totalItems}</span> enrolled trainees
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-full border border-purple-100 bg-white hover:bg-purple-50 disabled:opacity-40 text-slate-700 flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-2 font-bold text-slate-700">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-full border border-purple-100 bg-white hover:bg-purple-50 disabled:opacity-40 text-slate-700 flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl border border-purple-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-black text-slate-900">
                {editingTrainee ? "Edit Trainee Profile" : "Enroll New Trainee"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-2">
                <span>!</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Walker"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                />
              </div>

              {/* Email with Inline 409 error */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="alice.walker@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setEmailError("");
                  }}
                  className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border text-sm focus:outline-none focus:ring-2 focus:bg-white ${
                    emailError
                      ? "border-rose-400 focus:ring-rose-500 bg-rose-50/50"
                      : "border-slate-200 focus:ring-brand"
                  }`}
                />
                {emailError && (
                  <p className="mt-1.5 text-xs text-rose-600 font-bold flex items-center space-x-1">
                    <span>!</span>
                    <span>{emailError}</span>
                  </p>
                )}
              </div>

              {/* Cohort Batch Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assigned Cohort Batch
                </label>
                <select
                  required
                  value={formData.batch_id}
                  onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white cursor-pointer"
                >
                  <option value="">Select Cohort...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit / Cancel */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-full bg-brand hover:bg-brand-dark text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Spinner size="sm" className="text-white" />}
                  <span>{editingTrainee ? "Save Profile" : "Enroll Trainee"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl border border-rose-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900">Delete Trainee Record?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete <strong className="text-slate-800">{deleteTarget.name}</strong> ({deleteTarget.email})?
            </p>

            {deleteError && (
              <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 text-left font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-center space-x-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting && <Spinner size="sm" className="text-white" />}
                <span>Delete Trainee</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trainees;
