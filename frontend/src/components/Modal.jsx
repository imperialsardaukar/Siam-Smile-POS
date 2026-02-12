import React, { useEffect } from "react";
import Button from "./Button.jsx";

export default function Modal({ open, title, children, onClose, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="text-lg font-semibold">{title}</div>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
          <div className="p-5">{children}</div>
          {footer && <div className="p-5 border-t border-neutral-800">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
