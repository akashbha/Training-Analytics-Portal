// src/api/client.js
// Configured Axios instance with bearer token authorization and response error interceptors.
// Automatically transforms backend {"error": {"code", "message"}} envelopes into readable error messages.

import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request Interceptor: Attach stored JWT Bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 session expiration and parse backend errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 Unauthorized: Clear session and notify AuthContext cleanly (avoid duplicate events)
    if (error.response && error.response.status === 401) {
      const hadToken = Boolean(localStorage.getItem("token"));
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (hadToken) {
        window.dispatchEvent(
          new CustomEvent("auth:unauthorized", {
            detail: {
              message:
                error.response?.data?.error?.message ||
                "Your session is invalid or has expired. Please sign in again.",
            },
          })
        );
      }
    }

    // Normalize backend error structure: {"error": {"code": "...", "message": "..."}}
    const backendMessage = error.response?.data?.error?.message;
    const backendCode = error.response?.data?.error?.code;
    const isNetworkError =
      !error.response &&
      (error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        error.message?.includes("Network Error"));

    const friendlyError = new Error(
      backendMessage ||
        (isNetworkError
          ? "Unable to reach the authentication or API server. Check your connection and try again."
          : error.message || "An unexpected error occurred")
    );
    friendlyError.code = backendCode || error.code || "UNKNOWN_ERROR";
    friendlyError.status = error.response?.status;
    friendlyError.response = error.response;
    friendlyError.isNetworkError = isNetworkError;

    return Promise.reject(friendlyError);
  }
);
