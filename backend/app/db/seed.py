"""Database seed script for populating realistic test and demo data.
Generates reproducible cohorts, trainees, modules, performance trends, and admin accounts.
"""

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import text, func

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
    # Order: sessions -> users -> trainees -> modules -> batches
    db.query(Session).delete()
    db.query(User).delete()
    db.query(Trainee).delete()
    db.query(Module).delete()
    db.query(Batch).delete()
    db.commit()
    print("All tables cleared successfully.")

def seed_database(reset: bool = False) -> None:
    """Executes the deterministic database seeding pipeline."""
    # Ensure all tables exist in the target database
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
                # Ensure admin exists even if already seeded previously
                existing_admin = db.query(User).filter(User.email == "admin@example.com").first()
                if not existing_admin:
                    admin_user = User(
                        email="admin@example.com",
                        password_hash=hash_password("Admin123!"),
                        role="admin",
                        is_active=True,
                        trainee_id=None
                    )
                    db.add(admin_user)
                    db.commit()
                    print("Admin account seeded into existing database.")
                print("Already seeded")
                sys.exit(0)
            else:
                clear_tables(db)

        today_dt = datetime.now(timezone.utc)
        today_date = today_dt.date()

        # -------------------------------------------------------------
        # 1. Batches (5 batches with sensible start and end dates)
        # -------------------------------------------------------------
        batch_configs = [
            ("Batch A - Web Core", today_date - timedelta(weeks=16), today_date + timedelta(weeks=4)),
            ("Batch B - Data Systems", today_date - timedelta(weeks=14), today_date + timedelta(weeks=6)),
            ("Batch C - Cloud Native", today_date - timedelta(weeks=13), today_date + timedelta(weeks=7)),
            ("Batch D - Full Stack (Foundational)", today_date - timedelta(weeks=12), today_date + timedelta(weeks=8)),
            ("Batch E - DevOps & Architecture", today_date - timedelta(weeks=12), today_date + timedelta(weeks=8)),
        ]

        batches = []
        for name, start_d, end_d in batch_configs:
            batch = Batch(name=name, start_date=start_d, end_date=end_d)
            db.add(batch)
            batches.append(batch)
        db.flush()

        # -------------------------------------------------------------
        # 2. Modules (6 modules with required max_score values: 100, 50, 100, 20, 100, 50)
        # -------------------------------------------------------------
        module_configs = [
            ("Python Core & Data Structures", 100.0),
            ("SQL Modeling & PostgreSQL Operations", 50.0),
            ("FastAPI Services & REST Architecture", 100.0),
            ("Git Collaboration & Code Reviews", 20.0),
            ("System Security & Token Authentication", 100.0),
            ("Real-Time WebSockets & Streaming", 50.0),
        ]

        modules = []
        for name, max_sc in module_configs:
            mod = Module(name=name, max_score=max_sc)
            db.add(mod)
            modules.append(mod)
        db.flush()

        # -------------------------------------------------------------
        # 3. Trainees (50 total, exactly 10 per batch)
        # -------------------------------------------------------------
        trainees = []
        trainee_index = 0
        for batch in batches:
            for _ in range(10):
                trainee_index += 1
                first_name = fake.first_name()
                last_name = fake.last_name()
                full_name = f"{first_name} {last_name}"
                email = f"{first_name.lower()}.{last_name.lower()}{trainee_index}@training.internal"
                
                trainee = Trainee(
                    name=full_name,
                    email=email,
                    batch_id=batch.id
                )
                db.add(trainee)
                trainees.append(trainee)
        db.flush()

        # Designate Trainee 50 (last trainee) as the zero-sessions trainee to test empty state
        zero_session_trainee_id = trainees[-1].id

        # -------------------------------------------------------------
        # 4. Trainee Personas & Profiles
        # Distribution: ~60% improving, ~15% struggling, ~10% top performers, ~15% flat
        # -------------------------------------------------------------
        # We assign profiles to the 49 active trainees
        active_trainees = trainees[:-1]
        profiles = ["improving"] * 29 + ["struggling"] * 8 + ["top_performer"] * 5 + ["flat"] * 7
        random.shuffle(profiles)

        trainee_profiles = {}
        for trainee, profile in zip(active_trainees, profiles):
            trainee_profiles[trainee.id] = profile

        # -------------------------------------------------------------
        # 5. Sessions Generation (1500+ sessions over the last 12 weeks)
        # -------------------------------------------------------------
        # 49 active trainees * 34 sessions = 1666 sessions
        sessions_to_insert = []
        start_time_window = today_dt - timedelta(weeks=12)
        total_days = 84

        for trainee in active_trainees:
            profile = trainee_profiles[trainee.id]
            is_batch_d = (trainee.batch_id == batches[3].id)  # Batch D is weaker by ~15 points

            # Baseline ability percentage (0 - 100)
            if profile == "improving":
                base_start_pct = random.uniform(52.0, 60.0)
                improvement_gain = random.uniform(18.0, 25.0)  # Rises 15-25 points
            elif profile == "struggling":
                base_start_pct = random.uniform(38.0, 48.0)
                improvement_gain = random.uniform(-6.0, -1.0) # Declining or low
            elif profile == "top_performer":
                base_start_pct = random.uniform(90.0, 95.0)
                improvement_gain = random.uniform(1.0, 3.0)   # Consistently high
            else:  # flat
                base_start_pct = random.uniform(66.0, 72.0)
                improvement_gain = 0.0

            # Schedule 34 sessions spread across the 12 weeks for each trainee
            session_days = sorted(random.sample(range(1, total_days + 1), 34))

            for day_offset in session_days:
                time_fraction = day_offset / float(total_days)
                session_module = random.choice(modules)

                # Score percentage calculation
                current_pct = base_start_pct + (improvement_gain * time_fraction)
                if is_batch_d:
                    current_pct -= 15.0  # Batch D penalty

                # Add noise
                noise = random.uniform(-3.5, 3.5)
                final_pct = current_pct + noise

                # Bound percentage strictly between 0 and 100
                final_pct = max(0.0, min(100.0, final_pct))
                
                # Compute raw score according to module.max_score
                raw_score = (final_pct / 100.0) * session_module.max_score
                final_score = round(max(0.0, min(float(session_module.max_score), raw_score)), 1)

                # Error counts based on performance
                if profile == "improving":
                    base_err = 7.0 - (5.0 * time_fraction)
                elif profile == "struggling":
                    base_err = random.uniform(8.0, 14.0)
                elif profile == "top_performer":
                    base_err = random.uniform(0.0, 1.5)
                else:
                    base_err = random.uniform(3.0, 5.0)
                
                if is_batch_d:
                    base_err += random.uniform(2.0, 4.0)

                final_errors = max(0, int(round(base_err + random.uniform(-1.0, 1.0))))

                # Time in seconds (positive duration)
                if profile == "improving":
                    base_sec = 2400.0 - (1100.0 * time_fraction)
                elif profile == "struggling":
                    base_sec = random.uniform(2600.0, 3500.0)
                elif profile == "top_performer":
                    base_sec = random.uniform(700.0, 1200.0)
                else:
                    base_sec = random.uniform(1500.0, 1900.0)

                final_seconds = max(120, int(round(base_sec + random.uniform(-90.0, 90.0))))

                # Specific session timestamp
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
                    created_at=sess_time
                )
                sessions_to_insert.append(sess)

        # Batch insert sessions for high throughput
        db.bulk_save_objects(sessions_to_insert)
        db.flush()

        # -------------------------------------------------------------
        # 6. User Accounts with bcrypt-hashed passwords
        # admin@example.com / Admin123!
        # trainer@example.com / Trainer@123
        # trainee@example.com / Trainee@123 (linked to trainee[0])
        # -------------------------------------------------------------
        admin_user = User(
            email="admin@example.com",
            password_hash=hash_password("Admin123!"),
            role="admin",
            is_active=True,
            trainee_id=None
        )
        db.add(admin_user)

        trainer_user = User(
            email="trainer@example.com",
            password_hash=hash_password("Trainer@123"),
            role="trainer",
            is_active=True,
            trainee_id=None
        )
        db.add(trainer_user)

        # Link trainee user to trainee 1 who has complete session history
        trainee_user = User(
            email="trainee@example.com",
            password_hash=hash_password("Trainee@123"),
            role="trainee",
            is_active=True,
            trainee_id=trainees[0].id
        )
        db.add(trainee_user)
        db.commit()

        # -------------------------------------------------------------
        # 7. Print summary statistics & credentials
        # -------------------------------------------------------------
        total_batches = db.query(Batch).count()
        total_trainees = db.query(Trainee).count()
        total_modules = db.query(Module).count()
        total_sessions = db.query(Session).count()
        total_users = db.query(User).count()

        print("\n" + "=" * 60)
        print("SEEDING COMPLETE: SUMMARY REPORT")
        print("=" * 60)
        print(f"Batches inserted:  {total_batches}")
        print(f"Trainees inserted: {total_trainees}")
        print(f"Modules inserted:  {total_modules}")
        print(f"Sessions inserted: {total_sessions}")
        print(f"Users inserted:    {total_users}")
        print(f"Zero-session Trainee ID (Empty State Test): {zero_session_trainee_id} ({trainees[-1].name})")
        print("-" * 60)

        # Calculate and display Average Score per Batch (% of max_score)
        print("AVERAGE PERFORMANCE PER BATCH (SQL Aggregated):")
        batch_stats = db.execute(text("""
            SELECT 
                b.name AS batch_name,
                COUNT(s.id) AS session_count,
                ROUND(CAST(AVG((s.score / m.max_score) * 100) AS NUMERIC), 2) AS avg_score_pct
            FROM batches b
            JOIN trainees t ON t.batch_id = b.id
            LEFT JOIN sessions s ON s.trainee_id = t.id
            LEFT JOIN modules m ON m.id = s.module_id
            GROUP BY b.id, b.name
            ORDER BY b.name;
        """)).fetchall()

        for row in batch_stats:
            print(f"  • {row.batch_name:<38} | Sessions: {row.session_count:>4} | Avg Score: {row.avg_score_pct:>5}%")

        print("-" * 60)
        print("LOGIN CREDENTIALS (ROLE-BASED):")
        print("  [Trainer] Email: trainer@example.com | Password: Trainer@123")
        print(f"  [Trainee] Email: trainee@example.com | Password: Trainee@123 (Linked to Trainee: {trainees[0].name})")
        print("=" * 60 + "\n")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deterministic database seed script for Training Portal.")
    parser.add_argument("--reset", action="store_true", help="Truncate all tables and reseed from scratch.")
    args = parser.parse_args()
    seed_database(reset=args.reset)
