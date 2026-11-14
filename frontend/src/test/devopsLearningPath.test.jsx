// frontend/src/test/devopsLearningPath.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DevOpsLearningPath } from "../components/learning/DevOpsLearningPath.jsx";
import { learningApi } from "../api/learning.js";

const mockSubjectData = {
  id: 1,
  title: "DevOps Engineering & Containerization",
  slug: "devops-engineering",
  description: "Master enterprise DevOps, Linux container fundamentals, Docker CLI commands.",
  icon: "terminal",
  is_active: true,
  total_modules: 5,
  completed_modules: 0,
  overall_progress_pct: 0.0,
  modules: [
    {
      id: 1,
      subject_id: 1,
      title: "Docker Fundamentals",
      slug: "docker-fundamentals",
      order_index: 1,
      description: "Foundations of containerization and CLI.",
      is_required: true,
      total_lessons: 8,
      completed_lessons: 0,
      progress_pct: 0.0,
      is_unlocked: true,
      lessons: [
        {
          id: 1,
          module_id: 1,
          title: "Docker Setup & Architecture",
          description: "Understand Docker Community vs Enterprise editions.",
          duration_seconds: 407,
          order_index: 1,
          requires_practice: false,
          is_completed: false,
          watched_seconds: 0,
          companion_files: [
            { title: "Docker Complete Reference Slides", file_type: "pdf", relative_path: "Resources/slides.pdf" },
          ],
        },
        {
          id: 2,
          module_id: 1,
          title: "Starting Your First Container (Nginx)",
          description: "Run background containers with docker run -d.",
          duration_seconds: 538,
          order_index: 2,
          requires_practice: true,
          is_completed: false,
          watched_seconds: 0,
        },
      ],
      assignment: {
        id: 1,
        module_id: 1,
        title: "Containerize & Interconnect a Web Service",
        instructions: "Create a user-defined bridge network and verify DNS.",
        max_score: 100,
        passing_score: 70,
        is_required: true,
      },
      latest_submission: null,
    },
    {
      id: 2,
      subject_id: 1,
      title: "Custom Images & Dockerfiles",
      slug: "custom-images-dockerfiles",
      order_index: 2,
      is_required: true,
      total_lessons: 0,
      completed_lessons: 0,
      progress_pct: 0.0,
      is_unlocked: false,
      lessons: [],
    },
  ],
};

describe("DevOps Learning Path Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(learningApi, "getSubjectBySlug").mockResolvedValue(mockSubjectData);
    vi.spyOn(learningApi, "getVideoStreamUrl").mockImplementation(
      (id) => `http://127.0.0.1:8000/learning/lessons/${id}/stream?token=test-token`
    );
    vi.spyOn(learningApi, "getSubtitlesUrl").mockImplementation(
      (id) => `http://127.0.0.1:8000/learning/lessons/${id}/subtitles?token=test-token`
    );
  });

  it("renders the DevOps curriculum track header and progress ring", async () => {
    render(<DevOpsLearningPath showToast={vi.fn()} />);

    expect(await screen.findByText("DevOps Engineering & Containerization")).toBeInTheDocument();
    expect(screen.getByText("Docker Fundamentals")).toBeInTheDocument();
    expect(screen.getByText("0 of 8 Lessons")).toBeInTheDocument();
  });

  it("renders the active lesson video player and lesson playlist", async () => {
    render(<DevOpsLearningPath showToast={vi.fn()} />);

    expect(await screen.findByText("Lesson 1 of 8")).toBeInTheDocument();
    expect(screen.getAllByText("Docker Setup & Architecture").length).toBeGreaterThanOrEqual(1);

    // Check video player element
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video.src).toContain("/learning/lessons/1/stream");
  });

  it("allows switching between Lesson Overview, CLI Playbook, and Companion Slides", async () => {
    render(<DevOpsLearningPath showToast={vi.fn()} />);

    await screen.findByText("Lesson 1 of 8");

    // Click CLI Playbook tab
    const cliTab = screen.getByRole("button", { name: /cli playbook/i });
    fireEvent.click(cliTab);
    expect(screen.getByText("$ docker --version")).toBeInTheDocument();

    // Click Companion Slides tab
    const slidesTab = screen.getByRole("button", { name: /companion slides/i });
    fireEvent.click(slidesTab);
    expect(screen.getByText("Docker Complete Reference Slides")).toBeInTheDocument();
  });

  it("opens the Capstone Assignment modal and submits evidence", async () => {
    const submitSpy = vi.spyOn(learningApi, "submitAssignment").mockResolvedValue({
      id: 101,
      assignment_id: 1,
      trainee_id: 1,
      status: "submitted",
      commands_used: "docker network create devops-net",
      explanation: "Docker embedded DNS resolves container names.",
      submitted_at: new Date().toISOString(),
    });

    const toastSpy = vi.fn();
    render(<DevOpsLearningPath showToast={toastSpy} />);

    // Open Capstone modal
    const startBtn = await screen.findByRole("button", { name: /start capstone assignment/i });
    fireEvent.click(startBtn);

    expect(screen.getByText("Module 1 Capstone: Containerize & Interconnect")).toBeInTheDocument();

    // Fill in textareas
    const textareas = screen.getAllByRole("textbox");
    fireEvent.change(textareas[0], { target: { value: "docker network create devops-net" } });
    fireEvent.change(textareas[1], { target: { value: "Docker embedded DNS resolves container names." } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /submit evidence for review/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith(1, {
        commands_used: "docker network create devops-net",
        explanation: "Docker embedded DNS resolves container names.",
      });
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining("Capstone assignment submitted")
    );
  });
});
