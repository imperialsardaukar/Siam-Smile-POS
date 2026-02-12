import React from "react";

export default function Button({ className = "", variant = "primary", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-white text-neutral-900 hover:bg-neutral-100",
    subtle: "bg-neutral-900 text-neutral-100 hover:bg-neutral-800 border border-neutral-800",
    danger: "bg-red-500 text-white hover:bg-red-400",
    ghost: "bg-transparent hover:bg-neutral-900 border border-neutral-800",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}
