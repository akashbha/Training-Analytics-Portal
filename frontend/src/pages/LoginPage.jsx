// src/pages/LoginPage.jsx
// Centered authentication screen showcasing the portal's signature rounded-3xl card theme.
// Supports credentials submission, inline validation, loading states, and demo account shortcuts.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const loggedUser = await login(email, password);
      // Route based on role
      if (loggedUser.role === "trainee" && loggedUser.trainee_id) {
        navigate(`/trainees/${loggedUser.trainee_id}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      setErrorMessage(err.message || "Invalid email or password.");
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
    <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-full bg-brand text-white items-center justify-center text-xl font-black mb-3 shadow-sm">
            T
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Training Analytics Portal</h1>
          <p className="text-xs text-slate-600 mt-1">Sign in to view real-time session progress and cohort analytics</p>
        </div>

        {/* Login Card */}
        <Card variant="white" className="p-8 shadow-md">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center space-x-2"
            >
              <span className="font-bold">!</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-6 bg-brand hover:bg-brand-dark text-white font-bold text-sm rounded-full shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          {/* Demo Credentials Helper Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-bold text-slate-700 block mb-2">Quick Demo Accounts:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo("admin@example.com", "Admin123!")}
                className="text-left p-2 rounded-xl bg-purple-100/70 hover:bg-purple-100 text-purple-900 font-semibold text-[11px] transition-colors"
              >
                <div>Admin Demo</div>
                <div className="text-[10px] text-purple-600 font-normal">Full control</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo("trainer@example.com", "Trainer@123")}
                className="text-left p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold text-[11px] transition-colors"
              >
                <div>Trainer Demo</div>
                <div className="text-[10px] text-indigo-600 font-normal">Staff portal</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo("trainee@example.com", "Trainee@123")}
                className="text-left p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors"
              >
                <div>Trainee Demo</div>
                <div className="text-[10px] text-slate-500 font-normal">Self view</div>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
