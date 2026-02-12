import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const StoreCtx = createContext(null);

// In production, use same origin. In development, connect to localhost:3001
const isDev = import.meta.env.DEV;
const API_BASE = isDev ? "http://localhost:3001" : window.location.origin;

export function StoreProvider({ children }) {
  const { user, logout } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const handleAuthError = useCallback((error) => {
    const errorMsg = error?.message || "";
    if (errorMsg.includes("invalid token") || errorMsg.includes("missing token")) {
      console.error("[Socket] Authentication failed - clearing session");
      logout();
    }
  }, [logout]);

  useEffect(() => {
    // Connect only when logged in
    if (!user?.token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSnapshot(null);
      setConnected(false);
      setConnError(null);
      reconnectAttemptsRef.current = 0;
      return;
    }

    setIsConnecting(true);
    
    const socket = io(API_BASE, {
      auth: { token: user.token },
      transports: ["websocket", "polling"], // Fallback for compatibility
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    
    socketRef.current = socket;

    const onConnect = () => { 
      setConnected(true); 
      setConnError(null);
      setIsConnecting(false);
      reconnectAttemptsRef.current = 0;
    };
    
    const onDisconnect = (reason) => { 
      setConnected(false);
      // Don't show error for normal disconnect
      if (reason !== "io client disconnect") {
        setConnError(`Disconnected: ${reason}`);
      }
    };
    
    const onConnectError = (err) => { 
      const errorMsg = err?.message || "Failed to connect";
      setConnError(errorMsg);
      setConnected(false);
      setIsConnecting(false);
      reconnectAttemptsRef.current++;
      
      // Check for auth errors
      handleAuthError(err);
      
      // Stop trying after max attempts
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        socket.disconnect();
        setConnError("Connection failed after multiple attempts. Please refresh the page.");
      }
    };
    
    const onSnapshot = (s) => {
      setSnapshot(s);
      setIsConnecting(false);
    };

    const onError = (err) => {
      console.error("[Socket] Error:", err);
      handleAuthError(err);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("state:snapshot", onSnapshot);
    socket.on("error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("state:snapshot", onSnapshot);
      socket.off("error", onError);
      socket.disconnect();
    };
  }, [user?.token, handleAuthError]);

  const api = useMemo(() => ({
    snapshot,
    connected,
    connError,
    isConnecting,
    socket: socketRef.current,
    emit(event, payload) {
      return new Promise((resolve) => {
        const s = socketRef.current;
        if (!s) return resolve({ ok: false, error: "Not connected" });
        if (!s.connected) return resolve({ ok: false, error: "Socket not connected" });
        
        // Set a timeout for the response
        const timeout = setTimeout(() => {
          resolve({ ok: false, error: "Request timeout" });
        }, 10000);
        
        s.emit(event, payload, (resp) => {
          clearTimeout(timeout);
          resolve(resp || { ok: true });
        });
      });
    }
  }), [snapshot, connected, connError, isConnecting]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  return useContext(StoreCtx);
}

export const API_BASE_URL = API_BASE;
