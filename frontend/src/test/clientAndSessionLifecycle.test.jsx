import React from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { apiClient } from "../api/client.js";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import {
  useBatchHotspots,
  useBatchRemediations,
  useBatchMisconceptions,
} from "../hooks/useBatchAnalytics.js";
import { Dashboard } from "../pages/Dashboard.jsx";
import App from "../App.jsx";

vi.mock("../context/LiveContext.jsx", () => ({
  LiveProvider: ({ children }) => <>{children}</>,
  useLive: () => ({ status: "disconnected", lastEvent: null }),
  useLiveEvent: () => {},
  usePollingFallback: () => {},
}));

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const originalAdapter = apiClient.defaults.adapter;

function axiosResponse(config, status, data) {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  };
}

function axiosHttpError(config, status, code, message) {
  const err = new Error(`Request failed with status code ${status}`);
  err.config = config;
  err.response = {
    status,
    statusText: String(status),
    headers: {},
    data: { error: { code, message } },
  };
  return Promise.reject(err);
}

function axiosNetworkError(config) {
  const err = new Error("Network Error");
  err.code = "ERR_NETWORK";
  err.config = config;
  err.response = undefined;
  return Promise.reject(err);
}

const TRAINER_USER = {
  id: 2,
  email: "trainer@company.test",
  role: "trainer",
  name: "Verified Trainer",
  trainee_id: null,
};

