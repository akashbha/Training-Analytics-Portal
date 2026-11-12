// src/App.jsx
// Root application router with role guards, authentication protection, and live WebSocket broadcast context.
// Directs trainers to aggregate cohort analytics and trainees directly to their personal TraineeDashboard.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { LiveProvider } from "./context/LiveContext.jsx";
import { Layout } from "./components/Layout.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { AdminDashboard } from "./pages/AdminDashboard.jsx";
import { TraineeDashboard } from "./pages/TraineeDashboard.jsx";
import { Batches } from "./pages/Batches.jsx";
import { Trainees } from "./pages/Trainees.jsx";
import { AddSession } from "./pages/AddSession.jsx";
import { Modules } from "./pages/Modules.jsx";
import { Users } from "./pages/Users.jsx";
import { AuditLogs } from "./pages/AuditLogs.jsx";
import { Messages } from "./pages/Messages.jsx";
import { UnauthorizedPage } from "./pages/UnauthorizedPage.jsx";
import { Spinner } from "./components/Spinner.jsx";

// ProtectedRoute: Blocks unauthenticated or unverified sessions from protected views
function ProtectedRoute({ children }) {
  const { user, loading, sessionError, retrySession, logout, cachedDisplayUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user && sessionError?.type === "network") {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center p-4">
        <div
          role="alert"
          className="max-w-md w-full bg-white border border-amber-200 rounded-2xl shadow-lg p-6 text-center space-y-4"
        >
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700">
            Session Verification Unavailable
          </div>
          <h1 className="text-lg font-black text-slate-900">
            Unable to Verify Session
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {sessionError.message}
          </p>
          {cachedDisplayUser?.email && (
            <p className="text-[11px] text-slate-400">
              Cached local profile ({cachedDisplayUser.email}) cannot authorize access offline.
            </p>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={retrySession}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={sessionError?.type === "auth" ? { authError: sessionError.message } : undefined}
        replace
      />
    );
  }

  return children;
}

// RoleRoute: Checks role permission; displays friendly UnauthorizedPage if not allowed
function RoleRoute({ children, required = "staff" }) {
  const { user, isAdmin, isTrainer, isStaff, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (required === "admin" && !isAdmin) {
    return (
      <Layout>
        <UnauthorizedPage message="This administrative section requires administrator credentials." />
      </Layout>
    );
  }

  if (required === "staff" && !isStaff) {
    return (
      <Layout>
        <UnauthorizedPage message="This section requires trainer or administrator privileges." />
      </Layout>
    );
  }

  return children;
}

// HomeRoute: Renders AdminDashboard for admin, Dashboard for trainer, TraineeDashboard for trainee
function HomeRoute() {
  const { user, isStaff, isAdmin } = useAuth();

  if (!isStaff) {
    return <TraineeDashboard traineeId={user?.trainee_id} />;
  }

  if (isAdmin) {
    return (
      <Layout>
        <AdminDashboard />
      </Layout>
    );
  }

  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

// TraineeDetailRoute: Handles /trainees/:id with role and self-access verification
function TraineeDetailRoute() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();

  // If a trainee attempts to tamper with the URL to view another trainee's ID, reject immediately
  if (!isStaff && Number(user?.trainee_id) !== Number(id)) {
    return (
      <Layout>
        <UnauthorizedPage message="Trainees are restricted to viewing only their own performance data." />
      </Layout>
    );
  }

  return <TraineeDashboard />;
}

// RootRoute: Shows LandingPage if not logged in; shows appropriate Dashboard if logged in
function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <HomeRoute />;
}

export function App() {
  return (
    <AuthProvider>
      <LiveProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing & Login Routes: Root is the Home Screen */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Trainee Portal Route Aliases (resolve authenticated identity via /dashboard) */}
            <Route
              path="/trainee"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trainee-dashboard"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />

            {/* Authenticated Dashboard Route (Routes by Role) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <HomeRoute />
                </ProtectedRoute>
              }
            />

            {/* Explicit Admin Dashboard Route */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleRoute required="admin">
                    <Layout>
                      <AdminDashboard />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Batches Management Route (Staff: Trainers view-only, Admins manage) */}
            <Route
              path="/batches"
              element={
                <ProtectedRoute>
                  <RoleRoute required="staff">
                    <Layout>
                      <Batches />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Trainees Directory Route (Staff: Trainers view/add/edit, Admins delete) */}
            <Route
              path="/trainees"
              element={
                <ProtectedRoute>
                  <RoleRoute required="staff">
                    <Layout>
                      <Trainees />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Trainee Detail (Scoped: Staff access any; Trainees only access their own) */}
            <Route
              path="/trainees/:id"
              element={
                <ProtectedRoute>
                  <TraineeDetailRoute />
                </ProtectedRoute>
              }
            />

            {/* Add Session Route (Staff Only) */}
            <Route
              path="/sessions/new"
              element={
                <ProtectedRoute>
                  <RoleRoute required="staff">
                    <Layout>
                      <AddSession />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Modules Route (Staff / Admin) */}
            <Route
              path="/modules"
              element={
                <ProtectedRoute>
                  <RoleRoute required="staff">
                    <Layout>
                      <Modules />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Private Messaging Route (Trainee and Trainer only) */}
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Messages />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Users Management Route (Admin Only) */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <RoleRoute required="admin">
                    <Layout>
                      <Users />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={<Navigate to="/admin/users" replace />}
            />

            {/* Audit Logs Route (Admin Only) */}
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute>
                  <RoleRoute required="admin">
                    <Layout>
                      <AuditLogs />
                    </Layout>
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={<Navigate to="/admin/audit-logs" replace />}
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LiveProvider>
    </AuthProvider>
  );
}

export default App;
