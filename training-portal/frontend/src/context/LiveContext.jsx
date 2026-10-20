// src/context/LiveContext.jsx
// Centralized real-time WebSocket provider with event subscriber hub, automatic polling fallback, and live toast banners.
// Ensures a single persistent socket across the app, debounces burst events, and catches up on reconnect.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import { useLiveUpdates } from "../hooks/useLiveUpdates.js";
import { Activity, Bell, X } from "lucide-react";

const LiveContext = createContext(null);

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const token = localStorage.getItem("token");

  // Only open socket when user is actively authenticated
  const activeToken = user && token ? token : null;
  const { status, lastEvent, isConnected } = useLiveUpdates(activeToken);

  // Subscriber callbacks registry
  const subscribersRef = useRef(new Set());

  const subscribe = useCallback((callback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Live Toast Notifications queue (max 3, auto-dismiss 4s)
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, details = null) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => {
      const next = [...prev, { id, message, details }];
      return next.slice(-3); // Keep maximum 3 toasts
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Broadcast events to all registered subscribers and generate contextual toasts
  useEffect(() => {
    if (!lastEvent) return;

    // Notify registered subscribers
    subscribersRef.current.forEach((cb) => {
      try {
        cb(lastEvent);
      } catch {
        // Prevent subscriber errors from bubbling
      }
    });

    // Generate user-facing toast feedback
    const { type, trainee_name, count } = lastEvent;

    if (type === "session_created") {
      if (user?.role === "trainer") {
        addToast(
          `New session added for ${trainee_name || "Trainee"}`,
          "Live assessment synced"
        );
      } else {
        addToast("New session recorded", "Your dashboard has updated");
      }
    } else if (type === "sessions_bulk_created") {
      addToast(
        `Bulk import: ${count || "Multiple"} sessions added`,
        "Cohort metrics refreshed"
      );
    } else if (type === "session_deleted") {
      addToast("Session removed", "Metrics recalculated");
    }
  }, [lastEvent, user?.role, addToast]);

  const value = {
    status,
    lastEvent,
    isConnected,
    subscribe,
  };

  return (
    <LiveContext.Provider value={value}>
      {children}

      {/* Floating Live Event Toast Stack (Max 3, Top-Right) */}
      <div className="fixed top-20 right-6 z-50 flex flex-col space-y-2.5 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl border border-purple-500/30 flex items-center space-x-3 text-xs animate-in fade-in slide-in-from-right-5 duration-300 max-w-sm"
          >
            <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5 text-white animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white tracking-tight">{toast.message}</p>
              {toast.details && (
                <p className="text-[10px] text-purple-200 mt-0.5">{toast.details}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </LiveContext.Provider>
  );
}

/**
 * Access shared live WebSocket state
 */
export function useLive() {
  const context = useContext(LiveContext);
  if (!context) {
    throw new Error("useLive must be used within a LiveProvider");
  }
  return context;
}

/**
 * Hook to subscribe a component to WebSocket broadcast events
 */
export function useLiveEvent(callback) {
  const { subscribe } = useLive();
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    return subscribe((event) => {
      if (savedCallback.current) {
        savedCallback.current(event);
      }
    });
  }, [subscribe]);
}

/**
 * Polling fallback hook:
 * Refetches every 15s when disconnected; refetches once immediately upon reconnection.
 */
export function usePollingFallback(refetchFn, intervalMs = 15000) {
  const { isConnected } = useLive();
  const wasConnectedRef = useRef(isConnected);
  const savedRefetch = useRef(refetchFn);

  useEffect(() => {
    savedRefetch.current = refetchFn;
  }, [refetchFn]);

  // Catch-up refetch when socket reconnects
  useEffect(() => {
    if (!wasConnectedRef.current && isConnected) {
      if (savedRefetch.current) {
        savedRefetch.current();
      }
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  // Periodic polling fallback when not connected
  useEffect(() => {
    if (isConnected) return;

    const interval = setInterval(() => {
      if (savedRefetch.current) {
        savedRefetch.current();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isConnected, intervalMs]);
}
