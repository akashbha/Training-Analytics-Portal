// src/components/CurriculumTutorModal.jsx
// Technical curriculum mentor and module defect explainer.
// Grounded in verified curriculum syllabus topics to assist trainees on weak areas.

import React, { useState } from "react";
import { X, BookOpen, Send, Lightbulb, CheckCircle2 } from "lucide-react";

const MODULE_TUTOR_DATA = {
  "Docker & Container Virtualization": {
    coreConcept: "Container virtualization isolates application runtime environments using Linux cgroups and namespaces.",
    commonDefects: [
      "Bloated image sizes caused by leaving build tools and compilers in production layers.",
      "Data loss on container termination due to storing files in ephemeral container writable layers instead of named volumes.",
      "Port mapping errors failing to expose container ports to the host interface.",
    ],
    recommendedRemediation: "Adopt multi-stage Docker builds. Use minimal alpine or distroless base images for runtime. Mount named volumes for persistent database directories.",
    sampleFaqs: [
      {
        q: "How do multi-stage builds reduce image size?",
        a: "Multi-stage builds allow compiling binaries in a temporary 'builder' image and copying only the finished executable into a lightweight final image, discarding SDKs and intermediate caches.",
      },
      {
        q: "What is the difference between bind mounts and named volumes?",
        a: "Named volumes are managed directly by Docker in /var/lib/docker/volumes and are portable across hosts. Bind mounts link directly to an explicit host directory and depend on host filesystem structure.",
      },
    ],
  },
  "FastAPI REST Architecture": {
    coreConcept: "FastAPI builds asynchronous REST APIs utilizing Python type hints and Pydantic models for automated validation and serialization.",
    commonDefects: [
      "Blocking synchronous I/O operations placed inside async def handlers, blocking the event loop.",
      "Database session leaks caused by failing to close connections in dependency generators.",
      "Incorrect HTTP status codes returned (e.g. returning 200 OK instead of 201 Created on POST).",
    ],
    recommendedRemediation: "Ensure database dependencies yield sessions inside a try block with db.close() in a finally block. Use def for synchronous CPU-bound operations so FastAPI delegates them to a worker thread pool.",
    sampleFaqs: [
      {
        q: "When should I use async def vs plain def in route handlers?",
        a: "Use async def when using non-blocking asynchronous libraries (httpx, asyncpg). Use plain def for standard synchronous libraries (SQLAlchemy synchronous session, requests) so FastAPI runs them on thread workers.",
      },
      {
        q: "How does Pydantic handle payload validation?",
        a: "Pydantic validates request fields against Python type hints at runtime, automatically parsing types and returning 422 Unprocessable Entity with error details if validation fails.",
      },
    ],
  },
  "System Security & Token Authentication": {
    coreConcept: "Stateless authentication uses digitally signed JSON Web Tokens (JWT) transmitted via HTTP Authorization Bearer headers.",
    commonDefects: [
      "Excessively long access token lifetimes without a secure refresh token rotation mechanism.",
      "Storing sensitive tokens in browser localStorage making them vulnerable to Cross-Site Scripting (XSS).",
      "Using weak secret keys or failing to verify token expiration and signature algorithm headers.",
    ],
    recommendedRemediation: "Set short access token expiration (15 to 30 minutes). Store refresh tokens in HttpOnly SameSite cookies. Hash passwords using bcrypt with a minimum cost factor of 12.",
    sampleFaqs: [
      {
        q: "Why should access tokens expire quickly?",
        a: "Because JWTs are stateless and cannot be easily revoked before expiration, short lifetimes minimize the window of exposure if a token is intercepted.",
      },
      {
        q: "How does bcrypt defend against dictionary attacks?",
        a: "bcrypt incorporates an adjustable algorithmic work factor that increases computation time per attempt, rendering brute-force and rainbow table attacks computationally infeasible.",
      },
    ],
  },
  "SQL Modeling & PostgreSQL Operations": {
    coreConcept: "Relational data modeling enforces referential integrity through foreign keys, ACID transaction guarantees, and indexing structures.",
    commonDefects: [
      "Missing indexes on frequently filtered or joined foreign key columns leading to slow sequential scans.",
      "N+1 query problems in ORMs caused by lazy loading relationships inside iterative loops.",
      "Orphaned child records caused by omitting ON DELETE CASCADE constraints.",
    ],
    recommendedRemediation: "Create B-Tree indexes on foreign keys and frequently queried filter columns. Use joinedload or selectinload in SQLAlchemy to fetch relationships in a single batch query.",
    sampleFaqs: [
      {
        q: "When should I use EXPLAIN ANALYZE?",
        a: "Use EXPLAIN ANALYZE during query optimization to inspect whether PostgreSQL planner selected an Index Scan or Sequential Scan and to check actual execution runtimes.",
      },
      {
        q: "What is the difference between WHERE and HAVING?",
        a: "WHERE filters raw table rows before aggregation occurs. HAVING filters aggregated bucket groups produced by GROUP BY.",
      },
    ],
  },
};

