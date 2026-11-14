# DevOps Curriculum Media & Video Setup Guide

## Overview
The Training Analytics Portal features a production-grade, secure HTTP 206 Partial Content video streaming engine that delivers curriculum video lessons with pause/resume support, canonical path traversal protection, and server-enforced 60% completion thresholds.

All curriculum structure, lesson timings, CLI playbooks, capstone assignments, and **all 29 companion slide presentations (PDFs) and command cheatsheets (TXT)** are tracked directly in this repository under:
- [`backend/app/db/seed_learning.py`](file:///c:/Users/anmol/minor_project_shi/Training-Analytics-Portal/backend/app/db/seed_learning.py)
- [`backend/resources/devops/`](file:///c:/Users/anmol/minor_project_shi/Training-Analytics-Portal/backend/resources/devops/)

---

## Why Video Binaries (.mp4 / .zip) Are Not Stored in Git
The full DevOps video course (`devops shi.zip`) contains **over 20 hours of high-definition video lessons totaling 13.46 GB** across 48+ individual video files (ranging from 105 MB up to 606 MB per file).

- **GitHub Limit**: GitHub enforces a hard limit of **100 MB per file** (`GH001: Large files detected`) and a **2 GB repository cap**. Git is designed for version-controlling code and configuration, not hosting multi-gigabyte video libraries.
- **Enterprise Standard**: Video files are hosted on dedicated object storage (AWS S3, Cloudflare R2) or served locally from disk via the backend media resolver.

---

## How to Set Up the Videos for Evaluation

### Option 1: Local Machine (Active Setup)
The portal is already configured to stream video lessons directly from your local directory.
In `backend/.env` (or `backend/app/core/config.py`):
```env
MEDIA_STORAGE_PATH="C:/Users/anmol/Downloads/devops shi/Docker Course"
```
The FastAPI backend serves media via `/learning/media/{file_path}` with range streaming and security checks.

### Option 2: Extracting from `devops shi.zip`
1. Extract `devops shi.zip` into `backend/media/`:
   ```bash
   # Extract to backend/media/
   unzip "devops shi.zip" -d backend/media/
   ```
2. Update your `backend/.env`:
   ```env
   MEDIA_STORAGE_PATH="./media/Docker Course"
   ```
3. Run the backend seeder to populate the database:
   ```bash
   cd backend
   python -m app.db.seed_learning
   ```

### Option 3: Cloud / External Evaluator Download
For external evaluators or team members running on different machines, download the course video bundle:
- **Download Link**: `[Upload devops shi.zip to Google Drive / OneDrive and paste link here]`
- **Extraction Path**: Extract into `backend/media/` as described above.
- **Slide & Command Materials**: All 29 companion decks and command reference guides are already committed to Git in `backend/resources/devops/` and work immediately out of the box without downloading the video zip.
