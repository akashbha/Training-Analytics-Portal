# Model Card: Trainee Early Intervention Risk Model

## Target
The target label is a binary risk indicator for trainee performance on subsequent assessments. For each decision point k (where k is at least 5), the label is 1 if the mean score percentage of the next 2 sessions (sessions k + 1 and k + 2) is strictly below PASS_THRESHOLD (60.0 percent, imported from app.core.constants). Otherwise, the label is 0.

## Data
The dataset source is the seeded local SQLite database, which consists of synthetic trainee assessment data. The database contains 45 trainees in total. Trainees with fewer than 7 recorded sessions cannot form a valid decision point because at least 5 historical sessions and 2 future sessions are required. This leaves 39 trainees who contribute to the dataset. The generated dataset contains 677 rows with 216 positive cases, corresponding to a positive class rate of 31.9 percent.

## Features
Each row represents a single decision point for a trainee and uses only sessions completed strictly before that decision point. The 8 features are:
1. last_1_score: Score percentage achieved on the most recent prior assessment session.
2. last_3_mean_score: Arithmetic mean of score percentages across the last 3 prior assessment sessions.
3. overall_mean_score: Arithmetic mean of score percentages across all prior assessment sessions up to the decision point.
4. slope_last_5: Linear regression slope over the score percentages of the last 5 prior assessment sessions.
5. error_rate: Mean error count per session across all prior assessment sessions.
6. mean_time: Mean session duration in seconds across all prior assessment sessions.
7. session_count: Count of prior assessment sessions available at the decision point (k >= 5).
8. score_std: Standard deviation of score percentages across all prior assessment sessions up to the decision point.

## Split
The dataset is split by trainee using GroupShuffleSplit with test_size=0.2 and random_state=42. Because individual decision points for the same trainee are correlated, grouped splitting ensures that all rows for a given trainee remain strictly in either the training set or the test set.
- Training set: 31 trainees, 522 rows, 184 positive cases (35.2 percent positive).
- Test set: 8 trainees, 155 rows, 32 positive cases (20.6 percent positive).
The trainee identifier lists are stored in backend/app/ml/split.json.

## Models and Thresholds
The candidate models were evaluated on the training set using 5-fold GroupKFold cross-validation grouped by trainee_id.
- Majority Baseline: Always predicts class 0.
- Rule Baseline: Predicts 1 if last_3_mean_score < PASS_THRESHOLD (60.0 percent), else 0.
- Logistic Regression: Features standardized with StandardScaler, class_weight="balanced", random_state=42, max_iter=1000. The probability threshold was chosen on training cross-validation out-of-fold predictions to reach recall >= 0.80 with highest precision. The chosen threshold is 0.5300 (out-of-fold recall = 0.8043, out-of-fold precision = 0.9487).
- Random Forest: n_estimators=200, class_weight="balanced", random_state=42. The probability threshold was chosen on training cross-validation out-of-fold predictions to reach recall >= 0.80 with highest precision. The chosen threshold is 0.6700 (out-of-fold recall = 0.8098, out-of-fold precision = 0.9675).

No hyperparameters were tuned beyond these settings.

## Results
The cross-validation and test set evaluation results from model_results.json are as follows:

| Model | CV Recall (mean +/- std) | CV Precision (mean +/- std) | Test Precision | Test Recall | Test F1 | Test ROC-AUC | Test PR-AUC | Test Confusion Matrix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Majority Baseline | 0.0000 +/- 0.0000 | 0.0000 +/- 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.5000 | 0.2065 | [[123, 0], [32, 0]] |
| Rule Baseline | 1.0000 +/- 0.0000 | 0.8574 +/- 0.0731 | 0.8649 | 1.0000 | 0.9275 | 0.9797 | 0.8649 | [[118, 5], [0, 32]] |
| Logistic Regression | 0.8746 +/- 0.1307 | 0.9234 +/- 0.0590 | 0.9412 | 1.0000 | 0.9697 | 0.9995 | 0.9982 | [[121, 2], [0, 32]] |
| Random Forest | 0.8857 +/- 0.1337 | 0.9522 +/- 0.0399 | 0.9412 | 1.0000 | 0.9697 | 1.0000 | 1.0000 | [[121, 2], [0, 32]] |

Note on test evaluation: The test set metrics were computed and printed three times during development. First during threshold candidate inspection, second during initial pipeline execution, and third after updating JSON float rounding in the script. The model settings were fixed and were not tuned further based on the test set.

## Permutation Check
To verify that the model learns actual signal rather than an artifact of dataset construction, training set labels were randomly shuffled (seed 42) and Logistic Regression was retrained under the same 5-fold grouped cross-validation setup.
- Shuffled CV Recall: 0.4072 +/- 0.1181.
- Shuffled CV Precision: 0.3199 +/- 0.0366.
The precision drops directly to the baseline positive frequency (35.2 percent on train), and recall drops to 0.4072, confirming that learned predictive ability collapses to chance when labels are decoupled from features.

## Limitations
1. Synthetic Data: All records are generated by simulation scripts and do not reflect real human learning behaviors or authentic grading distributions.
2. Small Test Set: The test set consists of only 8 trainees (155 rows, 32 positive cases). The observed difference between the rule baseline (5 false positives) and the machine learning models (2 false positives) corresponds to only 3 rows and is within noise.
3. Shared Cutoff: The label uses the same 60% cutoff as the rule baseline. As a result, the models primarily learn to predict future adherence to this predefined cutoff rather than an independent external criterion.
4. Proxy Target: The target is a synthetic proxy (average score on next 2 sessions) rather than an observed educational outcome such as course completion, certification pass, or job placement.
5. High AUC Caveat: Test ROC-AUC values of 0.9995 and 1.0000 reflect the simplicity and consistency of the synthetic generator across these 8 test trainees and will not generalize to real classroom data.
6. No Real Student Data: The model has not been validated on real student or trainee data and must not be used for high-stakes decisions without clinical validation on authentic cohorts.
7. Development Test Exposures: The test set was computed three times during development. While thresholds were fixed on training cross-validation, the test metrics were visible during iteration.

