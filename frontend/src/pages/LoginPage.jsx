// src/pages/LoginPage.jsx
// Split 2-column authentication page matching the presentation design reference (left clean form, right custom illustration panel).
// Supports credentials submission, inline validation, loading states, demo account shortcuts, and dark mode toggle.

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { ArrowLeft, Check, Lock, Sun, Moon } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setErrorMessage(
        err.message || "Invalid credentials. Please verify your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0D0B18] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-white transition-colors relative">
      {/* Top right theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-10 h-10 rounded-full bg-white/80 dark:bg-[#181427]/80 backdrop-blur-md border border-slate-200 dark:border-purple-800/40 text-slate-700 dark:text-purple-200 hover:text-indigo-600 dark:hover:text-purple-300 flex items-center justify-center shadow-xs transition-all cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      {/* Centered Modal Container */}
      <div className="w-full max-w-4xl bg-white dark:bg-[#181427] rounded-3xl shadow-xl border border-slate-200/80 dark:border-purple-900/30 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* =========================================================================
            LEFT COLUMN: AUTHENTICATION FORM
            ========================================================================= */}
        <div className="p-8 sm:p-12 flex flex-col justify-between">
          <div>
            {/* Top Brand Logo */}
            <div className="flex items-center space-x-2.5 mb-8">
              <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block"></span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Training Portal
              </span>
            </div>

            {/* Greeting Header */}
            <div className="mb-7">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Holla, <br />
                Welcome Back
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                Hey, welcome back to your performance portal
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 font-semibold flex items-center space-x-2"
              >
                <span className="w-4 h-4 rounded-full bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200 flex items-center justify-center font-bold text-[10px]">
                  !
                </span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#130F20] border border-slate-300 dark:border-purple-900/50 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#130F20] border border-slate-300 dark:border-purple-900/50 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Remember Me & Utility */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-purple-900 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <span className="text-slate-400 text-xs hover:text-indigo-600 dark:hover:text-purple-400 cursor-pointer transition-colors">
                  Forgot Password?
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-36 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <Spinner size="sm" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Demo Credentials */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-purple-900/30">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Quick Demo Accounts
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleFillDemo("trainer@example.com", "Trainer@123")}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#1E1833] hover:bg-indigo-50 dark:hover:bg-purple-950/80 border border-slate-200 dark:border-purple-900/50 hover:border-indigo-200 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-purple-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Trainer
                </button>
                <button
                  type="button"
                  onClick={() => handleFillDemo("admin@example.com", "Admin123!")}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#1E1833] hover:bg-indigo-50 dark:hover:bg-purple-950/80 border border-slate-200 dark:border-purple-900/50 hover:border-indigo-200 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-purple-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleFillDemo("trainee@example.com", "Trainee@123")}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#1E1833] hover:bg-indigo-50 dark:hover:bg-purple-950/80 border border-slate-200 dark:border-purple-900/50 hover:border-indigo-200 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-purple-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Trainee
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Back Navigation */}
          <div className="mt-8 pt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <Link
              to="/"
              className="inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-purple-300 font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Portal Overview</span>
            </Link>
            <span className="text-slate-400">© 2026 Portal</span>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: VECTOR ILLUSTRATION PANEL
            ========================================================================= */}
        <div className="hidden md:flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 relative overflow-hidden">
          {/* Decorative Cloud Shapes */}
          <div className="absolute top-6 left-6 w-28 h-12 bg-white/20 rounded-full blur-[1px]" />
          <div className="absolute top-16 right-8 w-36 h-14 bg-white/25 rounded-full blur-[1px]" />
          <div className="absolute bottom-8 left-8 w-44 h-16 bg-white/20 rounded-full blur-[1px]" />
          <div className="absolute bottom-16 right-6 w-32 h-12 bg-white/15 rounded-full blur-[1px]" />

          {/* Central Illustrated Card Container */}
          <div className="relative z-10 w-full max-w-xs flex flex-col items-center">
            {/* Speech Bubble with Checkmark */}
            <div className="absolute -top-6 left-4 z-20 bg-white rounded-2xl p-3 shadow-lg flex items-center justify-center transform -rotate-6 animate-bounce">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
            </div>

            {/* Mobile / Screen Frame with Biometric Scanner */}
            <div className="w-52 h-80 rounded-[2.5rem] bg-slate-900 border-4 border-slate-800 shadow-2xl p-3 relative flex flex-col items-center justify-between overflow-hidden">
              {/* Speaker notch */}
              <div className="w-16 h-3 bg-slate-800 rounded-full mb-4"></div>

              {/* Screen interior with radiant gradient */}
              <div className="w-full h-full rounded-[1.8rem] bg-gradient-to-b from-purple-500 via-fuchsia-500 to-pink-500 p-4 flex flex-col items-center justify-center text-center relative">
                {/* Fingerprint Biometric Target */}
                <div className="w-20 h-20 rounded-full border-2 border-white/40 flex items-center justify-center relative mb-4">
                  <div className="w-14 h-14 rounded-full border-2 border-white/60 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 3" />
                      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                      <path d="M2 12a10 10 0 0 1 18-6" />
                      <path d="M2 16h.01" />
                      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
                    </svg>
                  </div>
                  {/* Radiating scanner pulse */}
                  <div className="absolute inset-0 rounded-full border border-white animate-ping opacity-25"></div>
                </div>

                {/* Progress bar line */}
                <div className="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden mb-2">
                  <div className="w-2/3 h-full bg-cyan-300 rounded-full"></div>
                </div>
                <span className="text-[10px] text-white/90 font-medium">
                  Verified Trainee Session
                </span>
              </div>
            </div>

            {/* Security Padlock Widget */}
            <div className="absolute -bottom-4 -right-4 z-20 bg-white rounded-2xl p-4 shadow-xl border border-slate-100 flex items-center justify-center transform rotate-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Lock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Subtext under graphic */}
          <div className="mt-8 text-center text-white/90 z-10">
            <h3 className="text-sm font-bold">Secure Performance Analytics</h3>
            <p className="text-[11px] text-indigo-100/80 mt-0.5">
              Role-guarded cohort metrics & longitudinal scoring
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
