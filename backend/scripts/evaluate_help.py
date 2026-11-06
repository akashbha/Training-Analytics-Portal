"""Evaluation script for Stage 3 of help assistant retrieval with relevance floor comparison.
Evaluates 30 realistic questions across participant roles for hit@1, hit@3, role scoping, and refusal accuracy.
Compares candidate relevance floors (4.0, 5.0, 6.0) and records results to backend/app/ml/help_eval_results.json.
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional

# Ensure backend root is on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
env_file = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(env_file):
    load_dotenv(env_file)

from app.db.session import SyncSessionLocal
from app.services.help_service import help_search, ROLE_SCOPES, RELEVANCE_FLOOR
from scripts.build_help_index import build_index

def evaluate_single_floor(questions: List[Dict[str, Any]], db, floor_val: float) -> Dict[str, Any]:
    """Runs retrieval evaluation on the question suite using a specific relevance floor."""
    detailed_results = []
    in_scope_count = 0
    hit_1_count = 0
    hit_3_count = 0
    role_violation_count = 0
    out_of_scope_count = 0
    refusal_correct_count = 0
    misses = []

    for item in questions:
        q = item["question"]
        role = item["role"]
        expected = item["expected_heading"]
        must_not = item.get("must_not_role")

        # Execute search with specific floor
        results = help_search(query=q, role=role, limit=3, db=db, floor=floor_val)
        allowed_roles = ROLE_SCOPES.get(role, ["all"])

        # Check role violation
        has_role_violation = False
        for r in results:
            if r["role"] not in allowed_roles:
                has_role_violation = True
            if must_not and r["role"] == must_not:
                has_role_violation = True

        if has_role_violation:
            role_violation_count += 1

        if expected is None:
            # Out-of-scope question
            out_of_scope_count += 1
            refusal_correct = (len(results) == 0)
            if refusal_correct:
                refusal_correct_count += 1
            detailed_results.append({
                "question": q,
                "role": role,
                "expected_heading": None,
                "results_returned": len(results),
                "refusal_correct": refusal_correct,
                "role_violation": has_role_violation,
                "top_returned_heading": results[0]["heading"] if results else None
            })
        else:
            # In-scope question
            in_scope_count += 1
            hit_1 = (len(results) > 0 and results[0]["heading"] == expected)
            hit_3 = any(r["heading"] == expected for r in results)

            if hit_1:
                hit_1_count += 1
            if hit_3:
                hit_3_count += 1

            top_heading = results[0]["heading"] if results else None

            record = {
                "question": q,
                "role": role,
                "expected_heading": expected,
                "hit_at_1": hit_1,
                "hit_at_3": hit_3,
                "role_violation": has_role_violation,
                "top_returned_heading": top_heading,
                "results": results
            }
            detailed_results.append(record)

            if not hit_1:
                misses.append({
                    "question": q,
                    "role": role,
                    "expected_heading": expected,
                    "top_returned_heading": top_heading,
                    "hit_at_3": hit_3
                })

    hit_1_rate = round(hit_1_count / in_scope_count * 100, 1) if in_scope_count else 0.0
    hit_3_rate = round(hit_3_count / in_scope_count * 100, 1) if in_scope_count else 0.0
    refusal_rate = round(refusal_correct_count / out_of_scope_count * 100, 1) if out_of_scope_count else 0.0

    summary = {
        "floor": floor_val,
        "total_questions": len(questions),
        "in_scope_questions": in_scope_count,
        "out_of_scope_questions": out_of_scope_count,
        "hit_at_1_count": hit_1_count,
        "hit_at_1_pct": hit_1_rate,
        "hit_at_3_count": hit_3_count,
        "hit_at_3_pct": hit_3_rate,
        "role_violation_count": role_violation_count,
        "refusal_correct_count": refusal_correct_count,
        "refusal_accuracy_pct": refusal_rate
    }

    return {
        "summary": summary,
        "misses": misses,
        "detailed_results": detailed_results
    }

def run_evaluation(questions_file: Optional[str] = None) -> Dict[str, Any]:
    """Runs retrieval evaluation across candidate floors and writes results."""
    db = SyncSessionLocal()
    try:
        # Guarantee fresh help index synchronization
        build_index(db)

        if questions_file:
            if not os.path.isabs(questions_file):
                questions_path = os.path.abspath(os.path.join(BACKEND_DIR, questions_file)) if not os.path.exists(questions_file) else os.path.abspath(questions_file)
            else:
                questions_path = questions_file
        else:
            questions_path = os.path.join(BACKEND_DIR, "app", "ml", "help_eval_questions.json")

        with open(questions_path, "r", encoding="utf-8") as f:
            questions = json.load(f)

        # Candidate floor comparisons
        candidate_floors = [4.0, 5.0, 6.0]
        floor_evaluations = {}
        for f_val in candidate_floors:
            floor_evaluations[f_val] = evaluate_single_floor(questions, db, f_val)

        # Primary payload uses the configured RELEVANCE_FLOOR
        primary_eval = floor_evaluations[RELEVANCE_FLOOR]
        primary_eval["source_file"] = os.path.basename(questions_path)
        primary_eval["floor_comparisons"] = {
            str(f_val): floor_evaluations[f_val]["summary"]
            for f_val in candidate_floors
        }

        # Choose destination results filename based on input questions file
        base_name = os.path.splitext(os.path.basename(questions_path))[0]
        out_name = f"{base_name.replace('_questions', '')}_results.json"
        results_path = os.path.join(BACKEND_DIR, "app", "ml", out_name)
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(primary_eval, f, indent=2)

        return primary_eval
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="Evaluate help assistant documentation retrieval")
    parser.add_argument("--file", type=str, default=None, help="Relative or absolute path to questions JSON file")
    args = parser.parse_args()

    payload = run_evaluation(questions_file=args.file)
    s = payload["summary"]
    misses = payload["misses"]
    comparisons = payload.get("floor_comparisons", {})
    src_file = payload.get("source_file", "help_eval_questions.json")

    print("\n========================================================")
    print("      HELP ASSISTANT RETRIEVAL EVALUATION REPORT        ")
    print("========================================================")
    print(f"Evaluation File Source    : {src_file}")
    print(f"Total Questions Evaluated : {s['total_questions']}")
    print(f"In-Scope Questions        : {s['in_scope_questions']}")
    print(f"Out-of-Scope Questions    : {s['out_of_scope_questions']}")
    print(f"Configured RELEVANCE_FLOOR: {s['floor']}")
    print("--------------------------------------------------------")
    print(f"Hit at 1                  : {s['hit_at_1_count']}/{s['in_scope_questions']} ({s['hit_at_1_pct']}%)")
    print(f"Hit at 3                  : {s['hit_at_3_count']}/{s['in_scope_questions']} ({s['hit_at_3_pct']}%)")
    print(f"Role Violations           : {s['role_violation_count']}")
    print(f"Refusal Accuracy          : {s['refusal_correct_count']}/{s['out_of_scope_questions']} ({s['refusal_accuracy_pct']}%)")
    print("========================================================")

    print("\nFloor Sensitivity Comparison (Tuned on Current Set):")
    print("-" * 75)
    print(f"{'Floor':<8} | {'In-Scope Hit@1':<18} | {'In-Scope Hit@3':<18} | {'Refusal Accuracy':<18}")
    print("-" * 75)
    for f_str, comp in comparisons.items():
        hit1_str = f"{comp['hit_at_1_count']}/{comp['in_scope_questions']} ({comp['hit_at_1_pct']}%)"
        hit3_str = f"{comp['hit_at_3_count']}/{comp['in_scope_questions']} ({comp['hit_at_3_pct']}%)"
        ref_str = f"{comp['refusal_correct_count']}/{comp['out_of_scope_questions']} ({comp['refusal_accuracy_pct']}%)"
        marker = " (Selected)" if float(f_str) == RELEVANCE_FLOOR else ""
        print(f"{f_str:<8} | {hit1_str:<18} | {hit3_str:<18} | {ref_str:<18}{marker}")
    print("-" * 75)

    print(f"\nList of Misses at 1 ({len(misses)} total at floor {s['floor']}):")
    print("-" * 75)
    if not misses:
        print("  None. All in-scope questions matched top-1.")
    else:
        for idx, m in enumerate(misses, 1):
            hit3_tag = "[Hit at 3: YES]" if m['hit_at_3'] else "[Hit at 3: NO]"
            print(f"{idx}. Role: {m['role']} {hit3_tag}")
            print(f"   Question: \"{m['question']}\"")
            print(f"   Expected: {m['expected_heading']}")
            print(f"   Top Hit : {m['top_returned_heading']}")
            print()
    print("-" * 75)

if __name__ == "__main__":
    main()
