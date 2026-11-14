# Model Card: Trainee Early Intervention Risk Model

## Governance Status & Operational Constraints
- **Operational Mode**: Strict Advisory-Only (`is_advisory: true`).
- **Autonomous Action Policy**: Zero Autonomous Actions. Model predictions must never trigger automated grading, account status alterations, or involuntary cohort reassignments. All pedagogical interventions require explicit human trainer review and authorization.
- **Simulation Status**: **FROZEN**. Predictive "What-If" simulators, biometric/behavioral telemetry (e.g. video rewind/pause turbulence tracking), and closed-loop autonomous remediation are strictly prohibited until the core risk model undergoes independent validation on authentic, non-synthetic human student cohorts.
- **Fallback Integrity**: If the advisory microservice is unreachable, degraded, or times out, the system explicitly reports `service_status: "unavailable"` and `Advisory Service Unavailable — Heuristic Fallback`. It never masks a rule-based fallback as ML output.

---

## Artifact Traceability & Integrity Hashes
All deployed artifacts, dataset extracts, and split definitions are cryptographically tracked:

| Artifact | Relative Path | Format | Version | SHA-256 Digest |
| :--- | :--- | :--- | :--- | :--- |
| **Model Pipeline** | `backend/app/ml/risk_model.joblib` | Scikit-Learn Pipeline | 1.0.0 | `cc9a261fceb41afa71823b36752842a7d91fab0dfe37d8916a85635309dd3664` |
| **Training Dataset** | `backend/app/ml/dataset.csv` | CSV (677 rows) | 1.0.0 | `c1683e4df2dae698376cc9695983b5f53b0a079372005cafff66c372c9a9126a` |
| **Grouped Split** | `backend/app/ml/split.json` | JSON (Train/Test IDs) | 1.0.0 | `2b3acfd41138f31cf618b805319929823755ae50901a1f7d195efd9dce14d384` |
| **Evaluation Metrics**| `backend/app/ml/metrics.json` | JSON (CV & Test Metrics)| 1.0.0 | `fcb594311de3390385f0012466189591db08eb02347d5ca24e25e963fb027116` |
| **Results Summary** | `backend/app/ml/model_results.json` | JSON (Cross-Model Matrix)| 1.0.0 | `7636e0b643585f73378c2cd897a0a26aa040dd43c27ebb5194aebb1708ccf4e5` |

---

## Threshold Policy & Explicit Business Rules

The system reconciles two distinct operational thresholds across the curriculum:

| Threshold | Numerical Cutoff | Architectural Purpose | Authority & Governance Scope |
| :--- | :--- | :--- | :--- |
| **`ASSESSMENT_PASS_THRESHOLD`** | **60.0%** | **Baseline Competence Cutoff** | **Controls Module Pass/Fail**: Standard assessment sessions scoring $\ge 60.0\%$ qualify as passing. Used for cohort pass rates, leaderboard qualification, learning assignment completions, and defines the ground-truth target label for ML risk prediction. |
| **`REMEDIATION_RESOLVE_THRESHOLD`** | **70.0%** | **Mastery Recovery Cutoff** | **Controls Remediation Resolution**: Once a trainee fails a module ($< 60.0\%$) and is placed into remediation, resolving the remediation flag requires demonstrating an elevated mastery score of $\ge 70.0\%$ on reassessment. Scores in the $60.0\% - 69.9\%$ range remain "In Progress", ensuring verified conceptual recovery rather than borderline survival. |

### Institutional Rule Map:
1. **What 60% Means**: Baseline passing competence on a standard curriculum module.
2. **What 70% Means**: Mastery recovery benchmark required to close out an active remediation intervention.
3. **Which controls pass/fail**: 60.0% (`ASSESSMENT_PASS_THRESHOLD`).
4. **Which controls remediation**: 70.0% (`REMEDIATION_RESOLVE_THRESHOLD`).
5. **Which controls model labels**: 60.0% (`PASS_THRESHOLD`). The ML binary label is 1 if $\text{mean}(\text{next 2 sessions}) < 60.0\%$.

