// src/hooks/useLiveUpdates.js
// WebSocket management hook connecting to the backend live broadcast stream with exponential backoff.
// Handles automatic ping/pong heartbeats, guards against React StrictMode duplicate connections, and intercepts 4401 token expiry.

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Normalizes WebSocket endpoint URL from environment variables.
 */
function getWebSocketUrl(token) {
  let base = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

  if (base.startsWith("http://")) {
    base = base.replace("http://", "ws://");
  } else if (base.startsWith("https://")) {
    base = base.replace("https://", "wss://");
  } else if (!base.startsWith("ws://") && !base.startsWith("wss://")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    base = `${proto}//${base.replace(/^\/+/, "")}`;
  }

  const cleanBase = base.replace(/\/+$/, "");
  return `${cleanBase}/ws?token=${encodeURIComponent(token)}`;
}

export function useLiveUpdates(token) {
  const [status, setStatus] = useState("offline"); // "connected" | "reconnecting" | "offline"
  const [lastEvent, setLastEvent] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectDelayRef = useRef(1000); // 1s, 2s, 4s, 8s, up to 30s
  const isIntentionalCloseRef = useRef(false);
  const isMountedRef = useRef(true);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token) {
      setStatus("offline");
      return;
    }

    // Do not open duplicate sockets if one is currently connecting or open (e.g. StrictMode)
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();

    const url = getWebSocketUrl(token);
    let socket;

    try {
      socket = new WebSocket(url);
    } catch {
      setStatus("offline");
      return;
    }

    wsRef.current = socket;

    socket.onopen = () => {
      if (!isMountedRef.current) {
        socket.close();
        return;
      }
      setStatus("connected");
      reconnectDelayRef.current = 1000; // Reset backoff delay on successful connection
    };

    socket.onmessage = (event) => {
      if (!isMountedRef.current) return;

      // Safely parse JSON without throwing
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        // Ignore malformed JSON safely
        return;
      }

      if (!data || typeof data !== "object") return;

      // Reply pong to server heartbeats
      if (data.type === "ping") {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "pong" }));
          } catch {
            // Socket write error ignored
          }
        }
        return;
      }

      // Valid application broadcast event
      setLastEvent({
        ...data,
        _receivedAt: Date.now(),
      });
    };

    socket.onclose = (event) => {
      if (!isMountedRef.current || isIntentionalCloseRef.current) return;

      wsRef.current = null;

      // Code 4401: Unauthorized token invalid or expired
      if (event.code === 4401) {
        setStatus("offline");
        clearReconnectTimer();
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return;
      }

      // Schedule reconnection with exponential backoff (1s -> 2s -> 4s -> max 30s)
      setStatus("reconnecting");
      const currentDelay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(currentDelay * 2, 30000);

      clearReconnectTimer();
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !isIntentionalCloseRef.current) {
          connect();
        }
      }, currentDelay);
    };

    socket.onerror = () => {
      // Socket error: let onclose trigger the backoff cycle
      try {
        socket.close();
      } catch {
        // Already closed
      }
    };
  }, [token, clearReconnectTimer]);

  useEffect(() => {
    isMountedRef.current = true;
    isIntentionalCloseRef.current = false;

    if (token) {
      connect();
    } else {
      setStatus("offline");
    }

    return () => {
      isMountedRef.current = false;
      isIntentionalCloseRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "Component unmounted");
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
    };
  }, [token, connect, clearReconnectTimer]);

  return {
    status,
    lastEvent,
    isConnected: status === "connected",
  };
}
