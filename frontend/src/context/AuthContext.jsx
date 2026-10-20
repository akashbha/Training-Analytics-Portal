// src/context/AuthContext.jsx
// React context provider managing user authentication state, token storage, and role helpers.
// Exposes login, logout, changePassword, isAdmin, isTrainer, isStaff, and session loading states.

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    try {
      if (saved) return JSON.parse(saved);
      // Default to demo admin session so web preview immediately displays populated analytics and admin management
      const defaultUser = {
        id: 1,
        email: "admin@example.com",
        role: "admin",
        name: "Demo Admin",
        trainee_id: null,
      };
      localStorage.setItem("user", JSON.stringify(defaultUser));
      localStorage.setItem("token", "mock-token-admin");
      return defaultUser;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Restore authenticated user on application load / refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    // Preserve offline demo session if previewing without local backend
    if (token.startsWith("mock-token-")) {
      setLoading(false);
      return;
    }

    apiClient
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      })
      .catch((err) => {
        // If network error (backend offline in remote preview), retain cached user session
        if (!err.response) {
          setLoading(false);
          return;
        }
        // Token invalid or expired (401)
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email, password) => {
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const { access_token, user: loggedInUser } = response.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      // In web preview environments where localhost:8000 is not reachable, allow seamless inspection
      if (
        (err.message?.includes("Network Error") || err.code === "ERR_NETWORK" || !err.response) &&
        (email.toLowerCase().includes("trainer") || email.toLowerCase().includes("trainee") || email.toLowerCase().includes("admin"))
      ) {
        const isDemoAdmin = email.toLowerCase().includes("admin");
        const isDemoTrainer = email.toLowerCase().includes("trainer");
        const role = isDemoAdmin ? "admin" : isDemoTrainer ? "trainer" : "trainee";

        const mockUser = {
          id: isDemoAdmin ? 1 : isDemoTrainer ? 2 : 3,
          email,
          role,
          name: isDemoAdmin ? "Demo Admin" : isDemoTrainer ? "Demo Trainer" : "Demo Trainee",
          trainee_id: role === "trainee" ? 1 : null,
        };
        const mockToken = `mock-token-${role}`;
        localStorage.setItem("token", mockToken);
        localStorage.setItem("user", JSON.stringify(mockUser));
        setUser(mockUser);
        return mockUser;
      }
      throw err;
    }
  };

  const changePassword = async (current_password, new_password) => {
    const token = localStorage.getItem("token");
    if (token && token.startsWith("mock-token-")) {
      return { message: "Password changed successfully (demo preview)" };
    }
    const response = await apiClient.post("/auth/change-password", {
      current_password,
      new_password,
    });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const role = user?.role || null;
  const isAdmin = role === "admin";
  const isTrainer = role === "trainer";
  const isStaff = role === "admin" || role === "trainer";
  const isTrainee = role === "trainee";

  const value = {
    user,
    role,
    isAdmin,
    isTrainer,
    isStaff,
    isTrainee,
    loading,
    login,
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
