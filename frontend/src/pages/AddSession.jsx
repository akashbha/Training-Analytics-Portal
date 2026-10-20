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

  // CSV Drag-and-Drop Upload state
  const [csvFile, setCsvFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
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
            { id: 1, name: "Alex Chen (Cohort Alpha)" },
            { id: 2, name: "Jordan Taylor (Cohort Alpha)" },
            { id: 3, name: "Samantha Reed (Cohort Alpha)" },
            { id: 4, name: "Elena Rostova (Cohort Alpha)" },
            { id: 7, name: "David Kim (Cohort Beta)" },
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
      validateAndSetCsv(file);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetCsv(e.target.files[0]);
    }
  };

  const validateAndSetCsv = (file) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Only .csv files are supported.");
      setCsvFile(null);
      return;
    }
    setCsvError("");
    setCsvResult(null);
    setCsvFile(file);
  };

  // Upload CSV File
  const handleCsvUpload = async () => {
    if (!csvFile) return;

    setCsvUploading(true);
    setCsvError("");
    setCsvResult(null);

    const body = new FormData();
    body.append("file", csvFile);

    try {
      const res = await apiClient.post("/sessions/bulk", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCsvResult(res.data);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setCsvError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to process CSV file."
      );
    } finally {
      setCsvUploading(false);
    }
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
              <div className="flex items-center space-x-2.5 pb-4 border-b border-purple-100 mb-6">
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

          {/* RIGHT: Dark Purple Card for CSV Ingestion (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card variant="dark" className="border border-purple-400/20 shadow-lg p-7">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-5">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-purple-200" />
                  <h2 className="text-base font-extrabold text-white">Bulk CSV Ingestion</h2>
                </div>
                {/* Download Template Link */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-purple-200 hover:text-white underline cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download template</span>
                </button>
              </div>

              <p className="text-xs text-purple-200/80 mb-5 leading-relaxed">
                Upload comma-separated evaluation files. Headers required:{" "}
                <code className="text-white bg-white/10 px-1 py-0.5 rounded text-[10px]">
                  trainee_email,module_name,score,errors,time_seconds
                </code>
              </p>

              {/* Drag and Drop Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-white bg-white/15 scale-[1.01]"
                    : "border-purple-300/40 hover:border-purple-200 bg-white/5 hover:bg-white/10"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv"
                  className="hidden"
                />
                <UploadCloud className="w-9 h-9 text-purple-200 mx-auto mb-2" />
                <p className="text-xs font-bold text-white">
                  {csvFile ? csvFile.name : "Drag & drop CSV file here, or click to browse"}
                </p>
                <p className="text-[10px] text-purple-300/70 mt-1">
                  Supports .csv files up to 5 MB
                </p>
              </div>

              {/* CSV Selection Status & Upload Button */}
              {csvFile && (
                <div className="mt-4 flex items-center justify-between p-3 rounded-2xl bg-white/10 border border-white/10">
                  <div className="text-xs text-white truncate max-w-[200px]">
                    {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                  </div>
                  <button
                    type="button"
                    onClick={handleCsvUpload}
                    disabled={csvUploading}
                    className="px-4 py-1.5 rounded-full bg-white hover:bg-purple-100 text-brand font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {csvUploading && <Spinner size="sm" />}
                    <span>Upload CSV</span>
                  </button>
                </div>
              )}

              {/* Upload Error Banner */}
              {csvError && (
                <div className="mt-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-400 text-xs text-rose-200 font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* CSV Results Summary & Error Table */}
              {csvResult && (
                <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Batch Ingestion Result
                    </span>
                    <div className="flex items-center space-x-2 text-xs font-extrabold">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        {csvResult.inserted} Inserted
                      </span>
                      {csvResult.failed > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                          {csvResult.failed} Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row Errors Table */}
                  {csvResult.errors && csvResult.errors.length > 0 && (
                    <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                      <div className="px-3 py-2 bg-white/10 text-[10px] font-bold text-purple-200 uppercase tracking-wider">
                        Row Validation Errors ({csvResult.errors.length})
                      </div>
                      <div className="max-h-44 overflow-y-auto divide-y divide-white/5 text-[11px]">
                        {csvResult.errors.map((err, i) => (
                          <div key={i} className="p-2.5 flex items-start space-x-2 text-rose-200">
                            <span className="font-extrabold text-white shrink-0">
                              Row #{err.row}:
                            </span>
                            <span className="text-purple-200/90">{err.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
