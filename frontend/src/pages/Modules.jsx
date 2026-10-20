// src/pages/Modules.jsx
// Curriculum Modules management portal (Admin / Staff).
// Supports module creation with score ceiling validation, updates, deletion, and preview resilience.

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiClient } from "../api/client.js";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Search,
  CheckCircle2,
  Award,
} from "lucide-react";

const PREVIEW_MODULES = [
  { id: 1, name: "Python Core & Data Structures", max_score: 100.0, session_count: 48 },
  { id: 2, name: "Algorithms & Complexity", max_score: 50.0, session_count: 36 },
  { id: 3, name: "SQL & Relational Schema Modeling", max_score: 100.0, session_count: 42 },
  { id: 4, name: "FastAPI & REST Architecture", max_score: 20.0, session_count: 28 },
  { id: 5, name: "React & State Engineering", max_score: 100.0, session_count: 54 },
  { id: 6, name: "System Design & Cloud Deployment", max_score: 50.0, session_count: 22 },
];

export function Modules() {
  const { isAdmin } = useAuth();

  const [modules, setModules] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [formData, setFormData] = useState({ name: "", max_score: "100" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/modules?page=1&page_size=100");
      const list = res.data?.items || res.data || [];
      setModules(list);
      setTotal(res.data?.total || list.length);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setModules(PREVIEW_MODULES);
        setTotal(PREVIEW_MODULES.length);
      } else {
        setError(err.message || "Failed to load curriculum modules");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const filteredModules = modules.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleOpenAdd = () => {
    setEditingModule(null);
    setFormData({ name: "", max_score: "100" });
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (mod, e) => {
    e.stopPropagation();
    setEditingModule(mod);
    setFormData({ name: mod.name, max_score: String(mod.max_score) });
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenDelete = (mod, e) => {
    e.stopPropagation();
    setDeleteTarget(mod);
    setDeleteError("");
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const scoreNum = parseFloat(formData.max_score);
    if (!formData.name.trim()) {
      setFormError("Module title is required.");
      return;
    }
    if (isNaN(scoreNum) || scoreNum <= 0) {
      setFormError("Maximum score must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingModule) {
        await apiClient.put(`/modules/${editingModule.id}`, {
          name: formData.name.trim(),
          max_score: scoreNum,
        });
      } else {
        await apiClient.post("/modules", {
          name: formData.name.trim(),
          max_score: scoreNum,
        });
      }
      setModalOpen(false);
      fetchModules();
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        // Fallback demo update
        if (editingModule) {
          setModules((prev) =>
            prev.map((m) =>
              m.id === editingModule.id ? { ...m, name: formData.name, max_score: scoreNum } : m
            )
          );
        } else {
          const newMod = {
            id: Date.now(),
            name: formData.name.trim(),
            max_score: scoreNum,
            session_count: 0,
          };
          setModules((prev) => [newMod, ...prev]);
        }
        setModalOpen(false);
      } else {
        setFormError(err.response?.data?.error?.message || err.message || "Failed to save module");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiClient.delete(`/modules/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchModules();
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setModules((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setDeleteError(err.response?.data?.error?.message || err.message || "Failed to delete module");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dark Purple Hero Card */}
      <Card variant="dark">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-bold uppercase tracking-wider mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Curriculum Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Assessment Modules
            </h1>
            <p className="text-xs sm:text-sm text-purple-200 mt-1 max-w-xl">
              Configure curriculum evaluation benchmarks, positive maximum scores, and module specifications.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white text-brand hover:bg-purple-50 rounded-full text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Module</span>
            </button>
          )}
        </div>
      </Card>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search modules by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-purple-100 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
          />
        </div>
        <div className="text-xs font-bold text-slate-500">
          Total Modules: <span className="text-brand">{total}</span>
        </div>
      </div>

      {/* Modules List Grid */}
      {loading ? (
        <Card variant="white" className="p-12 flex justify-center">
          <Spinner size="lg" />
        </Card>
      ) : error ? (
        <Card variant="white" className="p-8 text-center border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-rose-700">{error}</p>
          <button
            onClick={fetchModules}
            className="mt-3 px-4 py-1.5 bg-brand text-white rounded-full text-xs font-bold hover:bg-brand-dark"
          >
            Retry
          </button>
        </Card>
      ) : filteredModules.length === 0 ? (
        <Card variant="white" className="p-12 text-center">
          <p className="text-sm font-bold text-slate-700">No assessment modules found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((mod) => (
            <Card
              key={mod.id}
              variant="white"
              className="p-5 flex flex-col justify-between hover:border-brand/40 transition-all border border-purple-100 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand"></span>
                    <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-brand transition-colors">
                      {mod.name}
                    </h3>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => handleOpenEdit(mod, e)}
                        title="Edit Module"
                        className="p-1.5 rounded-full hover:bg-purple-50 text-slate-400 hover:text-brand transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleOpenDelete(mod, e)}
                        title="Delete Module"
                        className="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-semibold">
                    <Award className="w-3.5 h-3.5 text-brand" />
                    <span>Max Score</span>
                  </div>
                  <span className="text-sm font-black text-brand">{mod.max_score} pts</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-purple-50 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Module ID: #{mod.id}</span>
                <span>Active Curriculum</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-md p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {editingModule ? "Edit Assessment Module" : "New Curriculum Module"}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Module Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Distributed Consensus Systems"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Maximum Assessment Score *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.5"
                  value={formData.max_score}
                  onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                  placeholder="100"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
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
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center space-x-1 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? <Spinner size="sm" className="text-white" /> : <span>{editingModule ? "Save Changes" : "Create Module"}</span>}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-sm p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2 text-rose-600 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-extrabold text-slate-900">Delete Module</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete module{" "}
              <strong className="text-slate-900">"{deleteTarget.name}"</strong>? This will cascade and delete associated evaluation sessions.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold transition-colors shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-60"
              >
                {deleting ? <Spinner size="sm" className="text-white" /> : <span>Delete</span>}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Modules;
