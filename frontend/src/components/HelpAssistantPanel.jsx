// src/components/HelpAssistantPanel.jsx
// Help assistant search panel integrated into user dashboards.
// Queries the role-scoped project documentation search endpoint and renders citations.

import React, { useState } from "react";
import { apiClient } from "../api/client";
import { LoadingState } from "./states/LoadingState";
import { ErrorState } from "./states/ErrorState";

export function HelpAssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResponse, setSearchResponse] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get(`/help/search?q=${encodeURIComponent(trimmed)}&limit=3`);
      setSearchResponse(res.data);
    } catch (err) {
      setError(err.message || "Failed to search project documentation.");
      setSearchResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearchResponse(null);
    setError(null);
  };

  return (
    <div className="w-full">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          Ask the project docs
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Help Assistant</h3>
              <p className="text-xs text-slate-500">Search indexed portal documentation by topic.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 200))}
                maxLength={200}
                placeholder="Ask a question about grading thresholds, policies, or workflows..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400 bg-slate-50/50"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {query.length}/200
              </span>
              <div className="flex items-center space-x-2">
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Search
                </button>
              </div>
            </div>
          </form>

          {loading && (
            <LoadingState
              message="Searching project documentation..."
              compact={true}
            />
          )}

          {error && (
            <ErrorState
              message={error}
              onRetry={handleSearch}
              compact={true}
            />
          )}

          {!loading && !error && searchResponse && (
            <div className="space-y-3 pt-2">
              {searchResponse.answer_found ? (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight">
                    Matches from project documentation.
                  </h4>
                  <div className="space-y-2">
                    {searchResponse.results?.map((res, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{res.heading}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{res.source_path}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {res.text?.length > 220 ? `${res.text.slice(0, 220).trim()}...` : res.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                  <p className="text-xs font-medium text-slate-600">
                    This is not covered in the project documentation.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HelpAssistantPanel;
