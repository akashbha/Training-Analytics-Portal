// src/components/Card.jsx
// Standard card container with white, dark, and light surface variants.

import React from "react";

export function Card({
  children,
  variant = "white",
  className = "",
  ...props
}) {
  const baseStyles = "rounded-xl transition-all";
  const variants = {
    white: "bg-white text-slate-900 shadow-sm border border-slate-200/80 p-6",
    dark: "bg-slate-900 text-white shadow-md p-6",
    light: "bg-slate-50 text-slate-900 border border-slate-200/60 p-6",
  };

  const selectedVariant = variants[variant] || variants.white;

  return (
    <div className={`${baseStyles} ${selectedVariant} ${className}`} {...props}>
      {children}
    </div>
  );
}
