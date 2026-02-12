import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const AuthCtx = createContext(null);

const LS_KEY = "siam_smile_auth_v1";
const MODE_KEY = "pos_mode";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Track current mode separately from role
  // For admin: can be "admin", "cashier", or "kitchen"
  // For staff: can be "cashier" or "kitchen"
  const [currentMode, setCurrentMode] = useState(() => {
    return localStorage.getItem(MODE_KEY) || null;
  });

  // Check for stored auth on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Validate required fields
        if (parsed?.token && parsed?.role) {
          setUser(parsed);
          // Restore or set initial mode if not present
          const savedMode = localStorage.getItem(MODE_KEY);
          if (!savedMode) {
            // Set default mode based on role
            const initialMode = parsed.role === "admin" ? "admin" : 
                               parsed.staffRole === "kitchen" ? "kitchen" : "cashier";
            setCurrentMode(initialMode);
            localStorage.setItem(MODE_KEY, initialMode);
          }
        } else {
          // Invalid stored data, clear it
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(MODE_KEY);
        }
      }
    } catch (e) {
      console.error("[Auth] Failed to parse stored auth:", e);
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(MODE_KEY);
    }
    setIsReady(true);
  }, []);

  const login = useCallback((payload) => {
    setUser(payload);
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    // Set initial mode based on role
    const initialMode = payload.role === "admin" ? "admin" : 
                       payload.staffRole === "kitchen" ? "kitchen" : "cashier";
    setCurrentMode(initialMode);
    localStorage.setItem(MODE_KEY, initialMode);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setCurrentMode(null);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(MODE_KEY);
  }, []);

  // Switch mode function for managers and admins
  const switchMode = useCallback((mode) => {
    // Allow switch if user is manager or admin
    if (user?.role === "admin" || user?.staffRole === "manager") {
      setCurrentMode(mode);
      localStorage.setItem(MODE_KEY, mode);
      return true;
    }
    return false;
  }, [user]);

  // Check if user can switch modes (managers and admins)
  const canSwitchMode = user?.role === "admin" || user?.staffRole === "manager";
  
  // Check if user is elevated (manager or admin)
  const isElevated = user?.role === "admin" || user?.staffRole === "manager";

  // Get available views for the user
  const getAvailableViews = useCallback(() => {
    if (user?.role === "admin") {
      return [
        { value: "admin", label: "Admin" },
        { value: "cashier", label: "Cashier" },
        { value: "kitchen", label: "Kitchen" }
      ];
    }
    if (user?.staffRole === "manager") {
      return [
        { value: "cashier", label: "Cashier" },
        { value: "kitchen", label: "Kitchen" }
      ];
    }
    return [];
  }, [user]);

  const api = useMemo(() => ({
    user,
    isReady,
    login,
    logout,
    switchMode,
    currentMode,
    canSwitchMode,
    isElevated,
    getAvailableViews,
  }), [user, isReady, login, logout, switchMode, currentMode, canSwitchMode, isElevated, getAvailableViews]);

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const context = useContext(AuthCtx);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
