// src/components/learning/DevOpsLearningPath.jsx
// Interactive DevOps Learning Path with Range-based video playback, WebVTT subtitles,
// CLI command playbooks, companion slide downloads, and Capstone Assignment evaluation.

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Lock,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { learningApi } from "../../api/learning.js";
import { Spinner } from "../Spinner.jsx";

// Pre-packaged CLI Playbook commands matching Section 02 and 03 lessons
const LESSON_COMMAND_PLAYBOOKS = {
  1: [
    { cmd: "docker --version", desc: "Check installed Docker client version" },
    { cmd: "docker info", desc: "Display system-wide information including containers and daemon state" },
  ],
  2: [
    { cmd: "docker container run -d --name web-app -p 8080:80 nginx:alpine", desc: "Run detached Nginx web container publishing host port 8080 to container port 80" },
    { cmd: "curl http://localhost:8080", desc: "Verify HTTP 200 response from Nginx server" },
    { cmd: "docker container ls", desc: "List active running containers" },
  ],
  3: [
    { cmd: "docker container run -d --name test-vm alpine ping 127.0.0.1", desc: "Spawn process container running isolated ping command" },
    { cmd: "ps aux | grep ping", desc: "Observe that container process is visible natively in host kernel task list" },
  ],
  4: [
    { cmd: "docker container top web-app", desc: "Display running processes of web-app container" },
    { cmd: "docker container stats --no-stream", desc: "Display live stream of container CPU, memory, and network I/O" },
    { cmd: "docker container logs --tail 20 web-app", desc: "Tail recent web-app access and error logs" },
  ],
  5: [
    { cmd: "docker container exec -it web-app sh", desc: "Open an interactive TTY shell inside running container" },
    { cmd: "cat /etc/os-release", desc: "Inspect minimal Alpine/Linux distribution details inside container" },
    { cmd: "exit", desc: "Exit container shell without stopping running process" },
  ],
  6: [
    { cmd: "docker network ls", desc: "List virtual bridge, host, and null networks" },
    { cmd: "docker network inspect bridge", desc: "Inspect default docker0 bridge subnet and connected IP addresses" },
  ],
  7: [
    { cmd: "docker network create --driver bridge devops-net", desc: "Create an isolated user-defined bridge network" },
    { cmd: "docker container run -d --name db --net devops-net redis:alpine", desc: "Launch Redis container attached directly to devops-net" },
    { cmd: "docker network inspect devops-net", desc: "Verify container attachment and gateway configuration" },
  ],
  8: [
    { cmd: "docker container run -it --rm --net devops-net curlimages/curl curl -s http://web-app:80", desc: "Demonstrate embedded DNS name resolution: resolve web-app by hostname without IPs" },
    { cmd: "docker container run -it --rm --net devops-net alpine nslookup web-app", desc: "Inspect DNS query resolved by Docker internal 127.0.0.11 nameserver" },
  ],
};

