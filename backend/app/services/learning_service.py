"""Service layer managing learning curriculum, lesson progression, and assignment reviews."""

from datetime import datetime, timezone
import os
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.constants import ASSESSMENT_PASS_THRESHOLD
from app.models.learning import (
    LearningSubject,
    LearningModule,
    LearningLesson,
    LearningProgress,
    LearningAssignment,
    LearningSubmission
)
from app.models.user import User
from app.models.trainee import Trainee
from app.models.batch_trainer import BatchTrainer
from app.schemas.learning import (
    LearningSubjectDetail,
    LearningModuleDetail,
    LearningLessonSummary,
    LearningLessonDetail,
    LearningAssignmentSummary,
    LearningSubmissionResponse,
    LearningSubmissionCreate,
    LearningSubmissionReview,
    LearningProgressUpdate,
    LearningProgressResponse,
    CompanionFileItem
)
from app.services.audit_service import create_audit_log


class LearningService:
    def __init__(self, db: Session):
        self.db = db

    def list_subjects(self, user: User) -> List[LearningSubjectDetail]:
        """Lists active learning subjects decorated with the caller's overall completion percentage."""
        subjects = (
            self.db.query(LearningSubject)
            .filter(LearningSubject.is_active == True)
            .order_by(LearningSubject.id.asc())
            .all()
        )
        return [self._build_subject_detail(s, user) for s in subjects]

    def get_subject_by_slug(self, slug: str, user: User) -> LearningSubjectDetail:
        """Retrieves single subject with complete module roadmap and lesson progress."""
        subject = (
            self.db.query(LearningSubject)
            .filter(LearningSubject.slug == slug, LearningSubject.is_active == True)
            .first()
        )
        if not subject:
            raise AppException(
                code="SUBJECT_NOT_FOUND",
                message=f"Learning track '{slug}' not found",
                status_code=404
            )
        return self._build_subject_detail(subject, user)

    def _build_subject_detail(self, subject: LearningSubject, user: User) -> LearningSubjectDetail:
        """Serializes LearningSubject with progress analytics calculated per trainee."""
        trainee_id = user.trainee_id if user.role == "trainee" else None

        # Fetch all progress records for trainee across this subject's lessons
        progress_map = {}
        if trainee_id:
            records = (
                self.db.query(LearningProgress)
                .join(LearningLesson, LearningLesson.id == LearningProgress.lesson_id)
                .join(LearningModule, LearningModule.id == LearningLesson.module_id)
                .filter(LearningModule.subject_id == subject.id, LearningProgress.trainee_id == trainee_id)
                .all()
            )
            for r in records:
                progress_map[r.lesson_id] = r

        # Fetch submissions for trainee across assignments in this subject
        submission_map = {}
        if trainee_id:
            subs = (
                self.db.query(LearningSubmission)
                .join(LearningAssignment, LearningAssignment.id == LearningSubmission.assignment_id)
                .join(LearningModule, LearningModule.id == LearningAssignment.module_id)
                .filter(LearningModule.subject_id == subject.id, LearningSubmission.trainee_id == trainee_id)
                .order_by(LearningSubmission.submitted_at.desc())
                .all()
            )
            for s in subs:
                if s.assignment_id not in submission_map:
                    submission_map[s.assignment_id] = s

        modules_detail = []
        total_mod_count = len(subject.modules)
        completed_mod_count = 0

        previous_module_completed = True  # Module 1 is always unlocked

        for mod in subject.modules:
            lessons_summary = []
            completed_lesson_count = 0

            for l in mod.lessons:
                p = progress_map.get(l.id)
                is_comp = p.is_completed if p else False
                w_sec = p.watched_seconds if p else 0
                if is_comp:
                    completed_lesson_count += 1

                comp_files = None
                if l.companion_files:
                    comp_files = [
                        CompanionFileItem(
                            title=cf.get("title", "Resource"),
                            file_type=cf.get("file_type", "txt"),
                            relative_path=cf.get("relative_path", "")
                        )
                        for cf in l.companion_files
                    ]

                lessons_summary.append(
                    LearningLessonSummary(
                        id=l.id,
                        module_id=l.module_id,
                        title=l.title,
                        description=l.description,
                        duration_seconds=l.duration_seconds,
                        order_index=l.order_index,
                        requires_practice=l.requires_practice,
                        is_completed=is_comp,
                        watched_seconds=w_sec,
                        companion_files=comp_files
                    )
                )

            assignment_summary = None
            if mod.assignment:
                assignment_summary = LearningAssignmentSummary(
                    id=mod.assignment.id,
                    module_id=mod.assignment.module_id,
                    title=mod.assignment.title,
                    instructions=mod.assignment.instructions,
                    starter_files_url=mod.assignment.starter_files_url,
                    max_score=mod.assignment.max_score,
                    passing_score=mod.assignment.passing_score,
                    is_required=mod.assignment.is_required
                )

            latest_sub = None
            if mod.assignment and mod.assignment.id in submission_map:
                s_obj = submission_map[mod.assignment.id]
                latest_sub = self._format_submission(s_obj)

            # Module completion logic: must have lessons, all completed, and required assignment passed
            total_l = len(mod.lessons)
            lessons_done = (completed_lesson_count == total_l and total_l > 0)
            assignment_done = True
            if mod.assignment and mod.assignment.is_required:
                assignment_done = (latest_sub is not None and latest_sub.status == "passed")

            is_module_completed = lessons_done and assignment_done
            if is_module_completed:
                completed_mod_count += 1

            mod_progress_pct = 0.0
            if total_l > 0:
                mod_progress_pct = round((completed_lesson_count / total_l) * 100.0, 1)

            # Module unlocking: Module 1 unlocked, Module N unlocked if prev completed or caller is staff
            is_unlocked = True
            if user.role == "trainee" and mod.order_index > 1:
                is_unlocked = previous_module_completed

            modules_detail.append(
                LearningModuleDetail(
                    id=mod.id,
                    subject_id=mod.subject_id,
                    title=mod.title,
                    slug=mod.slug,
                    order_index=mod.order_index,
                    description=mod.description,
                    is_required=mod.is_required,
                    total_lessons=total_l,
                    completed_lessons=completed_lesson_count,
                    progress_pct=mod_progress_pct,
                    lessons=lessons_summary,
                    assignment=assignment_summary,
                    latest_submission=latest_sub,
                    is_unlocked=is_unlocked
                )
            )

            previous_module_completed = is_module_completed

        overall_pct = (
            round((completed_mod_count / total_mod_count) * 100.0, 1) if total_mod_count > 0 else 0.0
        )

        return LearningSubjectDetail(
            id=subject.id,
            title=subject.title,
            slug=subject.slug,
            description=subject.description,
            icon=subject.icon,
            is_active=subject.is_active,
            total_modules=total_mod_count,
            completed_modules=completed_mod_count,
            overall_progress_pct=overall_pct,
            modules=modules_detail
        )

    def get_lesson_detail(self, lesson_id: int, user: User) -> LearningLessonDetail:
        """Retrieves single lesson with secure playback URLs, subtitles, and progress state."""
        lesson = self.db.query(LearningLesson).filter(LearningLesson.id == lesson_id).first()
        if not lesson:
            raise AppException(
                code="LESSON_NOT_FOUND",
                message=f"Lesson with ID {lesson_id} not found",
                status_code=404
            )

        is_comp = False
        w_sec = 0
        if user.role == "trainee" and user.trainee_id:
            p = (
                self.db.query(LearningProgress)
                .filter(LearningProgress.trainee_id == user.trainee_id, LearningProgress.lesson_id == lesson_id)
                .first()
            )
            if p:
                is_comp = p.is_completed
                w_sec = p.watched_seconds

        comp_files = None
        if lesson.companion_files:
            comp_files = [
                CompanionFileItem(
                    title=cf.get("title", "Resource"),
                    file_type=cf.get("file_type", "txt"),
                    relative_path=cf.get("relative_path", "")
                )
                for cf in lesson.companion_files
            ]

        stream_url = f"/learning/lessons/{lesson.id}/stream"
        subtitles_url = (
            f"/learning/lessons/{lesson.id}/subtitles" if lesson.subtitle_relative_path else None
        )

        return LearningLessonDetail(
            id=lesson.id,
            module_id=lesson.module_id,
            title=lesson.title,
            description=lesson.description,
            duration_seconds=lesson.duration_seconds,
            order_index=lesson.order_index,
            requires_practice=lesson.requires_practice,
            is_completed=is_comp,
            watched_seconds=w_sec,
            companion_files=comp_files,
            has_video=bool(lesson.video_relative_path),
            has_subtitles=bool(lesson.subtitle_relative_path),
            stream_url=stream_url,
            subtitles_url=subtitles_url
        )

    def update_progress(
        self, lesson_id: int, payload: LearningProgressUpdate, user: User
    ) -> LearningProgressResponse:
        """Updates watch progress for a trainee. Enforces minimum watch threshold before marking complete."""
        lesson = self.db.query(LearningLesson).filter(LearningLesson.id == lesson_id).first()
        if not lesson:
            raise AppException(code="LESSON_NOT_FOUND", message=f"Lesson with ID {lesson_id} not found", status_code=404)

        if user.role != "trainee" or not user.trainee_id:
            # Staff previewing lessons do not persist learner progress
            return LearningProgressResponse(
                lesson_id=lesson_id,
                trainee_id=0,
                watched_seconds=payload.watched_seconds,
                is_completed=bool(payload.is_completed),
                completed_at=None
            )

        record = (
            self.db.query(LearningProgress)
            .filter(LearningProgress.trainee_id == user.trainee_id, LearningProgress.lesson_id == lesson_id)
            .first()
        )
        now = datetime.now(timezone.utc)

        # Clamp watched seconds to valid range [0, lesson.duration_seconds]
        clamped_watched = max(0, payload.watched_seconds)
        if lesson.duration_seconds > 0:
            clamped_watched = min(clamped_watched, lesson.duration_seconds)

        if not record:
            record = LearningProgress(
                trainee_id=user.trainee_id,
                lesson_id=lesson_id,
                watched_seconds=clamped_watched,
                is_completed=False,
                last_watched_at=now
            )
            self.db.add(record)
        else:
            record.watched_seconds = max(record.watched_seconds, clamped_watched)
            record.last_watched_at = now

        # Server-enforced completion: minimum 60% of video duration must be watched
        min_threshold = int(lesson.duration_seconds * 0.60) if lesson.duration_seconds > 0 else 0
        if record.watched_seconds >= min_threshold or lesson.duration_seconds == 0:
            if not record.is_completed:
                record.is_completed = True
                record.completed_at = now
        elif not record.is_completed:
            # Trainee sent is_completed=True but has not achieved the 60% threshold: reject completion
            record.is_completed = False

        self.db.commit()
        self.db.refresh(record)

        return LearningProgressResponse(
            lesson_id=record.lesson_id,
            trainee_id=record.trainee_id,
            watched_seconds=record.watched_seconds,
            is_completed=record.is_completed,
            completed_at=record.completed_at
        )

    def submit_assignment(
        self, assignment_id: int, payload: LearningSubmissionCreate, user: User
    ) -> LearningSubmissionResponse:
        """Submits or updates evidence for a module Capstone Assignment."""
        if user.role != "trainee" or not user.trainee_id:
            raise AppException(
                code="FORBIDDEN_ROLE",
                message="Only enrolled trainees can submit capstone assignments",
                status_code=403
            )

        assignment = (
            self.db.query(LearningAssignment)
            .filter(LearningAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise AppException(
                code="ASSIGNMENT_NOT_FOUND",
                message=f"Assignment with ID {assignment_id} not found",
                status_code=404
            )

        # Check existing submission
        existing = (
            self.db.query(LearningSubmission)
            .filter(
                LearningSubmission.assignment_id == assignment_id,
                LearningSubmission.trainee_id == user.trainee_id
            )
            .order_by(LearningSubmission.submitted_at.desc())
            .first()
        )

        if existing and existing.status == "passed":
            raise AppException(
                code="ASSIGNMENT_ALREADY_PASSED",
                message="This assignment has already been evaluated and passed",
                status_code=400
            )

        now = datetime.now(timezone.utc)
        if existing and existing.status in ("draft", "needs_changes"):
            existing.commands_used = payload.commands_used
            existing.explanation = payload.explanation
            existing.status = "submitted"
            existing.submitted_at = now
            sub = existing
        else:
            sub = LearningSubmission(
                assignment_id=assignment_id,
                trainee_id=user.trainee_id,
                status="submitted",
                commands_used=payload.commands_used,
                explanation=payload.explanation,
                submitted_at=now
            )
            self.db.add(sub)

        self.db.commit()
        self.db.refresh(sub)
        return self._format_submission(sub)

    def list_my_submissions(self, user: User) -> List[LearningSubmissionResponse]:
        """Lists assignment submissions for the current trainee."""
        if user.role != "trainee" or not user.trainee_id:
            return []
        subs = (
            self.db.query(LearningSubmission)
            .filter(LearningSubmission.trainee_id == user.trainee_id)
            .order_by(LearningSubmission.submitted_at.desc())
            .all()
        )
        return [self._format_submission(s) for s in subs]

    def list_trainer_submissions(
        self, user: User, status: Optional[str] = None
    ) -> List[LearningSubmissionResponse]:
        """Lists submissions awaiting review, scoped to assigned cohorts for trainers."""
        if user.role not in ("trainer", "admin"):
            raise AppException(code="FORBIDDEN_ROLE", message="Staff access required", status_code=403)

        query = self.db.query(LearningSubmission).join(Trainee, Trainee.id == LearningSubmission.trainee_id)

        if user.role == "trainer":
            assigned_batch_ids = [
                r[0] for r in self.db.query(BatchTrainer.batch_id).filter(BatchTrainer.trainer_id == user.id).all()
            ]
            query = query.filter(Trainee.batch_id.in_(assigned_batch_ids))

        if status:
            query = query.filter(LearningSubmission.status == status)

        subs = query.order_by(LearningSubmission.submitted_at.desc()).all()
        return [self._format_submission(s) for s in subs]

    def review_submission(
        self, submission_id: int, payload: LearningSubmissionReview, reviewer: User
    ) -> LearningSubmissionResponse:
        """Evaluates an assignment submission, awarding scores and recording trainer feedback."""
        if reviewer.role not in ("trainer", "admin"):
            raise AppException(code="FORBIDDEN_ROLE", message="Staff access required to grade assignments", status_code=403)

        sub = (
            self.db.query(LearningSubmission)
            .filter(LearningSubmission.id == submission_id)
            .first()
        )
        if not sub:
            raise AppException(code="SUBMISSION_NOT_FOUND", message=f"Submission {submission_id} not found", status_code=404)

        if payload.status not in ("passed", "needs_changes"):
            raise AppException(
                code="INVALID_STATUS",
                message="Review status must be either 'passed' or 'needs_changes'",
                status_code=400
            )

        if payload.score < 0.0 or payload.score > 100.0:
            raise AppException(
                code="SCORE_OUT_OF_BOUNDS",
                message="Review score must be between 0.0 and 100.0",
                status_code=400
            )

        if payload.status == "passed" and payload.score < ASSESSMENT_PASS_THRESHOLD:
            raise AppException(
                code="INVALID_PASS_SCORE",
                message=f"A passing review status requires a score >= {ASSESSMENT_PASS_THRESHOLD}% (received {payload.score}%)",
                status_code=400
            )

        if reviewer.role == "trainer":
            trainee = self.db.query(Trainee).filter(Trainee.id == sub.trainee_id).first()
            if not trainee:
                raise AppException(code="TRAINEE_NOT_FOUND", message="Trainee record missing", status_code=404)
            is_assigned = (
                self.db.query(BatchTrainer)
                .filter(BatchTrainer.batch_id == trainee.batch_id, BatchTrainer.trainer_id == reviewer.id)
                .first()
            )
            if not is_assigned:
                raise AppException(
                    code="FORBIDDEN_COHORT_ACCESS",
                    message="Trainers can only evaluate submissions from their assigned cohorts",
                    status_code=403
                )

        now = datetime.now(timezone.utc)
        sub.status = payload.status
        sub.score = payload.score
        sub.trainer_feedback = payload.trainer_feedback
        sub.reviewer_id = reviewer.id
        sub.reviewed_at = now

        create_audit_log(
            db=self.db,
            user_id=reviewer.id,
            action="review_learning_submission",
            entity_type="learning_submission",
            entity_id=sub.id,
            details={
                "status": sub.status,
                "score": sub.score,
                "trainee_id": sub.trainee_id,
                "assignment_id": sub.assignment_id
            }
        )
        self.db.commit()
        self.db.refresh(sub)
        return self._format_submission(sub)

    def _format_submission(self, s: LearningSubmission) -> LearningSubmissionResponse:
        """Helper serializing submission entity with trainee and reviewer metadata."""
        t_name = s.trainee.name if s.trainee else None
        t_email = s.trainee.email if s.trainee else None
        r_name = s.reviewer.email.split("@")[0].replace(".", " ").title() if s.reviewer else None

        return LearningSubmissionResponse(
            id=s.id,
            assignment_id=s.assignment_id,
            trainee_id=s.trainee_id,
            trainee_name=t_name,
            trainee_email=t_email,
            status=s.status,
            commands_used=s.commands_used,
            explanation=s.explanation,
            file_attachments=s.file_attachments,
            score=s.score,
            trainer_feedback=s.trainer_feedback,
            reviewer_id=s.reviewer_id,
            reviewer_name=r_name,
            submitted_at=s.submitted_at,
            reviewed_at=s.reviewed_at
        )
