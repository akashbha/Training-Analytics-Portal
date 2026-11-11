// src/components/PracticeDrillModal.jsx
// Self-assessment practice drill runner.
// Enables trainees to practice curriculum module questions with live timing and instant feedback.
// Academic Safety: Practice sessions are isolated and do not contaminate official proctored grading.

import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, AlertCircle, Clock, RotateCcw, ArrowRight, ArrowLeft } from "lucide-react";
import { getPracticeQuestions } from "../constants/practiceQuestions.js";
import { PASS_THRESHOLD, EXCELLENT_THRESHOLD } from "../constants/thresholds.js";

export function PracticeDrillModal({ moduleName, isOpen, onClose, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const timerRef = useRef(null);

  // Initialize questions and timer when modal opens
  useEffect(() => {
    if (isOpen && moduleName) {
      const qList = getPracticeQuestions(moduleName);
      setQuestions(qList);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setIsSubmitted(false);
      setSecondsElapsed(0);

      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, moduleName]);

  // Stop timer upon submission
  useEffect(() => {
    if (isSubmitted && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isSubmitted]);

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const total = questions.length;

  const handleSelectOption = (idx) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: idx,
    }));
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitted(true);

    // Calculate results
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const scorePct = total > 0 ? (correctCount / total) * 100 : 0;
    const defects = total - correctCount;

    // Store in isolated local practice history (does not contaminate official sessions)
    const drillRecord = {
      id: Date.now(),
      moduleName,
      scorePct,
      correctCount,
      total,
      defects,
      secondsElapsed,
      timestamp: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem("trainee_practice_history") || "[]");
      existing.unshift(drillRecord);
      localStorage.setItem("trainee_practice_history", JSON.stringify(existing.slice(0, 20)));
      window.dispatchEvent(new CustomEvent("practice_drill_saved", { detail: drillRecord }));
    } catch {
      // Ignore storage errors
    }

    if (onComplete) {
      onComplete(drillRecord);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setSecondsElapsed(0);
    timerRef.current = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
  };

  // Timing format
  const mins = Math.floor(secondsElapsed / 60);
  const secs = secondsElapsed % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Results calculation
  let correctCount = 0;
  if (isSubmitted) {
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) correctCount += 1;
    });
  }
  const finalScore = total > 0 ? (correctCount / total) * 100 : 0;
  const isMastery = finalScore >= EXCELLENT_THRESHOLD;
  const isPass = finalScore >= PASS_THRESHOLD && !isMastery;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Practice Drill
              </span>
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Isolated Self-Assessment
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              {moduleName || "Curriculum Module Drill"}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Stopwatch Timer */}
            <div className="flex items-center space-x-1.5 text-xs font-mono font-semibold text-slate-700 bg-[#fef4e8] border border-[#f0e3d5] px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-[#f09a3e]" />
              <span>{timeFormatted}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!isSubmitted ? (
            /* Question Active View */
            <div className="space-y-5">
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
                  <span>
                    Question {currentIndex + 1} of {total}
                  </span>
                  <span>{Math.round(((currentIndex + 1) / total) * 100)}% Completed</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#f0e3d5] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f09a3e] transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Box */}
              {currentQ && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                    {currentQ.question}
                  </h3>

                  {/* Options */}
                  <div className="space-y-2.5 pt-1">
                    {currentQ.options.map((optionText, optIdx) => {
                      const isSelected = selectedAnswers[currentIndex] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start space-x-3 cursor-pointer ${
                            isSelected
                              ? "bg-[#fef4e8] border-[#f09a3e] text-slate-900 font-semibold shadow-xs"
                              : "bg-white border-[#f0e3d5] text-slate-700 hover:bg-[#fdf8f2] hover:border-[#fbd1a7]"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border ${
                              isSelected
                                ? "bg-[#f09a3e] text-white border-[#f09a3e]"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="pt-0.5 leading-relaxed">{optionText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Results View */
            <div className="space-y-6">
              {/* Score Summary Banner */}
              <div className="p-4 sm:p-5 rounded-xl border bg-slate-50 border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Practice Evaluation Outcome
                    </span>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-black text-slate-900">
                        {finalScore.toFixed(1)}%
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        ({correctCount} of {total} correct)
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                      isMastery
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isPass
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    <span>{isMastery ? "Mastery Achieved" : isPass ? "Competent Pass" : "Needs Review"}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Time Elapsed
                    </span>
                    <span className="font-mono font-bold text-slate-800">{timeFormatted}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Defects (Errors)
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {total - correctCount} defect{total - correctCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Question Review Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Question Review & Technical Explanations
                </h4>

                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const userChoice = selectedAnswers[idx];
                    const isCorrect = userChoice === q.correctIndex;

                    return (
                      <div
                        key={q.id || idx}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          isCorrect ? "bg-slate-50/60 border-slate-200" : "bg-rose-50/30 border-rose-200"
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-900 block mb-1">
                              {idx + 1}. {q.question}
                            </span>
                            <div className="text-[11px] text-slate-600 space-y-0.5">
                              <div>
                                Your answer:{" "}
                                <strong className={isCorrect ? "text-emerald-700" : "text-rose-700"}>
                                  {userChoice != null ? q.options[userChoice] : "None"}
                                </strong>
                              </div>
                              {!isCorrect && (
                                <div className="text-slate-700">
                                  Correct answer:{" "}
                                  <strong className="text-slate-900 font-bold">
                                    {q.options[q.correctIndex]}
                                  </strong>
                                </div>
                              )}
                            </div>
                            {q.explanation && (
                              <p className="mt-1.5 p-2 rounded bg-white border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {!isSubmitted ? (
            <>
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center space-x-2">
                {currentIndex < total - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-1.5 rounded-lg bg-[#1C1B17] hover:bg-[#272520] text-xs font-bold text-white transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                  >
                    Finish & Submit Drill
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Drill</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PracticeDrillModal;
