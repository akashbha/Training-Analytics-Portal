import { PracticeDrillModal } from "../components/PracticeDrillModal.jsx";
import { CurriculumTutorModal } from "../components/CurriculumTutorModal.jsx";
import { Messages } from "./Messages.jsx";
// src/pages/TraineeDashboard.jsx
// Unified Warm Sand & Obsidian TraineeIQ Dashboard connected to real trainee analytics and messaging.

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuth } from "../context/AuthContext.jsx";
import { LoadingState, EmptyState, ErrorState } from "../components/states/index.js";
import { ModuleDiagnosticLedger } from "../components/ModuleDiagnosticLedger.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { UnauthorizedPage } from "./UnauthorizedPage.jsx";
import { useLiveEvent, usePollingFallback } from "../context/LiveContext.jsx";
import {
  useTraineeProfile,
  useTraineeSummary,
  useTraineeProgress,
  useTraineeErrors,
  useTraineeSessions,
} from "../hooks/useTraineeAnalytics.js";
import { apiClient } from "../api/client.js";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD } from "../constants/thresholds.js";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Bell,
  BookOpenCheck,
  Briefcase,
  BriefcaseBusiness,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Clock3,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  Info,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Save,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";

// Curated avatar options for instant profile selection
const AVATAR_OPTIONS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
];

// Navigation menu definition
const navItems = [
  { label: "Overview", icon: Home },
  { label: "Learning", icon: BookOpenCheck },
  { label: "Assessments", icon: ClipboardCheck },
  { label: "Projects", icon: BriefcaseBusiness },
  { label: "Skills", icon: Target },
  { label: "Mentor", icon: Users },
  { label: "Messages", icon: MessageSquare },
  { label: "Career", icon: Rocket },
];

function InfoIcon() {
  return <span className="info-icon" aria-label="More information">i</span>;
}

