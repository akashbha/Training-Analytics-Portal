"""End-to-end Admin & ML release verification script.

Runs four isolated verification phases without resetting the main development DB:
1. Fresh empty DB (1 admin only): verifies '-' cohort pass rate & honest empty states.
2. Isolated fresh seeded DB (backend/scripts/seed.py --reset against temp DB):
   - Verifies trainer/trainee RBAC (403 on admin routes)
   - Verifies ML Unavailable vs Rule Fallback Used (with process-scoped counter)
   - Verifies Evaluation artifact mtime vs unrecorded execution time
   - Verifies multi-page trainer loading, inactive (422) & duplicate (409) guards,
     concurrent error recovery, and post-reload persistence
3. Live ML microservice online check (uvicorn ml_service.main:app on port 8001):
   - Verifies Admin UI renders Service Status: All Services Up / Available
   - Verifies Model Evaluation card still shows honest baseline comparison
   - Verifies GET /analytics/trainees/{id}/risk returns method='ml' on eligible trainee
4. Main dev DB untouched sanity check (admin console loads live telemetry cleanly).

Usage (from repository root):
    backend\\venv\\Scripts\\python.exe backend/scripts/verify_admin_release.py [--artifacts-dir PATH]
"""

import argparse
import asyncio
import base64
import functools
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import websockets

print = functools.partial(print, flush=True)

SCRIPT_PATH = Path(__file__).resolve()
BACKEND_DIR = SCRIPT_PATH.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
PYTHON_EXE = sys.executable

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
]


def find_chrome() -> str:
    for path in CHROME_CANDIDATES:
        if path and os.path.exists(path):
            return path
    raise RuntimeError("Could not find Chrome/Chromium binary for headless CDP verification.")


class CDP:
    def __init__(self, ws, artifacts_dir: Path):
        self.ws = ws
        self.artifacts_dir = artifacts_dir
        self.msg_id = 0

    async def send(self, method, params=None):
        self.msg_id += 1
        cid = self.msg_id
        payload = {"id": cid, "method": method}
        if params:
            payload["params"] = params
        await self.ws.send(json.dumps(payload))
        while True:
            raw = await self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == cid:
                return data.get("result", {})

    async def eval(self, expr):
        res = await self.send(
            "Runtime.evaluate",
            {"expression": expr, "returnByValue": True, "awaitPromise": True},
        )
        return res.get("result", {}).get("value")

    async def snap(self, filename: str):
        path = self.artifacts_dir / filename
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(res["data"]))
        print(f"Captured: {path}")


def wait_for_port(url: str, max_attempts: int = 30) -> bool:
    for _ in range(max_attempts):
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status in (200, 404):
                    return True
        except Exception:
            pass
        time.sleep(0.7)
    return False


def http_json(url: str, method: str = "GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8").strip()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8").strip()
        return e.code, (json.loads(raw) if raw else None)


def start_backend(db_url=None):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_DIR)
    env["ALLOWED_ORIGINS"] = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://localhost:3000"
    if db_url:
        env["DATABASE_URL"] = db_url
    proc = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(PROJECT_ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    assert wait_for_port("http://127.0.0.1:8000/health"), "Backend failed to start on 8000"
    return proc


def start_ml_service():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_DIR)
    proc = subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "ml_service.main:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    assert wait_for_port("http://127.0.0.1:8001/health"), "ML microservice failed to start on 8001"
    return proc


