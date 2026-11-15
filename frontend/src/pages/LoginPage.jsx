// src/pages/LoginPage.jsx
// Clean, modern authentication portal for the Training Analytics Portal.

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "../components/Spinner.jsx";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  BarChart3,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import loginCharacters from "../assets/login-characters.png";

export function LoginPage() {
  const { login, sessionError, clearSessionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorKind, setErrorKind] = useState("auth");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location.search]);

  useEffect(() => {
    const routeAuthError = location.state?.authError;
    if (routeAuthError) {
      setErrorMessage(routeAuthError);
      setErrorKind("auth");
    } else if (sessionError?.message) {
      setErrorMessage(sessionError.message);
      setErrorKind(sessionError.type || "auth");
    }
  }, [location.state, sessionError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorKind("auth");
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    clearSessionError?.();
    try {
      const loggedUser = await login(cleanEmail, cleanPassword);
      // Route based on role
      if (loggedUser.role === "trainee" && loggedUser.trainee_id) {
        navigate(`/trainees/${loggedUser.trainee_id}`);
      } else if (loggedUser.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setErrorKind(err?.isNetworkError ? "network" : "auth");
      setErrorMessage(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#EF641F] selection:text-white">
      {/* Centered White Master Container */}
      <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.06)] border border-slate-100 p-5 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        {/* =========================================================================
            LEFT COLUMN: TANGERINE ORANGE 3D CHARACTER CARD
            ========================================================================= */}
        <div className="hidden md:flex md:col-span-6 rounded-[2rem] bg-[#EF641F] text-white p-8 sm:p-10 flex-col justify-between relative overflow-hidden min-h-[580px] shadow-sm">
          {/* Top Promotional Headline & Subtitle */}
          <div className="relative z-20">
            <h2 className="text-3xl sm:text-[2.35rem] font-extrabold tracking-tight text-white leading-[1.12]">
              Simplify
              <br />
              management with
              <br />
              our dashboard.
            </h2>

            {/* Playful curved indicator line under title */}
            <svg
              className="w-36 h-3 text-white/80 my-2"
              viewBox="0 0 120 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 9C35 2 85 2 117 9"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>

            <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal mt-3 max-w-xs">
              Simplify your engineering cohort tracking with our user-friendly analytics dashboard.
            </p>
          </div>

          {/* 3D Character Illustration (Seamless Transparent PNG, Zero Glitches) */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none select-none overflow-hidden">
            <img
              src={loginCharacters}
              alt="Trainer and Trainee Performance Mentors"
              className="w-[82%] max-w-[340px] h-auto object-bottom select-none translate-y-2"
            />
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: MODERN PILL AUTHENTICATION FORM
            ========================================================================= */}
        <div className="md:col-span-6 p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
          <div className="flex-1 flex flex-col justify-center">
            {/* Top Brand Pill Header */}
            <div className="flex items-center justify-center gap-2.5 mb-6">
              <span className="w-9 h-9 rounded-full bg-[#EF641F] text-white flex items-center justify-center font-black text-xs shadow-sm shadow-[#EF641F]/30">
                TAP
              </span>
              <span className="text-lg font-bold tracking-tight text-neutral-900">
                Training Analytics Portal
              </span>
            </div>

            {/* Title & Subtitle */}
            <div className="text-center mb-7">
              <h1 className="text-2xl sm:text-[28px] font-bold text-neutral-900 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-normal">
                Please login to your account
              </p>
            </div>

            {/* Error Alert Message */}
            {errorMessage && (
              <div
                role="alert"
                data-error-kind={errorKind}
                className={`mb-5 p-3 rounded-2xl border text-xs font-semibold flex items-center space-x-2.5 ${
                  errorKind === "network"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    errorKind === "network"
                      ? "bg-amber-200 text-amber-900"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  !
                </span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-5 py-3.5 rounded-2xl bg-[#F6F7F9] border border-transparent focus:border-[#EF641F]/40 focus:bg-white text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-4 focus:ring-[#EF641F]/10 transition-all"
                />
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-5 py-3.5 pr-12 rounded-2xl bg-[#F6F7F9] border border-transparent focus:border-[#EF641F]/40 focus:bg-white text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-4 focus:ring-[#EF641F]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Utility Row: Forgot Password */}
              <div className="flex items-center justify-end text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setErrorMessage("Password resets are restricted to workspace administrators.")
                  }
                  className="text-xs text-neutral-400 hover:text-[#EF641F] font-medium transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Full-Width Orange Pill Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#EF641F] hover:bg-[#DE5512] active:scale-[0.99] text-white font-semibold text-sm shadow-[0_12px_24px_-8px_rgba(239,100,31,0.5)] transition-all flex items-center justify-center cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <Spinner size="sm" className="text-white" />
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </div>
            </form>

            {/* Bottom Account Notice */}
            <div className="mt-7 text-center text-xs text-neutral-400 font-normal">
              Need account access?{" "}
              <span className="font-semibold text-neutral-600">
                Contact your workspace administrator
              </span>
            </div>

            {/* Quick Demo Credentials (tree-shaken unless VITE_DEMO_MODE==="true") */}
            {import.meta.env.VITE_DEMO_MODE === "true" && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Seeded Illustrative Demo Accounts (Synthetic Data)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("trainer@example.com");
                      setPassword("Trainer@123");
                      setErrorMessage("");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FEF4E8] hover:bg-[#FBD1A7] border border-[#F0E3D5] text-[#1C1B17] text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Trainer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@example.com");
                      setPassword("Admin123!");
                      setErrorMessage("");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FEF4E8] hover:bg-[#FBD1A7] border border-[#F0E3D5] text-[#1C1B17] text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("trainee@example.com");
                      setPassword("Trainee@123");
                      setErrorMessage("");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FEF4E8] hover:bg-[#FBD1A7] border border-[#F0E3D5] text-[#1C1B17] text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    Trainee
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Back Navigation */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-neutral-400">
            <Link
              to="/"
              className="inline-flex items-center text-neutral-400 hover:text-[#EF641F] font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Portal Overview</span>
            </Link>
            <span className="text-neutral-300">© 2026 Training Analytics Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
