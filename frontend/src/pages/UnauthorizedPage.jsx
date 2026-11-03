// src/pages/UnauthorizedPage.jsx
// Access restriction fallback screen with role-appropriate redirection.

import React from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card.jsx";

export function UnauthorizedPage({ message }) {
  return (
    <div className="max-w-md mx-auto my-12">
      <Card variant="white" className="text-center p-8 space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center font-bold text-lg">
          🔒
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access Restricted</h1>
        <p className="text-xs text-slate-600">
          {message ||
            "This section requires trainer or administrator privileges. Trainees are only permitted to view their own verified performance profile."}
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-brand text-white font-bold text-xs rounded-full hover:bg-brand-dark transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default UnauthorizedPage;
