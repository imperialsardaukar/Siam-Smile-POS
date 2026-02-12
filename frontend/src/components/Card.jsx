import React from "react";

export function Card({ className = "", ...props }) {
  return <div className={`rounded-2xl border border-neutral-800 bg-neutral-950/40 shadow-xl shadow-black/30 ${className}`} {...props} />;
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 p-5 border-b border-neutral-800">
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle && <div className="text-sm text-neutral-400">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function CardBody({ className = "", ...props }) {
  return <div className={`p-5 ${className}`} {...props} />;
}
