// src/api/client.js
// Configured Axios instance with bearer token authorization and response error interceptors.
// Automatically transforms backend {"error": {"code", "message"}} envelopes into readable error messages.

import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
    // 401 Unauthorized: Clear session and redirect to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // Normalize backend error structure: {"error": {"code": "...", "message": "..."}}
    const backendMessage = error.response?.data?.error?.message;
    const backendCode = error.response?.data?.error?.code;

    const friendlyError = new Error(
      backendMessage || error.message || "An unexpected error occurred"
    );
    friendlyError.code = backendCode || "UNKNOWN_ERROR";
    friendlyError.status = error.response?.status;
    friendlyError.response = error.response;

    return Promise.reject(friendlyError);
  }
);
