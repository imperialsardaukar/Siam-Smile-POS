import React from "react";

export default function Badge({ variant="neutral", children }) {
  const styles = {
    neutral: "bg-neutral-900 border-neutral-800 text-neutral-200",
    green: "bg-emerald-950 border-emerald-800 text-emerald-200",
    red: "bg-red-950 border-red-800 text-red-200",
    yellow: "bg-yellow-950 border-yellow-800 text-yellow-200",
    blue: "bg-sky-950 border-sky-800 text-sky-200",
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs ${styles[variant]}`}>{children}</span>;
}