describe("Real apiClient interceptors, session lifecycle, 404 contract, and KPI truthfulness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it("1. Real Axios interceptor attaches Bearer token and classifies network errors without clearing valid storage", async () => {
    localStorage.setItem("token", "real.jwt.123");
    localStorage.setItem("user", JSON.stringify(TRAINER_USER));
    const unauthorizedListener = vi.fn();
    window.addEventListener("auth:unauthorized", unauthorizedListener);

    let capturedAuthHeader = null;
    apiClient.defaults.adapter = async (config) => {
      capturedAuthHeader = config.headers?.Authorization || config.headers?.authorization;
      return axiosNetworkError(config);
    };

    await expect(apiClient.get("/batches")).rejects.toMatchObject({
      isNetworkError: true,
      code: "ERR_NETWORK",
    });

    expect(capturedAuthHeader).toBe("Bearer real.jwt.123");
    expect(localStorage.getItem("token")).toBe("real.jwt.123");
    expect(unauthorizedListener).not.toHaveBeenCalled();

    window.removeEventListener("auth:unauthorized", unauthorizedListener);
  });

  it("2. Real Axios interceptor clears storage on 401 cleanly, guards concurrent 401s, and preserves session on 403", async () => {
    const unauthorizedListener = vi.fn();
    window.addEventListener("auth:unauthorized", unauthorizedListener);

    // 401 on login without stored token should NOT trigger global auth:unauthorized event
    apiClient.defaults.adapter = async (config) =>
      axiosHttpError(config, 401, "INVALID_CREDENTIALS", "Invalid email or password.");

    await expect(apiClient.post("/auth/login", {})).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });
    expect(unauthorizedListener).not.toHaveBeenCalled();

    // Runtime 403 preserves session and does not clear token
    localStorage.setItem("token", "real.jwt.456");
    localStorage.setItem("user", JSON.stringify(TRAINER_USER));
    apiClient.defaults.adapter = async (config) =>
      axiosHttpError(config, 403, "FORBIDDEN", "Not assigned to this cohort.");

    await expect(apiClient.get("/batches/99/summary")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Not assigned to this cohort.",
    });
    expect(localStorage.getItem("token")).toBe("real.jwt.456");
    expect(unauthorizedListener).not.toHaveBeenCalled();

    // Concurrent runtime 401s clear storage once and emit a single auth:unauthorized event
    apiClient.defaults.adapter = async (config) =>
      axiosHttpError(config, 401, "TOKEN_EXPIRED", "Session expired.");

    const results = await Promise.allSettled([
      apiClient.get("/batches"),
      apiClient.get("/modules"),
    ]);
    expect(results.every((r) => r.status === "rejected" && r.reason.status === 401)).toBe(true);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(unauthorizedListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("auth:unauthorized", unauthorizedListener);
  });

  it("3. Successful login redirects to authenticated dashboard and survives refresh via /auth/me", async () => {
    const user = userEvent.setup();
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/auth/login") {
        return axiosResponse(config, 200, {
          access_token: "live.trainer.jwt",
          user: TRAINER_USER,
        });
      }
      if (config.url === "/auth/me") {
        return axiosResponse(config, 200, TRAINER_USER);
      }
      if (config.url?.startsWith("/batches")) {
        return axiosResponse(config, 200, { items: [{ id: 1, name: "Cohort One" }] });
      }
      if (config.url?.startsWith("/modules")) {
        return axiosResponse(config, 200, { items: [] });
      }
      if (config.url === "/analytics/batches/1/summary") {
        return axiosResponse(config, 200, {
          trainee_count: 5,
          avg_score_pct: 84.5,
          pass_rate_pct: 80.0,
          session_count: 10,
          avg_score_change_pct: 3.2,
        });
      }
      if (config.url === "/analytics/batches/1/bands") {
        return axiosResponse(config, 200, [
          { label: "Excellent (≥80%)", percent: 50, count: 5 },
          { label: "Average (60-79%)", percent: 30, count: 3 },
          { label: "Struggling (<60%)", percent: 20, count: 2 },
        ]);
      }
      return axiosResponse(config, 200, []);
    };

    window.history.pushState({}, "", "/login");
    const { unmount } = render(<App />);

    await user.type(screen.getByPlaceholderText("name@example.com"), TRAINER_USER.email);
    await user.type(screen.getByPlaceholderText(/•+/), "ValidPass123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("live.trainer.jwt");
      expect(screen.getByText("84.5%")).toBeInTheDocument();
    });

    // Simulate full page refresh on /dashboard
    unmount();
    window.history.pushState({}, "", "/dashboard");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("84.5%")).toBeInTheDocument();
      expect(screen.getAllByText("80.0%").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("4. Late /auth/me verification response arriving after logout never resurrects session", async () => {
    localStorage.setItem("token", "pending.jwt.token");
    localStorage.setItem("user", JSON.stringify(TRAINER_USER));

    let resolveVerify;
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/me") {
        return new Promise((resolve) => {
          resolveVerify = () => resolve(axiosResponse(config, 200, TRAINER_USER));
        });
      }
      return Promise.resolve(axiosResponse(config, 200, []));
    };

    function LifecycleProbe() {
      const { user, loading, logout } = useAuth();
      return (
        <div>
          <span data-testid="auth-state">{loading ? "loading" : user ? user.email : "logged-out"}</span>
          <button type="button" onClick={logout}>
            Logout Now
          </button>
        </div>
      );
    }

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthProvider>
          <LifecycleProbe />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("auth-state")).toHaveTextContent("loading");
    await user.click(screen.getByRole("button", { name: /logout now/i }));
    expect(screen.getByTestId("auth-state")).toHaveTextContent("logged-out");
    expect(localStorage.getItem("token")).toBeNull();

    // Late resolution from in-flight /auth/me arrives after logout
    resolveVerify();
    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent("logged-out");
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("5. Runtime 401 kicks active session to /login, while runtime 403 denies action without logging out", async () => {
    localStorage.setItem("token", "active.jwt.token");
    localStorage.setItem("user", JSON.stringify(TRAINER_USER));
    window.history.pushState({}, "", "/dashboard");

    let failMode = "403-subresource";
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/auth/me") return axiosResponse(config, 200, TRAINER_USER);
      if (config.url?.startsWith("/batches")) {
        return axiosResponse(config, 200, { items: [{ id: 1, name: "Cohort One" }] });
      }
      if (config.url?.startsWith("/modules")) return axiosResponse(config, 200, { items: [] });
      if (failMode === "401" && config.url?.startsWith("/analytics/")) {
        return axiosHttpError(config, 401, "TOKEN_REVOKED", "Token revoked.");
      }
      if (failMode === "403-subresource" && config.url === "/analytics/batches/1/trainers") {
        return axiosHttpError(config, 403, "FORBIDDEN", "Restricted trainer roster.");
      }
      return axiosResponse(config, 200, []);
    };

    render(<App />);

    // Wait for dashboard render with 403 subresource error
    await waitFor(() => {
      expect(screen.getAllByText(/cohort one/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(localStorage.getItem("token")).toBe("active.jwt.token");

    // Now simulate runtime 401 during an open session API request
    failMode = "401";
    await expect(apiClient.get("/analytics/batches/1/summary")).rejects.toMatchObject({ status: 401 });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/token revoked/i);
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("6. Retry succeeds after temporary outage, and cross-tab storage logout clears active session", async () => {
    const user = userEvent.setup();
    localStorage.setItem("token", "valid.session.jwt");
    localStorage.setItem("user", JSON.stringify(TRAINER_USER));
    window.history.pushState({}, "", "/modules");

    let serverOnline = false;
    apiClient.defaults.adapter = async (config) => {
      if (!serverOnline) return axiosNetworkError(config);
      if (config.url === "/auth/me") return axiosResponse(config, 200, TRAINER_USER);
      if (config.url?.startsWith("/modules")) {
        return axiosResponse(config, 200, {
          items: [{ id: 10, name: "Real Security Module", max_score: 100, session_count: 2 }],
          total: 1,
        });
      }
      return axiosResponse(config, 200, []);
    };

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unable to verify session/i);

    // Server recovers and user retries
    serverOnline = true;
    await user.click(screen.getByRole("button", { name: /retry connection/i }));

    expect(await screen.findByText("Real Security Module")).toBeInTheDocument();

    // Another browser tab logs out via storage event
    localStorage.removeItem("token");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "token",
        oldValue: "valid.session.jwt",
        newValue: null,
        storageArea: localStorage,
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/signed out in another tab/i);
  });

  it("7. Analytics 404 surfaces error (never empty success) while 200 empty shows clean empty state", async () => {
    apiClient.defaults.adapter = async (config) => {
      if (config.url?.includes("/batches/999/")) {
        return axiosHttpError(config, 404, "BATCH_NOT_FOUND", "Batch with ID 999 not found");
      }
      if (config.url?.endsWith("/misconceptions")) {
        return axiosResponse(config, 200, {
          batch_id: 1,
          total_notes_analyzed: 0,
          cluster_count: 0,
          clusters: [],
        });
      }
      return axiosResponse(config, 200, []);
    };

    const { result: h404 } = renderHook(() => useBatchHotspots(999));
    const { result: r404 } = renderHook(() => useBatchRemediations(999));
    const { result: m404 } = renderHook(() => useBatchMisconceptions(999));

    await waitFor(() => {
      expect(h404.current.loading).toBe(false);
      expect(r404.current.loading).toBe(false);
      expect(m404.current.loading).toBe(false);
    });
    expect(h404.current.error).toMatch(/batch with id 999 not found/i);
    expect(r404.current.error).toMatch(/batch with id 999 not found/i);
    expect(m404.current.error).toMatch(/batch with id 999 not found/i);

    const { result: hEmpty } = renderHook(() => useBatchHotspots(1));
    const { result: rEmpty } = renderHook(() => useBatchRemediations(1));
    const { result: mEmpty } = renderHook(() => useBatchMisconceptions(1));

    await waitFor(() => {
      expect(hEmpty.current.loading).toBe(false);
      expect(rEmpty.current.loading).toBe(false);
      expect(mEmpty.current.loading).toBe(false);
    });
    expect(hEmpty.current.error).toBeNull();
    expect(hEmpty.current.hotspots).toEqual([]);
    expect(rEmpty.current.error).toBeNull();
    expect(rEmpty.current.remediations).toEqual([]);
    expect(mEmpty.current.error).toBeNull();
    expect(mEmpty.current.clusters).toEqual([]);
  });

  it("8. Dashboard KPI cards and competency arc distinguish failed requests from real zero-record cohorts", async () => {
    localStorage.setItem("token", "trainer.jwt");
    let summaryMode = "error";

    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/auth/me") return axiosResponse(config, 200, TRAINER_USER);
      if (config.url?.startsWith("/batches?page")) {
        return axiosResponse(config, 200, { items: [{ id: 1, name: "Empty Cohort" }] });
      }
      if (config.url?.startsWith("/modules")) return axiosResponse(config, 200, { items: [] });
      if (config.url === "/analytics/batches/1/summary") {
        if (summaryMode === "error") {
          return axiosHttpError(config, 500, "SERVER_ERROR", "Summary telemetry down");
        }
        return axiosResponse(config, 200, {
          trainee_count: 5,
          avg_score_pct: null,
          pass_rate_pct: null,
          session_count: 0,
          avg_score_change_pct: null,
        });
      }
      if (config.url === "/analytics/batches/1/bands") {
        if (summaryMode === "error") {
          return axiosHttpError(config, 500, "SERVER_ERROR", "Bands down");
        }
        return axiosResponse(config, 200, []);
      }
      return axiosResponse(config, 200, []);
    };

    const { rerender } = render(
      <MemoryRouter>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </MemoryRouter>
    );

    // Error state must show Unavailable / — and NEVER 0 trainees, +0 pts, or -%
    await waitFor(() => {
      expect(screen.getAllByText(/metrics unavailable/i).length).toBeGreaterThanOrEqual(4);
    });
    expect(screen.queryByText("-%")).not.toBeInTheDocument();
    expect(screen.queryByText("+0 pts")).not.toBeInTheDocument();
    expect(screen.queryByText("N = 0")).not.toBeInTheDocument();

    // Switch to a healthy zero-session cohort and trigger Retry
    summaryMode = "zero-sessions";
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /^retry$/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/requires >= 1 graded evaluation/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("-%")).not.toBeInTheDocument();
    expect(screen.getByText("N = 5")).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </MemoryRouter>
    );
  });
});