---

## Target
The target label is a binary risk indicator for trainee performance on subsequent assessments. For each decision point $k$ (where $k \ge 5$), the label is 1 if the mean score percentage of the next 2 sessions (sessions $k + 1$ and $k + 2$) is strictly below `PASS_THRESHOLD` (60.0 percent, imported from `app.core.constants`). Otherwise, the label is 0.

$$\text{Label}_k = \begin{cases} 1 & \text{if } \frac{\text{Score}_{k+1} + \text{Score}_{k+2}}{2} < 60.0\% \\ 0 & \text{otherwise} \end{cases}$$

---

## Data Source & Sample Size Limits
The dataset source is the seeded local SQLite database, which consists of synthetic trainee assessment data generated via simulation scripts.
- **Total Trainees Seeded**: 45 trainees.
- **Eligible Trainees**: 39 trainees contributed to the dataset (6 trainees had fewer than 7 recorded sessions, preventing the formation of a decision point requiring 5 prior and 2 future sessions).
- **Total Dataset Size**: 677 decision rows with 216 positive cases (31.9% positive class prevalence).

---

## Features
Each row represents a single decision point for a trainee and uses only sessions completed strictly before that decision point. Practice drills (`is_practice = True`) are strictly filtered out to avoid contaminating graded performance telemetry. The 8 features are:
1. `last_1_score`: Score percentage achieved on the most recent prior assessment session.
2. `last_3_mean_score`: Arithmetic mean of score percentages across the last 3 prior assessment sessions.
3. `overall_mean_score`: Arithmetic mean of score percentages across all prior assessment sessions up to the decision point.
4. `slope_last_5`: Linear regression slope over the score percentages of the last 5 prior assessment sessions.
5. `error_rate`: Mean error count per session across all prior assessment sessions.
6. `mean_time`: Mean session duration in seconds across all prior assessment sessions.
7. `session_count`: Count of prior assessment sessions available at the decision point ($k \ge 5$).
8. `score_std`: Standard deviation of score percentages across all prior assessment sessions up to the decision point.

---

## Grouped Split
The dataset is split strictly by trainee using `GroupShuffleSplit` (`test_size=0.2`, `random_state=42`). Because individual decision points for the same trainee are temporally and behaviorally correlated, grouped splitting ensures that all rows for any given trainee remain strictly in either the training set or the test set, preventing trainee-identity leakage.
- **Training set**: 31 trainees, 522 rows, 184 positive cases (35.2% positive).
- **Test set**: 8 trainees, 155 rows, 32 positive cases (20.6% positive).

The exact trainee split IDs are serialized in `backend/app/ml/split.json`.

---

## Models and Threshold Selection
Candidate models were evaluated on the training set using 5-fold `GroupKFold` cross-validation grouped by `trainee_id`.
- **Majority Baseline**: Always predicts class 0.
- **Rule Baseline**: Predicts 1 if `last_3_mean_score < PASS_THRESHOLD` (60.0%), else 0.
- **Logistic Regression**: Features standardized with `StandardScaler`, `class_weight="balanced"`, `random_state=42`, `max_iter=1000`. The decision probability threshold was selected on training cross-validation out-of-fold predictions to reach recall $\ge 0.80$ with highest precision. Chosen threshold: **0.5300** (OOF recall = 0.8043, OOF precision = 0.9487).
- **Random Forest**: `n_estimators=200`, `class_weight="balanced"`, `random_state=42`. The decision probability threshold was selected on training cross-validation out-of-fold predictions to reach recall $\ge 0.80$ with highest precision. Chosen threshold: **0.6700** (OOF recall = 0.8098, OOF precision = 0.9675).

No hyperparameters were tuned beyond these settings.

---

## Results & Benchmark Comparison
The cross-validation and test set evaluation results from `model_results.json` are as follows:

