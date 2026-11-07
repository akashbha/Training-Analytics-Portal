import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import heatmapSnapshot from "../assets/landing-heatmap.json";

function HeatmapBackground() {
  const { modules, rows } = heatmapSnapshot;

  const totalCols = modules?.length || 7;
  const totalRows = rows?.length || 8;

  const gridCells = useMemo(() => {
    const cells = [];
    if (!rows || rows.length === 0) return cells;

    // Tile across 2 horizontal blocks to fill wide viewports cleanly
    const horizontalRepeats = 2;
    const colCount = totalCols * horizontalRepeats;

    for (let r = 0; r < totalRows; r++) {
      const row = rows[r];
      for (let h = 0; h < horizontalRepeats; h++) {
        for (let c = 0; c < totalCols; c++) {
          const cellData = row.cells?.[c];
          const score = cellData?.score_pct ?? 60.0;
          const colIndex = h * totalCols + c;
          cells.push({
            id: `${r}-${colIndex}`,
            rowIndex: r,
            colIndex,
            score,
          });
        }
      }
    }
    return { cells, colCount, rowCount: totalRows };
  }, [rows, totalCols, totalRows]);

  const cellWidth = 96;
  const cellHeight = 56;
  const gap = 8;
  const svgWidth = gridCells.colCount * (cellWidth + gap);
  const svgHeight = gridCells.rowCount * (cellHeight + gap);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-[0.05]"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        {gridCells.cells.map((cell) => {
          const x = cell.colIndex * (cellWidth + gap);
          const y = cell.rowIndex * (cellHeight + gap);
          // Darker fill for higher scores, lighter fill for lower scores
          const normalized = Math.min(Math.max((cell.score - 40) / 60, 0.15), 0.95);
          const delayMs = Math.round((cell.colIndex / gridCells.colCount) * 500);

          return (
            <rect
              key={cell.id}
              x={x}
              y={y}
              width={cellWidth}
              height={cellHeight}
              rx={6}
              fill="#0f172a"
              fillOpacity={normalized}
              className="landing-heatmap-cell"
              style={{
                animationDelay: `${delayMs}ms`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function LandingPage() {
  const { user, isStaff, isAdmin } = useAuth();

  const destinationPath = user
    ? isAdmin
      ? "/admin"
      : isStaff
      ? "/dashboard"
      : `/trainees/${user.trainee_id || 1}`
    : "/login";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <HeatmapBackground />

      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xs sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Training Analytics Portal
            </span>
            <span className="text-[11px] font-mono text-slate-500 border border-slate-200 bg-slate-100 px-1.5 py-0.5 rounded">
              v1.0.0
            </span>
          </div>

          <nav className="flex items-center space-x-4">
            <Link
              to={destinationPath}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              {user ? "Open Dashboard" : "Sign In"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
        {/* Hero Section */}
        <section className="space-y-6">
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
              Operational Training Records
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-tight">
              Trainee scores, errors, and time by module, with a risk view for each batch.
            </h1>
          </div>

          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            A structured tracking system for technical cohorts. Evaluates individual session
            outcomes, displays batch performance distributions, and applies an early warning
            model to flag candidates needing intervention.
          </p>

          <div className="pt-2">
            <Link
              to={destinationPath}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              {user ? "Go to Dashboard" : "Sign In to Portal"}
            </Link>
          </div>

          {/* Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200">
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
              <div className="text-[11px] font-medium text-slate-500">Batches monitored</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">5</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Cohorts active</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
              <div className="text-[11px] font-medium text-slate-500">Enrolled trainees</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">48</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Sample volume</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
              <div className="text-[11px] font-medium text-slate-500">Pass cutoff</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">60.0%</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">PASS_THRESHOLD</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
              <div className="text-[11px] font-medium text-slate-500">Curriculum modules</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">7</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Technical topics</div>
            </div>
          </div>
        </section>

        {/* Section 1: What is recorded */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Session Metrics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Measured across every practical assessment attempt in the database.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Score and Qualification</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Trainee Dashboard & Trainer Heatmap
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Numerical score scaled against the module maximum. A score of 60.0% (PASS_THRESHOLD)
                or higher marks a passing attempt. Cohort pass rates evaluate against the identical cutoff.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Measure: Percentage score (0.0% to 100.0%)
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Defect Error Count</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Module Diagnostic Ledger
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compilation errors, test failures, and execution defects logged per drill session.
                Tracks curriculum topics where errors cluster.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Measure: Non-negative integer count
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Completion Duration</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Speed Versus Accuracy Analysis
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Total active seconds required to complete the assessment drill. Evaluated against
                accuracy to identify pacing hesitation or rushing.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Measure: Duration in seconds
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Session Sequence and History</span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Chronological Progression Timeline
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Timestamped records of completed sessions per trainee. Establishes the learning trajectory
                and moving averages used for risk classification.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Measure: Sequential attempt count with ISO 8601 timestamps
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Who sees what */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Role-Gated Access
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Permissions enforced by JWT claims and database foreign keys.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-900">Administrator</div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Admin Governance Console (/admin)
                </div>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>User provisioning and role assignment</li>
                <li>System audit log inspection with event tracking</li>
                <li>Batch cohort creation and module management</li>
                <li>Held-out model evaluation metrics</li>
                <li>Blocked from viewing individual intervention cards</li>
              </ul>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-900">Trainer</div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Trainer Dashboard (/dashboard)
                </div>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Needs-Attention Queue: ML or rule fallback risk</li>
                <li>Batch Heatmap: trainee-by-module matrix</li>
                <li>Single session entry and bulk CSV import</li>
                <li>Direct remediation assignment</li>
                <li>Batch-scoped direct messaging</li>
              </ul>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-900">Trainee</div>
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Trainee Dashboard (/trainees/:id)
                </div>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Personal score dossier and progress curves</li>
                <li>Personal learning goals by module</li>
                <li>Defect diagnostic ledger</li>
                <li>Speed versus accuracy scatter analysis</li>
                <li>Restricted strictly to personal data (HTTP 403 on peers)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Limits */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              System Limitations and Disclosures
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Operational boundaries and evaluation caveats documented in MODEL_CARD.md.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-900">Synthetic Data Generation</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Assessment records originate from synthetic cohort simulation scripts rather than live
                human students. High test ROC-AUC scores (0.9995 for Logistic Regression, 1.0000 for
                Random Forest) reflect simplicity and consistency in the generator rather than guaranteed
                real-world generalization.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Impact: Model performance on human cohorts is unverified.
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-900">Model Versus Rule Margin</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                On the held-out test set (8 trainees, 155 session rows, 32 positive at-risk instances),
                the machine learning model differs from the simple 60.0% rule baseline by only 3 rows.
                This margin is within statistical noise for this sample volume.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Impact: The rule fallback remains the operational ground truth.
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-900">Data Volume and Storage</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The active cohort contains 48 trainees across 5 batches. The small sample volume limits
                the machine learning model from learning non-linear patterns beyond simple moving averages.
                Audit logs enforce application-layer immutability; hardware-level write-once storage is not implemented.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Impact: Configured for small to mid-sized training cohorts.
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">Training Analytics Portal</span>
            <span>(FastAPI + React + SQLite/PostgreSQL)</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <span className="font-mono text-[11px] text-slate-400">
              Evaluation facts documented in REPORT.md and MODEL_CARD.md
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
