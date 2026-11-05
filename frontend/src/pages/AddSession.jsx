// src/pages/AddSession.jsx
// Trainer assessment entry screen supporting single session submission and bulk CSV drag-and-drop upload.
// Validates module max scores inline, converts minutes to seconds, retains selected context on save, and reports row-level CSV errors.

import React, { useState, useEffect, useRef } from "react";
import { Card } from "../components/Card.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { apiClient } from "../api/client.js";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Target,
  User,
  BookOpen,
  Calendar,
  X,
  FileText,
} from "lucide-react";

export function AddSession() {
  // Option lists
  const [trainees, setTrainees] = useState([]);
  const [modules, setModules] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Single Session Form state
  const [formData, setFormData] = useState({
    trainee_id: "",
    module_id: "",
    score: "",
    errors: "0",
    time_minutes: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // CSV Drag-and-Drop & Dry-Run Ingestion state
  const [csvFile, setCsvFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [csvValidating, setCsvValidating] = useState(false);
  const [csvCommitting, setCsvCommitting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef(null);

  // Load trainees and modules on mount
  useEffect(() => {
    async function loadOptions() {
      setLoadingData(true);
      setLoadError("");
      try {
        const [traineeRes, moduleRes] = await Promise.all([
          apiClient.get("/trainees?page=1&page_size=100&sort=name"),
          apiClient.get("/modules?page=1&page_size=100"),
        ]);

        const tList = traineeRes.data?.items || traineeRes.data || [];
        const mList = moduleRes.data?.items || moduleRes.data || [];

        setTrainees(tList);
        setModules(mList);

        if (tList.length > 0) {
          setFormData((prev) => ({ ...prev, trainee_id: String(tList[0].id) }));
        }
        if (mList.length > 0) {
          setFormData((prev) => ({ ...prev, module_id: String(mList[0].id) }));
        }
      } catch (err) {
        if (!err.response || err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
          const fallbackTrainees = [
            { id: 1, name: "Alex Chen (Batch A - Web Core)" },
            { id: 2, name: "Jordan Taylor (Batch A - Web Core)" },
            { id: 3, name: "Samantha Reed (Batch A - Web Core)" },
            { id: 4, name: "Elena Rostova (Batch A - Web Core)" },
            { id: 7, name: "David Kim (Batch B - Data Systems)" },
          ];
          const fallbackModules = [
            { id: 1, name: "Python Fundamentals", max_score: 100 },
            { id: 2, name: "PostgreSQL & Schema Design", max_score: 100 },
            { id: 3, name: "FastAPI REST Architecture", max_score: 100 },
            { id: 4, name: "React & State Engineering", max_score: 100 },
          ];
          setTrainees(fallbackTrainees);
          setModules(fallbackModules);
          setFormData((prev) => ({
            ...prev,
            trainee_id: "1",
            module_id: "1",
          }));
        } else {
          setLoadError(err.message || "Failed to load curriculum modules and trainees.");
        }
      } finally {
        setLoadingData(false);
      }
    }
    loadOptions();
  }, []);

  // Selected module lookup for dynamic max_score
  const selectedModule = modules.find((m) => String(m.id) === String(formData.module_id)) || null;

  // Single form input change handler
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));

    // Instant client validation for score ceiling
    if (field === "score" && selectedModule) {
      const numScore = parseFloat(value);
      if (!isNaN(numScore) && numScore > selectedModule.max_score) {
        setFieldErrors((prev) => ({
          ...prev,
          score: `Score cannot exceed module ceiling of ${selectedModule.max_score}`,
        }));
      }
    }
  };

  // Submit Single Session
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.trainee_id) errors.trainee_id = "Please select a trainee.";
    if (!formData.module_id) errors.module_id = "Please select an assessment module.";

    const scoreNum = parseFloat(formData.score);
    if (isNaN(scoreNum) || scoreNum < 0) {
      errors.score = "Please enter a valid non-negative score.";
    } else if (selectedModule && scoreNum > selectedModule.max_score) {
      errors.score = `Score cannot exceed module maximum of ${selectedModule.max_score}.`;
    }

    const errorsNum = parseInt(formData.errors, 10);
    if (isNaN(errorsNum) || errorsNum < 0) {
      errors.errors = "Errors must be 0 or greater.";
    }

    const minsNum = parseFloat(formData.time_minutes);
    if (isNaN(minsNum) || minsNum <= 0) {
      errors.time_minutes = "Time duration must be greater than 0 minutes.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSingleSubmitting(true);
    setFieldErrors({});

    try {
      // Convert minutes to seconds
      const time_seconds = Math.round(minsNum * 60);

      const payload = {
        trainee_id: Number(formData.trainee_id),
        module_id: Number(formData.module_id),
        score: scoreNum,
        errors: errorsNum,
        time_seconds,
        created_at: formData.date
          ? new Date(`${formData.date}T12:00:00Z`).toISOString()
          : new Date().toISOString(),
      };

      await apiClient.post("/sessions", payload);

      // Success toast
      setToastMessage("Assessment session recorded successfully!");
      setTimeout(() => setToastMessage(""), 5000);

      // Keep form open for next entry, clearing only score, errors, and time
      setFormData((prev) => ({
        ...prev,
        score: "",
        errors: "0",
        time_minutes: "",
      }));
    } catch (err) {
      const backendMsg = err.response?.data?.error?.message || err.message;
      if (backendMsg.toLowerCase().includes("score")) {
        setFieldErrors({ score: backendMsg });
      } else {
        setFieldErrors({ form: backendMsg });
      }
    } finally {
      setSingleSubmitting(false);
    }
  };

  // CSV Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndDryRunCsv(file);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndDryRunCsv(e.target.files[0]);
    }
  };

  const validateAndDryRunCsv = async (file) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Only .csv files are supported.");
      setCsvFile(null);
      setImportPreview(null);
      return;
    }
    if (file.size > 1024 * 1024) {
      setCsvError(`File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the 1 MB limit.`);
      setCsvFile(null);
      setImportPreview(null);
      return;
    }
    setCsvError("");
    setCsvFile(file);
    setImportPreview(null);
    setCsvValidating(true);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await apiClient.post("/sessions/import?dry_run=true", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(res.data);
    } catch (err) {
      setCsvError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          "Failed to validate CSV file."
      );
    } finally {
      setCsvValidating(false);
    }
  };

  // Commit CSV Import (Atomic transaction)
  const handleCommitImport = async () => {
    if (!csvFile || !importPreview || importPreview.error_count > 0) return;

    setCsvCommitting(true);
    setCsvError("");

    const body = new FormData();
    body.append("file", csvFile);

    try {
      const res = await apiClient.post("/sessions/import?dry_run=false", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setToastMessage(`Successfully imported ${res.data.valid_rows || importPreview.valid_rows} sessions!`);
      setTimeout(() => setToastMessage(""), 5000);
      setCsvFile(null);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setCsvError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          "Failed to commit CSV import."
      );
    } finally {
      setCsvCommitting(false);
    }
  };

  const handleClearCsv = () => {
    setCsvFile(null);
    setImportPreview(null);
    setCsvError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Download CSV Template
  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get("/sessions/template", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sessions_bulk_template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback direct URL trigger
      const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
      window.open(`${base}/sessions/template`, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-xl flex items-center space-x-3 text-xs font-bold border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage("")}
              className="text-slate-400 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <span className="text-xs uppercase font-extrabold tracking-wider text-brand">
          Assessment Intake
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
          Record Training Sessions
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Submit individual trainee evaluation results or perform bulk ingestion via CSV
        </p>
      </div>

      {loadingData ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <Spinner size="lg" />
          <span className="text-xs font-semibold text-slate-500">
            Loading assessment forms and module criteria...
          </span>
        </div>
      ) : loadError ? (
        <Card variant="white" className="p-8 text-center border-rose-200">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">Failed to load dependencies</h3>
          <p className="text-xs text-rose-600 mt-1">{loadError}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: White Form Card (7 Cols) */}
          <div className="lg:col-span-7">
            <Card variant="white" className="p-7 shadow-xs">
              <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 mb-6">
                <div className="p-2 rounded-2xl bg-brand-light text-brand">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Single Session Entry
                  </h2>
                  <p className="text-xs text-slate-500">
                    Input evaluation score, error count, and duration in minutes
                  </p>
                </div>
              </div>

              {fieldErrors.form && (
                <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{fieldErrors.form}</span>
                </div>
              )}

              <form onSubmit={handleSingleSubmit} className="space-y-4">
                {/* Trainee Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-brand" />
                    <span>Select Trainee</span>
                  </label>
                  <select
                    value={formData.trainee_id}
                    onChange={(e) => handleInputChange("trainee_id", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white cursor-pointer"
                  >
                    {trainees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email}) • {t.batch_name || `Batch #${t.batch_id}`}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.trainee_id && (
                    <p className="mt-1 text-xs text-rose-600 font-bold">
                      {fieldErrors.trainee_id}
                    </p>
                  )}
                </div>

                {/* Module Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-brand" />
                    <span>Curriculum Module</span>
                  </label>
                  <select
                    value={formData.module_id}
                    onChange={(e) => handleInputChange("module_id", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white cursor-pointer"
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (Max: {m.max_score} pts)
                      </option>
                    ))}
                  </select>
                  {fieldErrors.module_id && (
                    <p className="mt-1 text-xs text-rose-600 font-bold">
                      {fieldErrors.module_id}
                    </p>
                  )}
                </div>

                {/* Score & Errors Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Score with Max Ceiling Badge */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                        <Target className="w-3.5 h-3.5 text-brand" />
                        <span>Score</span>
                      </label>
                      {selectedModule && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-light text-brand">
                          Max: {selectedModule.max_score}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={selectedModule?.max_score}
                      required
                      placeholder="e.g. 85.5"
                      value={formData.score}
                      onChange={(e) => handleInputChange("score", e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-2xl bg-slate-50 border text-sm focus:outline-none focus:ring-2 focus:bg-white font-bold ${
                        fieldErrors.score
                          ? "border-rose-400 focus:ring-rose-500 bg-rose-50/50"
                          : "border-slate-200 focus:ring-brand"
                      }`}
                    />
                    {fieldErrors.score && (
                      <p className="mt-1 text-xs text-rose-600 font-bold">
                        {fieldErrors.score}
                      </p>
                    )}
                  </div>

                  {/* Errors */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Errors Count</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="0"
                      value={formData.errors}
                      onChange={(e) => handleInputChange("errors", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white font-bold"
                    />
                    {fieldErrors.errors && (
                      <p className="mt-1 text-xs text-rose-600 font-bold">
                        {fieldErrors.errors}
                      </p>
                    )}
                  </div>
                </div>

                {/* Duration & Date Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Time Duration in Minutes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-brand" />
                      <span>Time (Minutes)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      placeholder="e.g. 25"
                      value={formData.time_minutes}
                      onChange={(e) => handleInputChange("time_minutes", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Auto-converts to seconds on submission
                    </span>
                    {fieldErrors.time_minutes && (
                      <p className="mt-1 text-xs text-rose-600 font-bold">
                        {fieldErrors.time_minutes}
                      </p>
                    )}
                  </div>

                  {/* Session Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-brand" />
                      <span>Session Date</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => handleInputChange("date", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand focus:bg-white"
                    />
                  </div>
                </div>

                {/* Form Action */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={singleSubmitting}
                    className="px-6 py-2.5 rounded-full bg-brand hover:bg-brand-dark text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {singleSubmitting && <Spinner size="sm" className="text-white" />}
                    <span>Record Session</span>
                  </button>
                </div>
              </form>
            </Card>
          </div>

          {/* RIGHT: White Card for CSV Ingestion (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card variant="white" className="border border-slate-200/80 shadow-sm p-7">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-brand" />
                  <h2 className="text-base font-extrabold text-slate-900">Bulk CSV Ingestion</h2>
                </div>
                {/* Download Template Link */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-brand hover:text-brand-dark underline cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download template</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Upload comma-separated evaluation files. Headers required:{" "}
                <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">
                  trainee_email,module_name,score,errors,time_seconds
                </code>
              </p>

              {/* Drag and Drop Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-brand bg-blue-50/50 scale-[1.01]"
                    : "border-slate-300 hover:border-brand bg-slate-50 hover:bg-slate-100/70"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv"
                  className="hidden"
                />
                <UploadCloud className="w-9 h-9 text-brand mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {csvFile ? csvFile.name : "Drag & drop CSV file here, or click to browse"}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports .csv files up to 1 MB (max 2,000 rows)
                </p>
              </div>

              {/* Validation Spinner */}
              {csvValidating && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center space-x-2 text-xs font-semibold text-slate-600">
                  <Spinner size="sm" />
                  <span>Validating CSV rows & checking business rules (dry run)...</span>
                </div>
              )}

              {/* Upload Error Banner */}
              {csvError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Dry-Run Validation Preview & Commit */}
              {importPreview && !csvValidating && (
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                  {/* Summary Badges */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Dry-Run Preview
                    </span>
                    <div className="flex items-center space-x-1.5 text-xs font-extrabold">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {importPreview.total_rows} Total
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {importPreview.valid_rows} Valid
                      </span>
                      {importPreview.error_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          {importPreview.error_count} Errors
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                    <div className="max-h-60 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-2.5">Row</th>
                            <th className="py-2 px-2.5">Trainee</th>
                            <th className="py-2 px-2.5">Module</th>
                            <th className="py-2 px-2.5 text-right">Score</th>
                            <th className="py-2 px-2.5 text-right">Errors</th>
                            <th className="py-2 px-2.5 text-right">Time</th>
                            <th className="py-2 px-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.rows?.map((r) => (
                            <tr
                              key={r.row}
                              className={
                                r.valid
                                  ? "hover:bg-slate-50/70"
                                  : "bg-rose-50/80 text-rose-900 border-l-2 border-rose-500"
                              }
                            >
                              <td className="py-2 px-2.5 font-mono font-bold text-slate-700">#{r.row}</td>
                              <td className="py-2 px-2.5 font-medium truncate max-w-[120px]" title={r.trainee_email}>
                                {r.trainee_email}
                              </td>
                              <td className="py-2 px-2.5 truncate max-w-[110px]" title={r.module_name}>
                                {r.module_name}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono">{r.score ?? "-"}</td>
                              <td className="py-2 px-2.5 text-right font-mono">{r.errors ?? "-"}</td>
                              <td className="py-2 px-2.5 text-right font-mono">{r.time_seconds != null ? `${r.time_seconds}s` : "-"}</td>
                              <td className="py-2 px-2.5">
                                {r.valid ? (
                                  <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[10px]">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Valid</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-start space-x-1 text-rose-700 font-semibold text-[10px]" title={r.error}>
                                    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                                    <span className="truncate max-w-[160px]">{r.error}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Commit Action Footer */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleClearCsv}
                      className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      Clear File
                    </button>

                    <div className="flex items-center space-x-2">
                      {importPreview.error_count > 0 && (
                        <span className="text-[11px] text-rose-600 font-medium">
                          Fix {importPreview.error_count} error{importPreview.error_count > 1 ? "s" : ""} to commit
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleCommitImport}
                        disabled={importPreview.error_count > 0 || importPreview.total_rows === 0 || csvCommitting}
                        className={`px-5 py-2 rounded-full font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all ${
                          importPreview.error_count === 0 && importPreview.total_rows > 0
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        {csvCommitting && <Spinner size="sm" className="text-white" />}
                        <span>Commit Import ({importPreview.valid_rows})</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddSession;