def stop_proc(proc):
    if not proc:
        return
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def run_db_script(db_url: str, code: str) -> str:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_DIR)
    env["DATABASE_URL"] = db_url
    res = subprocess.run(
        [PYTHON_EXE, "-c", code],
        cwd=str(PROJECT_ROOT),
        env=env,
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        raise RuntimeError(f"DB script failed:\nSTDOUT:{res.stdout}\nSTDERR:{res.stderr}")
    return res.stdout.strip()


async def run_verification(artifacts_dir: Path, keep_artifacts: bool):
    chrome_path = find_chrome()
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    temp_dir = Path(tempfile.mkdtemp(prefix="tap_release_verify_"))
    empty_db_file = temp_dir / "fresh_empty.db"
    seeded_db_file = temp_dir / "fresh_seeded.db"
    chrome_profile = temp_dir / "chrome_profile"
    empty_db_url = "sqlite:///" + str(empty_db_file).replace("\\", "/")
    seeded_db_url = "sqlite:///" + str(seeded_db_file).replace("\\", "/")

    env_fe = os.environ.copy()
    env_fe["VITE_API_URL"] = "http://127.0.0.1:8000"
    npx_cmd = ["cmd.exe", "/c", "npx"] if os.name == "nt" else ["npx"]
    frontend_proc = subprocess.Popen(
        [*npx_cmd, "vite", "--host", "127.0.0.1", "--port", "5173"],
        cwd=str(FRONTEND_DIR),
        env=env_fe,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    assert wait_for_port("http://127.0.0.1:5173"), "Frontend failed to start on 5173"

    chrome_proc = subprocess.Popen(
        [
            chrome_path,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--window-size=1520,1200",
            "--remote-debugging-port=9311",
            f"--user-data-dir={chrome_profile}",
        ]
    )

    ws_url = None
    for _ in range(25):
        await asyncio.sleep(0.8)
        try:
            with urllib.request.urlopen("http://127.0.0.1:9311/json", timeout=2) as resp:
                pages = json.loads(resp.read().decode())
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
        except Exception:
            pass
    assert ws_url, "Failed to connect Chrome CDP"

    backend_proc = None
    ml_proc = None
    try:
        async with websockets.connect(ws_url, max_size=40 * 1024 * 1024) as ws:
            cdp = CDP(ws, artifacts_dir)
            await cdp.send("Page.enable")
            await cdp.send("Runtime.enable")

            # =========================================================
            # PHASE 1: Fresh Empty DB (Schema + 1 Admin Only)
            # =========================================================
            print("\n=== PHASE 1: Fresh Empty DB Verification ===")
            run_db_script(
                empty_db_url,
                """
import app.models
from sqlalchemy.orm import sessionmaker
from app.db.session import sync_engine
from app.db.base import Base
from app.models.user import User
from app.core.security import get_password_hash
Base.metadata.create_all(bind=sync_engine)
db = sessionmaker(bind=sync_engine)()
db.add(User(email='admin@example.com', password_hash=get_password_hash('Admin123!'), role='admin', is_active=True))
db.commit()
db.close()
""",
            )
            backend_proc = start_backend(empty_db_url)
            st, auth = http_json(
                "http://127.0.0.1:8000/auth/login",
                "POST",
                {"email": "admin@example.com", "password": "Admin123!"},
            )
            assert st == 200
            token = auth["access_token"]
            st, ov = http_json("http://127.0.0.1:8000/analytics/overview", token=token)
            assert st == 200 and ov["mean_cohort_pass_rate_pct"] is None and ov["total_batches"] == 0, ov

            await cdp.send("Page.navigate", {"url": "http://127.0.0.1:5173/login"})
            await asyncio.sleep(1.5)
            await cdp.eval(
                f"(() => {{ localStorage.setItem('token', '{token}'); localStorage.setItem('user', JSON.stringify({json.dumps(auth['user'])})); }})()"
            )
            await cdp.send("Page.navigate", {"url": "http://127.0.0.1:5173/admin"})
            await asyncio.sleep(3.5)

            empty_dom = await cdp.eval(
                """
                (() => {
                    const lower = document.body.innerText.toLowerCase();
                    return {
                        hasNoAssessed: lower.includes('no assessed cohorts yet'),
                        hasZeroCohorts: lower.includes('0 cohorts'),
                        hasNoActiveBatches: lower.includes('no active cohort batches'),
                    };
                })()
                """
            )
            assert all(empty_dom.values()), f"Empty DB DOM failed: {empty_dom}"
            await cdp.snap("fresh_empty_admin_dashboard.png")
            stop_proc(backend_proc)
            backend_proc = None

            # =========================================================
            # PHASE 2: Fresh Seeded DB + RBAC + Checks 1-4 (ML Offline)
            # =========================================================
            print("\n=== PHASE 2: Fresh Seeded DB (scripts/seed.py --reset) & Checks 1-4 ===")
            seed_env = os.environ.copy()
            seed_env["PYTHONPATH"] = str(BACKEND_DIR)
            seed_env["DATABASE_URL"] = seeded_db_url
            seed_res = subprocess.run(
                [PYTHON_EXE, "scripts/seed.py", "--reset"],
                cwd=str(BACKEND_DIR),
                env=seed_env,
                capture_output=True,
                text=True,
            )
            assert seed_res.returncode == 0, f"seed.py --reset failed:\n{seed_res.stdout}\n{seed_res.stderr}"
            backend_proc = start_backend(seeded_db_url)

            for email, pw in [("trainer@example.com", "Trainer@123"), ("trainee@example.com", "Trainee@123")]:
                st_u, u_auth = http_json("http://127.0.0.1:8000/auth/login", "POST", {"email": email, "password": pw})
                assert st_u == 200
                u_tok = u_auth["access_token"]
                for method, path, body in [
                    ("GET", "/admin/users", None),
                    ("GET", "/admin/service-health", None),
                    ("GET", "/admin/model-evaluation", None),
                    ("POST", "/batches/1/trainers", {"trainer_id": 2}),
                    ("DELETE", "/batches/1/trainers/2", None),
                ]:
                    st_rbac, _ = http_json(f"http://127.0.0.1:8000{path}", method, body, token=u_tok)
                    assert st_rbac == 403, f"Expected 403 for {email} on {method} {path}, got {st_rbac}"
            print("Runtime RBAC checks passed (403 on all tested admin routes).")

            st, auth = http_json(
                "http://127.0.0.1:8000/auth/login",
                "POST",
                {"email": "admin@example.com", "password": "Admin123!"},
            )
            assert st == 200
            token = auth["access_token"]
            await cdp.eval(
                f"(() => {{ localStorage.setItem('token', '{token}'); localStorage.setItem('user', JSON.stringify({json.dumps(auth['user'])})); }})()"
            )
            await cdp.send("Page.navigate", {"url": "http://127.0.0.1:5173/admin"})
            await asyncio.sleep(3.5)

            await cdp.eval(
                """
                (() => {
                    const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.innerText.includes('Service Status'));
                    if (h3) { h3.scrollIntoView({ behavior: 'instant', block: 'start' }); window.scrollBy(0, -80); }
                })()
                """
            )
            await asyncio.sleep(1.0)
            pre_checks = await cdp.eval(
                """
                (() => {
                    const lower = document.body.innerText.toLowerCase();
                    return {
                        hasMlUnavailable: lower.includes('ml unavailable'),
                        hasFallbackAvailable: lower.includes('rule fallback available'),
                        hasFallbackActiveOld: lower.includes('fallback active'),
                        hasArtifactModified: lower.includes('evaluation artifact modified:'),
                        hasExecNotRecorded: lower.includes('execution time: not recorded'),
                        hasMeanCohortPassRate: lower.includes('mean cohort pass rate'),
                        hasCohortsAvgBelow60: lower.includes('cohorts with avg score < 60%'),
                    };
                })()
                """
            )
            assert pre_checks["hasMlUnavailable"] and pre_checks["hasFallbackAvailable"]
            assert not pre_checks["hasFallbackActiveOld"]
            assert pre_checks["hasArtifactModified"] and pre_checks["hasExecNotRecorded"]
            assert pre_checks["hasMeanCohortPassRate"] and pre_checks["hasCohortsAvgBelow60"]
            await cdp.snap("check_1_2_4_ml_unavailable_before_fallback.png")

            _, trainees_res = http_json("http://127.0.0.1:8000/trainees?page=1&page_size=20", token=token)
            fallback_triggered = False
            for t in trainees_res["items"]:
                st_r, risk = http_json(f"http://127.0.0.1:8000/analytics/trainees/{t['id']}/risk", token=token)
                reason_lower = str((risk or {}).get("reason", "")).lower()
                if st_r == 200 and risk and ("unreachable" in reason_lower or "timed out" in reason_lower):
                    fallback_triggered = True
                    print(f"Runtime fallback triggered on trainee #{t['id']}: {risk.get('reason')}")
                    break
            assert fallback_triggered

            await cdp.eval("document.querySelector('button[title=\"Run live service health probe\"]').click()")
            await asyncio.sleep(1.5)
            post_fallback = await cdp.eval(
                """
                (() => {
                    const lower = document.body.innerText.toLowerCase();
                    return {
                        hasRuleFallbackUsed: lower.includes('rule fallback used'),
                        hasScopeLabel: lower.includes('1x since this backend process started'),
                    };
                })()
                """
            )
            assert post_fallback["hasRuleFallbackUsed"] and post_fallback["hasScopeLabel"], post_fallback
            await cdp.snap("check_1_rule_fallback_used.png")

            # Add 1 inactive trainer + 102 active trainers to test pagination, inactive (422), duplicate (409), persistence
            out = run_db_script(
                seeded_db_url,
                """
import app.models
from sqlalchemy.orm import sessionmaker
from app.db.session import sync_engine
from app.models.user import User
from app.core.security import get_password_hash
db = sessionmaker(bind=sync_engine)()
pw = get_password_hash('Pass123!')
inactive = User(email='inactive.trainer@example.com', password_hash=pw, role='trainer', is_active=False)
db.add(inactive)
for i in range(1, 103):
    db.add(User(email=f'trainer_page2_{i:03d}@example.com', password_hash=pw, role='trainer', is_active=True))
db.commit()
print(inactive.id)
db.close()
""",
            )
            inactive_id = int(out.splitlines()[-1])
            st_inact, err_inact = http_json(
                "http://127.0.0.1:8000/batches/1/trainers", "POST", {"trainer_id": inactive_id}, token=token
            )
            assert st_inact == 422 and err_inact["error"]["code"] == "INACTIVE_TRAINER"

            _, b1_trainers = http_json("http://127.0.0.1:8000/batches/1/trainers", token=token)
            st_dup, err_dup = http_json(
                "http://127.0.0.1:8000/batches/1/trainers", "POST", {"trainer_id": b1_trainers[0]["trainer_id"]}, token=token
            )
            assert st_dup == 409 and err_dup["error"]["code"] == "TRAINER_ALREADY_ASSIGNED"

            await cdp.send("Page.reload", {"ignoreCache": True})
            await asyncio.sleep(3.5)
            await cdp.eval("document.querySelector('button[aria-label=\"Manage Trainers for Batch A - Web Core\"]')?.click()")
            await asyncio.sleep(1.5)
            assert await cdp.eval("document.body.innerText.includes('inactive trainer account excluded from assignment')")

            # Search inactive trainer -> disabled Inactive row, 0 Assign buttons
            await cdp.eval(
                """
                (() => {
                    const inp = document.querySelector('input[placeholder="Filter trainers by email..."]');
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(inp, 'inactive.trainer');
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                })()
                """
            )
            await asyncio.sleep(0.5)
            assert await cdp.eval(
                "document.body.innerText.includes('inactive.trainer@example.com') && Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === 'Assign').length === 0"
            )

            # Page-2 concurrent conflict test & clean assign persistence test
            await cdp.eval(
                """
                (() => {
                    const inp = document.querySelector('input[placeholder="Filter trainers by email..."]');
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(inp, 'trainer_page2_102');
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                })()
                """
            )
            await asyncio.sleep(0.5)
            _, p2_search = http_json(
                "http://127.0.0.1:8000/admin/users?role=trainer&search=trainer_page2_102&page=1&page_size=20",
                token=token,
            )
            http_json("http://127.0.0.1:8000/batches/1/trainers", "POST", {"trainer_id": p2_search["items"][0]["id"]}, token=token)
            await cdp.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Assign')?.click()")
            await asyncio.sleep(1.5)
            assert await cdp.eval("document.body.innerText.toLowerCase().includes('already assigned') && document.body.innerText.includes('trainer_page2_102@example.com')")
            await cdp.snap("check_3_manage_trainers_paginated_inactive.png")

            # Clean UI assign of trainer_page2_101 & reload persistence
            await cdp.eval(
                """
                (() => {
                    const inp = document.querySelector('input[placeholder="Filter trainers by email..."]');
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(inp, 'trainer_page2_101');
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                })()
                """
            )
            await asyncio.sleep(0.5)
            await cdp.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Assign')?.click()")
            await asyncio.sleep(1.5)
            await cdp.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Done')?.click()")
            await asyncio.sleep(0.8)
            await cdp.send("Page.reload", {"ignoreCache": True})
            await asyncio.sleep(3.5)
            assert await cdp.eval(
                "Array.from(document.querySelectorAll('span')).some(s => s.innerText.trim() === '+2' && (s.getAttribute('title') || '').includes('trainer_page2_101@example.com'))"
            )

            # =========================================================
            # PHASE 3: Live ML-Online Check (ML Microservice Running)
            # =========================================================
            print("\n=== PHASE 3: Live ML Microservice Online Check ===")
            ml_proc = start_ml_service()

            eligible_ml_ok = False
            for t in trainees_res["items"]:
                st_r, risk = http_json(f"http://127.0.0.1:8000/analytics/trainees/{t['id']}/risk", token=token)
                if st_r == 200 and risk and risk.get("method") == "ml":
                    eligible_ml_ok = True
                    print(
                        f"Eligible trainee #{t['id']} ML risk response verified: "
                        f"method={risk.get('method')}, probability={risk.get('probability')}, model_version={risk.get('model_version')}"
                    )
                    break
            assert eligible_ml_ok, "Expected at least one eligible trainee returning method='ml' while ML service is online"

            await cdp.eval(
                """
                (() => {
                    const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.innerText.includes('Service Status'));
                    if (h3) { h3.scrollIntoView({ behavior: 'instant', block: 'start' }); window.scrollBy(0, -80); }
                })()
                """
            )
            await asyncio.sleep(0.8)
            await cdp.eval("document.querySelector('button[title=\"Run live service health probe\"]').click()")
            await asyncio.sleep(1.5)
            ml_online_dom = await cdp.eval(
                """
                (() => {
                    const lower = document.body.innerText.toLowerCase();
                    return {
                        allServicesUp: lower.includes('all services up'),
                        randomForest: lower.includes('random forest'),
                        stillShowsEvalTruth: lower.includes('model does not beat the baseline rule'),
                    };
                })()
                """
            )
            print("Live ML-online Admin DOM checks:", ml_online_dom)
            assert all(ml_online_dom.values()), ml_online_dom
            await cdp.snap("verify_admin_ml_online.png")

            stop_proc(ml_proc)
            ml_proc = None
            stop_proc(backend_proc)
            backend_proc = None

            # =========================================================
            # PHASE 4: Main Dev DB Untouched Sanity Verification
            # =========================================================
            print("\n=== PHASE 4: Main Dev DB Verification ===")
            backend_proc = start_backend(db_url=None)
            st, auth = http_json(
                "http://127.0.0.1:8000/auth/login",
                "POST",
                {"email": "admin@example.com", "password": "Admin123!"},
            )
            assert st == 200
            token = auth["access_token"]
            await cdp.eval(
                f"(() => {{ localStorage.setItem('token', '{token}'); localStorage.setItem('user', JSON.stringify({json.dumps(auth['user'])})); }})()"
            )
            await cdp.send("Page.navigate", {"url": "http://127.0.0.1:5173/admin"})
            await asyncio.sleep(3.5)
            assert await cdp.eval(
                "document.body.innerText.toLowerCase().includes('ml unavailable') && document.body.innerText.toLowerCase().includes('mean cohort pass rate')"
            )
            await cdp.snap("verify_admin_final_main_db.png")

            print("\nALL RELEASE VERIFICATION PHASES (INCLUDING LIVE ML ONLINE CHECK) PASSED.")

    finally:
        stop_proc(chrome_proc)
        stop_proc(ml_proc)
        stop_proc(backend_proc)
        stop_proc(frontend_proc)
        shutil.rmtree(temp_dir, ignore_errors=True)
        if not keep_artifacts:
            shutil.rmtree(artifacts_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Verify Admin release checkpoint across empty, seeded, ML-online, and main DB states.")
    parser.add_argument("--artifacts-dir", type=str, default=None, help="Optional directory to retain captured verification PNG screenshots.")
    args = parser.parse_args()

    if args.artifacts_dir:
        artifacts_dir = Path(args.artifacts_dir)
        keep_artifacts = True
    else:
        artifacts_dir = Path(tempfile.mkdtemp(prefix="tap_verify_shots_"))
        keep_artifacts = False

    asyncio.run(run_verification(artifacts_dir, keep_artifacts))


if __name__ == "__main__":
    main()
