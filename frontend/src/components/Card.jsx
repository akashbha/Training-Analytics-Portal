// src/components/Card.jsx
// Signature rounded-3xl card container matching the portal's purple aesthetic theme.
// Supports standard white surface cards and hero dark purple focus containers.

import React from "react";

export function Card({
  children,
  variant = "white",
  className = "",
  ...props
}) {
  const baseStyles = "rounded-3xl transition-shadow";
  const variants = {
    white: "bg-white text-slate-900 shadow-sm border border-purple-100/60 p-6",
    dark: "bg-brand-dark text-white shadow-md p-6",
    light: "bg-brand-light text-slate-900 p-6",
  };

  const selectedVariant = variants[variant] || variants.white;

  return (
    <div className={`${baseStyles} ${selectedVariant} ${className}`} {...props}>
      {children}
    </div>
  );
}