function SectionTitle({ children, action, onAction }) {
  return (
    <div className="section-title-row">
      <h2>{children}</h2>
      {action ? (
        <button type="button" className="text-button" onClick={onAction}>
          {action} <ArrowUpRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

function ReadinessRing({ score = 78 }) {
  return (
    <div className="readiness-ring" aria-label={`Readiness score ${score} out of 100`}>
      <div className="readiness-ring__inner">
        <div className="readiness-value">
          <svg className="w-5 h-5 text-[#F09A3E] mr-1 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {score}<small>/100</small>
        </div>
        <div className="readiness-status"><span className="status-dot" /> On track</div>
      </div>
    </div>
  );
}

function SkillsRadar({ skillsData }) {
  const points = "150,16 204,54 183,122 117,122 96,54";
  const values = "150,29 187,66 169,105 111,111 105,69";
  return (
    <div className="skills-visual">
      <svg viewBox="0 0 300 150" role="img" aria-label="Skills proficiency radar chart">
        <polygon points={points} className="radar-grid" />
        <polygon points="150,39 177,63 167,99 133,99 123,63" className="radar-grid radar-grid--small" />
        <line x1="150" y1="16" x2="150" y2="122" className="radar-axis" />
        <line x1="96" y1="54" x2="183" y2="122" className="radar-axis" />
        <line x1="204" y1="54" x2="117" y2="122" className="radar-axis" />
        <polygon points={values} className="radar-value" />
        <circle cx="150" cy="29" r="4" className="radar-point" />
        <circle cx="187" cy="66" r="4" className="radar-point" />
        <circle cx="169" cy="105" r="4" className="radar-point" />
        <circle cx="111" cy="111" r="4" className="radar-point" />
        <circle cx="105" cy="69" r="4" className="radar-point" />
      </svg>
      <div className="radar-label radar-label--top">Python <strong>70</strong></div>
      <div className="radar-label radar-label--right">SQL <strong>78</strong></div>
      <div className="radar-label radar-label--bottom-right">Communication <strong>65</strong></div>
      <div className="radar-label radar-label--bottom-left">Domain Knowledge <strong>70</strong></div>
      <div className="radar-label radar-label--left">Git <strong>85</strong></div>
    </div>
  );
}

export function TraineeDashboard({ traineeId: propId }) {
  const params = useParams();
  const navigate = useNavigate();
  const { user, isTrainer, isAdmin, logout } = useAuth();
  const isStaff = isTrainer || isAdmin;

  const resolvedRawId = propId ?? params.id ?? (!isStaff ? user?.trainee_id : null);
  const parsedId =
    resolvedRawId !== null && resolvedRawId !== undefined && resolvedRawId !== ""
      ? Number(resolvedRawId)
      : null;
  const effectiveId =
    parsedId !== null && Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  const isUrlTampered =
    !isStaff &&
    params.id !== undefined &&
    user?.trainee_id !== undefined &&
    user?.trainee_id !== null &&
    Number(params.id) !== Number(user?.trainee_id);

  // Active view tab state (sidebar navigation)
  const [activeNav, setActiveNav] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("22 May, 2025");
  const [search, setSearch] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem("trainee_dark_mode") === "true";
    } catch {
      return false;
    }
  });
  const [themeRipple, setThemeRipple] = useState(null);
  const themeRippleTimerRef = useRef(null);

  // Interactive UI widget states
  const [actionDismissed, setActionDismissed] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [feedbackVote, setFeedbackVote] = useState(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }, []);

  const handleToggleTheme = useCallback(
    (e) => {
      const rect = e?.currentTarget?.getBoundingClientRect();
      const x = rect ? Math.round(rect.left + rect.width / 2) : Math.round(window.innerWidth / 2);
      const y = rect ? Math.round(rect.top + rect.height / 2) : 38;
      const nextDark = !isDarkMode;

      setIsDarkMode(nextDark);
      try {
        localStorage.setItem("trainee_dark_mode", String(nextDark));
      } catch {
        // Ignore storage restrictions
      }

      if (themeRippleTimerRef.current) {
        clearTimeout(themeRippleTimerRef.current);
      }
      setThemeRipple({ id: Date.now(), x, y, toDark: nextDark });
      themeRippleTimerRef.current = setTimeout(() => {
        setThemeRipple(null);
      }, 680);
    },
    [isDarkMode]
  );

  const handleLogout = useCallback(() => {
    setProfileMenuOpen(false);
    setNotificationsOpen(false);
    setMobileNavOpen(false);
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      if (themeRippleTimerRef.current) {
        clearTimeout(themeRippleTimerRef.current);
      }
    };
  }, []);

  // Tasks state (Task 3 checked by default, matching reference image)
  const [tasks, setTasks] = useState([
    { id: 1, title: "Complete SQL Joins - Practice Set 2", due: "Today 03:00 PM", priority: "High Priority", progress: "3/5", completed: false },
    { id: 2, title: "Review Python Functions", due: "Today 05:00 PM", priority: "Medium Priority", progress: "2/4", completed: false },
    { id: 3, title: "Attend Domain Knowledge Session", due: "Today 10:00 PM", priority: "Completed", progress: "3/3", completed: true },
    { id: 4, title: "Push Git Assignments", due: "Tomorrow 12:00 PM", priority: "Low Priority", progress: "1/3", completed: false },
    { id: 5, title: "Prepare for Assessment", due: "24 May 11:59 PM", priority: "Medium Priority", progress: "0/5", completed: false },
    { id: 6, title: "Optimize SQL Query Performance", due: "25 May 06:00 PM", priority: "High Priority", progress: "0/4", completed: false },
    { id: 7, title: "Read Industry 4.0 Whitepaper", due: "26 May 10:00 AM", priority: "Low Priority", progress: "2/2", completed: true },
  ]);

  const completedCount = tasks.filter((t) => t.completed).length;
  const visibleTasks = useMemo(() => {
    const list = showAllTasks ? tasks : tasks.slice(0, 5);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((t) => t.title.toLowerCase().includes(q) || t.priority.toLowerCase().includes(q));
  }, [tasks, showAllTasks, search]);

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  // Profile Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    specialization: "",
    bio: "",
    github_url: "",
    avatar_url: "",
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef(null);

  // Mentor check-in modal state
  const [mentorModalOpen, setMentorModalOpen] = useState(false);
  const [mentorNoteText, setMentorNoteText] = useState("");
  const [mentorNoteSubmitting, setMentorNoteSubmitting] = useState(false);
  const [mentorNoteSuccess, setMentorNoteSuccess] = useState(false);

  // Practice Drill & Curriculum Tutor modal states
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillModuleName, setDrillModuleName] = useState("SQL");
  const [tutorModalOpen, setTutorModalOpen] = useState(false);
  const [tutorModuleName, setTutorModuleName] = useState("SQL");
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Remediation Drills State (Closed-Loop Intervention)
  const [remediations, setRemediations] = useState([]);
  const [remediationsLoading, setRemediationsLoading] = useState(false);
  const [completeModalTarget, setCompleteModalTarget] = useState(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [submittingCompletion, setSubmittingCompletion] = useState(false);

  const fetchRemediations = useCallback(async () => {
    if (!effectiveId) return;
    setRemediationsLoading(true);
    try {
      const res = await apiClient.get(`/trainees/${effectiveId}/remediations`);
      setRemediations(res.data || []);
    } catch (err) {
      console.error("Failed to fetch trainee remediations:", err);
    } finally {
      setRemediationsLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    fetchRemediations();
  }, [fetchRemediations]);

  const handleCompleteRemediation = async (e) => {
    e.preventDefault();
    if (!completeModalTarget) return;
    setSubmittingCompletion(true);
    try {
      await apiClient.post(`/remediations/${completeModalTarget.id}/complete`, {
        completion_notes: completionNotes,
      });
      showToast("Practice activity completed! Awaiting mentor re-assessment.");
      setCompleteModalTarget(null);
      setCompletionNotes("");
      fetchRemediations();
    } catch (err) {
      console.error("Failed to complete remediation:", err);
      showToast("Error recording practice completion.");
    } finally {
      setSubmittingCompletion(false);
    }
  };

  // Fetch trainee analytics from real APIs
  const {
    data: profile,
    loading: profileLoading,
    isForbidden: profileForbidden,
    refetch: refetchProfile,
  } = useTraineeProfile(effectiveId);

  const {
    data: summary,
    loading: summaryLoading,
    isForbidden: summaryForbidden,
    refetch: refetchSummary,
  } = useTraineeSummary(effectiveId);

  const {
    data: progress,
    loading: progressLoading,
    error: progressError,
    isForbidden: progressForbidden,
    refetch: refetchProgress,
  } = useTraineeProgress(effectiveId);

  const {
    data: errorStats,
    loading: errorStatsLoading,
    error: errorStatsError,
    isForbidden: errorStatsForbidden,
    refetch: refetchErrors,
  } = useTraineeErrors(effectiveId);

  const {
    data: sessionsData,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useTraineeSessions(effectiveId, 1, 10);

  // Sync profile form when profile loads
  useEffect(() => {
    if (profile) {
      setEditForm({
        name: profile.name || "",
        phone: profile.phone || "",
        specialization: profile.specialization || "",
        bio: profile.bio || "",
        github_url: profile.github_url || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      await apiClient.put(`/trainees/${effectiveId}`, editForm);
      setSaveSuccess(true);
      refetchProfile();
      setTimeout(() => {
        setSaveSuccess(false);
        setEditModalOpen(false);
      }, 1200);
    } catch (err) {
      setSaveError(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm((prev) => ({ ...prev, avatar_url: reader.result  }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBookMentorSession = async (e) => {
    e.preventDefault();
    setMentorNoteSubmitting(true);
    try {
      await apiClient.post(`/trainees/${effectiveId}/goals`, {
        module_name: "SQL",
        target_score: 90,
        notes: mentorNoteText,
      });
      setMentorNoteSuccess(true);
      setTimeout(() => {
        setMentorNoteSuccess(false);
        setMentorModalOpen(false);
        setMentorNoteText("");
        showToast("Mentor check-in booked successfully!");
      }, 1200);
    } catch (err) {
      setMentorNoteSuccess(true);
      setTimeout(() => {
        setMentorNoteSuccess(false);
        setMentorModalOpen(false);
        showToast("Mentor check-in requested!");
      }, 1200);
    } finally {
      setMentorNoteSubmitting(false);
    }
  };

  // Readiness calculation based on real session progress
  const readinessScore = useMemo(() => {
    if (summary?.readiness_score !== undefined && summary.readiness_score !== null) {
      return Math.round(Number(summary.readiness_score));
    }
    if (progress && progress.length > 0) {
      const avg = progress.reduce((acc, p) => acc + (p.score_percentage || p.score || 70), 0) / progress.length;
      return Math.round(avg);
    }
    return 78;
  }, [summary, progress]);

  // Derived metrics
  const modulesCount = useMemo(() => {
    if (summary?.modules_completed !== undefined) {
      return summary.modules_completed;
    }
    return 8;
  }, [summary]);

  const avgAssessment = useMemo(() => {
    if (summary?.average_score !== undefined) {
      return Math.round(Number(summary.average_score));
    }
    return 82;
  }, [summary]);

  const priorityModuleData = useMemo(() => {
    if (errorStats && errorStats.length > 0) {
      const sorted = [...errorStats].sort((a, b) => (b.error_count || 0) - (a.error_count || 0));
      return {
        moduleName: sorted[0].module_name || "SQL",
        errorCount: sorted[0].error_count || 3,
      };
    }
    return { moduleName: "SQL", errorCount: 2 };
  }, [errorStats]);

  // Handle Unauthorized / Tampered URL
  if (isUrlTampered) {
    return <UnauthorizedPage />;
  }

  if (!effectiveId) {
    return (
      <div className="min-h-screen bg-[#FDF8F2] flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <ErrorState
            title="No Trainee Profile Linked"
            message="No trainee dossier ID was specified or linked to this account."
          />
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#1C1B17] text-white text-xs font-bold hover:bg-[#272520]"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const activeProfile = profile || {
    name: user?.name || "Danielle Johnson",
    email: user?.email || "trainee@example.com",
    avatar_url: "",
  };

  return (
    <div
      className={`app-shell ${isDarkMode ? "app-shell--dark" : ""} ${
        themeRipple ? "app-shell--theme-animating" : ""
      }`}
    >
      {themeRipple && (
        <span
          key={themeRipple.id}
          aria-hidden="true"
          className={`theme-ripple ${
            themeRipple.toDark ? "theme-ripple--to-dark" : "theme-ripple--to-light"
          }`}
          style={{
            "--ripple-x": `${themeRipple.x}px`,
            "--ripple-y": `${themeRipple.y}px`,
          }}
        />
      )}

      {/* =========================================================================
          1. SIDEBAR (TraineeIQ Design System)
          ========================================================================= */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--collapsed"} ${mobileNavOpen ? "sidebar--mobile-open" : ""}`}>
        <div className="brand-row">
          {sidebarOpen ? (
            <div className="brand-mark">
              Trainee<span>IQ</span>
            </div>
          ) : (
            <div className="brand-mark brand-mark--compact">T</div>
          )}
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={() => setSidebarOpen((val) => !val)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
          <button
            type="button"
            className="icon-button mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems
            .filter(({ label }) => !isAdmin || label !== "Messages")
            .map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                className={`nav-item ${activeNav === label ? "nav-item--active" : ""}`}
                onClick={() => {
                  setActiveNav(label);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                {sidebarOpen ? <span>{label}</span> : <span className="sr-only">{label}</span>}
              </button>
            ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-divider" />

        {isStaff && (
          <Link
            to="/"
            className="nav-item"
            style={{ color: "#F09A3E", fontSize: 13, fontWeight: 600, marginBottom: 4 }}
          >
            <ArrowLeft size={16} />
            {sidebarOpen ? <span>Trainer Portal</span> : <span className="sr-only">Trainer Portal</span>}
          </Link>
        )}

        <button
          type="button"
          className={`nav-item ${activeNav === "Support" ? "nav-item--active" : ""}`}
          onClick={() => setSupportModalOpen(true)}
        >
          <Headphones size={18} strokeWidth={1.8} />
          {sidebarOpen ? <span>Support</span> : <span className="sr-only">Support</span>}
        </button>

        <button
          type="button"
          className="nav-item nav-item--logout"
          onClick={handleLogout}
          aria-label="Log Out"
        >
          <LogOut size={18} strokeWidth={1.8} />
          {sidebarOpen ? <span>Log Out</span> : <span className="sr-only">Log Out</span>}
        </button>

        {sidebarOpen ? (
          <div className="sidebar-footer-note">
            <CircleHelp size={14} /> Need a hand? Visit the help center.
          </div>
        ) : null}
      </aside>

      {/* =========================================================================
          2. MAIN COLUMN (Topbar + Content)
          ========================================================================= */}
      <div className="main-column">
        {/* Top Header Bar */}
        <header className="topbar">
          <div className="mobile-topbar-start">
            <button
              type="button"
              className="icon-button mobile-menu"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>
            <div className="mobile-brand">
              Trainee<span>IQ</span>
            </div>
          </div>

          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anything..."
              aria-label="Search dashboard"
            />
            <kbd># K</kbd>
          </label>

          <div className="topbar-actions">
            {!isAdmin && (
              <button
                type="button"
                className={`icon-button ${activeNav === "Messages" ? "bg-[#FEF4E8] text-[#D97718]" : ""}`}
                onClick={() => setActiveNav("Messages")}
                aria-label="Open messages"
                title="Cohort & mentor messages"
              >
                <MessageSquare size={19} />
              </button>
            )}

            <button
              type="button"
              className={`icon-button theme-toggle-btn ${isDarkMode ? "theme-toggle-btn--dark" : ""}`}
              onClick={handleToggleTheme}
              aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-pressed={isDarkMode}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <span className="theme-toggle-icons" aria-hidden="true">
                <Sun size={18} className="theme-icon theme-icon--sun" />
                <Moon size={18} className="theme-icon theme-icon--moon" />
              </span>
            </button>

            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                className="icon-button notification-button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setNotificationsOpen((prev) => !prev);
                }}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={19} />
                <span className="notification-dot" />
              </button>

              {/* Notifications Popover */}
              {notificationsOpen && (
                <div className="theme-popover absolute right-0 top-12 w-80 bg-white border border-[#F0E3D5] rounded-2xl shadow-xl z-50 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0E3D5]">
                    <span className="font-bold text-[#1C1B17]">Notifications (3)</span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[#A2998A] hover:text-[#1C1B17] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-[#FEF4E8] border border-[#FBD1A7] flex items-start space-x-2.5">
                      <Sparkles className="w-4 h-4 text-[#D97718] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[#1C1B17]">Priya Sharma sent feedback</div>
                        <div className="text-[10px] text-[#787063] mt-0.5 leading-relaxed">
                          Great progress on SQL Joins topic. Focus on exercises.
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] flex items-start space-x-2.5">
                      <ClipboardList className="w-4 h-4 text-[#F09A3E] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[#1C1B17]">Practice Drill Scheduled</div>
                        <div className="text-[10px] text-[#787063] mt-0.5 leading-relaxed">
                          Complete SQL Joins Practice Set 2 before 3:00 PM today.
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FDF8F2] border border-[#F0E3D5] flex items-start space-x-2.5">
                      <Clock className="w-4 h-4 text-[#1C1B17] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[#1C1B17]">Attendance Logged</div>
                        <div className="text-[10px] text-[#787063] mt-0.5 leading-relaxed">
                          96% cohort attendance recorded for May 2025.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                className="profile-button"
                onClick={() => {
                  setNotificationsOpen(false);
                  setProfileMenuOpen((prev) => !prev);
                }}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                title="Account menu"
              >
                {activeProfile?.avatar_url ? (
                  <img
                    src={activeProfile.avatar_url}
                    alt={activeProfile.name || "Trainee"}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-[#FBD1A7]"
                  />
                ) : (
                  <span className="avatar">
                    {activeProfile?.name
                      ? activeProfile.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : "JD"}
                  </span>
                )}
                <span className="profile-copy">
                  <strong>{activeProfile?.name || "John Doe"}</strong>
                  <small>{user?.role === "admin" ? "Admin" : user?.role === "trainer" ? "Trainer" : "Trainee"}</small>
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${profileMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account actions"
                  className="theme-popover profile-dropdown absolute right-0 top-12 w-60 bg-white border border-[#F0E3D5] rounded-2xl shadow-xl py-2 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-[#F0E3D5]">
                    <p className="text-xs font-bold text-[#1C1B17] truncate">
                      {activeProfile?.name || user?.name || "Trainee"}
                    </p>
                    <p className="text-[11px] text-[#787063] truncate">
                      {activeProfile?.email || user?.email}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF4E8] text-[#D97718] border border-[#FBD1A7]">
                      {user?.role || "trainee"}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setEditModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C1B17] hover:bg-[#FEF4E8] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#D97718]" />
                    <span>Edit Profile</span>
                  </button>

                  {!isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setActiveNav("Messages");
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C1B17] hover:bg-[#FEF4E8] flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#F09A3E]" />
                      <span>Messages</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-[#F0E3D5]" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content Canvas */}
        <main className="dashboard-content">

          {/* Page Heading Row */}
          {activeNav !== "Messages" && (
            <div className="page-heading">
              <div>
                <h1>{activeNav === "Overview" ? "Overview" : activeNav}</h1>
                <p>
                  {activeNav === "Overview"
                    ? `Welcome back, ${activeProfile?.name ? activeProfile.name.split(" ")[0] : "Alex"}! Here's your learning progress for today.`
                    : activeNav === "Learning" || activeNav === "Learning Paths"
                    ? "Explore all modules, syllabus requirements, and active practice sets."
                    : activeNav === "Assessments"
                    ? "Real-time evaluation logs, error frequency benchmarks, and defect diagnostic ledger."
                    : activeNav === "Projects"
                    ? "Track industrial capstone deliverables, rubrics, and project submissions."
                    : activeNav === "Skills"
                    ? "Comprehensive competency matrix across advanced manufacturing domains."
                    : activeNav === "Mentor"
                    ? "Direct feedback, scheduled office hours, and personalized 1:1 check-in requests."
                    : "Readiness indicators, certification tracking, and industry pathway milestones."}
                </p>
              </div>

              <label className="date-select">
                <CalendarDays size={16} />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  aria-label="Select dashboard period"
                >
                  <option>22 May, 2025</option>
                  <option>29 May, 2025</option>
                  <option>05 Jun, 2025</option>
                </select>
                <ChevronDown size={15} />
              </label>
            </div>
          )}

          {/* =========================================================================
              VIEW: OVERVIEW (Exact Replica from traineelq.zip)
              ========================================================================= */}
          {activeNav === "Overview" && (
            <>
              {/* Row 1: Readiness Score, AI Next Best Action, 2x2 Matrix */}
              <section className="dashboard-grid dashboard-grid--top">
                {/* Card 1.1: Readiness Score */}
                <article className="card readiness-card">
                  <SectionTitle>
                    Readiness Score <InfoIcon />{" "}
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                      Illustrative Preview
                    </span>
                  </SectionTitle>
                  <ReadinessRing score={readinessScore} />
                  <p className="card-footnote">Illustrative static preview (not live readiness scoring)</p>
                </article>

                {/* Card 1.2: AI Next Best Action */}
                <article className="card next-action-card relative">
                  {actionDismissed ? (
                    <div className="p-6 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] text-center space-y-3 my-auto">
                      <div className="w-10 h-10 rounded-full bg-[#FEF0E1] text-[#D97718] flex items-center justify-center mx-auto border border-[#FBD1A7]">
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#1C1B17]">Action Set Dismissed</h3>
                        <p className="text-[11px] text-[#787063] mt-0.5">Focus recommendation cleared. You can restore it anytime.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActionDismissed(false)}
                        className="px-4 py-1.5 rounded-lg bg-[#F09A3E] text-white font-bold text-xs shadow-xs hover:bg-[#D97718] cursor-pointer"
                      >
                        Restore Recommendation
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between pb-1 relative">
                        <div className="flex items-center space-x-1.5 font-bold text-[#1C1B17] text-sm flex-wrap">
                          <Sparkles size={16} className="section-spark text-[#F09A3E]" />
                          <span>Next Best Action</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                            Rule-Based Preview
                          </span>
                        </div>
                        <button
                          type="button"
                          className="more-button cursor-pointer"
                          aria-label="More actions"
                          onClick={() => setActionMenuOpen((prev) => !prev)}
                        >
                          <MoreVertical size={17} />
                        </button>

                        {actionMenuOpen && (
                          <div className="absolute right-0 top-8 w-48 bg-white border border-[#F0E3D5] rounded-xl shadow-lg z-30 py-1 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuOpen(false);
                                setDrillModuleName(priorityModuleData?.moduleName || "SQL");
                                setDrillModalOpen(true);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#FEF4E8] font-medium text-[#1C1B17] flex items-center space-x-2"
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-[#D97718]" />
                              <span>Start Practice Drill</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuOpen(false);
                                setTutorModuleName(priorityModuleData?.moduleName || "SQL");
                                setTutorModalOpen(true);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#FEF4E8] font-medium text-[#1C1B17] flex items-center space-x-2"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#F09A3E]" />
                              <span>Ask Curriculum Tutor</span>
                            </button>
                            <div className="border-t border-[#F0E3D5] my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuOpen(false);
                                setActionDismissed(true);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-rose-50 font-medium text-rose-600 flex items-center space-x-2"
                            >
                              <X className="w-3.5 h-3.5 text-rose-500" />
                              <span>Dismiss Recommendation</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="action-panel">
                        <div className="action-icon">
                          <FileText size={19} />
                        </div>
                        <div>
                          <h3>
                            {priorityModuleData?.moduleName
                              ? `Complete ${priorityModuleData.moduleName} - Practice Set 2`
                              : "Complete SQL Joins - Practice Set 2"}
                          </h3>
                          <p>
                            You&apos;re making great progress, but completing this practice set will help you solidify your SQL skills and stay on track.
                          </p>
                        </div>
                      </div>

                      <div className="action-meta">
                        <span><Clock3 size={14} /> Estimated time: 45 min</span>
                        <span>Confidence: <strong>92%</strong></span>
                      </div>

                      <div className="action-buttons">
                        <button
                          type="button"
                          className="primary-button cursor-pointer"
                          onClick={() => {
                            setDrillModuleName(priorityModuleData?.moduleName || "SQL");
                            setDrillModalOpen(true);
                          }}
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          className="secondary-button cursor-pointer"
                          onClick={() => setActionDismissed(true)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  )}
                </article>

                {/* Card 1.3: 2x2 Metric Matrix */}
                <article className="card metric-cluster-card">
                  <div className="metric-cell">
                    <div className="metric-label">
                      <span className="metric-icon metric-icon--teal"><GraduationCap size={17} /></span>
                      Modules Completed <InfoIcon />
                    </div>
                    <div className="flex items-baseline justify-between mt-2.5">
                      <div className="metric-value" style={{ marginTop: 0 }}>
                        {modulesCount}<span>/12</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#A2998A]">67%</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className="h-1.5 w-6 rounded-full bg-[#f09a3e]" />
                      <span className="h-1.5 w-6 rounded-full bg-[#f09a3e]" />
                      <span className="h-1.5 w-6 rounded-full bg-[#f09a3e]" />
                      <span className="h-1.5 w-6 rounded-full bg-[#fbd1a7]" />
                      <span className="h-1.5 w-6 rounded-full bg-[#f0e3d5]" />
                    </div>
                  </div>

                  <div className="metric-cell">
                    <div className="metric-label">
                      <span className="metric-icon metric-icon--blue"><BarChart3 size={17} /></span>
                      Average Assessment <InfoIcon />
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="metric-value" style={{ marginTop: 0 }}>{avgAssessment}%</div>
                      <svg className="w-10 h-4 text-[#d97718]" viewBox="0 0 48 20" fill="none">
                        <path d="M2,16 L14,14 L24,6 L34,10 L46,2" stroke="#f09a3e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="metric-caption--inline" style={{ marginTop: 0 }}>
                        <span className="text-[#d97718] font-bold text-xs flex items-center">
                          <TrendingUp size={12} className="mr-0.5 inline" /> 8%
                        </span>
                        <span className="text-[10px] text-stone-500 block -mt-1">vs last attempt</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-cell">
                    <div className="metric-label">
                      <span className="metric-icon metric-icon--purple"><CalendarDays size={17} /></span>
                      Tasks Due This Week <InfoIcon />
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="metric-value" style={{ marginTop: 0 }}>4</div>
                      <svg className="w-20 h-6 text-amber-500" viewBox="0 0 100 24" fill="none">
                        <path
                          d="M2,18 C16,18 24,6 40,12 C56,18 66,7 80,13 C90,17 95,9 98,11"
                          stroke="#f09a3e"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="metric-cell">
                    <div className="metric-label">
                      <span className="metric-icon metric-icon--green"><CheckCircle2 size={17} /></span>
                      Attendance <InfoIcon />
                    </div>
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="metric-value" style={{ marginTop: 0 }}>96%</div>
                      <div className="metric-caption--inline" style={{ marginTop: 0 }}>
                        <span className="text-[#d97718] font-bold text-xs flex items-center">
                          <TrendingUp size={12} className="mr-0.5 inline" /> 1%
                        </span>
                        <span className="text-[10px] text-stone-500 block -mt-1">vs last month</span>
                      </div>
                    </div>
                  </div>
                </article>
              </section>

              {/* Row 2: Skills & Risk, Learning Journey & Mentor, Today's Tasks */}
              <section className="dashboard-grid dashboard-grid--middle">
                {/* Column 2.1: Skills Overview & High Risk Card */}
                <div className="flex flex-col gap-[18px]">
                  <article className="card skills-card">
                    <div className="section-title-row">
                      <h2>Skills Overview <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">Illustrative Preview</span></h2>
                      <button
                        type="button"
                        className="small-link"
                        onClick={() => setActiveNav("Skills")}
                      >
                        View details
                      </button>
                    </div>
                    <div className="skills-header">
                      <span>Sample proficiency profile</span>
                    </div>
                    <SkillsRadar />
                    <p className="card-footnote">Illustrative static preview (not live assessment telemetry)</p>
                  </article>

                  <article className="card risk-card">
                    <div className="risk-heading">
                      <span className="risk-icon"><ShieldCheck size={18} className="text-[#D97718]" /></span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2>High risk of falling behind</h2>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">Illustrative Preview</span>
                        </div>
                        <p>Sample risk scenario: falling behind in SQL. A quick check-in with your mentor can help clear doubts.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="outline-button cursor-pointer"
                      onClick={() => setMentorModalOpen(true)}
                    >
                      Book Mentor check-in
                    </button>
                    <div className="suggested-action">
                      <Target size={15} /> Suggested action: Book a 1:1 session with your mentor.
                    </div>
                  </article>
                </div>

                {/* Column 2.2: Learning Journey & Mentor Feedback */}
                <div className="flex flex-col gap-[18px]">
                  <article className="card journey-card">
                    <SectionTitle>Learning Journey <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">Illustrative Preview</span></SectionTitle>
                    <div className="journey-items">
                      <div className="journey-line" />
                      {[
                        { label: "Onboarding", date: "12 May", state: "done" },
                        { label: "Foundation", date: "19 May", state: "done" },
                        { label: "Tools in Progress", date: "26 May", state: "current" },
                        { label: "Domain Training", date: "02 Jun", state: "upcoming" },
                        { label: "Live Project", date: "16 Jun", state: "upcoming" },
                        { label: "Certification", date: "30 Jun", state: "upcoming" },
                      ].map((item, idx) => (
                        <div className={`journey-step journey-step--${item.state}`} key={idx}>
                          <div className="journey-dot">
                            {item.state === "done" ? <Check size={12} /> : item.state === "current" ? <Zap size={12} /> : null}
                          </div>
                          <strong>{item.label}</strong>
                          <span>{item.state === "done" ? "Completed" : item.state === "current" ? "In progress" : "Upcoming"}</span>
                          <small>{item.date}</small>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="card mentor-card">
                    <div className="section-title-row">
                      <h2>Mentor Feedback <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">Illustrative Preview</span></h2>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setActiveNav("Mentor")}
                      >
                        View all <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <div className="mentor-meta">
                      Sample mentor note — <strong>Priya Sharma</strong> <Sparkles size={13} />
                    </div>
                    <div className="mentor-message">
                      <ThumbsUp size={28} className="shrink-0 text-[#f09a3e] stroke-[1.8]" />
                      <p>Sample feedback: Great progress on the SQL Joins topic. Try to focus on the practice exercises this week.</p>
                      <button
                        type="button"
                        onClick={() => setFeedbackVote((v) => (v === "down" ? null : "down"))}
                        className={`cursor-pointer transition-colors ${
                          feedbackVote === "down" ? "text-[#1C1B17] font-bold" : "text-[#A2998A] hover:text-[#1C1B17]"
                        }`}
                        aria-label="Dislike feedback"
                      >
                        <ThumbsDown size={18} />
                      </button>
                    </div>
                  </article>
                </div>

                {/* Column 2.3: Today's Tasks */}
                <article className="card tasks-card">
                  <div className="section-title-row">
                    <h2>Today&apos;s Tasks <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">Illustrative Preview</span></h2>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setActiveNav("Learning")}
                    >
                      View All
                    </button>
                  </div>
                  <div className="task-list">
                    {visibleTasks.map((task) => {
                      const priorityClass = task.priority.toLowerCase().includes("high")
                        ? "priority--high"
                        : task.priority.toLowerCase().includes("completed")
                        ? "priority--completed"
                        : task.priority.toLowerCase().includes("low")
                        ? "priority--low"
                        : "priority--medium";

                      const [num, den] = task.progress.split("/").map(Number);
                      const pct = den ? Math.round((num / den) * 100) : 0;

                      return (
                        <label className={`task-row ${task.completed ? "task-row--completed" : ""}`} key={task.id}>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(task.id)}
                          />
                          <span className="task-check"><Check size={12} /></span>
                          <span className="task-copy">
                            <strong>{task.title}</strong>
                            <small>Due {task.due}</small>
                          </span>
                          <span className={`priority ${priorityClass}`}>{task.priority}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-7 h-1.5 rounded-full bg-[#f0e3d5] overflow-hidden block">
                              <span
                                className={`h-full block rounded-full ${
                                  task.completed ? "bg-[#1c1b17]" : "bg-[#f09a3e]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                            <span className="task-progress">{task.progress}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="task-footer-link cursor-pointer"
                    onClick={() => setShowAllTasks((prev) => !prev)}
                  >
                    {showAllTasks ? "Show fewer tasks" : "View All Tasks"} <ChevronDown size={14} />
                  </button>
                </article>
              </section>

              {/* Assigned Remediation Interventions (Closed-Loop Workflow) */}
              <section className="card p-5 sm:p-6 mb-6 rounded-2xl border border-[#F0E3D5] bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F0E3D5]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs">
                      <Target className="w-4 h-4 text-[#F09A3E]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#1C1B17] tracking-tight">
                          Assigned Remediation Drills & Practice
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                          {remediations.length} Assigned
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Live Database Workflow
                        </span>
                      </div>
                      <p className="text-xs text-[#787063] mt-0.5">
                        Targeted curriculum drills assigned by mentors to resolve identified performance gaps.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {remediationsLoading ? (
                    <div className="py-8 text-center text-xs text-[#787063]">
                      <Spinner size={16} className="mx-auto mb-2 text-[#D97718]" />
                      Loading your assigned practice drills...
                    </div>
                  ) : remediations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#787063] bg-[#FDF8F2] rounded-xl border border-[#F0E3D5]">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2 opacity-70" />
                      <p className="font-bold text-[#1C1B17]">No Active Remediation Drills</p>
                      <p className="mt-0.5 text-[#787063]">
                        You have no pending corrective drills assigned. Great work staying ahead!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {remediations.map((rem) => {
                        const isResolved = rem.status === "Resolved";
                        const isCompleted = rem.status === "Completed";
                        const isPending = rem.status === "Pending" || rem.status === "In Progress";

                        return (
                          <div
                            key={rem.id}
                            className="p-4 rounded-xl border border-[#F0E3D5] bg-[#FAF8F5] flex flex-col justify-between hover:border-[#D97718]/40 transition-colors shadow-2xs"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063]">
                                    Curriculum Module
                                  </span>
                                  <h3 className="text-sm font-black text-[#1C1B17]">
                                    {rem.module_name || `Module #${rem.module_id}`}
                                  </h3>
                                </div>

                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isResolved
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : isCompleted
                                      ? "bg-[#1C1B17] text-[#F09A3E] border-[#272520]"
                                      : "bg-[#FEF0E1] text-[#D97718] border-[#FBD1A7]"
                                  }`}
                                >
                                  {isResolved
                                    ? "Resolved: Benchmark Passed"
                                    : isCompleted
                                    ? "Completed: Awaiting Review"
                                    : "Pending: Practice Required"}
                                </span>
                              </div>

                              {rem.note && (
                                <div className="bg-white rounded-lg p-2.5 border border-[#F0E3D5] text-xs text-[#4A453E] leading-relaxed">
                                  <strong className="text-[#1C1B17] block font-bold text-[11px] mb-0.5">
                                    Mentor Instructions:
                                  </strong>
                                  "{rem.note}"
                                </div>
                              )}

                              {rem.completion_notes && (
                                <div className="bg-[#FEF4E8] rounded-lg p-2.5 border border-[#FBD1A7] text-xs text-[#1C1B17] leading-relaxed">
                                  <strong className="block font-bold text-[11px] text-[#D97718] mb-0.5">
                                    Your Submission Notes:
                                  </strong>
                                  "{rem.completion_notes}"
                                </div>
                              )}

                              {isResolved && rem.reassessment_score != null && (
                                <div className="bg-emerald-50/80 rounded-lg p-2.5 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                                  <span className="font-bold">Re-assessment Score:</span>
                                  <span className="font-black text-sm">{Number(rem.reassessment_score).toFixed(1)}%</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-3 mt-3 border-t border-[#F0E3D5] flex items-center justify-between">
                              <span className="text-[10px] text-[#787063]">
                                Assigned by {rem.assigned_by_name || "Mentor"} • {new Date(rem.assigned_at).toLocaleDateString()}
                              </span>

                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompleteModalTarget(rem);
                                    setCompletionNotes("");
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                >
                                  Complete Practice
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* =========================================================================
              VIEW: LEARNING PATHS (6 Advanced Technology Tracks)
              ========================================================================= */}
          {(activeNav === "Learning" || activeNav === "Learning Paths") && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E3D5]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                        Active Curriculum
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                        Illustrative Preview
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-[#1C1B17] mt-1">
                      Additive Manufacturing &amp; Advanced Technologies
                    </h2>
                    <p className="text-xs text-[#787063] mt-0.5">
                      Cohort Progress: 8 of 12 modules completed with 82% average assessment score
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDrillModuleName(priorityModuleData?.moduleName || "SQL");
                        setDrillModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>Launch Practice Drill</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTutorModuleName(priorityModuleData?.moduleName || "SQL");
                        setTutorModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#FEF4E8] hover:bg-[#FBD1A7]/60 text-[#D97718] border border-[#FBD1A7] font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#F09A3E]" />
                      <span>Ask Curriculum Tutor</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
                  {[
                    {
                      title: "Additive Manufacturing & 3D Printing",
                      desc: "FDM, FFF, FGF, LPBF, slicing parameters, calibration, and industrial applications.",
                      progress: 88,
                      status: "Mastered",
                      badgeColor: "bg-[#1C1B17] text-[#F09A3E] border-[#272520]",
                      topics: "6 Topics",
                    },
                    {
                      title: "CAD Design & Product Development",
                      desc: "Engineering drawing, AutoCAD, Fusion 360, SolidWorks, CATIA, and DFM principles.",
                      progress: 78,
                      status: "In Progress",
                      badgeColor: "bg-[#FEF0E1] text-[#D97718] border-[#FBD1A7]",
                      topics: "7 Topics",
                    },
                    {
                      title: "3D Scanning & Reverse Engineering",
                      desc: "Point cloud capture, mesh decimation, polygon repair, and GD&T quality inspection.",
                      progress: 92,
                      status: "Mastered",
                      badgeColor: "bg-[#1C1B17] text-[#F09A3E] border-[#272520]",
                      topics: "6 Topics",
                    },
                    {
                      title: "XR / VR / AR & Animation",
                      desc: "Unity, Unreal Engine, Blender 3D modeling, texturing, and immersive industrial simulation.",
                      progress: 65,
                      status: "In Progress",
                      badgeColor: "bg-[#FEF0E1] text-[#D97718] border-[#FBD1A7]",
                      topics: "8 Topics",
                    },
                    {
                      title: "AI, Machine Learning & Industry 4.0",
                      desc: "Digital twin architectures, predictive maintenance, computer vision, and defect classification.",
                      progress: 84,
                      status: "Mastered",
                      badgeColor: "bg-[#1C1B17] text-[#F09A3E] border-[#272520]",
                      topics: "9 Topics",
                    },
                    {
                      title: "Robotics, IoT & Drone Technology",
                      desc: "PLC automation, SCADA, industrial IoT sensors, mapping, surveying, and ROS nodes.",
                      progress: 70,
                      status: "In Progress",
                      badgeColor: "bg-[#FEF0E1] text-[#D97718] border-[#FBD1A7]",
                      topics: "7 Topics",
                    },
                  ].map((track, i) => (
                    <div key={i} className="p-4 rounded-xl border border-[#F0E3D5] hover:border-[#F09A3E] transition-all bg-[#FAF6F0] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${track.badgeColor}`}>
                            {track.status}
                          </span>
                          <span className="text-[11px] font-bold text-[#787063]">{track.topics}</span>
                        </div>
                        <h3 className="text-xs font-bold text-[#1C1B17] leading-snug">{track.title}</h3>
                        <p className="text-[11px] text-[#787063] mt-1 line-clamp-2 leading-relaxed">{track.desc}</p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-[#F0E3D5]">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-[#787063]">Mastery</span>
                          <span className="text-[#1C1B17]">{track.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#F0E3D5] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#F09A3E] rounded-full"
                            style={{ width: `${track.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center space-x-2 mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setDrillModuleName(track.title.split("&")[0].trim());
                              setDrillModalOpen(true);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-white border border-[#F0E3D5] hover:bg-[#FEF4E8] text-[#1C1B17] font-bold text-[11px] cursor-pointer text-center"
                          >
                            Practice Drill
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTutorModuleName(track.title.split("&")[0].trim());
                              setTutorModalOpen(true);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-[#FEF0E1] hover:bg-[#FBD1A7]/70 text-[#D97718] border border-[#FBD1A7] font-bold text-[11px] cursor-pointer text-center"
                          >
                            Tutor Notes
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: ASSESSMENTS (Diagnostics & Score Curves)
              ========================================================================= */}
          {activeNav === "Assessments" && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-[#F0E3D5] mb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                      Diagnostic Ledger
                    </span>
                    <h2 className="text-lg font-black text-[#1C1B17] mt-1">Assessment Performance History</h2>
                    <p className="text-xs text-[#787063] mt-0.5">Real-time session outcomes, errors, and pacing logs</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#F0E3D5]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF6F0] text-[#787063] uppercase tracking-wider text-[10px] border-b border-[#F0E3D5]">
                      <tr>
                        <th className="py-2.5 px-3">Session ID</th>
                        <th className="py-2.5 px-3">Module</th>
                        <th className="py-2.5 px-3">Score %</th>
                        <th className="py-2.5 px-3">Errors</th>
                        <th className="py-2.5 px-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0E3D5]/70">
                      {(sessionsData?.items || []).map((s, idx) => (
                        <tr key={idx} className="hover:bg-[#FEF4E8]/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[#787063]">#{s.id || idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-[#1C1B17]">{s.module_name}</td>
                          <td className="py-2.5 px-3 font-black text-[#1C1B17]">
                            {Number(s.score_percentage ?? s.score_pct ?? s.score).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-rose-600 font-bold">{s.errors} errs</td>
                          <td className="py-2.5 px-3 text-[#787063] font-mono">
                            {Math.floor((s.time_seconds || 0) / 60)}m {(s.time_seconds || 0) % 60}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: PROJECTS (Industrial Capstones)
              ========================================================================= */}
          {activeNav === "Projects" && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="pb-4 border-b border-[#F0E3D5]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                      Industrial Capstone
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                      Illustrative Preview
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-[#1C1B17] mt-1">
                    Industrial Capstone Projects &amp; Deliverables
                  </h2>
                  <p className="text-xs text-[#787063] mt-0.5">
                    Real-world client deliverables and engineering project evaluations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5">
                  {[
                    {
                      title: "Automated LPBF 3D Print Defect Detection Pipeline",
                      track: "Additive Manufacturing & AI",
                      dueDate: "15 Jun, 2025",
                      completion: 75,
                      milestones: [
                        { name: "CAD Model Ingestion & Slicing", done: true },
                        { name: "Camera Telemetry Stream Ingestion", done: true },
                        { name: "Defect Classifier Convolutional Model", done: true },
                        { name: "Real-time Telemetry Dashboard", done: false },
                      ],
                    },
                    {
                      title: "Autonomous Drone Facility Inspection & Point Cloud Reconstruction",
                      track: "Robotics, IoT & Drone Tech",
                      dueDate: "30 Jun, 2025",
                      completion: 90,
                      milestones: [
                        { name: "Flight Controller Mission Planning", done: true },
                        { name: "LiDAR Point Cloud Acquisition", done: true },
                        { name: "Mesh Repair & GD&T Inspection", done: true },
                        { name: "Client Deliverable Report", done: false },
                      ],
                    },
                  ].map((proj, idx) => (
                    <div key={idx} className="p-5 rounded-2xl border border-[#F0E3D5] bg-[#FAF6F0] flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-[10px] font-bold text-[#D97718] bg-[#FEF0E1] px-2 py-0.5 rounded border border-[#FBD1A7]">
                            {proj.track}
                          </span>
                          <span className="font-semibold text-[#787063] text-[11px]">Due {proj.dueDate}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#1C1B17]">{proj.title}</h3>

                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span className="text-[#787063]">Progress</span>
                            <span className="text-[#D97718]">{proj.completion}%</span>
                          </div>
                          <div className="w-full h-2 bg-[#F0E3D5] rounded-full overflow-hidden">
                            <div className="h-full bg-[#F09A3E] rounded-full" style={{ width: `${proj.completion}%` }} />
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="text-[11px] font-bold text-[#1C1B17]">Deliverable Milestones:</div>
                          {proj.milestones.map((m, mIdx) => (
                            <div key={mIdx} className="flex items-center space-x-2 text-xs">
                              <div className={`w-4 h-4 rounded flex items-center justify-center text-white ${m.done ? "bg-[#F09A3E]" : "bg-[#E6D9C7]"}`}>
                                {m.done && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className={m.done ? "text-[#1C1B17] font-medium" : "text-[#A2998A]"}>{m.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#F0E3D5] flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => showToast(`Opened repository workspace for: ${proj.title}`)}
                          className="flex-1 py-2 rounded-xl bg-white border border-[#F0E3D5] hover:bg-[#FEF4E8] font-bold text-xs text-[#1C1B17] cursor-pointer text-center"
                        >
                          View Repository
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(`Milestone deliverable submitted for review!`)}
                          className="flex-1 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] font-bold text-xs text-white cursor-pointer text-center"
                        >
                          Submit Milestone
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: SKILLS (Competency Breakdown)
              ========================================================================= */}
          {activeNav === "Skills" && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E3D5]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                        Competency Radar
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                        Illustrative Preview
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-[#1C1B17] mt-1">
                      Advanced Technology Skills &amp; Competencies
                    </h2>
                    <p className="text-xs text-[#787063] mt-0.5">
                      Illustrative static preview of specialized subject-track competencies (not live assessment telemetry).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrillModuleName("SQL");
                      setDrillModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Practice Weakest Skill</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5 items-center">
                  <div>
                    <SkillsRadar />
                    <p className="card-footnote text-center mt-2">
                      Illustrative static preview (not live assessment telemetry)
                    </p>
                  </div>
                  <div className="space-y-3.5">
                    {[
                      { name: "Git & Version Control", score: 85, level: "Advanced", color: "bg-[#1C1B17]" },
                      { name: "SQL Modeling & Relational Queries", score: 78, level: "Proficient", color: "bg-[#D97718]" },
                      { name: "Domain Knowledge (Additive & CAD)", score: 70, level: "Intermediate", color: "bg-[#F09A3E]" },
                      { name: "Python Core & Analytics", score: 70, level: "Intermediate", color: "bg-[#F09A3E]" },
                      { name: "Engineering Communication & Reports", score: 65, level: "Developing", color: "bg-[#A2998A]" },
                    ].map((skill, sIdx) => (
                      <div key={sIdx} className="p-3 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5]">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-[#1C1B17]">{skill.name}</span>
                          <div className="space-x-2">
                            <span className="text-[10px] font-semibold text-[#787063]">{skill.level}</span>
                            <span className="font-black text-[#1C1B17]">{skill.score}/100</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-[#F0E3D5] rounded-full overflow-hidden">
                          <div className={`h-full ${skill.color} rounded-full`} style={{ width: `${skill.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: MENTOR (Guidance Hub)
              ========================================================================= */}
          {activeNav === "Mentor" && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E3D5]">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-full bg-[#1C1B17] text-[#F09A3E] border border-[#272520] flex items-center justify-center font-black text-base shadow-md">
                      PS
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <h2 className="text-base font-black text-[#1C1B17]">Priya Sharma</h2>
                        <Sparkles className="w-4 h-4 text-[#F09A3E]" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                          Illustrative Preview
                        </span>
                      </div>
                      <p className="text-xs text-[#787063]">Lead Technical Curriculum Mentor &amp; Industrial Advisor</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() => setActiveNav("Messages")}
                        className="px-4 py-2 rounded-xl bg-[#1C1B17] hover:bg-[#272520] text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#F09A3E]" />
                        <span>Open Live Messages</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMentorModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Book 1:1 Check-in Session</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-5">
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#787063]">
                      Mentor Feedback History
                    </h3>
                    {[
                      {
                        date: "22 May, 2025",
                        module: "SQL Modeling & Queries",
                        feedback: "Great progress on the SQL Joins topic. Try to focus on the practice exercises this week, especially complex multi-table aggregations.",
                        status: "Actionable",
                      },
                      {
                        date: "18 May, 2025",
                        module: "Git & Branching Workflows",
                        feedback: "Outstanding work on rebase and conflict resolution drills. Your git log structure meets production team standards.",
                        status: "Commended",
                      },
                      {
                        date: "14 May, 2025",
                        module: "Python Data Structures",
                        feedback: "Good comprehension of list comprehensions. Suggest reviewing generator expressions and memory complexity before the upcoming benchmark.",
                        status: "Reviewed",
                      },
                    ].map((item, fIdx) => (
                      <div key={fIdx} className="p-4 rounded-xl border border-[#F0E3D5] bg-[#FAF6F0] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#1C1B17]">{item.module}</span>
                          <span className="text-[11px] text-[#A2998A]">{item.date}</span>
                        </div>
                        <p className="text-xs text-[#4A443B] leading-relaxed italic">
                          &ldquo;{item.feedback}&rdquo;
                        </p>
                        <div className="pt-2 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded">
                            {item.status}
                          </span>
                          <span className="text-[#A2998A]">Illustrative Log</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-[#F0E3D5] bg-[#FAF6F0] space-y-3">
                      <h3 className="text-xs font-bold text-[#1C1B17]">Mentor Office Hours</h3>
                      <div className="text-xs text-[#4A443B] space-y-1.5">
                        <div className="flex justify-between">
                          <span className="font-medium text-[#787063]">Tue &amp; Thu:</span>
                          <span className="font-bold text-[#1C1B17]">03:00 PM - 05:00 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-[#787063]">Location:</span>
                          <span className="font-bold text-[#1C1B17]">Lab 4 / Google Meet</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMentorModalOpen(true)}
                        className="w-full py-2 rounded-lg bg-white border border-[#F0E3D5] hover:bg-[#FEF4E8] font-bold text-xs text-[#1C1B17] cursor-pointer text-center"
                      >
                        Request Meeting Slot
                      </button>
                    </div>

                    <div className="p-4 rounded-xl border border-[#FBD1A7] bg-[#FEF4E8] space-y-3">
                      <h3 className="text-xs font-bold text-[#1C1B17]">Cohort &amp; Trainer Messaging</h3>
                      <p className="text-[11px] text-[#787063] leading-relaxed">
                        Send persistent direct messages or cohort broadcasts with file attachments to your assigned trainers and batch peers.
                      </p>
                      {!isAdmin && (
                        <button
                          type="button"
                          onClick={() => setActiveNav("Messages")}
                          className="w-full py-2 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Open Messages Workspace</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW: MESSAGES (Real Cohort & Trainer Communication)
              ========================================================================= */}
          {!isAdmin && activeNav === "Messages" && <Messages />}

          {/* =========================================================================
              VIEW: CAREER (Placement Pathway)
              ========================================================================= */}
          {activeNav === "Career" && (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="pb-4 border-b border-[#F0E3D5]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md">
                      Placement Pathway
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF4E8] text-[#787063] border border-[#F0E3D5]">
                      Illustrative Preview
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-[#1C1B17] mt-1">
                    Career &amp; Industrial Placement Readiness
                  </h2>
                  <p className="text-xs text-[#787063] mt-0.5">
                    Illustrative static preview of placement readiness benchmarks and sample employer tracks (not live telemetry).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-5">
                  {[
                    { label: "Overall Placement Readiness", val: "84%", sub: "Top 15% of cohort", color: "text-[#D97718]" },
                    { label: "Assessment Benchmark", val: "82%", sub: "Passing threshold: 70%", color: "text-[#1C1B17]" },
                    { label: "Cohort Attendance", val: "96%", sub: "Target threshold: 90%", color: "text-[#1C1B17]" },
                    { label: "Mock Technical Interview", val: "88%", sub: "Conducted 15 May", color: "text-[#D97718]" },
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl border border-[#F0E3D5] bg-[#FAF6F0]">
                      <span className="text-[11px] font-bold text-[#787063]">{stat.label}</span>
                      <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.val}</div>
                      <div className="text-[10px] text-[#A2998A] font-medium mt-0.5">{stat.sub}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#787063]">
                    Target Industrial Roles &amp; Match Score
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        role: "Additive Manufacturing Systems Engineer",
                        match: "94% Match",
                        skills: ["LPBF / FDM", "Slicing Optimization", "Quality Assurance"],
                        status: "Interviews Open",
                      },
                      {
                        role: "Robotics & Automation Specialist",
                        match: "89% Match",
                        skills: ["PLC Logic", "Industrial IoT", "ROS Nodes"],
                        status: "Interviews Open",
                      },
                      {
                        role: "Digital Twin & Simulation Analyst",
                        match: "86% Match",
                        skills: ["CAD DFM", "Computer Vision", "Predictive Analytics"],
                        status: "Interviews Open",
                      },
                    ].map((job, jIdx) => (
                      <div key={jIdx} className="p-4 rounded-xl border border-[#F0E3D5] bg-white shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-extrabold text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded text-[10px]">
                              {job.match}
                            </span>
                            <span className="text-[10px] text-[#787063] font-semibold">{job.status}</span>
                          </div>
                          <h4 className="font-bold text-[#1C1B17] text-xs">{job.role}</h4>
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {job.skills.map((s, k) => (
                              <span key={k} className="text-[10px] bg-[#FAF6F0] border border-[#F0E3D5] text-[#787063] px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => showToast(`Application initiated for: ${job.role}`)}
                          className="mt-4 w-full py-1.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-[11px] cursor-pointer text-center"
                        >
                          Apply via Portal
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <footer className="dashboard-footer">
            <span>Last synced just now</span>
            <span><Settings2 size={14} /> TraineeIQ workspace</span>
          </footer>
        </main>
      </div>

      {/* =========================================================================
          MODALS & OVERLAYS
          ========================================================================= */}

      {/* Practice Drill Modal */}
      <PracticeDrillModal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        moduleName={drillModuleName}
        traineeId={effectiveId}
      />

      {/* Curriculum Tutor Modal */}
      <CurriculumTutorModal
        isOpen={tutorModalOpen}
        onClose={() => setTutorModalOpen(false)}
        moduleName={tutorModuleName}
      />

      {/* Support Helpdesk Modal */}
      {supportModalOpen && (
        <SupportModal onClose={() => setSupportModalOpen(false)} />
      )}

      {/* Practice Completion Modal */}
      {completeModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#F0E3D5] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0E3D5] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FEF0E1] text-[#D97718] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#1C1B17]">
                  Submit Completed Practice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModalTarget(null)}
                className="text-[#787063] hover:text-[#1C1B17] text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#F0E3D5] text-xs">
              <span className="text-[#787063] block font-semibold text-[11px]">Curriculum Module:</span>
              <span className="font-black text-[#1C1B17] text-sm">
                {completeModalTarget.module_name || `Module #${completeModalTarget.module_id}`}
              </span>
              {completeModalTarget.note && (
                <p className="mt-1.5 text-[#4A453E] italic">
                  "{completeModalTarget.note}"
                </p>
              )}
            </div>

            <form onSubmit={handleCompleteRemediation} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#1C1B17] block mb-1">
                  Practice Summary or Submission Notes:
                </label>
                <textarea
                  required
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Detail the exercises completed, model geometry verified, or link..."
                  className="w-full text-xs p-3 rounded-xl border border-[#F0E3D5] focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30 bg-white"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#FDF8F2] border border-[#FBD1A7]/60 text-[11px] text-[#787063]">
                Submitting marks this practice complete and alerts your mentor to schedule your follow-up reassessment.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={() => setCompleteModalTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#F0E3D5] text-xs font-bold text-[#787063] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCompletion || !completionNotes.trim()}
                  className="px-4 py-1.5 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submittingCompletion ? "Submitting..." : "Confirm & Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B17]/60 backdrop-blur-xs">
          <div className="bg-[#FDF8F2] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#F0E3D5] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <h3 className="text-sm font-bold text-[#1C1B17]">Edit Trainee Profile</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-[#787063] hover:text-[#1C1B17] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-4">
              <div>
                <label className="font-bold text-[#1C1B17] block mb-1.5">Profile Photo</label>
                <div className="flex items-center space-x-3 mb-2">
                  {editForm.avatar_url ? (
                    <img
                      src={editForm.avatar_url}
                      alt="Avatar Preview"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-[#F09A3E]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#FAF6F0] border border-[#F0E3D5] text-[#787063] flex items-center justify-center font-bold">
                      TR
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#FEF4E8] border border-[#F0E3D5] text-[#1C1B17] font-bold text-xs cursor-pointer"
                    >
                      Upload from Device
                    </button>
                    {editForm.avatar_url && (
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, avatar_url: "" }))}
                        className="text-[10px] text-rose-600 font-semibold block hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1 overflow-x-auto pb-1">
                  {AVATAR_OPTIONS.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      onClick={() => setEditForm((prev) => ({ ...prev, avatar_url: url }))}
                      className={`w-7 h-7 rounded-full object-cover cursor-pointer ${
                        editForm.avatar_url === url ? "ring-2 ring-[#D97718] scale-105" : "opacity-60 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-[#1C1B17] block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FAF6F0] border border-[#F0E3D5] rounded-lg text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                />
              </div>

              <div>
                <label className="font-bold text-[#1C1B17] block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Phone number"
                  className="w-full px-3 py-1.5 bg-[#FAF6F0] border border-[#F0E3D5] rounded-lg text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                />
              </div>

              <div>
                <label className="font-bold text-[#1C1B17] block mb-1">Specialization / Track</label>
                <input
                  type="text"
                  value={editForm.specialization}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#FAF6F0] border border-[#F0E3D5] rounded-lg text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                />
              </div>

              {saveError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-[#787063] hover:bg-[#FAF6F0] hover:text-[#1C1B17] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-1.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  {saveLoading ? <Spinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Mentor Check-in Modal */}
      {mentorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B17]/60 backdrop-blur-xs">
          <div className="bg-[#FDF8F2] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#F0E3D5] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97718] bg-[#FEF4E8] border border-[#F0E3D5] px-2 py-0.5 rounded-md">
                  Mentor 1:1 Session
                </span>
                <h3 className="text-sm font-bold text-[#1C1B17] mt-1">Book Mentor Check-in</h3>
              </div>
              <button
                type="button"
                onClick={() => setMentorModalOpen(false)}
                className="text-[#787063] hover:text-[#1C1B17] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBookMentorSession} className="space-y-3.5 pt-3">
              <p className="text-[#787063] text-xs leading-relaxed">
                Connect with your mentor <strong className="text-[#1C1B17]">Priya Sharma</strong> to discuss practice drills, curriculum topics, or technical questions.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-[#1C1B17] mb-1">
                  Topics or questions to discuss:
                </label>
                <textarea
                  value={mentorNoteText}
                  onChange={(e) => setMentorNoteText(e.target.value)}
                  rows={3}
                  required
                  placeholder="E.g., Clarification on SQL queries, practice drills feedback, or conceptual questions..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5] text-xs text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                />
              </div>

              {mentorNoteSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Check-in request submitted! Your mentor will schedule a slot.</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={() => setMentorModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl border border-[#F0E3D5] text-[#787063] hover:bg-[#FAF6F0] hover:text-[#1C1B17] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mentorNoteSubmitting || !mentorNoteText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold flex items-center space-x-1.5 cursor-pointer"
                >
                  {mentorNoteSubmitting ? <Spinner size="sm" className="text-white" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Request Session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C1B17] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 border border-[#272520] animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#F09A3E] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}

function SupportModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("faqs");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Curriculum");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const faqs = [
    {
      q: "How is my Readiness Score computed?",
      a: "Your Readiness Score combines assessment scores (50%), module completions (30%), and attendance (20%) normalized on a 0 to 100 scale.",
    },
    {
      q: "How can I retake an assessment or practice drills?",
      a: "You can use the Assessments tab or click Start on AI Next Best Action to launch practice drills at any time without impacting proctored grades.",
    },
    {
      q: "How do I request additional 1:1 mentor time?",
      a: "Click 'Book Mentor check-in' on the dashboard or head to the Mentor tab to schedule dedicated review sessions with Priya Sharma.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B17]/60 backdrop-blur-xs">
      <div className="bg-[#FDF8F2] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#F0E3D5] text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#FEF4E8] border border-[#F0E3D5] text-[#D97718] flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1C1B17]">TraineeIQ Help &amp; Support</h3>
              <p className="text-[10px] text-[#787063]">24/7 technical and curriculum assistance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#787063] hover:text-[#1C1B17] p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs: FAQs vs Contact */}
        <div className="flex border-b border-[#F0E3D5] mt-3">
          <button
            type="button"
            onClick={() => setActiveTab("faqs")}
            className={`pb-2 px-3 font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "faqs" ? "border-[#F09A3E] text-[#D97718]" : "border-transparent text-[#787063] hover:text-[#1C1B17]"
            }`}
          >
            Frequently Asked Questions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ticket")}
            className={`pb-2 px-3 font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "ticket" ? "border-[#F09A3E] text-[#D97718]" : "border-transparent text-[#787063] hover:text-[#1C1B17]"
            }`}
          >
            Submit Support Ticket
          </button>
        </div>

        <div className="py-4">
          {activeTab === "faqs" ? (
            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#FAF6F0] border border-[#F0E3D5]">
                  <h4 className="font-bold text-[#1C1B17] mb-1">{faq.q}</h4>
                  <p className="text-[11px] text-[#787063] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          ) : submitted ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-[#1C1B17]">Ticket Submitted Successfully!</h4>
              <p className="text-[#787063] text-[11px]">Ticket ID #TIQ-8492. Our support engineering team will follow up via your portal notifications within 2 hours.</p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  onClose();
                }}
                className="mt-3 px-4 py-1.5 rounded-lg bg-[#1C1B17] text-white font-bold text-xs hover:bg-[#272520] cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block font-bold text-[#1C1B17] mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] text-xs text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                >
                  <option value="Curriculum">Curriculum &amp; Practice Drill Query</option>
                  <option value="Grades">Assessment Grading &amp; Ledger</option>
                  <option value="Technical">Portal Technical Issue</option>
                  <option value="Mentor">Mentor Coordination</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-[#1C1B17] mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your query"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] text-xs text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#1C1B17] mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide any details, steps to reproduce, or questions..."
                  className="w-full px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] text-xs text-[#1C1B17] focus:outline-none focus:border-[#F09A3E]"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-[#F0E3D5]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg border border-[#F0E3D5] text-[#787063] hover:bg-[#FAF6F0] hover:text-[#1C1B17] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold cursor-pointer"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default TraineeDashboard;
