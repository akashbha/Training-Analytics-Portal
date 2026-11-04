"""Database seed script for populating realistic test and demo data.
Generates reproducible cohorts, trainees, modules, performance trajectories, and credentials.
Implements:
- 5 normalized batches
- 45 trainees with uneven session counts (0 sessions, 1-2 cold-start sessions, dropouts, 10-35 active)
- 7 modules with varied max_scores (100, 50, 20)
- ~3 months of sessions with realistic noise, improving trajectories, and plateaus
- Idempotent execution with --reset flag
- Summary report printing per-batch session counts and averages
"""

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import text

from app.core.constants import (
    PASS_THRESHOLD,
    EXCELLENT_THRESHOLD,
    COLD_START_SESSIONS,
    COLD_START_CUTOFF,
)
from app.db.base import Base
from app.db.session import sync_engine, SyncSessionLocal
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session
from app.models.user import User

# Password hashing context using standard bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt for secure storage."""
    return pwd_context.hash(password)


def clear_tables(db) -> None:
    """Truncates all tables in strict foreign-key dependency order."""
    print("Clearing existing data in cascade-safe order...")
    # Dependency order: sessions -> users -> trainees -> modules -> batches
    db.query(Session).delete()
    db.query(User).delete()
    db.query(Trainee).delete()
    db.query(Module).delete()
    db.query(Batch).delete()
    db.commit()
    print("All tables cleared successfully.")


