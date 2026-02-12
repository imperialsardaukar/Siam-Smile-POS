import React from "react";
import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";
import Badge from "./Badge.jsx";
import Button from "./Button.jsx";
import Select from "./Select.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { useStore } from "../state/StoreContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";

export default function Topbar({ right }) {
  const { user, logout, currentMode, switchMode, canSwitchMode, isElevated } = useAuth();
  const { connected, connError, isConnecting } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const getConnectionBadge = () => {
    if (!user) return null;
    if (isConnecting) return <Badge variant="yellow">Connecting...</Badge>;
    if (connected) return <Badge variant="green">Online</Badge>;
    return <Badge variant="red">Offline</Badge>;
  };

  // Handle mode switch for elevated users (admin/manager)
  function handleModeSwitch(newMode) {
    if (!canSwitchMode) return;
    
    const success = switchMode(newMode);
    if (!success) return;

    // Navigate based on selected mode
    switch (newMode) {
      case "admin":
        navigate("/admin");
        break;
      case "cashier":
        navigate("/cashier");
        break;
      case "kitchen":
        navigate("/kitchen");
        break;
      default:
        break;
    }
  }

  // Get current view label
  const getCurrentViewLabel = () => {
    if (!currentMode) return null;
    switch (currentMode) {
      case "admin": return "Admin";
      case "cashier": return "Cashier";
      case "kitchen": return "Kitchen";
      default: return currentMode;
    }
  };

  // Determine if we should show the view switcher
  const showViewSwitcher = canSwitchMode && currentMode && user;
  
  // For admin, show full view switcher; for manager, show simplified
  const isAdmin = user?.role === "admin";

  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-neutral-950/80 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <Link to="/" className="flex items-center">
          <Brand />
        </Link>

        {/* Right: Connection + View Switcher + User Actions + Custom Content */}
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          {getConnectionBadge()}
          
          {user && connError && !connected && (
            <span className="text-xs text-red-300 hidden sm:inline max-w-xs truncate" title={connError}>
              {connError}
            </span>
          )}

          {/* View Switcher for Elevated Users (Admin/Manager) */}
          {showViewSwitcher && (
            <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-neutral-900/80 rounded-lg border border-neutral-700">
              <span className="text-xs text-neutral-400 hidden sm:inline">View:</span>
              
              {isAdmin ? (
                // Admin gets 3-way switch
                <Select
                  value={currentMode}
                  onChange={(e) => handleModeSwitch(e.target.value)}
                  className="w-auto min-w-[100px] text-sm bg-transparent border-0 py-0 px-1"
                >
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen">Kitchen</option>
                </Select>
              ) : (
                // Manager gets 2-way toggle
                <>
                  <Badge 
                    variant={currentMode === "cashier" ? "blue" : "green"} 
                    className="text-xs"
                  >
                    {currentMode === "cashier" ? "Cashier" : "Kitchen"}
                  </Badge>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => handleModeSwitch(currentMode === "cashier" ? "kitchen" : "cashier")}
                    className="text-xs px-2 py-1 ml-1"
                    title={`Switch to ${currentMode === "cashier" ? "Kitchen" : "Cashier"}`}
                  >
                    Switch
                  </Button>
                </>
              )}
            </div>
          )}

          {/* User Badge - Shows username for staff, nothing extra for admin (view shows role) */}
          {user && user.role === "staff" && (
            <Badge variant="neutral" className="hidden sm:inline-flex">
              {user.username}
            </Badge>
          )}
          
          {/* Custom right content passed from parent */}
          {right}
          
          {/* Logout Button */}
          {user && (
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ModeSwitcher - Dropdown component for switching between Cashier/Kitchen views
 * For use inside Cashier or Kitchen pages when a more prominent switcher is needed
 */
export function ModeSwitcher({ className = "" }) {
  const { currentMode, switchMode, canSwitchMode, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!canSwitchMode || !currentMode) return null;
  
  const isAdmin = user?.role === "admin";

  function handleModeSelect(e) {
    const newMode = e.target.value;
    const success = switchMode(newMode);
    if (success) {
      navigate(`/${newMode}`);
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-neutral-400">Current View:</span>
      <Select
        value={currentMode}
        onChange={handleModeSelect}
        className="w-auto min-w-[120px] text-sm"
      >
        {isAdmin && <option value="admin">Admin</option>}
        <option value="cashier">Cashier</option>
        <option value="kitchen">Kitchen</option>
      </Select>
    </div>
  );
}

/**
 * ViewSwitchButton - Simple toggle button for managers
 * Shows the target view they'll switch to
 */
export function ViewSwitchButton({ className = "" }) {
  const { currentMode, switchMode, canSwitchMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!canSwitchMode || !currentMode) return null;
  
  // Don't show toggle button for admin (they have dropdown)
  if (currentMode === "admin") return null;

  const targetMode = currentMode === "cashier" ? "kitchen" : "cashier";
  const targetLabel = targetMode === "cashier" ? "Cashier" : "Kitchen";

  function handleClick() {
    const success = switchMode(targetMode);
    if (success) {
      navigate(`/${targetMode}`);
    }
  }

  return (
    <Button
      variant="subtle"
      size="sm"
      onClick={handleClick}
      className={className}
    >
      Switch to {targetLabel}
    </Button>
  );
}
