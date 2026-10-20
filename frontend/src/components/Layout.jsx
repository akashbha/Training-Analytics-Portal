// src/components/Layout.jsx
// Core application layout shell providing standard page margins and structure.
// Embeds the floating pill navbar and wraps nested child routes inside a responsive viewport container.

import React from "react";
import { Navbar } from "./Navbar.jsx";

export function Layout({ children, liveSlot = null }) {
  return (
    <div className="min-h-screen bg-brand-page flex flex-col font-sans selection:bg-brand selection:text-white">
      <Navbar liveSlot={liveSlot} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
