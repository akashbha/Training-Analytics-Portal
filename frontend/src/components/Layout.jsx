// src/components/Layout.jsx
// Core application layout shell providing standard page margins and structure.
// Embeds the floating pill navbar, Axtroid facility background, and wraps nested child routes.

import React from "react";
import { Navbar } from "./Navbar.jsx";

export function Layout({ children, liveSlot = null }) {
  return (
    <div className="min-h-screen bg-brand-page flex flex-col font-sans selection:bg-brand selection:text-white">
      <Navbar liveSlot={liveSlot} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {children}
      </main>

        {/* Clean Application Footer */}
        <footer className="mt-auto py-5 border-t border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-black text-slate-900 tracking-wider">TRAINING PORTAL</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-medium">Assessment & Learning Analytics</span>
            </div>
            <div>
              <span>© 2026 Training Analytics Portal. All Rights Reserved.</span>
            </div>
          </div>
        </footer>
    </div>
  );
}
