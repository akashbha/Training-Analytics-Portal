// src/components/Navbar.jsx
// Anchored, clean edge-to-edge header for the Training Analytics Portal.
// Clean edge-to-edge header for the Training Analytics Portal.

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLive } from "../context/LiveContext.jsx";
import { Spinner } from "./Spinner.jsx";
import { KeyRound, LogOut, X, AlertTriangle, CheckCircle2, Crown, Shield, User } from "lucide-react";

function LiveBadge() {
  const { status } = useLive();

  if (status === "connected") {
    return (
      <div
        title="Live WebSocket stream connected"
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700"
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
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span>Reconnecting</span>
      </div>
    );
  }

  return (
    <div
      title="WebSocket offline (Polling fallback active every 15s)"
      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-500"
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

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "TP";

  const navItems = isAdmin
    ? [
        { label: "Home", to: "/" },
        { label: "Dashboard", to: "/admin" },
        { label: "Batches", to: "/batches" },
        { label: "Trainees", to: "/trainees" },
        { label: "Add Session", to: "/sessions/new" },
        { label: "Modules", to: "/modules" },
        { label: "Users", to: "/admin/users" },
        { label: "Audit Logs", to: "/admin/audit-logs" },
      ]
    : isTrainer
    ? [
        { label: "Home", to: "/" },
        { label: "Dashboard", to: "/dashboard" },
        { label: "Batches", to: "/batches" },
        { label: "Trainees", to: "/trainees" },
        { label: "Add Session", to: "/sessions/new" },
        { label: "Messages", to: "/messages" },
      ]
    : [
        { label: "Home", to: "/" },
        { label: "My Dossier", to: `/trainees/${user?.trainee_id || 1}` },
        { label: "Messages", to: "/messages" },
      ];

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
      <header className="w-full bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Live Indicator */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs shadow-xs">
                T
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight text-slate-900 leading-none">
                  TRAINING PORTAL
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {user?.role === "admin" ? "Admin Console" : user?.role === "trainer" ? "Trainer Console" : "Trainee Portal"}
                </span>
              </div>
            </Link>

            {/* Live Indicator */}
            {liveSlot ? <div>{liveSlot}</div> : null}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 truncate max-w-[160px]">
                  {user?.email}
                </div>
              </div>
              {user?.role === "admin" && (
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                  Admin
                </span>
              )}
              {user?.role === "trainer" && (
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase tracking-wider">
                  Trainer
                </span>
              )}
              {user?.role === "trainee" && (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                  Trainee
                </span>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="User profile menu"
                className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                {initials}
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.email}</p>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                      Role: {user?.role}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setPwdError("");
                      setPwdSuccess("");
                      setCurrentPwd("");
                      setNewPwd("");
                      setPwdModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Change Password</span>
                  </button>

                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center space-x-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      {pwdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 relative">
            <button
              onClick={() => setPwdModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
            <p className="text-xs text-slate-500 mt-1">
              Update your account password. Must be at least 8 characters.
            </p>

            {pwdError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {pwdError}
              </div>
            )}

            {pwdSuccess && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold">
                {pwdSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {pwdLoading ? <Spinner size="sm" /> : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
