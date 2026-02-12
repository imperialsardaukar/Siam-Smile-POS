import React from "react";

export default function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-2 outline-none focus:ring-2 focus:ring-red-500/40 ${className}`}
      {...props}
    />
  );
}
