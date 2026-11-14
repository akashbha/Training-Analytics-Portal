"""Database seeder for DevOps Learning Path curriculum, Module 1 lessons, and Capstone Assignment.
Idempotent script that creates or updates the DevOps curriculum without wiping existing databases.
"""

import os
from sqlalchemy.orm import Session
from app.db.session import SyncSessionLocal, sync_engine
from app.db.base import Base
from app.models.learning import (
    LearningSubject,
    LearningModule,
    LearningLesson,
    LearningAssignment
)

MODULE_1_LESSONS = [
    {
        "order_index": 1,
        "title": "Docker Setup & Architecture",
        "description": "Understand Docker Community vs Enterprise editions, the Docker client-server daemon architecture, socket communications, and core system requirements.",
        "video_relative_path": "2. The Best Way to Setup Docker for Your OS/1. Docker Editions Which Do I Use.mp4",
        "subtitle_relative_path": "2. The Best Way to Setup Docker for Your OS/1. Docker Editions Which Do I Use.srt",
        "duration_seconds": 407,
        "requires_practice": False,
        "companion_files": [
            {"title": "Docker Complete Reference Slides", "file_type": "pdf", "relative_path": "Resources/572027-rc221-docker.pdf"}
        ]
    },
    {
        "order_index": 2,
        "title": "Starting Your First Container (Nginx Web Server)",
        "description": "Run background containers with docker run -d, publish host ports using -p 80:80, verify HTTP responses, and manage container life cycles.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/2. Starting a Nginx Web Server.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/2. Starting a Nginx Web Server.srt",
        "duration_seconds": 538,
        "requires_practice": True,
        "companion_files": [
            {"title": "Section 03 Commands Cheat Sheet", "file_type": "txt", "relative_path": "3. Creating and Using Containers Like a Boss/1.1 DM S03 Commands.txt"},
            {"title": "Containers & Architecture Slides", "file_type": "pdf", "relative_path": "3. Creating and Using Containers Like a Boss/1.2 S03 Containers Slides.pdf"}
        ]
    },
    {
        "order_index": 3,
        "title": "Container vs VM: It's Just a Process",
        "description": "Deep-dive into Linux namespaces, cgroups, kernel process isolation, and understand why containers consume zero hypervisor overhead.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/4. Container VS. VM It's Just a Process.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/4. Container VS. VM It's Just a Process.srt",
        "duration_seconds": 252,
        "requires_practice": False,
        "companion_files": [
            {"title": "Containers & Architecture Slides", "file_type": "pdf", "relative_path": "3. Creating and Using Containers Like a Boss/1.2 S03 Containers Slides.pdf"}
        ]
    },
    {
        "order_index": 4,
        "title": "Container CLI Process Monitoring",
        "description": "Real-time process inspection using docker container top, live CPU/memory streaming with docker stats, inspecting metadata, and live log tailing.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/9. What's Going On In Containers CLI Process Monitoring.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/9. What's Going On In Containers CLI Process Monitoring.srt",
        "duration_seconds": 296,
        "requires_practice": True,
        "companion_files": [
            {"title": "Section 03 Commands Cheat Sheet", "file_type": "txt", "relative_path": "3. Creating and Using Containers Like a Boss/1.1 DM S03 Commands.txt"}
        ]
    },
    {
        "order_index": 5,
        "title": "Getting a Shell Inside Containers (No SSH Required)",
        "description": "Executing interactive commands with docker exec -it, understanding the minimal container root filesystem, and differences between image shells.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/10. Getting a Shell Inside Containers No Need for SSH.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/10. Getting a Shell Inside Containers No Need for SSH.srt",
        "duration_seconds": 645,
        "requires_practice": True,
        "companion_files": [
            {"title": "Section 03 Commands Cheat Sheet", "file_type": "txt", "relative_path": "3. Creating and Using Containers Like a Boss/1.1 DM S03 Commands.txt"}
        ]
    },
    {
        "order_index": 6,
        "title": "Docker Virtual Networking Concepts",
        "description": "Default bridge networks, host networking, NAT iptables packet traversal, container port bindings, and security boundaries.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/11. Docker Networks Concepts for Private and Public Comms in Containers.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/11. Docker Networks Concepts for Private and Public Comms in Containers.srt",
        "duration_seconds": 696,
        "requires_practice": False,
        "companion_files": [
            {"title": "Section 03 Commands Cheat Sheet", "file_type": "txt", "relative_path": "3. Creating and Using Containers Like a Boss/1.1 DM S03 Commands.txt"}
        ]
    },
    {
        "order_index": 7,
        "title": "CLI Management of Virtual Networks",
        "description": "Creating user-defined bridge networks with docker network create, attaching running containers dynamically, and isolating multi-tier workloads.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/13. Docker Networks CLI Management of Virtual Networks.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/13. Docker Networks CLI Management of Virtual Networks.srt",
        "duration_seconds": 478,
        "requires_practice": True,
        "companion_files": [
            {"title": "Section 03 Commands Cheat Sheet", "file_type": "txt", "relative_path": "3. Creating and Using Containers Like a Boss/1.1 DM S03 Commands.txt"}
        ]
    },
    {
        "order_index": 8,
        "title": "Container DNS & Automatic Service Discovery",
        "description": "How Docker's embedded 127.0.0.11 DNS server resolves container names automatically on user-defined networks, avoiding hardcoded IP addresses.",
        "video_relative_path": "3. Creating and Using Containers Like a Boss/14. Docker Networks DNS and How Containers Find Each Other.mp4",
        "subtitle_relative_path": "3. Creating and Using Containers Like a Boss/14. Docker Networks DNS and How Containers Find Each Other.srt",
        "duration_seconds": 341,
        "requires_practice": True,
        "companion_files": [
            {"title": "Section 03 Commands Cheat Sheet", "file_type": "txt", "relative_path": "3. Creating and Using Containers Like a Boss/1.1 DM S03 Commands.txt"}
        ]
    }
]