| Model | CV Recall (mean ± std) | CV Precision (mean ± std) | Test Precision | Test Recall | Test F1 | Test ROC-AUC | Test PR-AUC | Test Confusion Matrix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Majority Baseline** | 0.0000 ± 0.0000 | 0.0000 ± 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.5000 | 0.2065 | `[[123, 0], [32, 0]]` |
| **Rule Baseline** | 1.0000 ± 0.0000 | 0.8574 ± 0.0731 | 0.8649 | 1.0000 | 0.9275 | 0.9797 | 0.8649 | `[[118, 5], [0, 32]]` |
| **Logistic Regression** | 0.8746 ± 0.1307 | 0.9234 ± 0.0590 | 0.9412 | 1.0000 | 0.9697 | 0.9995 | 0.9982 | `[[121, 2], [0, 32]]` |
| **Random Forest** | 0.8857 ± 0.1337 | 0.9522 ± 0.0399 | 0.9412 | 1.0000 | 0.9697 | 1.0000 | 1.0000 | `[[121, 2], [0, 32]]` |

---

## Permutation Sanity Check
To verify that the models learn actual signal rather than an artifact of dataset formatting, training set labels were randomly shuffled (`seed=42`) and Logistic Regression was retrained under the identical 5-fold grouped cross-validation setup:
- **Shuffled CV Recall**: $0.4072 \pm 0.1181$
- **Shuffled CV Precision**: $0.3199 \pm 0.0366$

Precision collapsed directly to baseline positive class prevalence ($35.2\%$), confirming that predictive capability drops to chance when labels are decoupled from features.

---

## Critical Governance Warnings & Known Limitations

### 1. Synthetic Circularity & Overfitting Warning
The high performance scores (Test F1 of 0.97, Test ROC-AUC of 1.0000) are substantially an artifact of **synthetic data generation circularity**:
- In the simulation script (`simulate_activity.py`), synthetic trainees are assigned fixed proficiency tiers (e.g. low-ability vs high-ability). Trainees assigned to lower proficiency tiers consistently generate scores below 60% with low standard deviation.
- Because features (`last_3_mean_score`, `overall_mean_score`, `last_1_score`) and the target label (`mean(next 2 sessions) < 60%`) evaluate performance against the **identical 60.0% cutoff**, the machine learning models learn a largely deterministic mathematical proxy.
- Real human students exhibit non-linear learning curves, sudden conceptual breakthroughs, external stress factors, and module-specific variances that break this circular correlation. In real-world educational deployment, performance metrics will inevitably degrade compared to these synthetic figures.

### 2. Small Sample Size Limits (8 Test Trainees)
The held-out test set comprises **only 8 distinct trainees** (155 decision rows, 32 positive cases).
- The difference between the simple deterministic Rule Baseline (5 false positives) and the Random Forest model (2 false positives) represents **a difference of only 3 student decision points**.
- In practical terms, this small difference is within statistical noise and does not prove that machine learning provides a significant pedagogical advantage over the deterministic 60% rule baseline.

### 3. Advisory-Only Mandate & Human Oversight
- Every inference response returned by `/analytics/trainees/{id}/risk`, `/analytics/trainees/{id}/ml-prediction`, `/analytics/batches/{batch_id}/ml-attention`, and `/help/trainer-copilot` explicitly injects `is_advisory: true` and the required governance disclaimer.
- **Prohibited Actions**: Trainers and administrators are strictly prohibited from using model risk flags to automate academic penalties, disciplinary actions, certification failures, or cohort dismissals. All flags must be independently verified by a human trainer through direct portfolio inspection and personal consultation.

### 4. Prohibition & Freeze of Speculative AI Features
- **Predictive "What-If" Simulators**: Interactive sliders predicting future outcomes under simulated interventions are **FROZEN**. Presenting unvalidated predictive simulations to trainers creates an illusion of certainty that could mislead instructional planning.
- **Cognitive Turbulence Telemetry**: Real-time behavioral tracking of video pause/rewind frequency is **FROZEN** pending formal privacy impact assessments, student consent policies, and pedagogical validation.
- **Autonomous Remediation Loops**: Automated assignment and closing of remedial drills without trainer confirmation is **FROZEN**. Human trainers must remain the sole decision-makers for curriculum remediation.
