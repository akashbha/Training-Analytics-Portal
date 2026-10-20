// src/App.jsx
// Root application router with role guards, authentication protection, and live WebSocket broadcast context.
// Directs trainers to aggregate cohort analytics and trainees directly to their personal TraineeDashboard.

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { LiveProvider } from "./context/LiveContext.jsx";
import { Layout } from "./components/Layout.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { TraineeDashboard } from "./pages/TraineeDashboard.jsx";
import { Batches } from "./pages/Batches.jsx";
import { Trainees } from "./pages/Trainees.jsx";
import { AddSession } from "./pages/AddSession.jsx";
import { Modules } from "./pages/Modules.jsx";
import { Users } from "./pages/Users.jsx";
import { AuditLogs } from "./pages/AuditLogs.jsx";
import { UnauthorizedPage } from "./pages/Placeholders.jsx";
import { Spinner } from "./components/Spinner.jsx";

// ProtectedRoute: Blocks unauthenticated visitors and redirects to /login
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-page flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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

// HomeRoute: Renders Dashboard for staff, TraineeDashboard for trainees
function HomeRoute() {
  const { user, isStaff } = useAuth();

  if (!isStaff) {
    return (
      <Layout>
        <TraineeDashboard traineeId={user?.trainee_id} />
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

  return (
    <Layout>
      <TraineeDashboard />
    </Layout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <LiveProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Root Route: Staff Dashboard or Trainee Performance Dashboard */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomeRoute />
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