def seed_database(reset: bool = False) -> None:
    """Executes the deterministic database seeding pipeline."""
    Base.metadata.create_all(bind=sync_engine)

    # Deterministic pseudo-random generators
    random.seed(42)
    Faker.seed(42)
    fake = Faker()

    db = SyncSessionLocal()

    try:
        # Check idempotency
        existing_batches = db.query(Batch).count()
        if existing_batches > 0:
            if not reset:
                print("Database is already seeded. Pass '--reset' to wipe and reseed.")
                return
            else:
                clear_tables(db)

        today_dt = datetime.now(timezone.utc)
        today_date = today_dt.date()

        # -------------------------------------------------------------
        # 1. Batches (5 cohorts with normalized scheme: "Batch <Letter> - <Discipline>")
        # -------------------------------------------------------------
        batch_configs = [
            ("Batch A - Web Core", today_date - timedelta(weeks=16), today_date + timedelta(weeks=4)),
            ("Batch B - Data Systems", today_date - timedelta(weeks=14), today_date + timedelta(weeks=6)),
            ("Batch C - Cloud Native", today_date - timedelta(weeks=13), today_date + timedelta(weeks=7)),
            ("Batch D - Full Stack", today_date - timedelta(weeks=12), today_date + timedelta(weeks=8)),
            ("Batch E - DevOps & Architecture", today_date - timedelta(weeks=12), today_date + timedelta(weeks=8)),
        ]

        batches = []
        for name, start_d, end_d in batch_configs:
            batch = Batch(name=name, start_date=start_d, end_date=end_d)
            db.add(batch)
            batches.append(batch)
        db.flush()

        # -------------------------------------------------------------
        # 2. Modules (7 modules with required max_scores: 100, 50, and 20)
        # -------------------------------------------------------------
        module_configs = [
            ("Python Core & Data Structures", 100.0),
            ("SQL Modeling & PostgreSQL Operations", 50.0),
            ("FastAPI REST Architecture", 100.0),
            ("Git Version Control & Workflow", 20.0),
            ("System Security & Token Authentication", 100.0),
            ("Docker & Container Virtualization", 50.0),
            ("Continuous Integration & Deployment", 20.0),
        ]

        modules = []
        for name, max_sc in module_configs:
            mod = Module(name=name, max_score=max_sc)
            db.add(mod)
            modules.append(mod)
        db.flush()

        # -------------------------------------------------------------
        # 3. Trainees (45 trainees total: 9 per batch)
        # -------------------------------------------------------------
        trainees = []
        trainee_index = 0
        for batch in batches:
            for _ in range(9):
                trainee_index += 1
                first_name = fake.first_name()
                last_name = fake.last_name()
                full_name = f"{first_name} {last_name}"
                email = f"{first_name.lower()}.{last_name.lower()}{trainee_index}@training.internal"

                trainee = Trainee(
                    name=full_name,
                    email=email,
                    batch_id=batch.id,
                )
                db.add(trainee)
                trainees.append(trainee)
        db.flush()

        # -------------------------------------------------------------
        # 4. Trainee Behavioral Personas & Session Count Distribution
        # Requirements:
        # - Some 0 sessions (empty state test)
        # - Some 1-2 sessions (cold-start test)
        # - Some dropouts (stopped attending partway through)
        # - Most 10-35 sessions (improving, plateauing, struggling, top performer)
        # -------------------------------------------------------------
        # Trainee 0 to 44 (45 total)
        # Trainee 43 & 44: 0 sessions (Empty state)
        # Trainee 41 & 42: 1-2 sessions (Cold-start: one low < 50%, one high >= 50%)
        # Trainee 38 to 40: Dropouts (stopped attending around week 4)
        # Trainees 0 to 37: Active (improving, plateauing, struggling, top performers) with 12 to 34 sessions

        trainee_plans = {}

        # 0 sessions
        trainee_plans[trainees[44].id] = {"persona": "empty", "count": 0, "max_day": 0}
        trainee_plans[trainees[43].id] = {"persona": "empty", "count": 0, "max_day": 0}

        # 1-2 sessions (Cold-start)
        trainee_plans[trainees[42].id] = {"persona": "cold_start_low", "count": 2, "max_day": 14}
        trainee_plans[trainees[41].id] = {"persona": "cold_start_high", "count": 2, "max_day": 14}

        # Dropouts (stopped attending after ~25 days)
        trainee_plans[trainees[40].id] = {"persona": "dropout", "count": 6, "max_day": 25}
        trainee_plans[trainees[39].id] = {"persona": "dropout", "count": 7, "max_day": 28}
        trainee_plans[trainees[38].id] = {"persona": "dropout", "count": 5, "max_day": 22}

        # Remaining 38 trainees: mix of improving, plateauing, struggling, top performers (10-35 sessions)
        persona_pool = (
            ["improving"] * 18 +
            ["plateauing"] * 8 +
            ["struggling"] * 7 +
            ["top_performer"] * 5
        )
        random.shuffle(persona_pool)

        for t, persona in zip(trainees[:38], persona_pool):
            session_count = random.randint(14, 34)
            trainee_plans[t.id] = {"persona": persona, "count": session_count, "max_day": 84}

        # -------------------------------------------------------------
        # 5. Longitudinal Sessions Generation over ~3 months (84 days)
        # -------------------------------------------------------------
        sessions_to_insert = []
        start_time_window = today_dt - timedelta(days=84)
        total_days = 84

        for trainee in trainees:
            plan = trainee_plans[trainee.id]
            count = plan["count"]
            if count == 0:
                continue

            persona = plan["persona"]
            max_day = plan["max_day"]
            is_batch_d = (trainee.batch_id == batches[3].id)  # Batch D weaker by ~12 points

            # Baseline ability percentage (0 - 100)
            if persona == "improving":
                base_start_pct = random.uniform(52.0, PASS_THRESHOLD)
                improvement_gain = random.uniform(18.0, 24.0)  # Progresses to ~75-80%
            elif persona == "plateauing":
                base_start_pct = random.uniform(64.0, 71.0)
                improvement_gain = random.uniform(-1.5, 2.0)   # Stagnant around 65-70%
            elif persona == "struggling":
                base_start_pct = random.uniform(40.0, 48.0)
                improvement_gain = random.uniform(-6.0, -1.0)  # Declining or low
            elif persona == "top_performer":
                base_start_pct = random.uniform(88.0, 94.0)
                improvement_gain = random.uniform(1.0, 4.0)
            elif persona == "cold_start_low":
                base_start_pct = random.uniform(35.0, COLD_START_CUTOFF - 6.0)
                improvement_gain = 0.0
            elif persona == "cold_start_high":
                base_start_pct = random.uniform(COLD_START_CUTOFF + 15.0, 75.0)
                improvement_gain = 0.0
            elif persona == "dropout":
                base_start_pct = random.uniform(48.0, 58.0)
                improvement_gain = -10.0
            else:
                base_start_pct = 60.0
                improvement_gain = 0.0

            # Distribute sessions across available days
            sampled_days = sorted(random.sample(range(1, max_day + 1), count))

            for day_offset in sampled_days:
                time_fraction = day_offset / float(total_days)
                session_module = random.choice(modules)

                # Score calculation with progressive trend and noise
                current_pct = base_start_pct + (improvement_gain * time_fraction)
                if is_batch_d:
                    current_pct -= 12.0

                noise = random.uniform(-3.5, 3.5)
                final_pct = max(0.0, min(100.0, current_pct + noise))

                # Raw score according to module.max_score
                raw_score = (final_pct / 100.0) * session_module.max_score
                final_score = round(max(0.0, min(float(session_module.max_score), raw_score)), 1)

                # Errors
                if persona == "top_performer":
                    base_err = random.uniform(0.0, 1.5)
                elif persona == "improving":
                    base_err = max(1.0, 7.0 - (5.0 * time_fraction))
                elif persona == "struggling":
                    base_err = random.uniform(7.0, 13.0)
                else:
                    base_err = random.uniform(3.0, 6.0)

                final_errors = max(0, int(round(base_err + random.uniform(-1.0, 1.0))))

                # Duration in seconds (2 to 50 minutes)
                if persona == "top_performer":
                    base_sec = random.uniform(700.0, 1100.0)
                elif persona == "improving":
                    base_sec = max(900.0, 2200.0 - (900.0 * time_fraction))
                else:
                    base_sec = random.uniform(1400.0, 2400.0)

                final_seconds = max(120, int(round(base_sec + random.uniform(-60.0, 60.0))))

                # Timestamp
                sess_time = start_time_window + timedelta(
                    days=day_offset,
                    hours=random.randint(9, 17),
                    minutes=random.randint(0, 59),
                    seconds=random.randint(0, 59)
                )

                sess = Session(
                    trainee_id=trainee.id,
                    module_id=session_module.id,
                    score=final_score,
                    errors=final_errors,
                    time_seconds=final_seconds,
                    created_at=sess_time,
                )
                sessions_to_insert.append(sess)

        # Batch insert sessions
        db.bulk_save_objects(sessions_to_insert)
        db.flush()

        # -------------------------------------------------------------
        # 6. User Accounts with bcrypt-hashed passwords
        # -------------------------------------------------------------
        admin_user = User(
            email="admin@example.com",
            password_hash=hash_password("Admin123!"),
            role="admin",
            is_active=True,
            trainee_id=None,
        )
        trainer_user = User(
            email="trainer@example.com",
            password_hash=hash_password("Trainer@123"),
            role="trainer",
            is_active=True,
            trainee_id=None,
        )
        trainee_user = User(
            email="trainee@example.com",
            password_hash=hash_password("Trainee@123"),
            role="trainee",
            is_active=True,
            trainee_id=trainees[0].id,
        )
        db.add_all([admin_user, trainer_user, trainee_user])
        db.commit()

        # -------------------------------------------------------------
        # 7. Summary Report
        # -------------------------------------------------------------
        total_batches = db.query(Batch).count()
        total_trainees = db.query(Trainee).count()
        total_modules = db.query(Module).count()
        total_sessions = db.query(Session).count()
        total_users = db.query(User).count()

        print("\n" + "=" * 64)
        print("SEEDING COMPLETE: SUMMARY REPORT")
        print("=" * 64)
        print(f"Batches inserted:  {total_batches}")
        print(f"Trainees inserted: {total_trainees}")
        print(f"Modules inserted:  {total_modules} (max_scores: 100, 50, 20)")
        print(f"Sessions inserted: {total_sessions} (~3 months longitudinal data)")
        print(f"Users inserted:    {total_users}")
        print(f"Empty-state Trainees: ID {trainees[43].id} & {trainees[44].id} (0 sessions)")
        print(f"Cold-start Trainees:  ID {trainees[41].id} (high) & {trainees[42].id} (low < 50%)")
        print(f"Dropout Trainees:     ID {trainees[38].id}, {trainees[39].id}, {trainees[40].id} (stopped early)")
        print("-" * 64)

        # SQL aggregated batch performance
        print("AVERAGE PERFORMANCE PER BATCH (SQL Aggregated):")
        batch_stats = db.execute(text("""
            SELECT 
                b.name AS batch_name,
                COUNT(s.id) AS session_count,
                ROUND(CAST(AVG(CAST(s.score AS FLOAT) * 100.0 / CAST(m.max_score AS FLOAT)) AS NUMERIC), 2) AS avg_score_pct
            FROM batches b
            JOIN trainees t ON t.batch_id = b.id
            LEFT JOIN sessions s ON s.trainee_id = t.id
            LEFT JOIN modules m ON m.id = s.module_id
            GROUP BY b.id, b.name
            ORDER BY b.name;
        """)).fetchall()

        for row in batch_stats:
            avg_disp = f"{row.avg_score_pct}%" if row.avg_score_pct is not None else "N/A"
            print(f"  - {row.batch_name:<38} | Sessions: {row.session_count:>4} | Avg Score: {avg_disp:>7}")

        print("-" * 64)
        print("CREDENTIALS:")
        print("  [Admin]   Email: admin@example.com   | Password: Admin123!")
        print("  [Trainer] Email: trainer@example.com | Password: Trainer@123")
        print(f"  [Trainee] Email: trainee@example.com | Password: Trainee@123 (Linked to: {trainees[0].name})")
        print("=" * 64 + "\n")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Deterministic database seed script for Training Portal.")
    parser.add_argument("--reset", action="store_true", help="Truncate all tables and reseed from scratch.")
    args = parser.parse_args()
    seed_database(reset=args.reset)


if __name__ == "__main__":
    main()

