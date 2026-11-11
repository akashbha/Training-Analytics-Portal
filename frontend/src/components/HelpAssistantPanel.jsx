// src/components/HelpAssistantPanel.jsx
// Evidence-Grounded Trainer Copilot for AI Operations Center.
// Grounded strictly in database telemetry (sessions, scores, notes, remediations) and official rubrics (RAG).
// Distinguishes recorded facts from generated suggestions with verifiable citations and 1-click draft actions.

import React, { useState } from "react";
import { apiClient } from "../api/client";
import {
  Sparkles,
  Bot,
  Search,
  RotateCw,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Database,
  Target,
  MessageSquare,
  BookOpen,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export function HelpAssistantPanel({ batchId, onAssignRemediation, onDirectMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copilotResponse, setCopilotResponse] = useState(null);

  const samplePrompts = [
    "Which trainees need help with CAD or Fusion 360?",
    "Summarize the recurring mistakes in this batch.",
    "Summarize feedback and interventions I have not yet acted on.",
    "Draft a revision session using the approved course material.",
    "What is the grading policy and passing cutoff?",
  ];

  const handleExecuteQuery = async (queryText) => {
    const trimmed = (queryText || query).trim();
    if (!trimmed) return;
    if (!batchId) {
      setError("Select a cohort before asking the assistant.");
      return;
    }

    setLoading(true);
    setError(null);
    setQuery(trimmed);

    try {
      const res = await apiClient.post("/help/trainer-copilot", {
        batch_id: Number(batchId),
        query: trimmed,
      });
      setCopilotResponse(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to execute copilot query.");
      setCopilotResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setCopilotResponse(null);
    setError(null);
  };

  return (
    <div className="w-full">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#1C1B17] hover:text-[#D97718] bg-white hover:bg-[#FEF4E8] border border-[#F0E3D5] px-4 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
        >
          <Bot className="w-4 h-4 text-[#F09A3E]" />
          <span>Trainer Copilot</span>
          <span className="text-[10px] font-mono text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-1.5 py-0.2 rounded font-bold">
            Evidence-Backed
          </span>
        </button>
      ) : (
        <div className="bg-white rounded-2xl border border-[#F0E3D5] p-5 sm:p-6 shadow-[0_2px_12px_rgba(28,27,23,0.03)] space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F0E3D5]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4 text-[#F09A3E]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1C1B17] tracking-tight">
                    Trainer Copilot
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                    Source-Cited Retrieval Guard
                  </span>
                </div>
                <p className="text-xs text-[#787063] font-medium mt-0.5">
                  SQLite FTS5 BM25 retrieval and SQL telemetry lookup grounded in session logs, rubrics, and active interventions.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-[#787063] hover:text-[#1C1B17] hover:bg-[#F5E8D8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cohort context guard */}
          {!batchId && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Select a cohort to scope Trainer Copilot queries.</span>
            </div>
          )}

          {/* Sample Prompts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A2998A] mr-1">
              Quick Inquiries:
            </span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading || !batchId}
                onClick={() => handleExecuteQuery(p)}
                className="text-[11px] font-medium bg-[#FAFAF8] hover:bg-[#FEF4E8] text-[#4A453E] hover:text-[#1C1B17] border border-[#F0E3D5] hover:border-[#FBD1A7] px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Query Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteQuery(query);
            }}
            className="space-y-2"
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                disabled={!batchId}
                onChange={(e) => setQuery(e.target.value.slice(0, 250))}
                maxLength={250}
                placeholder={batchId ? "Ask about struggling candidates, recurring mistakes, unacted feedback, or revision questions..." : "Select a cohort first to query Trainer Copilot..."}
                className="w-full text-xs pl-3.5 pr-24 py-2.5 bg-[#FAFAF8] border border-[#F0E3D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F09A3E]/30 text-[#1C1B17] placeholder:text-[#A2998A] font-medium disabled:opacity-60"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 text-[#787063] hover:text-[#1C1B17] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !query.trim() || !batchId}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1C1B17] hover:bg-[#2D2A24] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Search className="w-3 h-3 text-[#F09A3E]" />
                  <span>Ask</span>
                </button>
              </div>
            </div>
          </form>

          {/* Loading State */}
          {loading && (
            <div className="py-8 text-center text-xs text-[#787063]">
              <RotateCw className="w-4 h-4 animate-spin mx-auto mb-2 text-[#D97718]" />
              <span>Querying database telemetry and curriculum rubrics...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Response Display */}
          {!loading && !error && copilotResponse && (
            <div className="space-y-4 pt-2">
              {/* Recorded Facts vs Generated Suggestions */}
              <div className="space-y-3">
                {/* 1. Recorded Facts */}
                <div className="bg-[#FAFAF8] rounded-xl border border-[#F0E3D5] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1C1B17] flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-[#D97718]" />
                      Recorded Operational Facts
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified Database Ledger
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-[#2D2A24] leading-relaxed select-text">
                    {copilotResponse.recorded_facts}
                  </pre>
                </div>

                {/* 2. Generated Pedagogical Suggestions */}
                {copilotResponse.sufficient_evidence && copilotResponse.generated_suggestions && (
                  <div className="bg-[#FEF4E8] rounded-xl border border-[#FBD1A7] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#D97718] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Generated Pedagogical Suggestions
                      </span>
                      <span className="text-[10px] font-bold text-[#787063] bg-white border border-[#F0E3D5] px-2 py-0.5 rounded-md">
                        Requires Trainer Approval
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-[#4A453E] leading-relaxed select-text">
                      {copilotResponse.generated_suggestions}
                    </pre>
                  </div>
                )}
              </div>

              {/* Citations Grid */}
              {copilotResponse.citations?.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#787063] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#A2998A]" />
                      Exact Grounding Citations ({copilotResponse.citations.length})
                    </span>
                    <span className="text-[10px] text-[#A2998A]">Source evidence</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {copilotResponse.citations.map((c, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-lg border border-[#F0E3D5] p-3 text-xs space-y-1 hover:border-[#D97718]/40 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#1C1B17] truncate">{c.title}</span>
                          <span className="text-[9px] font-mono uppercase bg-[#F7F2EB] px-1.5 py-0.2 rounded border border-[#E8DEC8] text-[#787063] shrink-0">
                            {c.source_type.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[#4A453E] text-[11px] leading-relaxed italic line-clamp-3">
                          "{c.excerpt}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-Drafted Action Buttons */}
              {copilotResponse.draft_actions?.length > 0 && (
                <div className="pt-2 border-t border-[#F0E3D5] space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#787063]">
                    1-Click Actionable Interventions:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {copilotResponse.draft_actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => {
                          if (act.action_type === "assign_remediation" && onAssignRemediation) {
                            onAssignRemediation(act.target_id, act.target_name, act.module_name);
                          } else if (act.action_type === "direct_message" && onDirectMessage) {
                            onDirectMessage(act.target_id, act.target_name, act.suggested_payload);
                          } else {
                            alert(`Action queued: ${act.label}`);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-[#FBD1A7] bg-[#FEF4E8] text-[#1C1B17] hover:bg-[#FCECD8] transition-colors cursor-pointer shadow-2xs"
                      >
                        {act.action_type === "assign_remediation" ? (
                          <Target className="w-3.5 h-3.5 text-[#D97718]" />
                        ) : act.action_type === "direct_message" ? (
                          <MessageSquare className="w-3.5 h-3.5 text-[#D97718]" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5 text-[#D97718]" />
                        )}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
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
