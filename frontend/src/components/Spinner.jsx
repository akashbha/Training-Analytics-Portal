// src/components/Spinner.jsx
// Lightweight, accessible SVG spinner component styled using Tailwind animation utilities.
// Provides configurable sizing and color themes for async state indicators.

import React from "react";

export function Spinner({ size = "md", className = "text-brand" }) {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  const dimensions = sizeMap[size] || sizeMap.md;

  return (
    <div role="status" aria-label="Loading" className="inline-flex items-center justify-center">
      <svg
        className={`animate-spin ${dimensions} ${className}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
