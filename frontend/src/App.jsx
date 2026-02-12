import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import Cashier from "./pages/Cashier.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import Admin from "./pages/Admin.jsx";
import { useAuth } from "./state/AuthContext.jsx";

/**
 * Check if user can access Cashier interface
 * Allowed: Admin, Cashier staff, Manager
 */
function canAccessCashier(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;
  // Staff roles: cashier, kitchen, manager
  const staffRole = user.staffRole || "cashier";
  return staffRole === "cashier" || staffRole === "manager";
}

/**
 * Check if user can access Kitchen interface
 * Allowed: Admin, Kitchen staff, Manager
 */
function canAccessKitchen(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;
  // Staff roles: cashier, kitchen, manager
  const staffRole = user.staffRole || "cashier";
  return staffRole === "kitchen" || staffRole === "manager";
}

/**
 * Check if user is any kind of staff (including manager)
 */
function isStaff(user) {
  if (!user) return false;
  return user.role === "staff" || user.role === "admin";
}

/**
 * Route Guard Component
 * Handles role-based access control
 */
function Guard({ role, children }) {
  const { user, isReady } = useAuth();
  
  // Show loading state while auth is initializing
  if (!isReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-300">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }
  
  // Not logged in - redirect to home
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  // Check role-based access
  if (role === "admin") {
    if (user.role !== "admin") {
      return <Navigate to="/" replace />;
    }
  } else if (role === "cashier") {
    if (!canAccessCashier(user)) {
      return <Navigate to="/" replace />;
    }
  } else if (role === "kitchen") {
    if (!canAccessKitchen(user)) {
      return <Navigate to="/" replace />;
    }
  } else if (role === "staff") {
    if (!isStaff(user)) {
      return <Navigate to="/" replace />;
    }
  }
  
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login/admin" element={<AdminLogin />} />
      <Route path="/login/staff" element={<StaffLogin />} />
      
      {/* Protected Routes */}
      <Route 
        path="/cashier" 
        element={
          <Guard role="cashier">
            <Cashier />
          </Guard>
        } 
      />
      <Route 
        path="/kitchen" 
        element={
          <Guard role="kitchen">
            <Kitchen />
          </Guard>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <Guard role="admin">
            <Admin />
          </Guard>
        } 
      />
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
