// src/pages/LoginPage.jsx
// Exact replica of the user's reference design (tangerine orange 3D character card on left,
// modern pill login form on right) styled for the TraineeIQ Training Analytics Portal.

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import loginIllustration from "../assets/login-illustration.jpg";

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
    if (!email || !password) {
      setErrorKind("auth");
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    clearSessionError?.();
    try {
      const loggedUser = await login(email, password);
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
    <div className="min-h-screen bg-[#F6F4F0] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#F46B22] selection:text-white">
      {/* Centered White Master Container Matching Reference Image */}
      <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(28,27,23,0.12)] border border-black/[0.04] p-5 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        {/* =========================================================================
            LEFT COLUMN: TANGERINE ORANGE 3D CHARACTER CARD (Matching Reference Image)
            ========================================================================= */}
        <div className="hidden md:flex md:col-span-6 rounded-[2rem] bg-gradient-to-b from-[#F1641D] via-[#EF651D] to-[#EB6019] text-white p-8 sm:p-10 flex-col justify-between relative overflow-hidden min-h-[580px] shadow-sm">
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
              className="w-36 h-3 text-white/55 my-2"
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

            <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium mt-3 max-w-xs">
              Simplify your engineering cohort tracking with our role-guarded performance portal.
            </p>
          </div>

          {/* 3D Character Illustration positioned cleanly below headline/subtitle with zero overlap */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[330px] h-[335px] z-10 pointer-events-none select-none overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 22%, black 100%), linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 22%, black 100%), linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
              WebkitMaskComposite: "source-in",
            }}
          >
            <img
              src={loginIllustration}
              alt="Trainer and Trainee Performance Mentors"
              className="w-full h-auto translate-y-[-14%] select-none"
            />
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: MODERN PILL AUTHENTICATION FORM (Matching Reference Image)
            ========================================================================= */}
        <div className="md:col-span-6 p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
          <div className="flex-1 flex flex-col justify-center">
            {/* Top Brand Pill Header */}
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="w-8 h-8 rounded-full bg-[#F46B22] text-white flex items-center justify-center font-black text-xs shadow-sm">
                TIQ
              </span>
              <span className="text-base font-extrabold tracking-tight text-[#1C1B17]">
                TraineeIQ
              </span>
            </div>

            {/* Title & Subtitle */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1C1B17] tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs text-[#787063] mt-1 font-medium">
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
                  placeholder="name@example.com"
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200/70 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F46B22]/30 focus:border-[#F46B22] transition-all"
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
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3.5 pr-11 rounded-2xl bg-[#F8F9FA] border border-slate-200/70 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F46B22]/30 focus:border-[#F46B22] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Utility Row: Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 text-[#787063] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-[#F46B22] rounded border-slate-300 focus:ring-[#F46B22] cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <span
                  onClick={() =>
                    setErrorMessage("Password resets are restricted to workspace administrators.")
                  }
                  className="text-xs text-[#787063] hover:text-[#F46B22] cursor-pointer transition-colors"
                >
                  Forgot password?
                </span>
              </div>

              {/* Full-Width Orange Pill Submit Button (Matching Reference Image) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#F46B22] hover:bg-[#E05710] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-[0_12px_24px_-10px_rgba(244,107,34,0.65)] hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <Spinner size="sm" className="text-white" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </div>
            </form>

            {/* Bottom Account Notice */}
            <div className="mt-6 text-center text-xs text-[#787063]">
              Don&apos;t have an account?{" "}
              <Link to="/#about" className="font-bold text-[#F46B22] hover:underline">
                Contact Admin
              </Link>
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
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link
              to="/"
              className="inline-flex items-center text-slate-500 hover:text-[#F46B22] font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Back to Portal Overview</span>
            </Link>
            <span className="text-slate-400">© 2026 TraineeIQ</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
