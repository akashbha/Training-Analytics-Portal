"""Evaluation script for Stage 3 of help assistant retrieval.
Evaluates 30 realistic questions across participant roles for hit@1, hit@3, role scoping, and refusal accuracy.
Writes detailed evaluation results to backend/app/ml/help_eval_results.json.
"""

import os
import sys
import json
from typing import List, Dict, Any

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
from app.services.help_service import help_search, ROLE_SCOPES
from scripts.build_help_index import build_index

def run_evaluation() -> Dict[str, Any]:
    """Runs retrieval evaluation and computes accuracy metrics."""
    db = SyncSessionLocal()
    try:
        # Guarantee fresh help index synchronization
        build_index(db)

        questions_path = os.path.join(BACKEND_DIR, "app", "ml", "help_eval_questions.json")
        with open(questions_path, "r", encoding="utf-8") as f:
            questions = json.load(f)

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

            # Execute search
            results = help_search(query=q, role=role, limit=3, db=db)
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

        eval_payload = {
            "summary": summary,
            "misses": misses,
            "detailed_results": detailed_results
        }

        results_path = os.path.join(BACKEND_DIR, "app", "ml", "help_eval_results.json")
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(eval_payload, f, indent=2)

        return eval_payload
    finally:
        db.close()

def main():
    payload = run_evaluation()
    s = payload["summary"]
    misses = payload["misses"]

    print("\n========================================================")
    print("      HELP ASSISTANT RETRIEVAL EVALUATION REPORT        ")
    print("========================================================")
    print(f"Total Questions Evaluated : {s['total_questions']}")
    print(f"In-Scope Questions        : {s['in_scope_questions']}")
    print(f"Out-of-Scope Questions    : {s['out_of_scope_questions']}")
    print("--------------------------------------------------------")
    print(f"Hit at 1                  : {s['hit_at_1_count']}/{s['in_scope_questions']} ({s['hit_at_1_pct']}%)")
    print(f"Hit at 3                  : {s['hit_at_3_count']}/{s['in_scope_questions']} ({s['hit_at_3_pct']}%)")
    print(f"Role Violations           : {s['role_violation_count']}")
    print(f"Refusal Accuracy          : {s['refusal_correct_count']}/{s['out_of_scope_questions']} ({s['refusal_accuracy_pct']}%)")
    print("========================================================")

    print(f"\nList of Misses at 1 ({len(misses)} total):")
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