export function DevOpsLearningPath({ showToast }) {
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview, commands, resources
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Assignment Modal & Submission State
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    commands_used: "",
    explanation: "",
  });

  const videoRef = useRef(null);
  const progressTimerRef = useRef(null);

  // Fetch subject roadmap and lessons
  const loadCurriculum = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await learningApi.getSubjectBySlug("devops-engineering");
      setSubject(data);

      if (data.modules && data.modules.length > 0) {
        const m1 = data.modules[0];
        if (m1.lessons && m1.lessons.length > 0) {
          // Select first incomplete lesson or lesson 1
          const firstIncomplete = m1.lessons.find((l) => !l.is_completed) || m1.lessons[0];
          setActiveLesson(firstIncomplete);
        }
        if (m1.latest_submission) {
          setAssignmentForm({
            commands_used: m1.latest_submission.commands_used || "",
            explanation: m1.latest_submission.explanation || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load DevOps curriculum:", err);
      setError("Unable to load the DevOps learning curriculum. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurriculum();
  }, [loadCurriculum]);

  // Video playback speed handler
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Video progress syncing
  const handleTimeUpdate = () => {
    if (!videoRef.current || !activeLesson) return;
    const current = Math.floor(videoRef.current.currentTime);
    const duration = activeLesson.duration_seconds || Math.floor(videoRef.current.duration) || 1;

    // Throttle progress updates to backend every 10 seconds
    if (!progressTimerRef.current || Date.now() - progressTimerRef.current > 10000) {
      progressTimerRef.current = Date.now();
      const shouldComplete = current >= Math.floor(duration * 0.6);

      learningApi
        .updateProgress(activeLesson.id, {
          watched_seconds: current,
          is_completed: shouldComplete,
        })
        .then((res) => {
          if (res.is_completed && !activeLesson.is_completed) {
            setActiveLesson((prev) => (prev ? { ...prev, is_completed: true } : prev));
            // Update subject state
            setSubject((prev) => {
              if (!prev) return prev;
              const nextModules = prev.modules.map((m) => {
                const nextLessons = m.lessons.map((l) =>
                  l.id === activeLesson.id ? { ...l, is_completed: true } : l
                );
                return { ...m, lessons: nextLessons };
              });
              return { ...prev, modules: nextModules };
            });
            if (showToast) showToast(`Lesson completed: ${activeLesson.title}`);
          }
        })
        .catch((err) => console.warn("Progress sync warning:", err));
    }
  };

  // Manual completion button
  const handleMarkCompleted = async () => {
    if (!activeLesson) return;
    try {
      const watched = activeLesson.duration_seconds || 300;
      const res = await learningApi.updateProgress(activeLesson.id, {
        watched_seconds: watched,
        is_completed: true,
      });
      if (res.is_completed) {
        setActiveLesson((prev) => (prev ? { ...prev, is_completed: true } : prev));
        loadCurriculum();
        if (showToast) showToast(`Lesson marked complete!`);
      }
    } catch (err) {
      console.error("Failed to mark lesson complete:", err);
    }
  };

  // Copy command to clipboard
  const handleCopyCommand = (cmd, index) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    if (showToast) showToast("Command copied to clipboard!");
  };

  // Submit Capstone Assignment
  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    const activeMod = subject?.modules?.[activeModuleIndex];
    if (!activeMod || !activeMod.assignment) return;

    if (!assignmentForm.commands_used.trim() || !assignmentForm.explanation.trim()) {
      if (showToast) showToast("Please provide both CLI commands and your reflective explanation.");
      return;
    }

    try {
      setAssignmentSubmitting(true);
      await learningApi.submitAssignment(activeMod.assignment.id, {
        commands_used: assignmentForm.commands_used,
        explanation: assignmentForm.explanation,
      });
      setAssignmentModalOpen(false);
      await loadCurriculum();
      if (showToast) showToast("Capstone assignment submitted! Awaiting trainer evaluation.");
    } catch (err) {
      console.error("Assignment submission error:", err);
      if (showToast) showToast("Failed to submit assignment. Please try again.");
    } finally {
      setAssignmentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center space-y-4">
        <Spinner size="lg" />
        <p className="text-sm font-bold text-[#787063]">Loading DevOps Learning Curriculum...</p>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="card p-8 border-red-200 bg-red-50/50">
        <div className="flex items-center space-x-3 text-red-700">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="font-bold text-sm">Failed to Load Curriculum</h3>
            <p className="text-xs mt-1 text-red-600">{error || "Subject not available."}</p>
          </div>
        </div>
        <button
          onClick={loadCurriculum}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentModule = subject.modules[activeModuleIndex] || subject.modules[0];
  const commandsList = activeLesson ? LESSON_COMMAND_PLAYBOOKS[activeLesson.order_index] || [] : [];
  const latestSub = currentModule?.latest_submission;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. CLEAN FLAT HEADER & CURRICULUM TRACK PROGRESSION
          ========================================================================= */}
      <div className="space-y-5 pb-6 border-b border-[#F0E3D5]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309] bg-[#FEF0E1] border border-[#FBD1A7] px-2 py-0.5 rounded flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                DevOps Learning Path
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C1B17] text-[#F09A3E]">
                Docker &amp; Containers
              </span>
              <span className="text-[10px] font-medium text-[#787063] bg-white border border-[#F0E3D5] px-2 py-0.5 rounded">
                8 Core Lessons • 60 Mins
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C1B17] tracking-tight">{subject.title}</h1>
            <p className="text-xs text-[#787063] leading-relaxed">{subject.description}</p>
          </div>

          {/* Crisp SaaS Progress Strip (Flat, No Bubble Curves) */}
          <div className="bg-white p-3.5 rounded-lg border border-[#F0E3D5] flex flex-col gap-2 sm:min-w-[260px] shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#1C1B17]">Module 1 Progress</span>
              <span className="font-extrabold text-[#B45309]">{Math.round(currentModule.progress_pct)}%</span>
            </div>
            <div className="w-full h-2 bg-[#F0E3D5] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F09A3E] transition-all duration-500 rounded-full"
                style={{ width: `${currentModule.progress_pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#787063]">
              <span>{currentModule.completed_lessons} of {currentModule.total_lessons} Lessons</span>
              <span className="font-bold text-[#B45309] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#F09A3E]" />
                {latestSub?.status === "passed" ? "Capstone Passed" : "Capstone Pending"}
              </span>
            </div>
          </div>
        </div>

        {/* Module Milestones Bar (Crisp Segmented Tabs with rounded-lg) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-2">
          {subject.modules.map((mod, idx) => {
            const isActive = idx === activeModuleIndex;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  if (mod.is_unlocked) {
                    setActiveModuleIndex(idx);
                    if (mod.lessons && mod.lessons.length > 0) {
                      setActiveLesson(mod.lessons[0]);
                    }
                  } else {
                    if (showToast) showToast(`Module ${idx + 1} unlocks after passing Module 1 Capstone!`);
                  }
                }}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "bg-white border-[#F09A3E] ring-1 ring-[#F09A3E]/30 shadow-xs"
                    : mod.is_unlocked
                    ? "bg-white border-[#F0E3D5] hover:border-[#FBD1A7]"
                    : "bg-[#F5EFE6]/40 border-dashed border-[#E3D8CB] opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#787063]">
                    M0{mod.order_index}
                  </span>
                  {mod.is_unlocked ? (
                    mod.progress_pct === 100 && mod.latest_submission?.status === "passed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#F09A3E]" />
                    )
                  ) : (
                    <Lock className="w-3 h-3 text-[#A2998A]" />
                  )}
                </div>
                <div className="text-xs font-bold text-[#1C1B17] mt-1.5 line-clamp-1">{mod.title}</div>
                <div className="text-[10px] text-[#787063] mt-0.5">
                  {mod.is_unlocked ? `${mod.total_lessons} Lessons` : "Locked Milestone"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          2. INTERACTIVE THEATER & LESSON VIEW (Two-Column Layout)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Video Player, Controls, and Tabbed Playbook (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="card p-0 overflow-hidden border-[#F0E3D5] bg-[#1C1B17] text-white shadow-md">
            {/* Player Header */}
            <div className="px-5 py-3.5 bg-[#272520] border-b border-[#3A3731] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#F09A3E] text-white">
                  Lesson {activeLesson?.order_index || 1} of {currentModule.total_lessons}
                </span>
                <span className="text-xs font-bold text-[#FAF6F0] line-clamp-1">
                  {activeLesson?.title || "Docker Lesson"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Speed Controls */}
                <div className="flex items-center bg-[#1C1B17] rounded-lg p-0.5 border border-[#3A3731]">
                  {[1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        playbackSpeed === spd
                          ? "bg-[#F09A3E] text-white"
                          : "text-[#A2998A] hover:text-white"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-[#A2998A]">
                  {Math.floor((activeLesson?.duration_seconds || 0) / 60)}m{" "}
                  {(activeLesson?.duration_seconds || 0) % 60}s
                </span>
              </div>
            </div>

            {/* Video Container with Range Stream & WebVTT Subtitles */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {activeLesson ? (
                <video
                  ref={videoRef}
                  key={activeLesson.id}
                  controls
                  controlsList="nodownload"
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                  src={learningApi.getVideoStreamUrl(activeLesson.id)}
                >
                  {activeLesson.has_subtitles && (
                    <track
                      kind="subtitles"
                      src={learningApi.getSubtitlesUrl(activeLesson.id)}
                      srcLang="en"
                      label="English Subtitles"
                      default
                    />
                  )}
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="text-center p-8 space-y-2">
                  <Play className="w-12 h-12 text-[#787063] mx-auto animate-pulse" />
                  <p className="text-sm font-bold text-[#A2998A]">Select a lesson to begin playback</p>
                </div>
              )}
            </div>

            {/* Player Bottom Status Bar */}
            <div className="px-5 py-3 bg-[#272520] border-t border-[#3A3731] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeLesson?.is_completed ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Completed &amp; Logged
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[#A2998A]">
                    <Clock className="w-3.5 h-3.5 text-[#F09A3E]" />
                    Watch 60% of video to complete
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!activeLesson?.is_completed && (
                  <button
                    type="button"
                    onClick={handleMarkCompleted}
                    className="px-3 py-1 rounded-lg bg-[#3A3731] hover:bg-[#4A463F] text-xs font-bold text-[#F09A3E] cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Complete</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabbed Interactive Study Playbook */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-[#F0E3D5] pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeTab === "overview"
                    ? "border-[#F09A3E] text-[#B45309]"
                    : "border-transparent text-[#787063] hover:text-[#1C1B17]"
                }`}
              >
                Lesson Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("commands")}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "commands"
                    ? "border-[#F09A3E] text-[#B45309]"
                    : "border-transparent text-[#787063] hover:text-[#1C1B17]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>CLI Playbook ({commandsList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("resources")}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === "resources"
                    ? "border-[#F09A3E] text-[#B45309]"
                    : "border-transparent text-[#787063] hover:text-[#1C1B17]"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Companion Slides</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-3 pt-1">
                <h3 className="text-sm font-black text-[#1C1B17]">{activeLesson?.title}</h3>
                <p className="text-xs text-[#787063] leading-relaxed">
                  {activeLesson?.description ||
                    "In this lesson, you will master essential Docker commands, container process monitoring, and networking architecture."}
                </p>
                <div className="p-3.5 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] space-y-1.5">
                  <div className="text-[11px] font-black text-[#1C1B17] uppercase tracking-wider">
                    Hands-On Learning Takeaways
                  </div>
                  <ul className="text-xs text-[#787063] space-y-1 list-disc list-inside">
                    <li>Run containers isolated from the host OS while binding host network ports.</li>
                    <li>Inspect process trees natively through kernel cgroups without SSH overhead.</li>
                    <li>Connect multi-container setups using custom bridge networks and embedded DNS.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: CLI COMMAND PLAYBOOK */}
            {activeTab === "commands" && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#787063]">
                    Execute these commands in your local terminal alongside the video:
                  </span>
                </div>
                {commandsList.length > 0 ? (
                  <div className="space-y-2.5">
                    {commandsList.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#1C1B17] border border-[#272520] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="text-[10px] font-bold text-[#A2998A]">{item.desc}</div>
                          <code className="text-xs font-mono text-[#F09A3E] block truncate font-semibold">
                            $ {item.cmd}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand(item.cmd, idx)}
                          className="px-3 py-1.5 rounded-lg bg-[#272520] hover:bg-[#3A3731] text-[11px] font-bold text-[#FAF6F0] flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border border-[#3A3731]"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#787063]">No specific CLI commands listed for this conceptual lesson.</p>
                )}
              </div>
            )}

            {/* TAB 3: COMPANION RESOURCES & SLIDES */}
            {activeTab === "resources" && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-[#787063]">
                  Official companion PDFs and cheat-sheets attached to this curriculum chapter:
                </p>
                {activeLesson?.companion_files && activeLesson.companion_files.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeLesson.companion_files.map((file, idx) => (
                      <a
                        key={idx}
                        href={learningApi.getCompanionFileUrl(activeLesson.id, idx)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3.5 rounded-lg border border-[#F0E3D5] bg-[#FAF6F0] hover:bg-[#FEF4E8] hover:border-[#FBD1A7] transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-white border border-[#F0E3D5] text-[#F09A3E]">
                            {file.file_type === "pdf" ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <FileCode className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#1C1B17] truncate">{file.title}</div>
                            <div className="text-[10px] font-semibold text-[#787063] uppercase">
                              {file.file_type} Document
                            </div>
                          </div>
                        </div>
                        <Download className="w-4 h-4 text-[#787063] group-hover:text-[#B45309] shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#787063]">No companion slides directly attached to this lesson.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Curriculum Playlist & Capstone Assignment Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Lessons Playlist Card */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E3D5]">
              <div>
                <h3 className="text-sm font-black text-[#1C1B17]">Module 1: Docker Fundamentals</h3>
                <p className="text-[11px] text-[#787063]">8 Core Lessons • Sequential Progression</p>
              </div>
              <span className="text-xs font-black text-[#B45309] bg-[#FEF0E1] px-2 py-0.5 rounded-full">
                {currentModule.completed_lessons} / {currentModule.total_lessons}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {currentModule.lessons.map((lesson) => {
                const isSelected = activeLesson?.id === lesson.id;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setActiveLesson(lesson)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-[#FEF4E8] border-[#F09A3E] ring-1 ring-[#F09A3E]/30"
                        : lesson.is_completed
                        ? "bg-white border-[#F0E3D5] hover:bg-[#FAF6F0]"
                        : "bg-white/70 border-[#F0E3D5] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="shrink-0">
                        {lesson.is_completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isSelected ? (
                          <Play className="w-4 h-4 text-[#F09A3E] fill-current" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-[#A2998A] flex items-center justify-center text-[9px] font-black text-[#787063]">
                            {lesson.order_index}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-bold leading-snug line-clamp-1 ${
                            isSelected ? "text-[#B45309]" : "text-[#1C1B17]"
                          }`}
                        >
                          {lesson.title}
                        </div>
                        <div className="text-[10px] text-[#787063] font-medium flex items-center gap-1.5 mt-0.5">
                          <span>
                            {Math.floor(lesson.duration_seconds / 60)}m {lesson.duration_seconds % 60}s
                          </span>
                          {lesson.requires_practice && (
                            <span className="text-[9px] font-bold text-[#F09A3E] bg-[#FEF0E1] px-1 rounded">
                              Hands-on
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isSelected ? "text-[#B45309] translate-x-0.5" : "text-[#A2998A]"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Capstone Assignment Card */}
          <div className="card p-5 space-y-3.5 border-2 border-[#FBD1A7] bg-gradient-to-b from-[#FFFDF9] to-[#FAF6F0]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#B45309] bg-[#FEF0E1] px-2 py-0.5 rounded-full border border-[#FBD1A7]">
                Milestone Capstone
              </span>
              {/* Status Pill */}
              {latestSub?.status === "passed" ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Passed ({latestSub.score}/100)
                </span>
              ) : latestSub?.status === "submitted" ? (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Under Review
                </span>
              ) : latestSub?.status === "needs_changes" ? (
                <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  Needs Changes
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#787063] bg-[#F0E3D5] px-2 py-0.5 rounded-full">
                  Not Submitted
                </span>
              )}
            </div>

            <div>
              <h4 className="text-sm font-black text-[#1C1B17]">
                {currentModule.assignment?.title || "Containerize & Interconnect a Web Service"}
              </h4>
              <p className="text-xs text-[#787063] mt-1 leading-relaxed">
                Prove practical competency: launch an isolated web app, attach a client container on a user-defined
                bridge network, and verify DNS resolution.
              </p>
            </div>

            {/* Trainer Feedback Banner if Needs Changes or Passed */}
            {latestSub?.trainer_feedback && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1 ${
                  latestSub.status === "passed"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="font-bold flex items-center gap-1 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-[#F09A3E]" />
                  Trainer Feedback ({latestSub.reviewer_name || "Instructor"}):
                </div>
                <p className="italic leading-relaxed">"{latestSub.trainer_feedback}"</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAssignmentModalOpen(true)}
              className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-xs transition-all ${
                latestSub?.status === "passed"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : latestSub?.status === "needs_changes"
                  ? "bg-[#D97718] hover:bg-[#B45309] text-white"
                  : "bg-[#F09A3E] hover:bg-[#D97718] text-white"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>
                {latestSub?.status === "passed"
                  ? "View Graded Submission"
                  : latestSub?.status === "needs_changes"
                  ? "Revise & Resubmit"
                  : latestSub?.status === "submitted"
                  ? "Update Submission"
                  : "Start Capstone Assignment"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. CAPSTONE ASSIGNMENT SUBMISSION MODAL
          ========================================================================= */}
      {assignmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-lg border border-[#F0E3D5] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#F0E3D5] flex items-center justify-between bg-[#FAF6F0]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-[#FEF0E1] text-[#B45309] border border-[#FBD1A7]">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1C1B17]">
                    Module 1 Capstone: Containerize &amp; Interconnect
                  </h3>
                  <p className="text-xs text-[#787063]">Passing Score: 70/100 • Trainer Evaluated</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignmentModalOpen(false)}
                className="p-2 text-[#787063] hover:text-[#1C1B17] hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Instructions Box */}
              <div className="p-4 rounded-lg bg-[#FAF6F0] border border-[#F0E3D5] space-y-2">
                <h4 className="text-xs font-black text-[#1C1B17] uppercase tracking-wider">Required Tasks:</h4>
                <ol className="text-xs text-[#787063] space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Create a user-defined bridge network named <code className="font-bold text-[#B45309]">devops-net</code>.</li>
                  <li>Run an Nginx container named <code className="font-bold text-[#B45309]">web-app</code> on that network, mapping port 8080:80.</li>
                  <li>Run a temporary client container to curl <code className="font-bold text-[#B45309]">http://web-app</code> over the network.</li>
                  <li>Verify output demonstrating container DNS resolution without hardcoded IP addresses.</li>
                </ol>
              </div>

              {/* Revision Alert if Trainer Rejected */}
              {latestSub?.status === "needs_changes" && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    Trainer Feedback on Previous Attempt:
                  </div>
                  <p className="italic">{latestSub.trainer_feedback}</p>
                </div>
              )}

              <form id="capstone-form" onSubmit={handleAssignmentSubmit} className="space-y-4">
                {/* Input 1: Commands Used */}
                <div>
                  <label className="block text-xs font-black text-[#1C1B17] mb-1">
                    1. CLI Commands Executed
                  </label>
                  <textarea
                    rows={4}
                    value={assignmentForm.commands_used}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, commands_used: e.target.value })}
                    placeholder={`docker network create devops-net\ndocker run -d --name web-app --net devops-net -p 8080:80 nginx:alpine\ndocker run --rm --net devops-net curlimages/curl curl -s http://web-app`}
                    className="w-full p-3 rounded-lg border border-[#F0E3D5] bg-[#FAF6F0] text-xs font-mono focus:border-[#F09A3E] focus:outline-hidden leading-relaxed"
                    required
                  />
                </div>

                {/* Input 2: Reflective Explanation */}
                <div>
                  <label className="block text-xs font-black text-[#1C1B17] mb-1">
                    2. Reflective Explanation &amp; Verification
                  </label>
                  <textarea
                    rows={3}
                    value={assignmentForm.explanation}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, explanation: e.target.value })}
                    placeholder="Explain why Docker's internal 127.0.0.11 DNS resolver succeeded on user-defined networks while failing on the default bridge..."
                    className="w-full p-3 rounded-lg border border-[#F0E3D5] bg-[#FAF6F0] text-xs focus:border-[#F09A3E] focus:outline-hidden leading-relaxed"
                    required
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#F0E3D5] bg-[#FAF6F0] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAssignmentModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#787063] hover:text-[#1C1B17] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="capstone-form"
                disabled={assignmentSubmitting}
                className="px-5 py-2.5 rounded-lg bg-[#F09A3E] hover:bg-[#D97718] text-white font-bold text-xs shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {assignmentSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Evidence for Review</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

