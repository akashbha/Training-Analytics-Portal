// src/api/learning.js
// Client API for DevOps Learning Paths, Range-based Video Streaming, and Capstone Assignments.

import { apiClient } from "./client.js";

export const learningApi = {
  getSubjects: async () => {
    const res = await apiClient.get("/learning/subjects");
    return res.data;
  },

  getSubjectBySlug: async (slug) => {
    const res = await apiClient.get(`/learning/subjects/${slug}`);
    return res.data;
  },

  getLessonDetail: async (lessonId) => {
    const res = await apiClient.get(`/learning/lessons/${lessonId}`);
    return res.data;
  },

  updateProgress: async (lessonId, { watched_seconds, is_completed }) => {
    const res = await apiClient.post(`/learning/lessons/${lessonId}/progress`, {
      watched_seconds,
      is_completed,
    });
    return res.data;
  },

  submitAssignment: async (assignmentId, { commands_used, explanation }) => {
    const res = await apiClient.post(`/learning/assignments/${assignmentId}/submit`, {
      commands_used,
      explanation,
    });
    return res.data;
  },

  getMySubmissions: async () => {
    const res = await apiClient.get("/learning/submissions/my");
    return res.data;
  },

  getTrainerSubmissions: async (status) => {
    const params = status ? { status } : {};
    const res = await apiClient.get("/learning/trainer/submissions", { params });
    return res.data;
  },

  reviewSubmission: async (submissionId, { status, score, trainer_feedback }) => {
    const res = await apiClient.post(`/learning/trainer/submissions/${submissionId}/review`, {
      status,
      score,
      trainer_feedback,
    });
    return res.data;
  },

  getVideoStreamUrl: (lessonId) => {
    const token = localStorage.getItem("token") || "";
    const baseURL = apiClient.defaults.baseURL || "http://127.0.0.1:8000";
    return `${baseURL}/learning/lessons/${lessonId}/stream?token=${encodeURIComponent(token)}`;
  },

  getSubtitlesUrl: (lessonId) => {
    const token = localStorage.getItem("token") || "";
    const baseURL = apiClient.defaults.baseURL || "http://127.0.0.1:8000";
    return `${baseURL}/learning/lessons/${lessonId}/subtitles?token=${encodeURIComponent(token)}`;
  },

  getCompanionFileUrl: (lessonId, fileIndex) => {
    const token = localStorage.getItem("token") || "";
    const baseURL = apiClient.defaults.baseURL || "http://127.0.0.1:8000";
    return `${baseURL}/learning/lessons/${lessonId}/companion-files/${fileIndex}?token=${encodeURIComponent(token)}`;
  },
};

