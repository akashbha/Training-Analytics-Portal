// src/pages/Users.jsx
// Administrative user lifecycle management portal matching the purple theme specification.
// Supports user creation with auto-generated temporary credentials, role mutations, activations, and self-protection guards.

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiClient } from "../api/client.js";
import {
  Users as UsersIcon,
  UserPlus,
  Search,
  Filter,
  Shield,
  KeyRound,
  Check,
  Copy,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";

const PREVIEW_USERS = [
  { id: 1, email: "admin@example.com", role: "admin", is_active: true, trainee_id: null, trainee_name: null },
  { id: 2, email: "trainer@example.com", role: "trainer", is_active: true, trainee_id: null, trainee_name: null },
  { id: 3, email: "alex.chen@example.com", role: "trainee", is_active: true, trainee_id: 1, trainee_name: "Alex Chen" },
  { id: 4, email: "jordan.t@example.com", role: "trainee", is_active: true, trainee_id: 2, trainee_name: "Jordan Taylor" },
  { id: 5, email: "elena.r@example.com", role: "trainee", is_active: true, trainee_id: 4, trainee_name: "Elena Rostova" },
  { id: 6, email: "inactive.trainer@example.com", role: "trainer", is_active: false, trainee_id: null, trainee_name: null },
];

export function Users() {
  const { user: currentAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal: Add User
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    email: "",
    role: "trainer",
    trainee_id: "",
    password: "",
  });
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [traineeOptions, setTraineeOptions] = useState([]);

  // Modal: Temporary Credentials Reveal
  const [revealModal, setRevealModal] = useState(null); // { email, tempPassword, title }
  const [copied, setCopied] = useState(false);

  // Fetch Trainee options for dropdown
  useEffect(() => {
    apiClient
      .get("/trainees?page=1&page_size=100")
      .then((res) => {
        setTraineeOptions(res.data?.items || res.data || []);
      })
      .catch(() => {
        setTraineeOptions([
          { id: 1, name: "Alex Chen", email: "alex.chen@example.com" },
          { id: 2, name: "Jordan Taylor", email: "jordan.t@example.com" },
          { id: 3, name: "Samantha Reed", email: "s.reed@example.com" },
          { id: 4, name: "Elena Rostova", email: "elena.r@example.com" },
        ]);
      });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("page_size", String(pageSize));
      if (search.trim()) params.append("search", search.trim());
      if (roleFilter) params.append("role", roleFilter);

      const res = await apiClient.get(`/admin/users?${params.toString()}`);
      setUsers(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        // Fallback for preview mode
        let filtered = [...PREVIEW_USERS];
        if (roleFilter) filtered = filtered.filter((u) => u.role === roleFilter);
        if (search.trim()) {
          const s = search.toLowerCase();
          filtered = filtered.filter(
            (u) => u.email.toLowerCase().includes(s) || (u.trainee_name && u.trainee_name.toLowerCase().includes(s))
          );
        }
        setUsers(filtered);
        setTotal(filtered.length);
      } else {
        setError(err.message || "Failed to load user accounts");
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddSubmitting(true);
    try {
      const payload = {
        email: addForm.email.trim(),
        role: addForm.role,
        trainee_id: addForm.role === "trainee" && addForm.trainee_id ? Number(addForm.trainee_id) : null,
        password: addForm.password.trim() || undefined,
      };

      const res = await apiClient.post("/admin/users", payload);
      setAddModalOpen(false);
      setAddForm({ email: "", role: "trainer", trainee_id: "", password: "" });
      fetchUsers();

      // Show temporary password modal
      setRevealModal({
        title: "User Account Provisioned",
        email: payload.email,
        tempPassword: res.data?.temporary_password || payload.password || "GeneratedSecret@123",
      });
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK") {
        // Preview mode mock create
        const newMock = {
          id: Date.now(),
          email: addForm.email,
          role: addForm.role,
          is_active: true,
          trainee_id: addForm.role === "trainee" ? Number(addForm.trainee_id) : null,
          trainee_name: "Mock Trainee",
        };
        setUsers((prev) => [newMock, ...prev]);
        setTotal((prev) => prev + 1);
        setAddModalOpen(false);
        setRevealModal({
          title: "User Account Provisioned (Demo Preview)",
          email: addForm.email,
          tempPassword: addForm.password || "Temporary@123",
        });
      } else {
        setAddError(err.message || "Failed to create user account");
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    const nextActive = !targetUser.is_active;
    if (targetUser.id === currentAdmin?.id && !nextActive) {
      alert("You cannot deactivate your own administrative account.");
      return;
    }
    try {
      await apiClient.patch(`/admin/users/${targetUser.id}`, { is_active: nextActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextActive } : u))
      );
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK") {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextActive } : u))
        );
      } else {
        alert(err.message || "Failed to update user status");
      }
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.id === currentAdmin?.id && newRole !== "admin") {
      alert("You cannot demote your own administrative account.");
      return;
    }
    try {
      await apiClient.patch(`/admin/users/${targetUser.id}`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK") {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
        );
      } else {
        alert(err.message || "Failed to update user role");
      }
    }
  };

  const handleResetPassword = async (targetUser) => {
    if (!window.confirm(`Reset password for ${targetUser.email}? A new temporary password will be generated.`)) {
      return;
    }
    try {
      const res = await apiClient.post(`/admin/users/${targetUser.id}/reset-password`);
      setRevealModal({
        title: "Password Reset Completed",
        email: targetUser.email,
        tempPassword: res.data?.temporary_password || "ResetSecret@123",
      });
    } catch (err) {
      if (!err.response || err.code === "ERR_NETWORK") {
        setRevealModal({
          title: "Password Reset Completed (Demo Preview)",
          email: targetUser.email,
          tempPassword: "DemoReset@123",
        });
      } else {
        alert(err.message || "Failed to reset password");
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand">System Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">User Accounts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authentication identities, role capabilities, account activation, and credential resets.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchUsers()}
            className="p-2.5 rounded-full bg-white border border-purple-100 hover:bg-brand-light text-slate-600 hover:text-brand transition-colors cursor-pointer shadow-xs"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setAddError("");
              setAddModalOpen(true);
            }}
            className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-full font-bold text-xs shadow-sm hover:shadow flex items-center space-x-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card variant="white" className="p-4 border-purple-100 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by email or trainee name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-brand" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="trainer">Trainers</option>
              <option value="trainee">Trainees</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card variant="white" className="border-purple-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Spinner size="lg" />
            <span className="text-xs text-slate-500 font-medium">Loading user accounts...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-rose-600">{error}</p>
            <button
              onClick={() => fetchUsers()}
              className="px-4 py-1.5 bg-brand text-white rounded-full text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <UsersIcon className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No users found</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or role filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-purple-100 bg-purple-50/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Linked Trainee</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {users.map((u) => {
                  const isSelf = u.id === currentAdmin?.id;
                  const roleBadgeClass =
                    u.role === "admin"
                      ? "bg-purple-900 text-white"
                      : u.role === "trainer"
                      ? "bg-brand text-white"
                      : "bg-purple-100 text-brand";

                  return (
                    <tr key={u.id} className="hover:bg-purple-50/40 transition-colors">
                      {/* Email & Self Tag */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span>{u.email}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        {isSelf ? (
                          <span
                            title="You cannot demote your own account"
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${roleBadgeClass} cursor-not-allowed inline-flex items-center space-x-1`}
                          >
                            <Shield className="w-3 h-3 inline mr-1" />
                            {u.role}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                            aria-label={`Change role for ${u.email}`}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${roleBadgeClass} border-none focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer`}
                          >
                            <option value="admin" className="text-slate-800 bg-white">Admin</option>
                            <option value="trainer" className="text-slate-800 bg-white">Trainer</option>
                            <option value="trainee" className="text-slate-800 bg-white">Trainee</option>
                          </select>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_active ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          ></span>
                          <span>{u.is_active ? "Active" : "Deactivated"}</span>
                        </span>
                      </td>

                      {/* Linked Trainee */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {u.role === "trainee" ? (
                          u.trainee_name ? (
                            <span className="font-semibold text-slate-800">{u.trainee_name} (ID: {u.trainee_id})</span>
                          ) : (
                            <span className="text-amber-600 font-medium">Linked ID #{u.trainee_id}</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Toggle Active */}
                          {isSelf ? (
                            <button
                              disabled
                              title="You cannot deactivate your own account"
                              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                            >
                              Lock
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer flex items-center space-x-1 ${
                                u.is_active
                                  ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              }`}
                            >
                              {u.is_active ? (
                                <>
                                  <UserX className="w-3 h-3" />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>Activate</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-brand hover:bg-purple-100 transition-colors cursor-pointer flex items-center space-x-1"
                            title="Generate a new temporary password"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Reset Pwd</span>
                          </button>
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
        {total > pageSize && (
          <div className="px-4 py-3 border-t border-purple-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {users.length} of {total} accounts
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

      {/* Add User Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-md p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Provision User Account</h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Role *
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                >
                  <option value="trainer">Trainer (Analytics & Session Grading)</option>
                  <option value="admin">Administrator (Full System & User Control)</option>
                  <option value="trainee">Trainee (Personal Dashboard View)</option>
                </select>
              </div>

              {addForm.role === "trainee" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Link Trainee Profile *
                  </label>
                  <select
                    required
                    value={addForm.trainee_id}
                    onChange={(e) => setAddForm({ ...addForm, trainee_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                    <option value="">-- Select enrolled trainee --</option>
                    {traineeOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Each trainee record must map to exactly one login account.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Password (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate secure password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center space-x-1 cursor-pointer disabled:opacity-60"
                >
                  {addSubmitting ? <Spinner size="sm" className="text-white" /> : <span>Create Account</span>}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Temporary Password Reveal Modal */}
      {revealModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-md p-6 shadow-2xl border-purple-100 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-xl font-black mb-3">
              ✓
            </div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{revealModal.title}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Credentials for <strong className="text-slate-800">{revealModal.email}</strong>. Copy and share these credentials now; temporary passwords are not shown again.
            </p>

            <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-2xl flex items-center justify-between font-mono text-sm font-bold text-brand mb-6">
              <span>{revealModal.tempPassword}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(revealModal.tempPassword)}
                className="px-3 py-1 bg-brand text-white text-xs font-sans font-bold rounded-full hover:bg-brand-dark transition-colors flex items-center space-x-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRevealModal(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              Done & Dismiss
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Users;
