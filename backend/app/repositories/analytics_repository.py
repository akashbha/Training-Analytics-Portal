"""SQL-only analytics repository executing mathematical aggregations and window functions.
Uses ANSI standard CAST() syntax to prevent SQLAlchemy bind parameter syntax collisions.
"""

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.batch import Batch
from app.models.trainee import Trainee

class AnalyticsRepository:
    """Repository executing pure SQL aggregations for analytical dashboards."""
    def __init__(self, db: Session):
        self.db = db
        self.dialect_name = db.bind.dialect.name if db.bind else "postgresql"

    # =========================================================================
    # 1. BATCH SUMMARY (Pure SQL with date comparison intervals)
    # =========================================================================
    def get_batch_summary(
        self,
        batch_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Optional[Dict[str, Any]]:
        """Computes cohort session metrics, pass rates, and 4-week score change in SQL."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        date_clauses = ""
        params: Dict[str, Any] = {"batch_id": batch_id}

        if from_date:
            date_clauses += " AND s.created_at >= :from_date"
            params["from_date"] = datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc)
        if to_date:
            date_clauses += " AND s.created_at <= :to_date"
            params["to_date"] = datetime.combine(to_date, datetime.max.time(), tzinfo=timezone.utc)

        now_utc = datetime.now(timezone.utc)
        params["recent_cutoff"] = now_utc - timedelta(days=28)
        params["prior_cutoff"] = now_utc - timedelta(days=56)

        if self.dialect_name == "postgresql":
            sql = f"""
            WITH cohort_trainees AS (
                SELECT id FROM trainees WHERE batch_id = :batch_id
            ),
            session_metrics AS (
                SELECT 
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct,
                    s.errors,
                    s.time_seconds,
                    s.created_at
                FROM sessions s
                JOIN modules m ON m.id = s.module_id
                WHERE s.trainee_id IN (SELECT id FROM cohort_trainees)
                {date_clauses}
            ),
            period_comparisons AS (
                SELECT
                    AVG(CASE WHEN created_at >= :recent_cutoff THEN score_pct END) AS recent_avg,
                    AVG(CASE WHEN created_at >= :prior_cutoff AND created_at < :recent_cutoff THEN score_pct END) AS prior_avg
                FROM session_metrics
            )
            SELECT 
                (SELECT COUNT(*) FROM cohort_trainees) AS trainee_count,
                COUNT(sm.id) AS session_count,
                ROUND(CAST(AVG(sm.score_pct) AS NUMERIC), 1) AS avg_score_pct,
                ROUND(CAST(AVG(CASE WHEN sm.score_pct >= 50.0 THEN 100.0 ELSE 0.0 END) AS NUMERIC), 1) AS pass_rate_pct,
                ROUND(CAST(AVG(sm.errors) AS NUMERIC), 1) AS avg_errors,
                ROUND(CAST(AVG(sm.time_seconds) AS NUMERIC), 1) AS avg_time_seconds,
                ROUND(CAST(pc.recent_avg - pc.prior_avg AS NUMERIC), 1) AS avg_score_change_pct
            FROM period_comparisons pc
            LEFT JOIN session_metrics sm ON true
            GROUP BY pc.recent_avg, pc.prior_avg;
            """
        else:
            # SQLite variant
            sql = f"""
            WITH cohort_trainees AS (
                SELECT id FROM trainees WHERE batch_id = :batch_id
            ),
            session_metrics AS (
                SELECT 
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct,
                    s.errors,
                    s.time_seconds,
                    s.created_at
                FROM sessions s
                JOIN modules m ON m.id = s.module_id
                WHERE s.trainee_id IN (SELECT id FROM cohort_trainees)
                {date_clauses}
            ),
            period_comparisons AS (
                SELECT
                    AVG(CASE WHEN created_at >= :recent_cutoff THEN score_pct END) AS recent_avg,
                    AVG(CASE WHEN created_at >= :prior_cutoff AND created_at < :recent_cutoff THEN score_pct END) AS prior_avg
                FROM session_metrics
            )
            SELECT 
                (SELECT COUNT(*) FROM cohort_trainees) AS trainee_count,
                COUNT(sm.id) AS session_count,
                ROUND(AVG(sm.score_pct), 1) AS avg_score_pct,
                ROUND(AVG(CASE WHEN sm.score_pct >= 50.0 THEN 100.0 ELSE 0.0 END), 1) AS pass_rate_pct,
                ROUND(AVG(sm.errors), 1) AS avg_errors,
                ROUND(AVG(sm.time_seconds), 1) AS avg_time_seconds,
                ROUND(pc.recent_avg - pc.prior_avg, 1) AS avg_score_change_pct
            FROM period_comparisons pc
            LEFT JOIN session_metrics sm ON 1=1
            GROUP BY pc.recent_avg, pc.prior_avg;
            """

        row = self.db.execute(text(sql), params).fetchone()
        return {
            "batch_id": batch.id,
            "batch_name": batch.name,
            "trainee_count": int(row[0]) if row and row[0] is not None else 0,
            "session_count": int(row[1]) if row and row[1] is not None else 0,
            "avg_score_pct": float(row[2]) if row and row[2] is not None else None,
            "pass_rate_pct": float(row[3]) if row and row[3] is not None else None,
            "avg_errors": float(row[4]) if row and row[4] is not None else None,
            "avg_time_seconds": float(row[5]) if row and row[5] is not None else None,
            "avg_score_change_pct": float(row[6]) if row and row[6] is not None else None,
        }

    # =========================================================================
    # 2. BATCH WEEKLY TREND (Honors from_date, ANSI CAST, continuous series)
    # =========================================================================
    def get_batch_weekly(
        self,
        batch_id: int,
        weeks: int = 8,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Generates continuous calendar weeks series respecting from_date filter."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        # If from_date is specified, start week progression from from_date week
        if from_date:
            first_week_start = from_date - timedelta(days=from_date.weekday())
            last_week_start = first_week_start + timedelta(weeks=weeks - 1)
        else:
            today = to_date or datetime.now(timezone.utc).date()
            current_week_start = today - timedelta(days=today.weekday())
            first_week_start = current_week_start - timedelta(weeks=weeks - 1)
            last_week_start = current_week_start

        if self.dialect_name == "postgresql":
            sql = """
            WITH series AS (
                SELECT CAST(generate_series(
                    CAST(:first_week AS TIMESTAMP),
                    CAST(:last_week AS TIMESTAMP),
                    INTERVAL '1 week'
                ) AS DATE) AS week_start
            ),
            cohort_sessions AS (
                SELECT 
                    CAST(DATE_TRUNC('week', s.created_at) AS DATE) AS week_start,
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct
                FROM sessions s
                JOIN trainees t ON t.id = s.trainee_id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
            )
            SELECT 
                to_char(series.week_start, 'YYYY-MM-DD') AS week_start_str,
                ROUND(CAST(AVG(cs.score_pct) AS NUMERIC), 1) AS avg_score_pct,
                COUNT(cs.id) AS session_count
            FROM series
            LEFT JOIN cohort_sessions cs ON cs.week_start = series.week_start
            GROUP BY series.week_start
            ORDER BY series.week_start ASC;
            """
            params = {
                "batch_id": batch_id,
                "first_week": first_week_start,
                "last_week": last_week_start
            }
        else:
            sql = """
            WITH RECURSIVE week_series(w_date, step) AS (
                SELECT date(:first_week), 1
                UNION ALL
                SELECT date(w_date, '+7 days'), step + 1
                FROM week_series
                WHERE step < :weeks
            ),
            cohort_sessions AS (
                SELECT 
                    date(s.created_at, '-' || ((strftime('%w', s.created_at) + 6) % 7) || ' days') AS week_start,
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct
                FROM sessions s
                JOIN trainees t ON t.id = s.trainee_id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
            )
            SELECT 
                ws.w_date AS week_start_str,
                ROUND(AVG(cs.score_pct), 1) AS avg_score_pct,
                COUNT(cs.id) AS session_count
            FROM week_series ws
            LEFT JOIN cohort_sessions cs ON cs.week_start = ws.w_date
            GROUP BY ws.w_date
            ORDER BY ws.w_date ASC;
            """
            params = {
                "batch_id": batch_id,
                "first_week": first_week_start.isoformat(),
                "weeks": weeks
            }

        rows = self.db.execute(text(sql), params).fetchall()
        return [
            {
                "week_start": row[0],
                "avg_score_pct": float(row[1]) if row[1] is not None else None,
                "session_count": int(row[2])
            }
            for row in rows
        ]

    def get_global_weekly(self, weeks: int = 8) -> List[Dict[str, Any]]:
        """Returns continuous weekly progression aggregated across all cohorts."""
        today = datetime.now(timezone.utc).date()
        current_week_start = today - timedelta(days=today.weekday())
        first_week_start = current_week_start - timedelta(weeks=weeks - 1)
        last_week_start = current_week_start

        if self.dialect_name == "postgresql":
            sql = """
            WITH series AS (
                SELECT CAST(generate_series(
                    CAST(:first_week AS TIMESTAMP),
                    CAST(:last_week AS TIMESTAMP),
                    INTERVAL '1 week'
                ) AS DATE) AS week_start
            ),
            all_sessions AS (
                SELECT 
                    CAST(DATE_TRUNC('week', s.created_at) AS DATE) AS week_start,
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct
                FROM sessions s
                JOIN modules m ON m.id = s.module_id
            )
            SELECT 
                to_char(series.week_start, 'YYYY-MM-DD') AS week_start_str,
                ROUND(CAST(AVG(cs.score_pct) AS NUMERIC), 1) AS avg_score_pct,
                COUNT(cs.id) AS session_count
            FROM series
            LEFT JOIN all_sessions cs ON cs.week_start = series.week_start
            GROUP BY series.week_start
            ORDER BY series.week_start ASC;
            """
            params = {
                "first_week": first_week_start,
                "last_week": last_week_start
            }
        else:
            sql = """
            WITH RECURSIVE week_series(w_date, step) AS (
                SELECT date(:first_week), 1
                UNION ALL
                SELECT date(w_date, '+7 days'), step + 1
                FROM week_series
                WHERE step < :weeks
            ),
            all_sessions AS (
                SELECT 
                    date(s.created_at, '-' || ((strftime('%w', s.created_at) + 6) % 7) || ' days') AS week_start,
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct
                FROM sessions s
                JOIN modules m ON m.id = s.module_id
            )
            SELECT 
                ws.w_date AS week_start_str,
                ROUND(AVG(cs.score_pct), 1) AS avg_score_pct,
                COUNT(cs.id) AS session_count
            FROM week_series ws
            LEFT JOIN all_sessions cs ON cs.week_start = ws.w_date
            GROUP BY ws.w_date
            ORDER BY ws.w_date ASC;
            """
            params = {
                "first_week": first_week_start.isoformat(),
                "weeks": weeks
            }

        rows = self.db.execute(text(sql), params).fetchall()
        return [
            {
                "week_start": row[0],
                "avg_score_pct": float(row[1]) if row[1] is not None else None,
                "session_count": int(row[2])
            }
            for row in rows
        ]

    # =========================================================================
    # 3. SCORE BANDS
    # =========================================================================
    def get_batch_bands(self, batch_id: int) -> Optional[List[Dict[str, Any]]]:
        """Categorizes trainees into score bands purely in SQL, always returning all 3 tiers."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        if self.dialect_name == "postgresql":
            sql = """
            WITH trainee_averages AS (
                SELECT 
                    t.id AS trainee_id,
                    AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS avg_pct
                FROM trainees t
                JOIN sessions s ON s.trainee_id = t.id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id
            ),
            trainee_bands AS (
                SELECT 
                    trainee_id,
                    CASE 
                        WHEN avg_pct >= 75.0 THEN 'Excellent'
                        WHEN avg_pct >= 50.0 THEN 'Average'
                        ELSE 'Struggling'
                    END AS band
                FROM trainee_averages
            ),
            band_labels AS (
                SELECT 'Excellent' AS label, 1 AS ord
                UNION ALL SELECT 'Average', 2
                UNION ALL SELECT 'Struggling', 3
            ),
            total_trainees AS (
                SELECT COUNT(*) AS total FROM trainee_averages
            )
            SELECT 
                b.label,
                COUNT(tb.trainee_id) AS count,
                CASE 
                    WHEN (SELECT total FROM total_trainees) > 0 THEN
                        ROUND(CAST(COUNT(tb.trainee_id) * 100.0 / (SELECT total FROM total_trainees) AS NUMERIC), 1)
                    ELSE 0.0
                END AS percent
            FROM band_labels b
            LEFT JOIN trainee_bands tb ON tb.band = b.label
            GROUP BY b.label, b.ord
            ORDER BY b.ord ASC;
            """
        else:
            sql = """
            WITH trainee_averages AS (
                SELECT 
                    t.id AS trainee_id,
                    AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS avg_pct
                FROM trainees t
                JOIN sessions s ON s.trainee_id = t.id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id
            ),
            trainee_bands AS (
                SELECT 
                    trainee_id,
                    CASE 
                        WHEN avg_pct >= 75.0 THEN 'Excellent'
                        WHEN avg_pct >= 50.0 THEN 'Average'
                        ELSE 'Struggling'
                    END AS band
                FROM trainee_averages
            ),
            band_labels AS (
                SELECT 'Excellent' AS label, 1 AS ord
                UNION ALL SELECT 'Average', 2
                UNION ALL SELECT 'Struggling', 3
            ),
            total_trainees AS (
                SELECT COUNT(*) AS total FROM trainee_averages
            )
            SELECT 
                b.label,
                COUNT(tb.trainee_id) AS count,
                CASE 
                    WHEN (SELECT total FROM total_trainees) > 0 THEN
                        ROUND(COUNT(tb.trainee_id) * 100.0 / (SELECT total FROM total_trainees), 1)
                    ELSE 0.0
                END AS percent
            FROM band_labels b
            LEFT JOIN trainee_bands tb ON tb.band = b.label
            GROUP BY b.label, b.ord
            ORDER BY b.ord ASC;
            """

        rows = self.db.execute(text(sql), {"batch_id": batch_id}).fetchall()
        return [
            {
                "label": row[0],
                "count": int(row[1]),
                "percent": float(row[2]) if row[2] is not None else 0.0
            }
            for row in rows
        ]

    # =========================================================================
    # 4. LEADERBOARD (Filters sessions by batch_id INSIDE window subquery)
    # =========================================================================
    def get_batch_leaderboard(
        self,
        batch_id: int,
        order: str = "desc",
        limit: int = 10
    ) -> Optional[List[Dict[str, Any]]]:
        """Calculates ranks via RANK() filtering sessions inside the window CTE."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        if self.dialect_name == "postgresql":
            sql = """
            WITH trainee_stats AS (
                SELECT 
                    t.id AS trainee_id,
                    t.name,
                    ROUND(CAST(AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS NUMERIC), 1) AS avg_score_pct,
                    COUNT(s.id) AS session_count
                FROM trainees t
                LEFT JOIN sessions s ON s.trainee_id = t.id
                LEFT JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id, t.name
            ),
            trend_calc AS (
                SELECT 
                    t.id AS trainee_id,
                    ROUND(CAST((
                        AVG(CASE WHEN ranked_s.row_desc <= 3 THEN ranked_s.score_pct END) -
                        AVG(CASE WHEN ranked_s.row_asc <= 3 THEN ranked_s.score_pct END)
                    ) AS NUMERIC), 1) AS trend_pct
                FROM trainees t
                LEFT JOIN (
                    SELECT 
                        s.trainee_id,
                        (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct,
                        ROW_NUMBER() OVER (PARTITION BY s.trainee_id ORDER BY s.created_at DESC) AS row_desc,
                        ROW_NUMBER() OVER (PARTITION BY s.trainee_id ORDER BY s.created_at ASC) AS row_asc
                    FROM sessions s
                    JOIN trainees tr ON tr.id = s.trainee_id
                    JOIN modules m ON m.id = s.module_id
                    WHERE tr.batch_id = :batch_id
                ) ranked_s ON ranked_s.trainee_id = t.id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id
            ),
            ranked_trainees AS (
                SELECT 
                    ts.trainee_id,
                    ts.name,
                    ts.avg_score_pct,
                    ts.session_count,
                    tc.trend_pct,
                    CASE 
                        WHEN ts.session_count > 0 THEN 
                            RANK() OVER (
                                PARTITION BY (ts.session_count > 0)
                                ORDER BY ts.avg_score_pct DESC
                            )
                        ELSE NULL
                    END AS rank_desc,
                    CASE 
                        WHEN ts.session_count > 0 THEN 
                            RANK() OVER (
                                PARTITION BY (ts.session_count > 0)
                                ORDER BY ts.avg_score_pct ASC
                            )
                        ELSE NULL
                    END AS rank_asc,
                    CASE 
                        WHEN ts.session_count = 0 THEN 'no_sessions'
                        WHEN ts.avg_score_pct < 50.0 THEN 'needs_help'
                        WHEN ts.avg_score_pct < 60.0 THEN 'struggling'
                        ELSE 'on_track'
                    END AS status
                FROM trainee_stats ts
                LEFT JOIN trend_calc tc ON tc.trainee_id = ts.trainee_id
            )
            SELECT 
                CASE WHEN :order = 'asc' THEN rank_asc ELSE rank_desc END AS selected_rank,
                trainee_id,
                name,
                avg_score_pct,
                session_count,
                trend_pct,
                status
            FROM ranked_trainees
            ORDER BY 
                (session_count > 0) DESC,
                CASE WHEN :order = 'asc' THEN avg_score_pct END ASC,
                CASE WHEN :order = 'desc' THEN avg_score_pct END DESC,
                name ASC
            LIMIT :limit;
            """
        else:
            sql = """
            WITH trainee_stats AS (
                SELECT 
                    t.id AS trainee_id,
                    t.name,
                    ROUND(AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0), 1) AS avg_score_pct,
                    COUNT(s.id) AS session_count
                FROM trainees t
                LEFT JOIN sessions s ON s.trainee_id = t.id
                LEFT JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id, t.name
            ),
            trend_calc AS (
                SELECT 
                    t.id AS trainee_id,
                    ROUND(
                        AVG(CASE WHEN ranked_s.row_desc <= 3 THEN ranked_s.score_pct END) -
                        AVG(CASE WHEN ranked_s.row_asc <= 3 THEN ranked_s.score_pct END)
                    , 1) AS trend_pct
                FROM trainees t
                LEFT JOIN (
                    SELECT 
                        s.trainee_id,
                        (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct,
                        ROW_NUMBER() OVER (PARTITION BY s.trainee_id ORDER BY s.created_at DESC) AS row_desc,
                        ROW_NUMBER() OVER (PARTITION BY s.trainee_id ORDER BY s.created_at ASC) AS row_asc
                    FROM sessions s
                    JOIN trainees tr ON tr.id = s.trainee_id
                    JOIN modules m ON m.id = s.module_id
                    WHERE tr.batch_id = :batch_id
                ) ranked_s ON ranked_s.trainee_id = t.id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id
            ),
            ranked_trainees AS (
                SELECT 
                    ts.trainee_id,
                    ts.name,
                    ts.avg_score_pct,
                    ts.session_count,
                    tc.trend_pct,
                    CASE 
                        WHEN ts.session_count > 0 THEN 
                            RANK() OVER (
                                PARTITION BY (ts.session_count > 0)
                                ORDER BY ts.avg_score_pct DESC
                            )
                        ELSE NULL
                    END AS rank_desc,
                    CASE 
                        WHEN ts.session_count > 0 THEN 
                            RANK() OVER (
                                PARTITION BY (ts.session_count > 0)
                                ORDER BY ts.avg_score_pct ASC
                            )
                        ELSE NULL
                    END AS rank_asc,
                    CASE 
                        WHEN ts.session_count = 0 THEN 'no_sessions'
                        WHEN ts.avg_score_pct < 50.0 THEN 'needs_help'
                        WHEN ts.avg_score_pct < 60.0 THEN 'struggling'
                        ELSE 'on_track'
                    END AS status
                FROM trainee_stats ts
                LEFT JOIN trend_calc tc ON tc.trainee_id = ts.trainee_id
            )
            SELECT 
                CASE WHEN :order = 'asc' THEN rank_asc ELSE rank_desc END AS selected_rank,
                trainee_id,
                name,
                avg_score_pct,
                session_count,
                trend_pct,
                status
            FROM ranked_trainees
            ORDER BY 
                (session_count > 0) DESC,
                CASE WHEN :order = 'asc' THEN avg_score_pct END ASC,
                CASE WHEN :order = 'desc' THEN avg_score_pct END DESC,
                name ASC
            LIMIT :limit;
            """

        rows = self.db.execute(
            text(sql),
            {"batch_id": batch_id, "order": order.lower(), "limit": limit}
        ).fetchall()

        return [
            {
                "rank": int(row[0]) if row[0] is not None else None,
                "trainee_id": int(row[1]),
                "name": str(row[2]),
                "avg_score_pct": float(row[3]) if row[3] is not None else None,
                "session_count": int(row[4]),
                "trend_pct": float(row[5]) if row[5] is not None else None,
                "status": str(row[6])
            }
            for row in rows
        ]

    # =========================================================================
    # 5. ATTENTION NEEDED
    # =========================================================================
    def get_batch_attention(self, batch_id: int) -> Optional[List[Dict[str, Any]]]:
        """Selects up to 5 trainees needing attention with falling trends in SQL."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        if self.dialect_name == "postgresql":
            sql = """
            WITH trainee_overall AS (
                SELECT 
                    t.id AS trainee_id,
                    t.name,
                    ROUND(CAST(AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS NUMERIC), 1) AS avg_score_pct,
                    COUNT(s.id) AS session_count
                FROM trainees t
                JOIN sessions s ON s.trainee_id = t.id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id, t.name
            ),
            weekly_scores AS (
                SELECT 
                    s.trainee_id,
                    CAST(DATE_TRUNC('week', s.created_at) AS DATE) AS wk,
                    AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS wk_avg,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.trainee_id 
                        ORDER BY CAST(DATE_TRUNC('week', s.created_at) AS DATE) DESC
                    ) AS rn
                FROM sessions s
                JOIN trainees t ON t.id = s.trainee_id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY s.trainee_id, CAST(DATE_TRUNC('week', s.created_at) AS DATE)
            ),
            falling_check AS (
                SELECT 
                    trainee_id,
                    MAX(CASE WHEN rn = 1 THEN wk_avg END) AS wk1,
                    MAX(CASE WHEN rn = 2 THEN wk_avg END) AS wk2,
                    MAX(CASE WHEN rn = 3 THEN wk_avg END) AS wk3
                FROM weekly_scores
                WHERE rn <= 3
                GROUP BY trainee_id
            )
            SELECT 
                o.trainee_id,
                o.name,
                o.avg_score_pct,
                CASE 
                    WHEN o.avg_score_pct < 50.0 THEN 'critical_low'
                    WHEN o.avg_score_pct < 60.0 THEN 'struggling'
                    WHEN fc.wk1 < fc.wk2 AND fc.wk2 < fc.wk3 THEN 'falling'
                    ELSE 'needs_review'
                END AS trend
            FROM trainee_overall o
            LEFT JOIN falling_check fc ON fc.trainee_id = o.trainee_id
            WHERE o.avg_score_pct < 60.0 
               OR (fc.wk1 IS NOT NULL AND fc.wk2 IS NOT NULL AND fc.wk3 IS NOT NULL AND fc.wk1 < fc.wk2 AND fc.wk2 < fc.wk3)
            ORDER BY o.avg_score_pct ASC
            LIMIT 5;
            """
        else:
            sql = """
            WITH trainee_overall AS (
                SELECT 
                    t.id AS trainee_id,
                    t.name,
                    ROUND(AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0), 1) AS avg_score_pct,
                    COUNT(s.id) AS session_count
                FROM trainees t
                JOIN sessions s ON s.trainee_id = t.id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY t.id, t.name
            ),
            weekly_scores AS (
                SELECT 
                    s.trainee_id,
                    date(s.created_at, '-' || ((strftime('%w', s.created_at) + 6) % 7) || ' days') AS wk,
                    AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS wk_avg,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.trainee_id 
                        ORDER BY date(s.created_at, '-' || ((strftime('%w', s.created_at) + 6) % 7) || ' days') DESC
                    ) AS rn
                FROM sessions s
                JOIN trainees t ON t.id = s.trainee_id
                JOIN modules m ON m.id = s.module_id
                WHERE t.batch_id = :batch_id
                GROUP BY s.trainee_id, wk
            ),
            falling_check AS (
                SELECT 
                    trainee_id,
                    MAX(CASE WHEN rn = 1 THEN wk_avg END) AS wk1,
                    MAX(CASE WHEN rn = 2 THEN wk_avg END) AS wk2,
                    MAX(CASE WHEN rn = 3 THEN wk_avg END) AS wk3
                FROM weekly_scores
                WHERE rn <= 3
                GROUP BY trainee_id
            )
            SELECT 
                o.trainee_id,
                o.name,
                o.avg_score_pct,
                CASE 
                    WHEN o.avg_score_pct < 50.0 THEN 'critical_low'
                    WHEN o.avg_score_pct < 60.0 THEN 'struggling'
                    WHEN fc.wk1 < fc.wk2 AND fc.wk2 < fc.wk3 THEN 'falling'
                    ELSE 'needs_review'
                END AS trend
            FROM trainee_overall o
            LEFT JOIN falling_check fc ON fc.trainee_id = o.trainee_id
            WHERE o.avg_score_pct < 60.0 
               OR (fc.wk1 IS NOT NULL AND fc.wk2 IS NOT NULL AND fc.wk3 IS NOT NULL AND fc.wk1 < fc.wk2 AND fc.wk2 < fc.wk3)
            ORDER BY o.avg_score_pct ASC
            LIMIT 5;
            """

        rows = self.db.execute(text(sql), {"batch_id": batch_id}).fetchall()
        return [
            {
                "trainee_id": int(row[0]),
                "name": str(row[1]),
                "avg_score_pct": float(row[2]) if row[2] is not None else None,
                "trend": str(row[3])
            }
            for row in rows
        ]

    # =========================================================================
    # 6. TRAINEE SUMMARY (latest, best, avg, improvement in SQL)
    # =========================================================================
    def get_trainee_summary(
        self,
        trainee_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Optional[Dict[str, Any]]:
        """Computes trainee metrics and first-3 vs last-3 improvement in pure SQL."""
        trainee = self.db.query(Trainee).filter(Trainee.id == trainee_id).first()
        if not trainee:
            return None

        date_clauses = ""
        params: Dict[str, Any] = {"trainee_id": trainee_id}
        if from_date:
            date_clauses += " AND s.created_at >= :from_date"
            params["from_date"] = datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc)
        if to_date:
            date_clauses += " AND s.created_at <= :to_date"
            params["to_date"] = datetime.combine(to_date, datetime.max.time(), tzinfo=timezone.utc)

        if self.dialect_name == "postgresql":
            sql = f"""
            WITH ranked_sessions AS (
                SELECT 
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct,
                    s.errors,
                    s.time_seconds,
                    s.created_at,
                    ROW_NUMBER() OVER (ORDER BY s.created_at DESC) AS row_desc,
                    ROW_NUMBER() OVER (ORDER BY s.created_at ASC) AS row_asc
                FROM sessions s
                JOIN modules m ON m.id = s.module_id
                WHERE s.trainee_id = :trainee_id
                {date_clauses}
            ),
            improvement_calc AS (
                SELECT 
                    AVG(CASE WHEN row_desc <= 3 THEN score_pct END) AS last_3_avg,
                    AVG(CASE WHEN row_asc <= 3 THEN score_pct END) AS first_3_avg
                FROM ranked_sessions
            )
            SELECT 
                (SELECT ROUND(CAST(score_pct AS NUMERIC), 1) FROM ranked_sessions WHERE row_desc = 1) AS latest_score_pct,
                ROUND(CAST(MAX(rs.score_pct) AS NUMERIC), 1) AS best_score_pct,
                ROUND(CAST(AVG(rs.score_pct) AS NUMERIC), 1) AS avg_score_pct,
                COUNT(rs.id) AS session_count,
                ROUND(CAST(AVG(rs.errors) AS NUMERIC), 1) AS avg_errors,
                ROUND(CAST(AVG(rs.time_seconds) AS NUMERIC), 1) AS avg_time_seconds,
                ROUND(CAST(ic.last_3_avg - ic.first_3_avg AS NUMERIC), 1) AS improvement_pct
            FROM improvement_calc ic
            LEFT JOIN ranked_sessions rs ON true
            GROUP BY ic.last_3_avg, ic.first_3_avg;
            """
        else:
            sql = f"""
            WITH ranked_sessions AS (
                SELECT 
                    s.id,
                    (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS score_pct,
                    s.errors,
                    s.time_seconds,
                    s.created_at,
                    ROW_NUMBER() OVER (ORDER BY s.created_at DESC) AS row_desc,
                    ROW_NUMBER() OVER (ORDER BY s.created_at ASC) AS row_asc
                FROM sessions s
                JOIN modules m ON m.id = s.module_id
                WHERE s.trainee_id = :trainee_id
                {date_clauses}
            ),
            improvement_calc AS (
                SELECT 
                    AVG(CASE WHEN row_desc <= 3 THEN score_pct END) AS last_3_avg,
                    AVG(CASE WHEN row_asc <= 3 THEN score_pct END) AS first_3_avg
                FROM ranked_sessions
            )
            SELECT 
                (SELECT ROUND(score_pct, 1) FROM ranked_sessions WHERE row_desc = 1) AS latest_score_pct,
                ROUND(MAX(rs.score_pct), 1) AS best_score_pct,
                ROUND(AVG(rs.score_pct), 1) AS avg_score_pct,
                COUNT(rs.id) AS session_count,
                ROUND(AVG(rs.errors), 1) AS avg_errors,
                ROUND(AVG(rs.time_seconds), 1) AS avg_time_seconds,
                ROUND(ic.last_3_avg - ic.first_3_avg, 1) AS improvement_pct
            FROM improvement_calc ic
            LEFT JOIN ranked_sessions rs ON 1=1
            GROUP BY ic.last_3_avg, ic.first_3_avg;
            """

        row = self.db.execute(text(sql), params).fetchone()
        return {
            "latest_score_pct": float(row[0]) if row and row[0] is not None else None,
            "best_score_pct": float(row[1]) if row and row[1] is not None else None,
            "avg_score_pct": float(row[2]) if row and row[2] is not None else None,
            "session_count": int(row[3]) if row and row[3] is not None else 0,
            "avg_errors": float(row[4]) if row and row[4] is not None else None,
            "avg_time_seconds": float(row[5]) if row and row[5] is not None else None,
            "improvement_pct": float(row[6]) if row and row[6] is not None else None,
        }

    # =========================================================================
    # 7. TRAINEE PROGRESS (Chronological sessions)
    # =========================================================================
    def get_trainee_progress(
        self,
        trainee_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Returns ordered timeline of sessions with percentage scores computed in SQL."""
        trainee = self.db.query(Trainee).filter(Trainee.id == trainee_id).first()
        if not trainee:
            return None

        date_clauses = ""
        params: Dict[str, Any] = {"trainee_id": trainee_id}
        if from_date:
            date_clauses += " AND s.created_at >= :from_date"
            params["from_date"] = datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc)
        if to_date:
            date_clauses += " AND s.created_at <= :to_date"
            params["to_date"] = datetime.combine(to_date, datetime.max.time(), tzinfo=timezone.utc)

        if self.dialect_name == "postgresql":
            sql = f"""
            SELECT 
                s.created_at,
                m.name AS module_name,
                ROUND(CAST(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0 AS NUMERIC), 1) AS score_pct,
                s.errors,
                s.time_seconds
            FROM sessions s
            JOIN modules m ON m.id = s.module_id
            WHERE s.trainee_id = :trainee_id
            {date_clauses}
            ORDER BY s.created_at ASC;
            """
        else:
            sql = f"""
            SELECT 
                s.created_at,
                m.name AS module_name,
                ROUND(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0, 1) AS score_pct,
                s.errors,
                s.time_seconds
            FROM sessions s
            JOIN modules m ON m.id = s.module_id
            WHERE s.trainee_id = :trainee_id
            {date_clauses}
            ORDER BY s.created_at ASC;
            """

        rows = self.db.execute(text(sql), params).fetchall()
        return [
            {
                "created_at": row[0] if isinstance(row[0], datetime) else datetime.fromisoformat(str(row[0])),
                "module_name": str(row[1]),
                "score_pct": float(row[2]),
                "errors": int(row[3]),
                "time_seconds": int(row[4])
            }
            for row in rows
        ]

    # =========================================================================
    # 8. TRAINEE ERRORS BY MODULE
    # =========================================================================
    def get_trainee_errors_by_module(self, trainee_id: int) -> Optional[List[Dict[str, Any]]]:
        """Aggregates error frequency per module strictly in SQL."""
        trainee = self.db.query(Trainee).filter(Trainee.id == trainee_id).first()
        if not trainee:
            return None

        if self.dialect_name == "postgresql":
            sql = """
            SELECT 
                m.name AS module_name,
                ROUND(CAST(AVG(s.errors) AS NUMERIC), 1) AS avg_errors,
                COUNT(s.id) AS session_count
            FROM sessions s
            JOIN modules m ON m.id = s.module_id
            WHERE s.trainee_id = :trainee_id
            GROUP BY m.id, m.name
            ORDER BY avg_errors DESC, m.name ASC;
            """
        else:
            sql = """
            SELECT 
                m.name AS module_name,
                ROUND(AVG(s.errors), 1) AS avg_errors,
                COUNT(s.id) AS session_count
            FROM sessions s
            JOIN modules m ON m.id = s.module_id
            WHERE s.trainee_id = :trainee_id
            GROUP BY m.id, m.name
            ORDER BY avg_errors DESC, m.name ASC;
            """

        rows = self.db.execute(text(sql), {"trainee_id": trainee_id}).fetchall()
        return [
            {
                "module_name": str(row[0]),
                "avg_errors": float(row[1]) if row[1] is not None else 0.0,
                "session_count": int(row[2])
            }
            for row in rows
        ]

    # =========================================================================
    # 9. BATCH COMPARE
    # =========================================================================
    def get_batches_compare(self) -> List[Dict[str, Any]]:
        """Aggregates all cohorts in SQL comparing pass rates and average scores."""
        if self.dialect_name == "postgresql":
            sql = """
            SELECT 
                b.id AS batch_id,
                b.name AS batch_name,
                ROUND(CAST(AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) AS NUMERIC), 1) AS avg_score_pct,
                ROUND(CAST(AVG(CASE WHEN (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) >= 50.0 THEN 100.0 ELSE 0.0 END) AS NUMERIC), 1) AS pass_rate_pct,
                COUNT(DISTINCT t.id) AS trainee_count
            FROM batches b
            LEFT JOIN trainees t ON t.batch_id = b.id
            LEFT JOIN sessions s ON s.trainee_id = t.id
            LEFT JOIN modules m ON m.id = s.module_id
            GROUP BY b.id, b.name
            ORDER BY b.start_date DESC, b.name ASC;
            """
        else:
            sql = """
            SELECT 
                b.id AS batch_id,
                b.name AS batch_name,
                ROUND(AVG(CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0), 1) AS avg_score_pct,
                ROUND(AVG(CASE WHEN (CAST(s.score AS FLOAT) / CAST(m.max_score AS FLOAT) * 100.0) >= 50.0 THEN 100.0 ELSE 0.0 END), 1) AS pass_rate_pct,
                COUNT(DISTINCT t.id) AS trainee_count
            FROM batches b
            LEFT JOIN trainees t ON t.batch_id = b.id
            LEFT JOIN sessions s ON s.trainee_id = t.id
            LEFT JOIN modules m ON m.id = s.module_id
            GROUP BY b.id, b.name
            ORDER BY b.start_date DESC, b.name ASC;
            """

        rows = self.db.execute(text(sql)).fetchall()
        return [
            {
                "batch_id": int(row[0]),
                "batch_name": str(row[1]),
                "avg_score_pct": float(row[2]) if row[2] is not None else None,
                "pass_rate_pct": float(row[3]) if row[3] is not None else None,
                "trainee_count": int(row[4])
            }
            for row in rows
        ]
