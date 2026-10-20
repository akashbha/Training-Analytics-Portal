"""Activity simulation script generating live assessment sessions for demonstration dashboards.
Logs in with trainer credentials, submits randomized valid performance records, and handles interrupts gracefully.
"""

import argparse
import random
import sys
import time
import requests

def run_simulation(
    base_url: str = "http://localhost:8000",
    email: str = "trainer@example.com",
    password: str = "Trainer@123",
    interval: float = 5.0
) -> None:
    """Executes a continuous live session generation loop until interrupted by user."""
    session = requests.Session()
    login_url = f"{base_url.rstrip('/')}/auth/login"

    print(f"Logging in to {login_url} as '{email}'...")
    try:
        login_res = session.post(login_url, json={"email": email, "password": password}, timeout=10)
        if login_res.status_code != 200:
            print(f"Login failed (HTTP {login_res.status_code}): {login_res.text}", file=sys.stderr)
            sys.exit(1)

        token = login_res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    except requests.RequestException as exc:
        print(f"Connection error connecting to {base_url}: {exc}", file=sys.stderr)
        sys.exit(1)

    print("Authenticated successfully. Loading active trainees and curriculum modules...")
    trainees_res = session.get(f"{base_url.rstrip('/')}/trainees?page_size=100", headers=headers, timeout=10)
    modules_res = session.get(f"{base_url.rstrip('/')}/modules?page_size=100", headers=headers, timeout=10)

    if trainees_res.status_code != 200 or modules_res.status_code != 200:
        print("Failed to retrieve trainees or modules.", file=sys.stderr)
        sys.exit(1)

    trainees = trainees_res.json().get("items", [])
    modules = modules_res.json().get("items", [])

    if not trainees or not modules:
        print("Error: No trainees or modules found. Run the seed script first: python -m app.db.seed", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(trainees)} trainees and {len(modules)} assessment modules.")
    print(f"Starting live session stream every {interval}s. Press Ctrl+C to stop.\n" + "-" * 70)

    submitted_count = 0
    try:
        while True:
            trainee = random.choice(trainees)
            module = random.choice(modules)

            # Performance percentage between 50% and 98%
            pct = random.uniform(0.50, 0.98)
            score = round(pct * module["max_score"], 1)
            # Ensure score never exceeds max_score
            score = min(score, float(module["max_score"]))

            errors = max(0, int(round(random.uniform(0, 4))))
            duration = random.randint(700, 2100)

            payload = {
                "trainee_id": trainee["id"],
                "module_id": module["id"],
                "score": score,
                "errors": errors,
                "time_seconds": duration
            }

            post_res = session.post(f"{base_url.rstrip('/')}/sessions", json=payload, headers=headers, timeout=10)
            if post_res.status_code == 201:
                submitted_count += 1
                created_session = post_res.json()
                print(
                    f"[{submitted_count:>3}] Session #{created_session['id']:<4} | "
                    f"Trainee: {trainee['name']:<22} | "
                    f"Module: {module['name'][:22]:<22} | "
                    f"Score: {score:>5.1f}/{module['max_score']} ({created_session['score_percentage']}%) | "
                    f"Errors: {errors} | Time: {duration}s"
                )
            else:
                print(f"Failed to post session (HTTP {post_res.status_code}): {post_res.text}", file=sys.stderr)

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n" + "-" * 70)
        print(f"Live simulation stopped cleanly by user. Total sessions created: {submitted_count}")
        sys.exit(0)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live session generator for Training Portal demo.")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Root URL of the FastAPI backend.")
    parser.add_argument("--email", default="trainer@example.com", help="Trainer account email address.")
    parser.add_argument("--password", default="Trainer@123", help="Trainer account password.")
    parser.add_argument("--interval", type=float, default=5.0, help="Interval between sessions in seconds.")
    args = parser.parse_args()

    run_simulation(
        base_url=args.base_url,
        email=args.email,
        password=args.password,
        interval=args.interval
    )
