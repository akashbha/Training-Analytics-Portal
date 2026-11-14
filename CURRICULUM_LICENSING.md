# DevOps Curriculum Licensing, Media Attribution & Instructional Notice

## 1. Scope & Legal Disclaimer
This document establishes the licensing terms, fair-use boundaries, and instructional attribution for all media assets, video lectures, companion reference slides, and command cheat sheets served through the **Training Analytics Portal**.

- **Intended Purpose**: The curriculum content hosted on this portal is designated strictly for **internal, educational, and professional development training**.
- **Non-Commercial Boundary**: No content, video streaming stream, or accompanying slide deck may be distributed, repackaged, or commercialized outside the sanctioned learning cohort environment.
- **Access Restrictions**: All media streaming endpoints (`/learning/lessons/{id}/stream`), subtitles (`/learning/lessons/{id}/subtitles`), and companion downloads (`/learning/lessons/{id}/companion-files/{index}`) are protected by cryptographically verified JWT bearer tokens, active user validation, session revocation ledgers, and directory traversal boundary checks.

---

## 2. Curriculum Media Inventory & Provenance

The Module 1 curriculum (*Docker Fundamentals & Core Container Operations*) references the following instructional assets configured via `MEDIA_STORAGE_PATH`:

| Lesson # | Lesson Title | Media Type | Asset Relative Path | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **01** | Docker Setup & Architecture | MP4 / WebVTT / PDF | `2. The Best Way to Setup Docker for Your OS/` | Client-daemon architectural foundations |
| **02** | Starting Your First Container | MP4 / WebVTT / TXT / PDF | `3. Creating and Using Containers Like a Boss/` | Container lifecycle & port publishing (`-p 80:80`) |
| **03** | Container vs VM: Just a Process | MP4 / WebVTT / PDF | `3. Creating and Using Containers Like a Boss/` | Linux namespaces & cgroups kernel isolation |
| **04** | Container CLI Process Monitoring | MP4 / WebVTT / TXT | `3. Creating and Using Containers Like a Boss/` | Real-time telemetry (`docker stats`, `docker top`) |
| **05** | Getting a Shell Inside Containers | MP4 / WebVTT / TXT | `3. Creating and Using Containers Like a Boss/` | Interactive debugging (`docker exec -it`) |
| **06** | Docker Virtual Networking Concepts | MP4 / WebVTT / TXT | `3. Creating and Using Containers Like a Boss/` | Bridge networks & NAT iptables routing |
| **07** | CLI Management of Virtual Networks| MP4 / WebVTT / TXT | `3. Creating and Using Containers Like a Boss/` | Multi-tier workload network isolation |
| **08** | Capstone: Interconnect Web Service | Assignment Rubric | Evaluated via trainer review workflow | Practical DNS verification milestone |

---

## 3. Fair-Use & Attribution Statement
All course video material, architectural diagrams, and command summaries are adapted for corporate educational purposes under standard instructional training fair-use doctrines. Copyrights to underlying trade names (such as *Docker*, *Nginx*, *Linux*) belong to their respective trademark holders.

---

## 4. Technical Safeguards Enforced by Software Architecture
1. **Path-Traversal Prevention**: Canonical `os.path.commonpath` verification stops relative path escaping (`../`, `..\\`).
2. **Revocation-Aware Streaming**: HTTP 206 Partial Content video streaming checks token JTI revocation on each segment request.
3. **Backend-Controlled Progress**: Video completion is calculated strictly server-side ($\ge 60\%$ watch duration required); client boolean manipulation is ignored.
4. **Cohort-Scoped Evaluation**: Trainers can only review capstone assignments submitted by trainees enrolled in their assigned cohort batches.

