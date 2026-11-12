import React from "react";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../api/client.js", () => ({
  apiClient: mockApi,
}));

vi.mock("../context/LiveContext.jsx", () => ({
  LiveProvider: ({ children }) => <>{children}</>,
  useLive: () => ({ status: "disconnected", lastEvent: null }),
  useLiveEvent: () => {},
  usePollingFallback: () => {},
}));

import App from "../App.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import { Users } from "../pages/Users.jsx";
import { AuditLogs } from "../pages/AuditLogs.jsx";
import { Modules } from "../pages/Modules.jsx";
import { Batches } from "../pages/Batches.jsx";
import { Trainees } from "../pages/Trainees.jsx";
import { AddSession } from "../pages/AddSession.jsx";
import {
  useBatches,
  useBatchSummary,
  useBatchWeekly,
  useBatchBands,
  useBatchAttention,
  useBatchLeaderboard,
  useBatchHeatmap,
  useBatchHotspots,
  useBatchRemediations,
  useBatchMisconceptions,
} from "../hooks/useBatchAnalytics.js";
import {
  useTraineeProfile,
  useTraineeSummary,
  useTraineeProgress,
  useTraineeErrors,
  useTraineeSessions,
  useTraineeStanding,
} from "../hooks/useTraineeAnalytics.js";

function makeNetworkError(message = "Network Error") {
  const err = new Error(message);
  err.code = "ERR_NETWORK";
  err.isNetworkError = true;
  err.response = undefined;
  return err;
}

function makeHttpError(status, message, code = "API_ERROR") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.response = {
    status,
    data: { error: { code, message } },
  };
  return err;
}

const ADMIN_USER = {
  id: 1,
  email: "real.admin@company.test",
  role: "admin",
  name: "Real Admin",
  trainee_id: null,
};