function getModuleData(modName = "") {
  const keys = Object.keys(MODULE_TUTOR_DATA);
  const match = keys.find((k) => modName.toLowerCase().includes(k.split(" ")[0].toLowerCase()));
  return match ? MODULE_TUTOR_DATA[match] : MODULE_TUTOR_DATA["Docker & Container Virtualization"];
}

export function CurriculumTutorModal({ isOpen, moduleName, onClose }) {
  const [userQuery, setUserQuery] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  if (!isOpen) return null;

  const data = getModuleData(moduleName || "");

  const handleAsk = (e) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const questionText = userQuery.trim();
    setUserQuery("");

    // Find closest FAQ or generate technical guidance
    const faq = data.sampleFaqs.find(
      (f) =>
        f.q.toLowerCase().includes(questionText.toLowerCase()) ||
        questionText.toLowerCase().includes(f.q.split(" ")[1]?.toLowerCase() || "")
    );

    const answer = faq
      ? faq.a
      : `For ${moduleName || "this module"}: focus on addressing core defects. ${data.recommendedRemediation} Review the official syllabus guidelines to ensure error counts stay below the 2.0 benchmark tolerance.`;

    setChatHistory((prev) => [
      ...prev,
      { sender: "trainee", text: questionText },
      { sender: "tutor", text: answer },
    ]);
  };

  const handleQuickQuestion = (faq) => {
    setChatHistory((prev) => [
      ...prev,
      { sender: "trainee", text: faq.q },
      { sender: "tutor", text: faq.a },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Curriculum Technical Tutor
              </span>
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Syllabus Grounded
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              {moduleName || "Technical Module Explainer"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Core Concept Box */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-950 space-y-1">
            <span className="font-bold block uppercase text-[10px] text-blue-700">
              Curriculum Core Focus
            </span>
            <p className="leading-relaxed">{data.coreConcept}</p>
          </div>

          {/* Common Defects Analysis */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-900 font-bold">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Common Evaluation Defects in {moduleName}</span>
            </div>
            <ul className="space-y-1 text-slate-600 list-disc list-inside">
              {data.commonDefects.map((def, i) => (
                <li key={i} className="leading-relaxed">
                  {def}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Remediation Strategy */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="font-bold text-slate-900 block">
              Remediation Benchmark Advice
            </span>
            <p className="text-slate-600 leading-relaxed">{data.recommendedRemediation}</p>
          </div>

          {/* Quick FAQ buttons */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Ask Common Curriculum Questions
            </span>
            <div className="flex flex-wrap gap-2">
              {data.sampleFaqs.map((faq, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickQuestion(faq)}
                  className="px-2.5 py-1 text-left rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors cursor-pointer"
                >
                  {faq.q}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Thread */}
          {chatHistory.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-xs space-y-1 ${
                    msg.sender === "trainee"
                      ? "bg-slate-100 text-slate-900 font-medium ml-6"
                      : "bg-blue-50 border border-blue-200 text-blue-950 mr-6"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">
                    {msg.sender === "trainee" ? "Trainee Question" : "Tutor Explanation"}
                  </span>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question Input Footer */}
        <form onSubmit={handleAsk} className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center space-x-2">
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder={`Ask a technical question about ${moduleName || "this module"}...`}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="submit"
            disabled={!userQuery.trim()}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default CurriculumTutorModal;
