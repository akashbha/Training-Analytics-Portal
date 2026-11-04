// src/components/CommandPalette.jsx
// Global interactive command palette modal triggered with Ctrl+K / Cmd+K or navigation button.
// Provides instant fuzzy search and direct navigation across Pages, Trainees, Batches, Modules, and System Actions.

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { apiClient } from "../api/client.js";
import {
  Search,
  Command,
  LayoutDashboard,
  Users,
  GraduationCap,
  Layers,
  BookOpen,
  PlusCircle,
  KeyRound,
  LogOut,
  Sun,
  Moon,
  Shield,
  Clock,
  CornerDownLeft,
  X,
  Sparkles,
} from "lucide-react";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const navigate = useNavigate();
  const { user, isStaff, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Dynamic remote entity states
  const [trainees, setTrainees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [modules, setModules] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // 1. Listen for global keyboard shortcut: Ctrl+K / Cmd+K or custom trigger event
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle palette on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Quick slash trigger when not focusing form inputs
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) &&
        !document.activeElement?.isContentEditable
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

  // 2. Fetch search dataset once palette is opened
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    // Auto-focus search input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    // If staff, preload cohorts, trainees, and modules for instant search
    if (isStaff) {
      setLoadingData(true);
      Promise.all([
        apiClient.get("/trainees?page=1&page_size=100").catch(() => ({ data: { items: [] } })),
        apiClient.get("/batches?page=1&page_size=50").catch(() => ({ data: { items: [] } })),
        apiClient.get("/modules?page=1&page_size=50").catch(() => ({ data: { items: [] } })),
      ])
        .then(([traineeRes, batchRes, moduleRes]) => {
          setTrainees(traineeRes.data?.items || traineeRes.data || []);
          setBatches(batchRes.data?.items || batchRes.data || []);
          setModules(moduleRes.data?.items || moduleRes.data || []);
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [isOpen, isStaff]);

  // 3. Assemble indexed command list categorized by role & entity
  const allItems = useMemo(() => {
    const items = [];

    // Category: Navigation Pages
    if (isStaff) {
      items.push({
        id: "page-dashboard",
        category: "Navigation",
        title: "Dashboard",
        subtitle: "Cohort analytics, KPI trends, and leaderboard",
        icon: LayoutDashboard,
        badge: "Page",
        action: () => navigate("/"),
        keywords: ["home", "analytics", "dashboard", "overview"],
      });
      items.push({
        id: "page-batches",
        category: "Navigation",
        title: "Batches",
        subtitle: "Cohort groups, start dates, and comparisons",
        icon: Layers,
        badge: "Page",
        action: () => navigate("/batches"),
        keywords: ["cohorts", "groups", "batches"],
      });
      items.push({
        id: "page-trainees",
        category: "Navigation",
        title: "Trainees",
        subtitle: "Learner directory, scores, and records",
        icon: GraduationCap,
        badge: "Page",
        action: () => navigate("/trainees"),
        keywords: ["students", "learners", "trainees", "roster"],
      });
      items.push({
        id: "page-add-session",
        category: "Navigation",
        title: "Add Session",
        subtitle: "Record new assessment or upload bulk CSV",
        icon: PlusCircle,
        badge: "Action",
        action: () => navigate("/sessions/new"),
        keywords: ["new", "session", "csv", "score", "grade"],
      });
      items.push({
        id: "page-modules",
        category: "Navigation",
        title: "Modules",
        subtitle: "Curriculum tracks, max scores, and criteria",
        icon: BookOpen,
        badge: "Page",
        action: () => navigate("/modules"),
        keywords: ["curriculum", "courses", "modules", "topics"],
      });
    } else {
      items.push({
        id: "page-my-dashboard",
        category: "Navigation",
        title: "My Performance Dashboard",
        subtitle: "View your personal progression and assessment history",
        icon: LayoutDashboard,
        badge: "Page",
        action: () => navigate("/"),
        keywords: ["me", "scores", "progress", "history"],
      });
    }

    if (isAdmin) {
      items.push({
        id: "page-users",
        category: "Navigation",
        title: "Users Management",
        subtitle: "Manage portal administrators, trainers, and credentials",
        icon: Shield,
        badge: "Admin",
        action: () => navigate("/admin/users"),
        keywords: ["admin", "users", "accounts", "roles", "passwords"],
      });
      items.push({
        id: "page-audit-logs",
        category: "Navigation",
        title: "Audit Logs",
        subtitle: "Track system mutations, logins, and security events",
        icon: Clock,
        badge: "Admin",
        action: () => navigate("/admin/audit-logs"),
        keywords: ["audit", "compliance", "security", "logs", "history"],
      });
    }

    // Category: Actions
    items.push({
      id: "action-theme",
      category: "Quick Actions",
      title: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      subtitle: `Currently using ${theme} theme. Press Enter to toggle.`,
      icon: theme === "dark" ? Sun : Moon,
      badge: "Theme",
      action: () => toggleTheme(),
      keywords: ["dark", "light", "theme", "mode", "toggle", "appearance", "color"],
    });

    items.push({
      id: "action-logout",
      category: "Quick Actions",
      title: "Sign Out",
      subtitle: `Signed in as ${user?.email || "User"}`,
      icon: LogOut,
      badge: "Auth",
      action: () => logout(),
      keywords: ["logout", "exit", "signout", "quit"],
    });

    // Category: Trainees (if staff)
    if (isStaff && trainees.length > 0) {
      trainees.forEach((t) => {
        items.push({
          id: `trainee-${t.id}`,
          category: "Trainees",
          title: t.name,
          subtitle: `${t.email} • Batch #${t.batch_id}`,
          icon: GraduationCap,
          badge: "Trainee",
          action: () => navigate(`/trainees/${t.id}`),
          keywords: [t.name.toLowerCase(), t.email.toLowerCase(), `batch ${t.batch_id}`],
        });
      });
    }

    // Category: Batches (if staff)
    if (isStaff && batches.length > 0) {
      batches.forEach((b) => {
        items.push({
          id: `batch-${b.id}`,
          category: "Batches",
          title: b.name,
          subtitle: `Cohort ID: ${b.id} • Started ${b.start_date || "Active"}`,
          icon: Layers,
          badge: "Cohort",
          action: () => navigate("/batches"),
          keywords: [b.name.toLowerCase(), `batch ${b.id}`, "cohort"],
        });
      });
    }

    // Category: Modules (if staff)
    if (isStaff && modules.length > 0) {
      modules.forEach((m) => {
        items.push({
          id: `module-${m.id}`,
          category: "Modules",
          title: m.name,
          subtitle: `Code: ${m.code || "MOD"} • Max score: ${m.max_score || 100}`,
          icon: BookOpen,
          badge: "Module",
          action: () => navigate("/modules"),
          keywords: [m.name.toLowerCase(), (m.code || "").toLowerCase(), "curriculum"],
        });
      });
    }

    return items;
  }, [isStaff, isAdmin, trainees, batches, modules, theme, user, navigate, toggleTheme, logout]);

  // 4. Client-side search filtering
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default view: Show Navigation and Quick Actions
      return allItems.filter(
        (item) => item.category === "Navigation" || item.category === "Quick Actions"
      );
    }

    const queryTokens = q.split(/\s+/);
    return allItems.filter((item) => {
      const matchTarget = `${item.title} ${item.subtitle} ${(item.keywords || []).join(" ")}`.toLowerCase();
      return queryTokens.every((token) => matchTarget.includes(token));
    });
  }, [query, allItems]);

  // 5. Keep selectedIndex within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  // 6. Handle ArrowUp, ArrowDown, Enter, and Escape inside modal
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected && selected.action) {
        selected.action();
        setIsOpen(false);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 pb-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#181427] border border-purple-100 dark:border-purple-900/40 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col text-slate-900 dark:text-slate-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input Bar */}
        <div className="flex items-center px-5 py-4 border-b border-purple-100 dark:border-purple-900/30 space-x-3">
          <div className="text-brand dark:text-purple-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, trainee, batch, or module... (Press Esc to exit)"
            className="w-full bg-transparent text-sm sm:text-base font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none text-slate-900 dark:text-slate-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-purple-950/60 border border-slate-200 dark:border-purple-800/40 text-[10px] font-bold text-slate-500 dark:text-purple-300">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-3 space-y-1 divide-y divide-transparent"
        >
          {loadingData && trainees.length === 0 && (
            <div className="px-4 py-2 text-xs text-purple-400 font-semibold animate-pulse">
              Preloading directory index...
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 dark:bg-purple-950/40 text-brand dark:text-purple-300 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No matching results found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                No commands, trainees, or modules match "{query}". Try another search term.
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const IconComponent = item.icon || Command;

              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-brand text-white shadow-md shadow-brand/20 dark:bg-purple-600"
                      : "hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-brand-light dark:bg-purple-950/60 text-brand dark:text-purple-300"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {item.title}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          isSelected
                            ? "text-purple-100"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-purple-100 dark:bg-purple-950/60 text-brand dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40"
                      }`}
                    >
                      {item.badge}
                    </span>

                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center text-white text-[10px] font-bold">
                        <CornerDownLeft className="w-3.5 h-3.5 ml-1" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="px-5 py-3 border-t border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-[#151122] flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                ↓
              </kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                ↵
              </kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            {filteredItems.length} command{filteredItems.length === 1 ? "" : "s"} available
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;

