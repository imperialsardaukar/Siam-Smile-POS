import React from "react";

export default function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 shadow-lg shadow-red-500/20 grid place-items-center font-black">
        SS
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-lg font-semibold">Siam Smile App</div>
          <div className="text-xs text-neutral-400">POS • Real-time</div>
        </div>
      )}
    </div>
  );
}
