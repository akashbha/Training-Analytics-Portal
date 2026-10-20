// src/components/Navbar.jsx
// Floating pill navigation bar styled with purple brand accents, role links, and live WebSocket status indicator.
// Exposes Users and Audit Logs navigation for admins only, and provides a Change Password modal for all authenticated roles.

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLive } from "../context/LiveContext.jsx";
import { Card } from "./Card.jsx";
import { Spinner } from "./Spinner.jsx";
import { KeyRound, LogOut, X, AlertTriangle, CheckCircle2, Crown, Shield, User } from "lucide-react";

function LiveBadge() {
  const { status } = useLive();

  if (status === "connected") {
    return (
      <div
        title="Live WebSocket stream connected"
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-extrabold text-emerald-700 shadow-2xs"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Live</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div
        title="WebSocket disconnected, reconnecting with exponential backoff..."
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-extrabold text-amber-700 shadow-2xs"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span>Reconnecting...</span>
      </div>
    );
  }

  return (
    <div
      title="WebSocket offline (Polling fallback active every 15s)"
      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-extrabold text-slate-500 shadow-2xs"
    >
      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
      <span>Offline</span>
    </div>
  );
}

export function Navbar({ liveSlot = null }) {
  const { user, isAdmin, isTrainer, logout, changePassword } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Change Password Modal state
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // Compute initials from email or username
  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "TP";

  // Navigation items based on role matrix:
  // Trainee sees: "My Progress", Profile/Logout
  // Trainer sees: Dashboard, Trainees, Add Session, Batches (view-only), Profile/Logout
  // Admin sees: Dashboard, Trainees, Add Session, Batches, Modules, Users, Audit Logs, Profile/Logout
  const navItems = isAdmin
    ? [
        { label: "Dashboard", to: "/" },
        { label: "Batches", to: "/batches" },
        { label: "Trainees", to: "/trainees" },
        { label: "Add Session", to: "/sessions/new" },
        { label: "Modules", to: "/modules" },
        { label: "Users", to: "/admin/users" },
        { label: "Audit Logs", to: "/admin/audit-logs" },
      ]
    : isTrainer
    ? [
        { label: "Dashboard", to: "/" },
        { label: "Batches", to: "/batches" },
        { label: "Trainees", to: "/trainees" },
        { label: "Add Session", to: "/sessions/new" },
      ]
    : [];

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess("");

    if (newPwd.length < 8) {
      setPwdError("New password must be at least 8 characters long.");
      return;
    }

    setPwdLoading(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdSuccess("Password updated successfully!");
      setCurrentPwd("");
      setNewPwd("");
      setTimeout(() => {
        setPwdModalOpen(false);
        setPwdSuccess("");
      }, 1500);
    } catch (err) {
      setPwdError(err.message || "Failed to change password");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-4 z-40 px-4 max-w-7xl mx-auto">
        <nav className="bg-white/95 backdrop-blur-md rounded-full px-5 py-3 shadow-sm border border-purple-100 flex items-center justify-between">
          {/* Brand Logo & Live Indicator Slot */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2 font-extrabold text-lg tracking-tight text-brand">
              <span className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-sm font-black">
                T
              </span>
              <span className="text-slate-900">Training portal</span>
            </Link>

            {/* Live Indicator (green / amber / grey) */}
            <div id="live-indicator-slot">{liveSlot || <LiveBadge />}</div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-brand text-white shadow-xs"
                      : "text-slate-600 hover:text-brand hover:bg-brand-light/60"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                  {user?.email}
                </div>
              </div>
              {/* Distinct role badges */}
              {user?.role === "admin" && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                  <Crown className="w-3 h-3 text-purple-700 fill-purple-700" />
                  <span>Admin</span>
                </span>
              )}
              {user?.role === "trainer" && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                  <Shield className="w-3 h-3 text-indigo-700" />
                  <span>Trainer</span>
                </span>
              )}
              {user?.role === "trainee" && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                  <User className="w-3 h-3 text-emerald-700" />
                  <span>Trainee</span>
                </span>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="User profile menu"
                className="w-9 h-9 rounded-full bg-brand-light text-brand font-extrabold text-xs flex items-center justify-center hover:ring-2 hover:ring-brand/40 transition-all cursor-pointer"
              >
                {initials}
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-purple-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100 sm:hidden">
                    <div className="text-xs font-semibold text-slate-900 truncate">{user?.email}</div>
                    <div className="text-[10px] text-brand uppercase font-bold">{user?.role}</div>
                  </div>

                  {/* Change Password option for all roles */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setPwdError("");
                      setPwdSuccess("");
                      setPwdModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-brand-light/60 hover:text-brand flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Change password</span>
                  </button>

                  {/* Sign out */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Change Password Modal */}
      {pwdModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card variant="white" className="w-full max-w-sm p-6 shadow-xl border-purple-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-purple-100">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Change Password</h3>
              </div>
              <button
                onClick={() => setPwdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pwdError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-full text-xs font-bold transition-all shadow-sm flex items-center space-x-1 cursor-pointer disabled:opacity-60"
                >
                  {pwdLoading ? <Spinner size="sm" className="text-white" /> : <span>Update</span>}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

export default Navbar;
