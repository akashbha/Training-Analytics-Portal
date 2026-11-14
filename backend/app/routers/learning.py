"""FastAPI router managing DevOps Learning Paths, Range-based Video Streaming, WebVTT Subtitles, and Capstone Assignments.
Enforces authenticated streaming, cohort-scoped trainer grading, and directory-traversal prevention.
"""

import os
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, Query, Request, Response, status
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db, get_current_user, require_staff, bearer_scheme
from app.core.security import decode_access_token
from app.core.exceptions import AppException
from app.services.revocation_service import is_token_revoked
from app.models.user import User
from app.models.learning import LearningLesson
from app.schemas.learning import (
    LearningSubjectDetail,
    LearningLessonDetail,
    LearningProgressUpdate,
    LearningProgressResponse,
    LearningSubmissionResponse,
    LearningSubmissionCreate,
    LearningSubmissionReview
)
from app.services.learning_service import LearningService

router = APIRouter(prefix="/learning", tags=["Learning Path"])


def get_media_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    """Validates token from Bearer header or query string (for HTML5 <video> and <track> elements)."""
    raw_token = credentials.credentials if credentials and credentials.credentials else token
    if not raw_token:
        raise AppException(
            code="UNAUTHENTICATED",
            message="Missing authentication credentials",
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        payload = decode_access_token(raw_token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise AppException(code="INVALID_TOKEN", message="Invalid token payload", status_code=401)
        user_id = int(user_id_str)
        jti = payload.get("jti")
        iat = payload.get("iat")
    except (JWTError, ValueError):
        raise AppException(code="INVALID_OR_EXPIRED_TOKEN", message="Authentication token is invalid or expired", status_code=401)

    if is_token_revoked(db, jti=jti, user_id=user_id, iat=iat):
        raise AppException(code="TOKEN_REVOKED", message="Authentication token has been revoked", status_code=401)

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise AppException(code="USER_INACTIVE", message="User account is inactive", status_code=401)
    return user


def _resolve_safe_media_path(relative_path: str) -> str:
    """Safely resolves relative path against MEDIA_STORAGE_PATH, preventing directory traversal."""
    if not relative_path:
        raise AppException(code="MEDIA_NOT_CONFIGURED", message="Media asset not configured", status_code=404)

    # Sanitize null bytes
    if "\x00" in relative_path:
        raise AppException(code="INVALID_PATH", message="Access denied: null byte detected", status_code=403)

    base_dir = os.path.abspath(settings.MEDIA_STORAGE_PATH)
    target_path = os.path.abspath(os.path.join(base_dir, relative_path.replace("/", os.sep)))

    # Path traversal safety check using canonical commonpath
    try:
        common = os.path.commonpath([base_dir, target_path])
    except ValueError:
        raise AppException(code="INVALID_PATH", message="Access denied: invalid drive path", status_code=403)

    if common != base_dir or target_path == base_dir:
        raise AppException(code="INVALID_PATH", message="Access denied: path traversal detected", status_code=403)

    return target_path


@router.get("/subjects", response_model=List[LearningSubjectDetail])
def list_learning_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all active learning subjects with module milestones and progress analytics."""
    service = LearningService(db)
    return service.list_subjects(current_user)


@router.get("/subjects/{slug}", response_model=LearningSubjectDetail)
def get_learning_subject(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves single subject track with complete module roadmap, lessons, and assignment states."""
    service = LearningService(db)
    return service.get_subject_by_slug(slug, current_user)


@router.get("/lessons/{lesson_id}", response_model=LearningLessonDetail)
def get_lesson_detail(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves lesson metadata, playback endpoints, companion resources, and watch state."""
    service = LearningService(db)
    return service.get_lesson_detail(lesson_id, current_user)


@router.post("/lessons/{lesson_id}/progress", response_model=LearningProgressResponse)
def update_lesson_progress(
    lesson_id: int,
    payload: LearningProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates seconds watched and records lesson completion if threshold is achieved."""
    service = LearningService(db)
    return service.update_progress(lesson_id, payload, current_user)


@router.get("/lessons/{lesson_id}/stream")
def stream_lesson_video(
    lesson_id: int,
    request: Request,
    range: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_media_user)
):
    """Serves video media with HTTP 206 Partial Content range requests for instant seeking and low buffering."""
    lesson = db.query(LearningLesson).filter(LearningLesson.id == lesson_id).first()
    if not lesson or not lesson.video_relative_path:
        raise AppException(code="VIDEO_NOT_FOUND", message=f"Video asset for lesson {lesson_id} not found", status_code=404)

    file_path = _resolve_safe_media_path(lesson.video_relative_path)
    if not os.path.exists(file_path):
        raise AppException(code="VIDEO_FILE_MISSING", message="Video file is not available on server media storage", status_code=404)

    file_size = os.path.getsize(file_path)

    # If client didn't send Range header, return initial metadata probe
    if not range:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
        }
        return FileResponse(file_path, media_type="video/mp4", headers=headers)

    # Parse Range: bytes=start-end
    try:
        range_val = range.strip().replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
    except Exception:
        raise AppException(code="INVALID_RANGE", message="Malformed Range header", status_code=416)

    if start >= file_size or end >= file_size or start > end or start < 0 or end < 0:
        return Response(
            status_code=416,
            headers={
                "Content-Range": f"bytes */{file_size}",
                "Accept-Ranges": "bytes",
            }
        )

    chunk_size = end - start + 1

    def iter_file():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                read_size = min(bytes_left, 128 * 1024)  # 128 KB chunk buffer
                chunk = f.read(read_size)
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }
    return StreamingResponse(iter_file(), status_code=status.HTTP_206_PARTIAL_CONTENT, headers=headers)


