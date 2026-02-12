import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import Select from "./Select.jsx";

export function ModeSwitcher() {
  const { currentMode, switchMode, canSwitchMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  if (!canSwitchMode || !currentMode) return null;
  
  // Only show on Cashier or Kitchen pages
  const isCashierOrKitchen = location.pathname === "/cashier" || location.pathname === "/kitchen";
  if (!isCashierOrKitchen) return null;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-400">Mode:</span>
      <Select 
        value={currentMode}
        onChange={(e) => {
          const newMode = e.target.value;
          switchMode(newMode);
          navigate(`/${newMode}`);
        }}
        className="w-32"
      >
        <option value="cashier">Cashier</option>
        <option value="kitchen">Kitchen</option>
      </Select>
    </div>
  );
}

// Alternative simpler version for inline use
export function ModeSwitcherButton() {
  const { currentMode, switchMode, canSwitchMode } = useAuth();
  const navigate = useNavigate();
  
  if (!canSwitchMode || !currentMode) return null;
  
  const otherMode = currentMode === "cashier" ? "kitchen" : "cashier";
  
  return (
    <button
      onClick={() => {
        switchMode(otherMode);
        navigate(`/${otherMode}`);
      }}
      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 transition"
    >
      Switch to {otherMode.charAt(0).toUpperCase() + otherMode.slice(1)}
    </button>
  );
}