def seed_devops_curriculum(db: Session) -> None:
    """Ensures database tables exist and seeds the DevOps Engineering learning path."""
    Base.metadata.create_all(bind=sync_engine)

    # 1. Subject
    subject = db.query(LearningSubject).filter(LearningSubject.slug == "devops-engineering").first()
    if not subject:
        subject = LearningSubject(
            title="DevOps Engineering & Containerization",
            slug="devops-engineering",
            description="Master enterprise DevOps, Linux container fundamentals, Docker CLI commands, multi-container architecture, and production orchestration.",
            icon="terminal",
            is_active=True
        )
        db.add(subject)
        db.flush()

    # 2. Modules
    modules_meta = [
        {"order": 1, "slug": "docker-fundamentals", "title": "Docker Fundamentals", "desc": "Foundations of containerization, process isolation, CLI lifecycle, virtual networks, and service discovery.", "req": True},
        {"order": 2, "slug": "custom-images-dockerfiles", "title": "Custom Images & Dockerfiles", "desc": "Writing clean Dockerfiles, image layers, build cache optimization, named volumes, and persistent data.", "req": True},
        {"order": 3, "slug": "docker-compose", "title": "Multi-Container Docker Compose", "desc": "Defining multi-service stacks with docker-compose.yml, environment variable injection, and microservices.", "req": True},
        {"order": 4, "slug": "swarm-kubernetes", "title": "Cluster Orchestration (Swarm & Kubernetes)", "desc": "Multi-node clustering, overlay networks, Kubernetes Pods, ReplicaSets, Services, and declarative YAML.", "req": False},
        {"order": 5, "slug": "security-hardening", "title": "DevOps Security & Production Hardening", "desc": "Rootless containers, CVE image scanning, AppArmor/Seccomp profiles, and Docker Bench hardening.", "req": False},
    ]

    module_map = {}
    for m in modules_meta:
        mod = db.query(LearningModule).filter(
            LearningModule.subject_id == subject.id,
            LearningModule.slug == m["slug"]
        ).first()
        if not mod:
            mod = LearningModule(
                subject_id=subject.id,
                title=m["title"],
                slug=m["slug"],
                order_index=m["order"],
                description=m["desc"],
                is_required=m["req"]
            )
            db.add(mod)
            db.flush()
        module_map[m["slug"]] = mod

    # 3. Seed Lessons for Module 1
    m1 = module_map["docker-fundamentals"]
    for l_data in MODULE_1_LESSONS:
        lesson = db.query(LearningLesson).filter(
            LearningLesson.module_id == m1.id,
            LearningLesson.order_index == l_data["order_index"]
        ).first()
        if not lesson:
            lesson = LearningLesson(
                module_id=m1.id,
                title=l_data["title"],
                description=l_data["description"],
                video_relative_path=l_data["video_relative_path"],
                subtitle_relative_path=l_data["subtitle_relative_path"],
                duration_seconds=l_data["duration_seconds"],
                order_index=l_data["order_index"],
                companion_files=l_data["companion_files"],
                requires_practice=l_data["requires_practice"]
            )
            db.add(lesson)
        else:
            # Update paths and descriptions if already seeded
            lesson.title = l_data["title"]
            lesson.description = l_data["description"]
            lesson.video_relative_path = l_data["video_relative_path"]
            lesson.subtitle_relative_path = l_data["subtitle_relative_path"]
            lesson.duration_seconds = l_data["duration_seconds"]
            lesson.companion_files = l_data["companion_files"]
            lesson.requires_practice = l_data["requires_practice"]

    # 4. Seed Capstone Assignment for Module 1
    assignment = db.query(LearningAssignment).filter(LearningAssignment.module_id == m1.id).first()
    assignment_instructions = (
        "### Module 1 Capstone: Containerize & Interconnect a Web Service\n\n"
        "**Scenario:** You need to launch an isolated web service on an internal custom bridge network, "
        "connect a secondary debug client container, and demonstrate that both containers communicate by DNS name.\n\n"
        "**Required Tasks:**\n"
        "1. Create a user-defined bridge network named `devops-net`.\n"
        "2. Run an `nginx:alpine` web server named `web-app` on `devops-net`, publishing port `8080:80` to your host machine.\n"
        "3. Run an interactive temporary container (`curl-client`) on the same `devops-net` network.\n"
        "4. From inside `curl-client`, execute `curl http://web-app` to verify internal DNS resolution without using IP addresses.\n"
        "5. Inspect active containers using `docker ps` and check network membership using `docker network inspect devops-net`.\n\n"
        "**Submission Evidence Required:**\n"
        "- List of all CLI commands executed.\n"
        "- Terminal output showing successful curl response and `docker ps`.\n"
        "- Short explanation (2–4 sentences): *Why does Docker DNS resolution work on user-defined networks but fail on the default bridge?*"
    )
    if not assignment:
        assignment = LearningAssignment(
            module_id=m1.id,
            title="Containerize & Interconnect a Web Service",
            instructions=assignment_instructions,
            max_score=100,
            passing_score=70,
            is_required=True
        )
        db.add(assignment)
    else:
        assignment.instructions = assignment_instructions
        assignment.title = "Containerize & Interconnect a Web Service"

    db.commit()

if __name__ == "__main__":
    db = SyncSessionLocal()
    try:
        seed_devops_curriculum(db)
        print("Successfully seeded DevOps Learning Path curriculum and Module 1 lessons!")
    finally:
        db.close()