@router.get("/lessons/{lesson_id}/subtitles")
def get_lesson_subtitles(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_media_user)
):
    """Converts local .srt subtitle file into browser-native WebVTT format for <track> display."""
    lesson = db.query(LearningLesson).filter(LearningLesson.id == lesson_id).first()
    if not lesson or not lesson.subtitle_relative_path:
        raise AppException(code="SUBTITLES_NOT_FOUND", message="Subtitles not available for this lesson", status_code=404)

    file_path = _resolve_safe_media_path(lesson.subtitle_relative_path)
    if not os.path.exists(file_path):
        raise AppException(code="SUBTITLE_FILE_MISSING", message="Subtitle file missing on disk", status_code=404)

    try:
        with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
            raw_srt = f.read()
    except Exception as exc:
        raise AppException(code="SUBTITLE_READ_ERROR", message=f"Failed to read subtitles: {str(exc)}", status_code=500)

    # Convert SRT timestamps (00:00:12,345) to WebVTT format (00:00:12.345)
    transformed = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", raw_srt)
    vtt_content = "WEBVTT\n\n" + transformed.strip()

    return Response(content=vtt_content, media_type="text/vtt; charset=utf-8")


@router.get("/lessons/{lesson_id}/companion-files/{file_index}")
def download_companion_file(
    lesson_id: int,
    file_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_media_user)
):
    """Downloads an attached slide deck PDF or command cheat-sheet TXT file."""
    lesson = db.query(LearningLesson).filter(LearningLesson.id == lesson_id).first()
    if not lesson or not lesson.companion_files:
        raise AppException(code="RESOURCE_NOT_FOUND", message="No companion files attached to this lesson", status_code=404)

    if file_index < 0 or file_index >= len(lesson.companion_files):
        raise AppException(code="RESOURCE_INDEX_OUT_OF_BOUNDS", message="Invalid companion file index", status_code=404)

    target_file = lesson.companion_files[file_index]
    rel_path = target_file.get("relative_path")
    file_path = _resolve_safe_media_path(rel_path)

    if not os.path.exists(file_path):
        raise AppException(code="FILE_NOT_FOUND", message="Attached resource missing from storage", status_code=404)

    filename = os.path.basename(file_path)
    media_type = "application/pdf" if filename.lower().endswith(".pdf") else "text/plain"

    return FileResponse(file_path, media_type=media_type, filename=filename)


@router.post("/assignments/{assignment_id}/submit", response_model=LearningSubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_assignment(
    assignment_id: int,
    payload: LearningSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits practical Capstone Assignment evidence for instructional trainer evaluation."""
    service = LearningService(db)
    return service.submit_assignment(assignment_id, payload, current_user)


@router.get("/submissions/my", response_model=List[LearningSubmissionResponse])
def get_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists assignment submission history and grading feedback for the active trainee."""
    service = LearningService(db)
    return service.list_my_submissions(current_user)


@router.get("/trainer/submissions", response_model=List[LearningSubmissionResponse])
def get_trainer_submissions(
    status: Optional[str] = Query(None, description="Filter by submission status"),
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Lists pending or reviewed assignment submissions, scoped strictly to assigned cohorts for trainers."""
    service = LearningService(db)
    return service.list_trainer_submissions(staff, status=status)


@router.post("/trainer/submissions/{submission_id}/review", response_model=LearningSubmissionResponse)
def review_assignment_submission(
    submission_id: int,
    payload: LearningSubmissionReview,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff)
):
    """Grades a submission, provides actionable feedback, and unlocks subsequent modules upon passing."""
    service = LearningService(db)
    return service.review_submission(submission_id, payload, staff)
