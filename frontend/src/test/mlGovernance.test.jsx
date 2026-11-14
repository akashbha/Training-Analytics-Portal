// frontend/src/test/mlGovernance.test.jsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
  },
}));

vi.mock("../api/client.js", () => ({
  apiClient: mockApi,
}));

import { FlaggedTraineeRiskCard } from "../components/FlaggedTraineeRiskCard.jsx";
import { ML_ADVISORY_DISCLAIMER } from "../constants/thresholds.js";

describe("ML Governance and Advisory UI Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. renders Advisory Only badge and disclaimer for ML inference", async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        method: "ml",
        reason: "Elevated error rate across Docker modules",
        label: 1,
        probability: 0.85,
        threshold: 0.67,
        threshold_unit: "probability",
        top_features: [
          { feature: "last_3_mean_score", importance: 0.45, explanation: "Prior performance weight" },
        ],
        model_version: "1.0.0",
        is_advisory: true,
        advisory_disclaimer: "Advisory only. Model outputs are decision-support suggestions.",
      },
    });

    render(
      <MemoryRouter>
        <FlaggedTraineeRiskCard
          trainee={{
            trainee_id: 101,
            trainee_name: "John Trainee",
            session_count: 6,
            metrics: { recent_avg_score: 52.0 },
          }}
          rank={1}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("John Trainee")).toBeInTheDocument();
    });

    // Verify Advisory Badge
    const advisoryBadge = screen.getByTestId("advisory-badge");
    expect(advisoryBadge).toBeInTheDocument();
    expect(advisoryBadge).toHaveTextContent("Advisory Only — Trainer Oversight Required");

    // Verify Advisory Disclaimer
    expect(
      screen.getByText("Advisory only. Model outputs are decision-support suggestions.")
    ).toBeInTheDocument();

    // Verify ML Model indicator
    expect(screen.getByText(/ML Model \(Random Forest v1.0\)/)).toBeInTheDocument();
  });

  it("2. renders Advisory Only badge and fallback disclaimer for Rule Fallback (Cold Start)", async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        method: "rule",
        service_status: "cold_start",
        reason: "Trainee has 2 session(s); evaluated using rule fallback",
        label: 1,
        probability: null,
        threshold: 60.0,
        threshold_unit: "score_percentage",
        top_features: [],
        model_version: null,
        is_advisory: true,
      },
    });

    render(
      <MemoryRouter>
        <FlaggedTraineeRiskCard
          trainee={{
            trainee_id: 102,
            trainee_name: "Jane Trainee",
            session_count: 2,
            metrics: { recent_avg_score: 48.0 },
          }}
          rank={2}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Jane Trainee")).toBeInTheDocument();
    });

    // Verify Advisory Badge on Rule Fallback card
    const advisoryBadge = screen.getByTestId("advisory-badge");
    expect(advisoryBadge).toBeInTheDocument();
    expect(advisoryBadge).toHaveTextContent("Advisory Only — Trainer Oversight Required");

    // Verify Fallback to threshold constant disclaimer
    expect(screen.getByText(ML_ADVISORY_DISCLAIMER)).toBeInTheDocument();

    // Verify Rule Fallback indicator
    expect(screen.getByText(/Rule Fallback \(Cold Start/)).toBeInTheDocument();
  });

  it("3. renders Advisory Service Unavailable badge and never masks offline service as model output", async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        method: "rule",
        service_status: "unavailable",
        reason: "Advisory ML service is unreachable or timed out; evaluated using deterministic rule fallback (model inference unavailable)",
        label: 1,
        probability: null,
        threshold: 60.0,
        threshold_unit: "score_percentage",
        top_features: [],
        model_version: null,
        is_advisory: true,
      },
    });

    render(
      <MemoryRouter>
        <FlaggedTraineeRiskCard
          trainee={{
            trainee_id: 103,
            trainee_name: "Bob Offline",
            session_count: 8,
            metrics: { recent_avg_score: 42.0 },
          }}
          rank={3}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Bob Offline")).toBeInTheDocument();
    });

    // Verify explicit Service Unavailable badge
    const unavailBadge = screen.getByTestId("service-unavailable-badge");
    expect(unavailBadge).toBeInTheDocument();
    expect(unavailBadge).toHaveTextContent("Advisory Service Unavailable — Heuristic Fallback");

    // Must NOT display "ML Model (Random Forest v1.0)"
    expect(screen.queryByText(/ML Model \(Random Forest v1.0\)/)).not.toBeInTheDocument();

    // Advisory badge must still be present
    const advisoryBadge = screen.getByTestId("advisory-badge");
    expect(advisoryBadge).toBeInTheDocument();
    expect(advisoryBadge).toHaveTextContent("Advisory Only — Trainer Oversight Required");

    // Reason must state inference unavailable
    expect(
      screen.getByText(/Advisory ML service is unreachable or timed out/i)
    ).toBeInTheDocument();
  });

  it("4. verifies the UI does not present ML output as an automated final decision", async () => {
    mockApi.get.mockResolvedValueOnce({
      data: {
        method: "ml",
        reason: "Declining trend and 2 failed sessions",
        label: 1,
        probability: 0.92,
        threshold: 0.67,
        threshold_unit: "probability",
        top_features: [
          { feature: "last_3_mean_score", importance: 0.5, explanation: "Mean score weight" },
        ],
        model_version: "1.0.0",
        is_advisory: true,
      },
    });

    const assignDrillFn = vi.fn();
    const messageFn = vi.fn();

    render(
      <MemoryRouter>
        <FlaggedTraineeRiskCard
          trainee={{
            trainee_id: 104,
            trainee_name: "Charlie Action",
            session_count: 10,
            metrics: { recent_avg_score: 45.0 },
          }}
          rank={4}
          onAssignDrill={assignDrillFn}
          onMessageTrainee={messageFn}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Charlie Action")).toBeInTheDocument();
    });

    // Assert probability is labeled as estimated likelihood, not definitive verdict
    expect(screen.getByText("Model Probability")).toBeInTheDocument();
    expect(screen.getByText("At-Risk Likelihood")).toBeInTheDocument();
    expect(screen.queryByText(/Automated Failing Grade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Final Academic Decision/i)).not.toBeInTheDocument();

    // Verify human-in-the-loop action controls are available
    expect(screen.getByRole("button", { name: /Assign Drill/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message/i })).toBeInTheDocument();
  });
});
