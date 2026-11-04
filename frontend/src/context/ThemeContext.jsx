// src/context/ThemeContext.jsx
// Theme provider managing light and dark mode states with localStorage persistence and system preference detection.
// Toggles the .dark class on document.documentElement for Tailwind CSS dark: variants.

import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "training_portal_theme";

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // 1. Check saved user preference in localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      return saved;
    }
    // 2. Check system preference
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  const isDark = theme === "dark";

  // Synchronize documentElement class and storage on theme change
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, isDark]);

  // Listen for operating system theme changes if user hasn't pinned one manually
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (newTheme) => {
    if (newTheme === "dark" || newTheme === "light") {
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

