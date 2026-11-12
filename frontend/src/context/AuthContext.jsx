// src/context/AuthContext.jsx
// React context provider managing user authentication state, token storage, and role helpers.
// Exposes login, logout, changePassword, isAdmin, isTrainer, isStaff, and session loading states.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../api/client.js";

const AuthContext = createContext(null);

export function isNetworkUnavailableError(err) {
  return Boolean(
    err &&
      (err.isNetworkError ||
        (!err.response &&
          (err.code === "ERR_NETWORK" ||
            err.code === "ECONNABORTED" ||
            err.message?.includes("Network Error") ||
            err.message?.includes("Unable to reach"))))
  );
}

function readCachedUserProfile() {
  try {
    const saved = localStorage.getItem("user");
    if (!saved || saved === "null") return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Never authorize protected routes from unverified localStorage state on boot.
  const [user, setUser] = useState(null);
  const [cachedDisplayUser, setCachedDisplayUser] = useState(() => readCachedUserProfile());
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Monotonic auth epoch + AbortController prevent in-flight /auth/me responses
  // from resurrecting a logged-out session or overwriting a newer login.
  const authEpochRef = useRef(0);
  const verifyAbortRef = useRef(null);

  const verifySession = useCallback(async () => {
    const requestEpoch = ++authEpochRef.current;
    if (verifyAbortRef.current) {
      verifyAbortRef.current.abort();
    }
    const controller = new AbortController();
    verifyAbortRef.current = controller;

    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setSessionError(null);
      setLoading(false);
      return null;
    }

    if (token.startsWith("mock-token-")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setCachedDisplayUser(null);
      setSessionError({
        type: "auth",
        message: "Mock session tokens are not accepted. Please sign in with valid credentials.",
      });
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const res = await apiClient.get("/auth/me", { signal: controller.signal });
      if (requestEpoch !== authEpochRef.current || controller.signal.aborted) {
        return null;
      }
      setUser(res.data);
      setCachedDisplayUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      setSessionError(null);
      return res.data;
    } catch (err) {
      if (
        requestEpoch !== authEpochRef.current ||
        controller.signal.aborted ||
        err?.code === "ERR_CANCELED" ||
        err?.name === "CanceledError"
      ) {
        return null;
      }
      setUser(null);
      if (isNetworkUnavailableError(err)) {
        // Transient network outage preserves non-authorizing cached display hint,
        // but never treats cached storage as an authenticated session.
        setSessionError({
          type: "network",
          message:
            "Cannot reach authentication server to verify your session. Retry when connected.",
        });
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setCachedDisplayUser(null);
        setSessionError({
          type: "auth",
          message:
            err.response?.data?.error?.message ||
            err.message ||
            "Your session is invalid or has expired. Please sign in again.",
        });
      }
      return null;
    } finally {
      if (requestEpoch === authEpochRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Verify authenticated user on application load / refresh
  useEffect(() => {
    verifySession();
    return () => {
      if (verifyAbortRef.current) {
        verifyAbortRef.current.abort();
      }
    };
  }, [verifySession]);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      authEpochRef.current += 1;
      if (verifyAbortRef.current) {
        verifyAbortRef.current.abort();
      }
      setUser(null);
      setCachedDisplayUser(null);
      setLoading(false);
      setSessionError({
        type: "auth",
        message:
          event?.detail?.message ||
          "Your session is invalid or has expired. Please sign in again.",
      });
    };

    const handleStorageSync = (event) => {
      if (event.key === "token" && !event.newValue) {
        authEpochRef.current += 1;
        if (verifyAbortRef.current) {
          verifyAbortRef.current.abort();
        }
        setUser(null);
        setCachedDisplayUser(null);
        setLoading(false);
        setSessionError({
          type: "auth",
          message: "Your session was signed out in another tab.",
        });
      } else if (event.key === null) {
        authEpochRef.current += 1;
        if (verifyAbortRef.current) {
          verifyAbortRef.current.abort();
        }
        setUser(null);
        setCachedDisplayUser(null);
        setLoading(false);
        setSessionError({
          type: "auth",
          message: "Your browser session was cleared.",
        });
      } else if (event.key === "token" && event.newValue && event.newValue !== event.oldValue) {
        verifySession();
      }
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    window.addEventListener("storage", handleStorageSync);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
      window.removeEventListener("storage", handleStorageSync);
    };
  }, [verifySession]);

  const login = async (email, password) => {
    authEpochRef.current += 1;
    if (verifyAbortRef.current) {
      verifyAbortRef.current.abort();
    }
    setLoading(false);
    setSessionError(null);
    const loginEpoch = authEpochRef.current;
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const { access_token, user: loggedInUser } = response.data || {};
      if (!access_token || !loggedInUser) {
        const malformed = new Error("Authentication response was incomplete.");
        malformed.isAuthError = true;
        throw malformed;
      }
      if (loginEpoch !== authEpochRef.current) {
        return null;
      }

      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setCachedDisplayUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      if (isNetworkUnavailableError(err)) {
        const connErr = new Error(
          "Unable to reach the authentication server. Check your connection and try again."
        );
        connErr.code = "ERR_NETWORK";
        connErr.isNetworkError = true;
        throw connErr;
      }

      const authErr = new Error(
        err.response?.data?.error?.message || err.message || "Invalid email or password."
      );
      authErr.status = err.response?.status || err.status;
      authErr.code = err.code;
      authErr.isAuthError = true;
      throw authErr;
    }
  };

  const changePassword = async (current_password, new_password) => {
    const response = await apiClient.post("/auth/change-password", {
      current_password,
      new_password,
    });
    return response.data;
  };

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const logout = () => {
    authEpochRef.current += 1;
    if (verifyAbortRef.current) {
      verifyAbortRef.current.abort();
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCachedDisplayUser(null);
    setLoading(false);
    setSessionError(null);
  };

  const role = user?.role || null;
  const isAdmin = role === "admin";
  const isTrainer = role === "trainer";
  const isStaff = role === "admin" || role === "trainer";
  const isTrainee = role === "trainee";

  const value = {
    user,
    cachedDisplayUser,
    role,
    isAdmin,
    isTrainer,
    isStaff,
    isTrainee,
    loading,
    sessionError,
    login,
    retrySession: verifySession,
    clearSessionError,
    changePassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