describe("Sprint 1A: Honest authentication & operational fallback removal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("1. Fresh browser stays logged out and redirects protected routes to /login without Demo Admin", async () => {
    window.history.pushState({}, "", "/dashboard");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(mockApi.get).not.toHaveBeenCalledWith("/auth/me");
    expect(screen.queryByText(/Demo Admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Seeded Illustrative Demo Accounts/i)).not.toBeInTheDocument();
  });

  it("2. Incorrect password is rejected cleanly and creates no session", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/login");
    mockApi.post.mockRejectedValueOnce(makeHttpError(401, "Invalid email or password."));

    render(<App />);

    await user.type(screen.getByPlaceholderText("name@example.com"), "trainer@example.com");
    await user.type(screen.getByPlaceholderText(/•+/), "WrongPassword!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(alert).toHaveAttribute("data-error-kind", "auth");
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("3. Login API unavailable shows connection error and never creates mock session", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/login");
    mockApi.post.mockRejectedValueOnce(makeNetworkError());

    render(<App />);

    await user.type(screen.getByPlaceholderText("name@example.com"), "admin@example.com");
    await user.type(screen.getByPlaceholderText(/•+/), "Admin123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to reach the authentication server/i);
    expect(alert).toHaveAttribute("data-error-kind", "network");
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("4a. Rejects leftover mock-token-* sessions and redirects protected routes to /login", async () => {
    localStorage.setItem("token", "mock-token-admin");
    localStorage.setItem("user", JSON.stringify({ id: 1, email: "admin@example.com", role: "admin" }));
    window.history.pushState({}, "", "/admin");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(mockApi.get).not.toHaveBeenCalledWith("/auth/me");
  });

  it("4b. Invalid/expired token from /auth/me (401) is cleared and rejected", async () => {
    localStorage.setItem("token", "expired.jwt.token");
    localStorage.setItem("user", JSON.stringify(ADMIN_USER));
    window.history.pushState({}, "", "/admin/users");
    mockApi.get.mockRejectedValueOnce(makeHttpError(401, "Token expired"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/token expired/i);
  });

  it("4c. Cached localStorage user never authorizes protected routes when /auth/me fails on network outage", async () => {
    localStorage.setItem("token", "real.jwt.token");
    localStorage.setItem("user", JSON.stringify(ADMIN_USER));
    window.history.pushState({}, "", "/admin/users");
    mockApi.get.mockRejectedValueOnce(makeNetworkError());

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to verify session/i);
    expect(screen.getByRole("button", { name: /retry connection/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /user accounts/i })).not.toBeInTheDocument();
  });

  it("5. Failed user provisioning never adds a user row or opens reveal modal", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "valid.jwt.token");

    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/me") return Promise.resolve({ data: ADMIN_USER });
      if (url.startsWith("/trainees")) return Promise.resolve({ data: { items: [] } });
      if (url.startsWith("/admin/users")) {
        return Promise.resolve({
          data: {
            items: [{ ...ADMIN_USER, is_active: true }],
            total: 1,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mockApi.post.mockRejectedValueOnce(makeNetworkError());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Users />
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText("real.admin@company.test");

    await user.click(screen.getByRole("button", { name: /add user/i }));
    await user.type(screen.getByPlaceholderText("colleague@example.com"), "new.trainer@company.test");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/unable to reach|network error|failed to create user account/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("new.trainer@company.test")).not.toBeInTheDocument();
    expect(screen.queryByText(/user account provisioned/i)).not.toBeInTheDocument();
  });

  it("6. Failed password reset and status mutation fail visibly with zero invented credentials", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "valid.jwt.token");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const targetTrainer = {
      id: 2,
      email: "trainer.one@company.test",
      role: "trainer",
      is_active: true,
      trainee_id: null,
    };

    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/me") return Promise.resolve({ data: ADMIN_USER });
      if (url.startsWith("/trainees")) return Promise.resolve({ data: { items: [] } });
      if (url.startsWith("/admin/users")) {
        return Promise.resolve({
          data: { items: [ADMIN_USER, targetTrainer], total: 2 },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mockApi.post.mockRejectedValueOnce(makeNetworkError());
    mockApi.patch.mockRejectedValueOnce(makeNetworkError());

    render(
      <MemoryRouter>
        <AuthProvider>
          <Users />
        </AuthProvider>
      </MemoryRouter>
    );

    const trainerCell = await screen.findByText("trainer.one@company.test");
    const row = trainerCell.closest("tr");

    await user.click(within(row).getByRole("button", { name: /reset pwd/i }));
    const resetAlert = await screen.findByRole("alert");
    expect(resetAlert).toHaveTextContent(/network error|failed to reset password/i);
    expect(screen.queryByText(/password reset completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DemoReset@123|ResetSecret@123/)).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: /deactivate/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network error|failed to update user status/i);
    });
    // Row remains active (still shows "Deactivate", never faked into "Activate")
    expect(within(row).getByRole("button", { name: /deactivate/i })).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it("7. Failed operational list requests render error/retry state and zero preview records", async () => {
    localStorage.setItem("token", "valid.jwt.token");
    mockApi.get.mockImplementation((url) => {
      if (url === "/auth/me") return Promise.resolve({ data: ADMIN_USER });
      return Promise.reject(makeNetworkError());
    });

    const pages = [
      {
        name: "Users",
        node: <Users />,
        forbiddenPreviewText: "Elena Rostova",
      },
      {
        name: "AuditLogs",
        node: <AuditLogs />,
        forbiddenPreviewText: "new_trainer@example.com",
      },
      {
        name: "Modules",
        node: <Modules />,
        forbiddenPreviewText: "Python Core & Data Structures",
      },
      {
        name: "Batches",
        node: <Batches />,
        forbiddenPreviewText: "Cohort Alpha (Core Full-Stack)",
      },
      {
        name: "Trainees",
        node: <Trainees />,
        forbiddenPreviewText: "Alex Chen",
      },
    ];

    for (const page of pages) {
      const { unmount } = render(
        <MemoryRouter>
          <AuthProvider>{page.node}</AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
      expect(screen.queryByText(page.forbiddenPreviewText)).not.toBeInTheDocument();
      unmount();
    }

    // AddSession also refuses fallback trainees/modules on network failure
    const { unmount: unmountSession } = render(
      <MemoryRouter>
        <AuthProvider>
          <AddSession />
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/network error|failed to load curriculum modules/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Python Fundamentals")).not.toBeInTheDocument();
    unmountSession();
  });

  it("8. Analytics hooks refuse preview fallback data on network failure or empty batches", async () => {
    mockApi.get.mockRejectedValue(makeNetworkError());

    const batchHooks = [
      () => useBatches(),
      () => useBatchSummary(1),
      () => useBatchWeekly(1),
      () => useBatchBands(1),
      () => useBatchAttention(1),
      () => useBatchLeaderboard(1),
      () => useBatchHeatmap(1),
      () => useBatchHotspots(1),
      () => useBatchRemediations(1),
      () => useBatchMisconceptions(1),
    ];

    for (const run of batchHooks) {
      const { result } = renderHook(run);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.error).toBeTruthy();
      if ("batches" in result.current) expect(result.current.batches).toEqual([]);
      if ("data" in result.current) expect(result.current.data).toBeNull();
    }

    const traineeHooks = [
      () => useTraineeProfile(1),
      () => useTraineeSummary(1),
      () => useTraineeProgress(1),
      () => useTraineeErrors(1),
      () => useTraineeSessions(1),
      () => useTraineeStanding(1),
    ];

    for (const run of traineeHooks) {
      const { result } = renderHook(run);
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeNull();
    }

    // Empty /batches response stays empty instead of substituting preview cohorts
    mockApi.get.mockResolvedValueOnce({ data: { items: [] } });
    const { result: emptyBatches } = renderHook(() => useBatches());
    await waitFor(() => {
      expect(emptyBatches.current.loading).toBe(false);
    });
    expect(emptyBatches.current.error).toBeNull();
    expect(emptyBatches.current.batches).toEqual([]);
  });
});

