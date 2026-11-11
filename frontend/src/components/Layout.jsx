// src/components/Layout.jsx
// Complete Axtroid / TraineeIQ Application Shell matching the Trainee Dashboard.
// Features persistent Deep Obsidian collapsible left sidebar, search topbar, live status, and warm sand workspace.

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLive } from "../context/LiveContext.jsx";
import { Spinner } from "./Spinner.jsx";
import {
  GraduationCap,
  LayoutDashboard,
  Layers,
  Users,
  Plus,
  MessageSquare,
  BookOpen,
  UserCheck,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  KeyRound,
  LogOut,
  X,
  CircleHelp,
  Menu,
} from "lucide-react";

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
        title="WebSocket disconnected, reconnecting..."
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

export function Layout({ children }) {
  const { user, isAdmin, isTrainer, logout, changePassword } = useAuth();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("portal_sidebar_open");
    return saved !== null ? saved === "true" : true;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Password Modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("portal_sidebar_open", sidebarOpen.toString());
  }, [sidebarOpen]);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "TR";

  const navItems = isAdmin
    ? [
        { label: "Overview", to: "/admin", icon: LayoutDashboard },
        { label: "Batches", to: "/batches", icon: Layers },
        { label: "Trainees", to: "/trainees", icon: Users },
        { label: "Log Session", to: "/sessions/new", icon: Plus },
        { label: "Modules", to: "/modules", icon: BookOpen },
        { label: "Users", to: "/admin/users", icon: UserCheck },
        { label: "Audit Logs", to: "/admin/audit-logs", icon: Shield },
      ]
    : isTrainer
    ? [
        { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
        { label: "Batches", to: "/batches", icon: Layers },
        { label: "Trainees", to: "/trainees", icon: Users },
        { label: "Log Session", to: "/sessions/new", icon: Plus },
        { label: "Messages", to: "/messages", icon: MessageSquare },
        { label: "Modules", to: "/modules", icon: BookOpen },
      ]
    : [
        { label: "Overview", to: user?.trainee_id ? `/trainees/${user.trainee_id}` : "/dashboard", icon: LayoutDashboard },
        { label: "Messages", to: "/messages", icon: MessageSquare },
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
    <div className="app-shell min-h-screen flex selection:bg-[#F09A3E] selection:text-white">
      {/* ====================================================================
          1. DEEP OBSIDIAN LEFT SIDEBAR (Matching Trainee Dashboard)
          ==================================================================== */}
      <aside
        className={`sidebar ${
          sidebarOpen ? "w-[248px] flex-[0_0_248px]" : "sidebar--collapsed w-[76px] flex-[0_0_76px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} fixed md:static top-0 bottom-0 left-0 bg-[#1C1B17] text-[#FDF8F2] flex flex-col py-6 transition-all duration-200 z-40 border-r border-[#272520]`}
      >
        {/* Brand Row */}
        <div className="brand-row flex items-center justify-between px-6 pb-6 border-b border-[#272520]/60 min-h-[52px]">
          {sidebarOpen ? (
            <Link to="/" className="brand-mark flex items-center gap-2.5 text-lg font-black tracking-tight text-white">
              <div className="w-8 h-8 rounded-xl bg-[#272520] border border-[#F09A3E]/30 flex items-center justify-center shrink-0">
                <GraduationCap size={20} className="text-[#F09A3E]" />
              </div>
              <span className="truncate">{isAdmin ? "Admin" : isTrainer ? "Trainer" : "TraineeIQ"}</span>
            </Link>
          ) : (
            <Link to="/" className="brand-mark--compact mx-auto">
              <div className="w-8 h-8 rounded-xl bg-[#272520] border border-[#F09A3E]/30 flex items-center justify-center">
                <GraduationCap size={20} className="text-[#F09A3E]" />
              </div>
            </Link>
          )}

          <button
            type="button"
            className="icon-button sidebar-toggle hidden md:inline-grid cursor-pointer text-[#A2998A] hover:text-[#F09A3E] hover:bg-white/5 p-1 rounded-lg transition-colors ml-auto"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar width"
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>

          <button
            type="button"
            className="icon-button mobile-close md:hidden cursor-pointer text-[#A2998A] hover:text-white ml-auto"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav flex flex-col gap-1.5 px-3 mt-4" aria-label="Primary navigation">
          {navItems.map(({ label, to, icon: Icon }) => {
            const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={label}
                to={to}
                title={!sidebarOpen ? label : undefined}
                className={`nav-item relative flex items-center gap-3.5 min-h-[44px] px-3.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "nav-item--active bg-[#272520] text-white font-bold"
                    : "text-[#A2998A] hover:text-white hover:bg-white/5"
                } ${!sidebarOpen ? "justify-center px-0" : ""}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-[#F09A3E]" />
                )}
                <Icon size={18} className={`shrink-0 ${isActive ? "text-[#F09A3E]" : "text-[#A2998A]"}`} />
                {sidebarOpen && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer flex-1" />
        <div className="sidebar-divider h-px mx-5 my-3 bg-[#272520]" />

        {/* Footer Note */}
        {sidebarOpen && (
          <div className="sidebar-footer-note px-5 text-[11px] text-[#787063] flex items-center gap-2">
            <CircleHelp size={14} className="text-[#A2998A] shrink-0" />
            <span className="truncate">Training Operations Desk</span>
          </div>
        )}
      </aside>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ====================================================================
          2. MAIN COLUMN WITH TOPBAR & WORKSPACE CANVAS
          ==================================================================== */}
      <div className="main-column flex-1 flex flex-col min-w-0 bg-[#FDF8F2]">
        {/* Topbar */}
        <header className="topbar h-[72px] px-6 lg:px-8 bg-white border-b border-[#F0E3D5] flex items-center justify-between gap-4 sticky top-0 z-20">
          {/* Mobile hamburger & brand */}
          <div className="mobile-topbar-start flex items-center gap-2 md:hidden">
            <button
              type="button"
              className="icon-button p-1.5 rounded-lg text-[#1C1B17] hover:bg-[#FEF4E8] cursor-pointer"
              onClick={() => setMobileOpen(true)}
              aria-label="Open mobile navigation"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-1.5 font-black text-sm text-[#1C1B17]">
              <GraduationCap size={18} className="text-[#F09A3E]" />
              <span>Trainer</span>
            </div>
          </div>

          {/* Search Box */}
          <label className="search-box hidden sm:flex items-center gap-2.5 w-full max-w-sm h-10 px-3.5 bg-[#FDF8F2] border border-[#F0E3D5] rounded-xl text-[#787063] focus-within:border-[#F09A3E]/60 focus-within:ring-2 focus-within:ring-[#F09A3E]/20 transition-all cursor-text">
            <Search size={16} className="text-[#A2998A] shrink-0" />
            <input
              type="text"
              placeholder="Search subjects, cohorts, or trainees..."
              className="w-full bg-transparent border-0 outline-none text-xs text-[#1C1B17] placeholder:text-[#A2998A]"
              aria-label="Search portal"
            />
            <kbd className="px-2 py-0.5 rounded bg-white border border-[#F0E3D5] text-[10px] font-mono text-[#787063] shrink-0 shadow-2xs">
              Ctrl K
            </kbd>
          </label>

          {/* Right Actions */}
          <div className="topbar-actions flex items-center gap-3 ml-auto">
            {/* Live WebSocket Status */}
            <LiveBadge />

            {/* Notification Bell */}
            <button
              type="button"
              className="w-9 h-9 rounded-xl border border-[#F0E3D5] bg-[#FDF8F2] hover:bg-[#FEF4E8] flex items-center justify-center text-[#787063] hover:text-[#1C1B17] transition-colors relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="w-2 h-2 rounded-full bg-[#F09A3E] absolute top-2 right-2 border-2 border-white" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#FEF4E8] transition-colors cursor-pointer"
                aria-label="Toggle user menu"
              >
                <div className="w-9 h-9 rounded-xl bg-[#1C1B17] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {initials}
                </div>
                <div className="text-left hidden md:flex flex-col">
                  <strong className="text-xs font-bold text-[#1C1B17] leading-tight truncate max-w-[130px]">
                    {user?.email?.split("@")[0] || "Trainer"}
                  </strong>
                  <small className="text-[10px] font-bold uppercase tracking-wider text-[#D97718]">
                    {user?.role === "admin" ? "Admin" : "Trainer"}
                  </small>
                </div>
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#F0E3D5] py-2 z-50 animate-in fade-in duration-100"
                  onClick={() => setProfileOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-[#F0E3D5]">
                    <p className="text-xs font-bold text-[#1C1B17] truncate">{user?.email}</p>
                    <p className="text-[10px] font-semibold text-[#787063] uppercase tracking-wider mt-0.5">
                      Role: {user?.role}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPwdError("");
                      setPwdSuccess("");
                      setCurrentPwd("");
                      setNewPwd("");
                      setPwdModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C1B17] hover:bg-[#FEF4E8] flex items-center space-x-2 cursor-pointer transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#D97718]" />
                    <span>Change Password</span>
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Workspace Canvas */}
        <main className="flex-1 w-full max-w-[1640px] mx-auto px-6 py-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>

      {/* Change Password Modal */}
      {pwdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#F0E3D5] p-6 relative">
            <button
              onClick={() => setPwdModalOpen(false)}
              className="absolute top-4 right-4 text-[#A2998A] hover:text-[#1C1B17] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black text-[#1C1B17]">Change Password</h3>
            <p className="text-xs text-[#787063] mt-1">
              Update your account password. Must be at least 8 characters.
            </p>

            {pwdError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {pwdError}
              </div>
            )}

            {pwdSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold">
                {pwdSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C1B17] uppercase mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#F0E3D5] text-sm focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C1B17] uppercase mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#F0E3D5] text-sm focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#F0E3D5] text-xs font-bold text-[#787063] hover:bg-[#FEF4E8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white text-xs font-bold cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {pwdLoading ? <Spinner size="sm" /> : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;
