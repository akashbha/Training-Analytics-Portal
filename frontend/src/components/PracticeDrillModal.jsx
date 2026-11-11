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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1C1B17]/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#F0E3D5] shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#F0E3D5] flex items-start justify-between gap-3 bg-[#FAF6F0]">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[#D97718] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded-md uppercase tracking-wider">
                Practice Drill
              </span>
              <span className="text-[10px] font-medium text-[#787063] bg-white border border-[#F0E3D5] px-2 py-0.5 rounded-md">
                Isolated Self-Assessment
              </span>
            </div>
            <h2 className="text-sm font-bold text-[#1C1B17]">
              {moduleName || "Curriculum Module Drill"}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* Stopwatch Timer */}
            <div className="flex items-center space-x-1.5 text-xs font-mono font-semibold text-[#1C1B17] bg-[#FEF4E8] border border-[#F0E3D5] px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-[#F09A3E]" />
              <span>{timeFormatted}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#787063] hover:text-[#1C1B17] hover:bg-[#FEF4E8] transition-colors cursor-pointer"
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
                <div className="flex items-center justify-between text-xs text-[#787063] mb-1.5 font-medium">
                  <span>
                    Question {currentIndex + 1} of {total}
                  </span>
                  <span>{Math.round(((currentIndex + 1) / total) * 100)}% Completed</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#F0E3D5] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F09A3E] transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Box */}
              {currentQ && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[#1C1B17] leading-snug">
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
                              ? "bg-[#FEF4E8] border-[#F09A3E] text-[#1C1B17] font-semibold shadow-xs"
                              : "bg-white border-[#F0E3D5] text-[#4A443B] hover:bg-[#FDF8F2] hover:border-[#FBD1A7]"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border ${
                              isSelected
                                ? "bg-[#F09A3E] text-white border-[#F09A3E]"
                                : "bg-[#FAF6F0] text-[#787063] border-[#F0E3D5]"
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
              <div className="p-4 sm:p-5 rounded-xl border bg-[#FAF6F0] border-[#F0E3D5] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063] block mb-0.5">
                      Practice Evaluation Outcome
                    </span>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-black text-[#1C1B17]">
                        {finalScore.toFixed(1)}%
                      </span>
                      <span className="text-xs font-semibold text-[#787063]">
                        ({correctCount} of {total} correct)
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                      isMastery
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isPass
                        ? "bg-[#FEF0E1] text-[#D97718] border-[#FBD1A7]"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    <span>{isMastery ? "Mastery Achieved" : isPass ? "Competent Pass" : "Needs Review"}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F0E3D5] text-xs">
                  <div>
                    <span className="text-[10px] text-[#787063] uppercase font-bold block">
                      Time Elapsed
                    </span>
                    <span className="font-mono font-bold text-[#1C1B17]">{timeFormatted}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#787063] uppercase font-bold block">
                      Defects (Errors)
                    </span>
                    <span className="font-mono font-bold text-[#1C1B17]">
                      {total - correctCount} defect{total - correctCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Question Review Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#787063]">
                  Question Review &amp; Technical Explanations
                </h4>

                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const userChoice = selectedAnswers[idx];
                    const isCorrect = userChoice === q.correctIndex;

                    return (
                      <div
                        key={q.id || idx}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          isCorrect ? "bg-[#FAF6F0] border-[#F0E3D5]" : "bg-rose-50/40 border-rose-200"
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-[#1C1B17] block mb-1">
                              {idx + 1}. {q.question}
                            </span>
                            <div className="text-[11px] text-[#787063] space-y-0.5">
                              <div>
                                Your answer:{" "}
                                <strong className={isCorrect ? "text-emerald-700" : "text-rose-700"}>
                                  {userChoice != null ? q.options[userChoice] : "None"}
                                </strong>
                              </div>
                              {!isCorrect && (
                                <div className="text-[#4A443B]">
                                  Correct answer:{" "}
                                  <strong className="text-[#1C1B17] font-bold">
                                    {q.options[q.correctIndex]}
                                  </strong>
                                </div>
                              )}
                            </div>
                            {q.explanation && (
                              <p className="mt-1.5 p-2 rounded bg-white border border-[#F0E3D5] text-[11px] text-[#787063] leading-relaxed">
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
        <div className="p-4 border-t border-[#F0E3D5] bg-[#FAF6F0] flex items-center justify-between">
          {!isSubmitted ? (
            <>
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-3 py-1.5 rounded-lg border border-[#F0E3D5] bg-white text-xs font-semibold text-[#1C1B17] hover:bg-[#FEF4E8] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1"
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
                    className="px-4 py-1.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                  >
                    Finish &amp; Submit Drill
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleRestart}
                className="px-3 py-1.5 rounded-lg border border-[#F0E3D5] bg-white text-xs font-semibold text-[#1C1B17] hover:bg-[#FEF4E8] cursor-pointer flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Drill</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
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
