// src/components/Card.jsx
// Signature card container matching the portal's aesthetic theme.
// Supports standard white surface cards, hero dark purple focus containers, and dark mode adaptation.

import React from "react";

export function Card({
  children,
  variant = "white",
  className = "",
  ...props
}) {
  const baseStyles = "rounded-xl transition-all duration-200";
  const variants = {
    white: "bg-white dark:bg-[#181427] text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/80 dark:border-purple-900/30 p-6",
    dark: "bg-slate-900 dark:bg-[#251D42] text-white shadow-md border border-purple-400/20 p-6",
    light: "bg-slate-50 dark:bg-purple-950/40 text-slate-900 dark:text-purple-200 border border-slate-200/60 dark:border-purple-900/30 p-6",
  };

  const selectedVariant = variants[variant] || variants.white;

  return (
    <div className={`${baseStyles} ${selectedVariant} ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
