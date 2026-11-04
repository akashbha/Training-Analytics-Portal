// src/components/Navbar.jsx
// Edge-to-edge header for the Training Analytics Portal with dark mode support,
// role links, live WebSocket status indicator, Dark/Light theme toggle, and Command Palette search trigger.

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLive } from "../context/LiveContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { Card } from "./Card.jsx";
import { Spinner } from "./Spinner.jsx";
import {
  KeyRound,
  LogOut,
  X,
  AlertTriangle,
  CheckCircle2,
  Crown,
  Shield,
  User,
  Search,
  Sun,
  Moon,
} from "lucide-react";

function LiveBadge() {
  const { status } = useLive();

  if (status === "connected") {
    return (
      <div
        title="Live WebSocket stream connected"
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 shadow-2xs"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="tracking-wide">LIVE</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div
        title="WebSocket disconnected, reconnecting with exponential backoff..."
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 shadow-2xs"
      >
        <Spinner size="xs" />
        <span className="tracking-wide">RECONNECTING</span>
      </div>
    );
  }

  return (
    <div
      title="WebSocket offline (Polling fallback active every 15s)"
      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 shadow-2xs"
    >
      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
      <span className="tracking-wide">OFFLINE</span>
    </div>
  );
}

export function Navbar({ liveSlot = null }) {
  const { user, isAdmin, isTrainer, logout, changePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  // Navigation items based on role matrix
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
      ]
    : [
        { label: "Home", to: "/" },
        { label: "My Dossier", to: `/trainees/${user?.trainee_id || 1}` },
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

  const openPalette = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <>
      <header className="w-full bg-white dark:bg-[#181427] border-b border-slate-200/90 dark:border-purple-900/40 sticky top-0 z-40 shadow-2xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Live Indicator */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-black dark:bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                T
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  TRAINING PORTAL
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-purple-300 uppercase tracking-widest mt-0.5">
                  {user?.role === "admin" ? "Admin Console" : user?.role === "trainer" ? "Trainer Console" : "Trainee Portal"}
                </span>
              </div>
            </Link>

            {/* Live Indicator */}
            {liveSlot ? <div>{liveSlot}</div> : <LiveBadge />}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-slate-100 dark:bg-purple-950/80 text-slate-900 dark:text-purple-200"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-950/40"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Action Center: Command Palette Trigger + Dark Mode Toggle + User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Command Palette Trigger Button */}
            <button
              type="button"
              onClick={openPalette}
              title="Search trainees, batches, or commands (Ctrl+K)"
              className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-purple-950/50 border border-slate-200/80 dark:border-purple-800/40 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-purple-600 transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-purple-300" />
              <span className="hidden sm:inline text-xs font-semibold">Search</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-[#181427] border border-slate-200 dark:border-purple-800/60 text-[10px] font-extrabold text-slate-600 dark:text-purple-300">
                ⌘K
              </kbd>
            </button>

            {/* Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-purple-950/50 border border-slate-200/80 dark:border-purple-800/40 text-slate-600 dark:text-purple-200 hover:border-slate-300 dark:hover:border-purple-600 flex items-center justify-center transition-all cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 animate-in spin-in-180 duration-200" />
              )}
            </button>

            {/* User Profile & Role Info */}
            <div className="flex items-center space-x-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                  {user?.email}
                </div>
              </div>

              {/* Role Badges */}
              {user?.role === "admin" && (
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900 dark:bg-purple-950/80 text-white dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>Admin</span>
                </span>
              )}
              {user?.role === "trainer" && (
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-indigo-950/80 text-blue-700 dark:text-indigo-300 border border-blue-200 dark:border-indigo-800 text-[10px] font-black uppercase tracking-wider">
                  <Shield className="w-3 h-3 text-blue-600 dark:text-indigo-400" />
                  <span>Trainer</span>
                </span>
              )}
              {user?.role === "trainee" && (
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  <User className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Trainee</span>
                </span>
              )}

              {/* Profile Avatar & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="User profile menu"
                  className="w-8 h-8 rounded-full bg-slate-900 dark:bg-purple-600 text-white font-bold text-xs flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  {initials}
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#181427] rounded-xl shadow-lg border border-slate-200 dark:border-purple-900/40 py-1.5 z-50 animate-in fade-in duration-100"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-purple-900/30">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-purple-300 uppercase tracking-wider mt-0.5">
                        Role: {user?.role}
                      </p>
                    </div>

                    {/* Mobile Navigation links inside dropdown */}
                    <div className="lg:hidden border-b border-slate-100 dark:border-purple-900/30 py-1">
                      {navItems.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-purple-950/50"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        openPalette();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-purple-950/50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center space-x-2">
                        <Search className="w-3.5 h-3.5" />
                        <span>Command Palette</span>
                      </span>
                      <kbd className="text-[10px] text-slate-400 font-bold">⌘K</kbd>
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setPwdError("");
                        setPwdSuccess("");
                        setCurrentPwd("");
                        setNewPwd("");
                        setPwdModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-purple-950/50 flex items-center space-x-2 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/30 flex items-center space-x-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      {pwdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs p-4">
          <Card variant="white" className="w-full max-w-sm p-6 shadow-xl border-slate-200 dark:border-purple-900/40 animate-in fade-in zoom-in-95 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-purple-900/30">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-slate-800 dark:text-purple-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Change Password</h3>
              </div>
              <button
                onClick={() => setPwdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pwdError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-purple-900/50 bg-white dark:bg-[#130F20] text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-purple-900/50 bg-white dark:bg-[#130F20] text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-purple-900/40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-purple-600 hover:bg-blue-600 dark:hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {pwdLoading ? "Updating..." : "Update Password"}
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
