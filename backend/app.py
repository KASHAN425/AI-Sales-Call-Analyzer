import sys
import os
import shutil
import uuid
import json
import threading
import subprocess
import traceback
from datetime import datetime, timedelta

# --------------------------------------------------
# UTF-8 SAFE CONSOLE ENCODING FOR WINDOWS
# --------------------------------------------------
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Depends,
    HTTPException,
    Header,
    Request,
    WebSocket,
    WebSocketDisconnect
)
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
import bcrypt

from database import create_tables, get_connection
from pipeline import process_audio
from live_copilot import (
    create_live_session,
    get_live_session,
    process_live_turn,
    finalize_live_call_and_save,
    calculate_talk_ratio
)

# ==================================================
# JWT CONFIGURATION
# ==================================================
SECRET_KEY = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours for seamless development

# ==================================================
# FASTAPI APP
# ==================================================
app = FastAPI(
    title="AI Sales Call Analyzer",
    description="AI-powered sales call intelligence API using Gemini Generative AI",
    version="2.0.0"
)

# ==================================================
# CORS CONFIGURATION
# ==================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables on startup
try:
    create_tables()
except Exception as e:
    print(f"[DB] Notice during table check: {e}")

# Folders
UPLOAD_FOLDER = "uploads"
JOBS_FOLDER = "jobs"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(JOBS_FOLDER, exist_ok=True)

# In-memory job tracker
jobs = {}


# ==================================================
# AUTHENTICATION DEPENDENCY
# ==================================================
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is required")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        return {
            "id": int(user_id),
            "email": payload.get("email"),
            "name": payload.get("name")
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ==================================================
# AUDIO CONVERSION HELPER
# ==================================================
def convert_to_wav(input_path):
    """
    Converts any audio file to 16kHz mono WAV using ffmpeg.
    Guarantees the output path is never the same as input_path.
    """
    base, ext = os.path.splitext(input_path)
    output_path = base + "_16k.wav"

    if input_path.lower().endswith("_16k.wav"):
        return input_path

    command = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        output_path
    ]

    try:
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"[Audio] Converted successfully: {output_path}")
        return output_path
    except Exception as e:
        print(f"[Audio] Conversion notice ({e}). Using original file: {input_path}")
        return input_path


# ==================================================
# REPORT ENRICHMENT HELPER
# ==================================================
def enrich_report(report):
    """
    Enriches report with next call strategy, suggested conversation script,
    sales coaching, and follow-up actions if not already provided by Gemini AI.
    """
    if not isinstance(report, dict):
        return report

    # If already populated by Gemini Generative AI, keep the real outputs
    if (
        report.get("next_call_strategy")
        and report.get("recommended_conversation")
        and report.get("sales_coaching")
        and report.get("follow_up_actions")
    ):
        return report

    customer = report.get("customer_analysis") or {}
    salesperson = report.get("salesperson_analysis") or {}
    metrics = salesperson.get("metrics") or {}

    primary_need = customer.get("primary_need") or "Product and pricing information"
    score = salesperson.get("performance_score", 70)

    report["next_call_strategy"] = report.get("next_call_strategy") or {
        "suggested_timing": "Within 24 to 48 hours",
        "objective": f"Follow up regarding {primary_need} and present customized options.",
        "priority": "Address all customer questions and establish mutual next steps.",
        "checklist": [
            "Review customer requirements discussed in initial call.",
            "Prepare transparent pricing and timeline packages.",
            "Send meeting recap email prior to call.",
            "Agree on a firm decision milestone."
        ]
    }

    report["recommended_conversation"] = report.get("recommended_conversation") or {
        "opening": "Hi! Thanks for speaking earlier. I'm following up with the specific details and pricing we discussed.",
        "discovery_question": f"Regarding your priority for {primary_need}, what is your target launch timeline?",
        "objection_handling": "Our packages are flexible and designed to provide clear ROI based on your specific requirements.",
        "value_proposition": "We deliver modern, scalable solutions that solve your exact needs efficiently.",
        "closing_question": "Does tomorrow afternoon work for a quick 15-minute walkthrough?"
    }

    report["sales_coaching"] = report.get("sales_coaching") or [
        {
            "area": "Discovery",
            "title": "Ask Deeper Qualification Questions",
            "advice": "Ask open-ended questions about budget, timeline, and decision criteria early in the call."
        },
        {
            "area": "Closing",
            "title": "Establish Concrete Follow-up Times",
            "advice": "Always agree on a specific calendar time and date before ending the interaction."
        }
    ]

    report["follow_up_actions"] = report.get("follow_up_actions") or [
        {
            "action": "Send proposal and pricing overview",
            "detail": "Email packages and scope breakdown within 24 hours."
        },
        {
            "action": "Schedule follow-up review",
            "detail": "Confirm next appointment with calendar invite."
        }
    ]

    return report


# ==================================================
# DATABASE JOB HELPERS
# ==================================================
def init_call_in_database(job_id, audio_file, user_id):
    connection = get_connection()
    if not connection:
        return
    try:
        cursor = connection.cursor()
        query = """
            INSERT INTO calls (user_id, job_id, audio_file, status, report)
            VALUES (%s, %s, %s, 'processing', '{}')
            ON DUPLICATE KEY UPDATE status = 'processing'
        """
        cursor.execute(query, (int(user_id) if user_id else None, job_id, audio_file))
        connection.commit()
        cursor.close()
        connection.close()
        print(f"[DB] Call initialized in database with status 'processing' for Job ID: {job_id}")
    except Exception as e:
        print(f"[DB] Notice initializing call: {e}")


def mark_call_failed_in_database(job_id, error_message):
    connection = get_connection()
    if not connection:
        return
    try:
        cursor = connection.cursor()
        cursor.execute("UPDATE calls SET status = 'failed' WHERE job_id = %s", (job_id,))
        connection.commit()
        cursor.close()
        connection.close()
    except Exception as e:
        print(f"[DB] Notice marking call failed: {e}")


def save_call_to_database(job_id, report, user_id):
    connection = get_connection()
    if not connection:
        print("[DB] Warning: Cannot connect to MySQL to save call.")
        return None

    cursor = None
    try:
        cursor = connection.cursor()
        performance_score = report.get("salesperson_analysis", {}).get("performance_score")
        audio_file = report.get("call_information", {}).get("audio_file", "")
        report_json = json.dumps(report, ensure_ascii=False)

        query = """
            INSERT INTO calls (user_id, job_id, audio_file, status, report, performance_score)
            VALUES (%s, %s, %s, 'completed', %s, %s)
            ON DUPLICATE KEY UPDATE
                status = 'completed',
                report = VALUES(report),
                performance_score = VALUES(performance_score),
                audio_file = VALUES(audio_file)
        """
        values = (
            int(user_id) if user_id else None,
            job_id,
            audio_file,
            report_json,
            performance_score
        )
        cursor.execute(query, values)
        connection.commit()

        cursor.execute("SELECT id FROM calls WHERE job_id = %s", (job_id,))
        row = cursor.fetchone()
        call_id = row[0] if row else cursor.lastrowid
        print(f"[DB] Call saved successfully with ID: {call_id} for User ID: {user_id}")
        return call_id
    except Exception as e:
        print(f"[DB] Error saving call to MySQL: {e}")
        return None
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ==================================================
# BACKGROUND ANALYSIS WORKER
# ==================================================
def run_analysis(job_id, file_path, user_id):
    try:
        jobs[job_id] = {
            "status": "processing",
            "message": "AI analysis is running...",
            "user_id": user_id
        }

        print(f"\n[Worker] Starting analysis for job: {job_id} (User: {user_id})")

        # Convert audio safely
        wav_file = convert_to_wav(file_path)

        # Run AI intelligence pipeline (Whisper + Gemini .invoke())
        report = process_audio(wav_file)
        report = enrich_report(report)

        # Save to MySQL
        call_id = save_call_to_database(job_id, report, user_id)

        jobs[job_id] = {
            "status": "completed",
            "message": "Analysis completed successfully.",
            "report": report,
            "call_id": call_id,
            "user_id": user_id
        }

        print(f"[Worker] Job {job_id} completed successfully (Call ID: {call_id}).\n")

    except Exception as e:
        print(f"[Worker] Analysis failed for job {job_id}: {e}")
        traceback.print_exc()
        mark_call_failed_in_database(job_id, str(e))
        jobs[job_id] = {
            "status": "failed",
            "message": f"Analysis failed: {str(e)}",
            "user_id": user_id
        }


# ==================================================
# ROUTES: HOME & HEALTH
# ==================================================
@app.get("/")
def home():
    return {
        "message": "AI Sales Call Analyzer API",
        "status": "online",
        "version": "2.0.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


# ==================================================
# ROUTE: ANALYZE AUDIO
# ==================================================
@app.post("/analyze")
async def analyze_audio(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    allowed_extensions = [".mp3", ".wav", ".m4a", ".ogg", ".flac"]
    original_name = file.filename or "audio.mp3"
    extension = os.path.splitext(original_name)[1].lower()

    if extension not in allowed_extensions:
        return {
            "success": False,
            "error": "Unsupported audio format. Please upload MP3, WAV, M4A, OGG, or FLAC."
        }

    job_id = str(uuid.uuid4())
    file_name = f"{job_id}{extension}"
    file_path = os.path.join(UPLOAD_FOLDER, file_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        print(f"[Upload] File upload error: {e}")
        return {
            "success": False,
            "error": "Failed to save uploaded audio file."
        }

    jobs[job_id] = {
        "status": "queued",
        "message": "Audio uploaded. AI analysis is queued.",
        "filename": original_name,
        "user_id": current_user["id"]
    }

    # Initialize record in MySQL so job is never lost on restart
    init_call_in_database(job_id, original_name, current_user["id"])

    # Start background analysis thread
    thread = threading.Thread(
        target=run_analysis,
        args=(job_id, file_path, current_user["id"]),
        daemon=True
    )
    thread.start()

    return {
        "success": True,
        "job_id": job_id,
        "status": "queued",
        "message": "Audio uploaded successfully. AI analysis started."
    }


# ==================================================
# ROUTE: CHECK JOB STATUS
# ==================================================
@app.get("/status/{job_id}")
def get_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    # 1. First check in-memory dictionary
    job = jobs.get(job_id)
    if job and job.get("status") in ["queued", "processing", "completed", "failed"]:
        response = {
            "status": job.get("status"),
            "message": job.get("message")
        }
        if job.get("status") == "completed":
            response["call_id"] = job.get("call_id")
            response["report"] = job.get("report")
        return response

    # 2. Database Fallback (if server restarted, multi-worker, or memory cleared)
    connection = get_connection()
    if connection:
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute("SELECT id, status, report, performance_score FROM calls WHERE job_id = %s", (job_id,))
            row = cursor.fetchone()
            cursor.close()
            connection.close()

            if row:
                status = row.get("status") or "completed"
                parsed_report = {}
                try:
                    raw_report = row.get("report")
                    if raw_report and raw_report != "{}":
                        parsed_report = json.loads(raw_report)
                except Exception:
                    parsed_report = {}

                if parsed_report and parsed_report.get("call_information"):
                    status = "completed"

                response = {
                    "status": status,
                    "message": "AI analysis is running..." if status == "processing" else ("Analysis completed." if status == "completed" else "Analysis failed."),
                    "call_id": row["id"],
                    "report": parsed_report
                }
                # Cache back into in-memory jobs
                jobs[job_id] = response
                return response
        except Exception as e:
            print(f"[DB] Error querying job status fallback: {e}")

    raise HTTPException(status_code=404, detail="Job not found.")


# ==================================================
# ROUTE: GET REPORT BY JOB ID
# ==================================================
@app.get("/report/{job_id}")
def get_report_by_job_id(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    job = jobs.get(job_id)
    if job and job.get("status") == "completed":
        return {
            "success": True,
            "report": job.get("report"),
            "call_id": job.get("call_id")
        }

    # Database Fallback
    connection = get_connection()
    if connection:
        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute("SELECT id, status, report FROM calls WHERE job_id = %s", (job_id,))
            row = cursor.fetchone()
            cursor.close()
            connection.close()

            if row and row.get("report") and row["report"] != "{}":
                parsed_report = json.loads(row["report"])
                return {
                    "success": True,
                    "report": parsed_report,
                    "call_id": row["id"]
                }
        except Exception as e:
            print(f"[DB] Error fetching report fallback: {e}")

    if job:
        return {
            "success": False,
            "status": job.get("status"),
            "message": job.get("message", "Analysis is still in progress.")
        }

    raise HTTPException(status_code=404, detail="Job not found.")


# ==================================================
# ROUTE: DASHBOARD STATS
# ==================================================
@app.get("/dashboard/stats")
def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    connection = get_connection()
    if not connection:
        return {
            "success": False,
            "error": "Database connection failed",
            "total_calls": 0,
            "average_score": 0,
            "average_buying_intent": 0
        }

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT report, performance_score
            FROM calls
            """
        )
        rows = cursor.fetchall()
        total_calls = len(rows)

        if total_calls == 0:
            return {
                "success": True,
                "total_calls": 0,
                "average_score": 0,
                "average_buying_intent": 0
            }

        valid_scores = [r["performance_score"] for r in rows if r.get("performance_score") is not None]
        avg_score = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else 0

        buying_scores = []
        for r in rows:
            try:
                rep = json.loads(r["report"])
                cust = rep.get("customer_analysis", {})
                score = cust.get("buying_intent_score")
                if score is not None:
                    buying_scores.append(float(score))
                else:
                    for it in cust.get("intent", []):
                        if isinstance(it, dict) and "buying_intent_score" in it:
                            buying_scores.append(float(it["buying_intent_score"]))
            except Exception:
                pass

        avg_buying = round(sum(buying_scores) / len(buying_scores), 2) if buying_scores else 0.7

        return {
            "success": True,
            "total_calls": total_calls,
            "average_score": avg_score,
            "average_buying_intent": avg_buying
        }
    except Exception as e:
        print(f"[Stats] Error: {e}")
        return {
            "success": False,
            "error": str(e),
            "total_calls": 0,
            "average_score": 0,
            "average_buying_intent": 0
        }
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ==================================================
# ROUTE: LIST CALLS (CALL HISTORY)
# ==================================================
@app.get("/calls")
def get_user_calls(
    current_user: dict = Depends(get_current_user)
):
    connection = get_connection()
    if not connection:
        return {
            "success": False,
            "error": "Database connection failed",
            "calls": []
        }

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, job_id, audio_file, performance_score, created_at, report
            FROM calls
            ORDER BY created_at DESC
            """
        )
        rows = cursor.fetchall()
        calls_list = []

        for r in rows:
            try:
                rep = json.loads(r["report"])
                cust = rep.get("customer_analysis", {})
                sales = rep.get("salesperson_analysis", {})

                # Primary need
                need = cust.get("primary_need")
                if not need:
                    intents = cust.get("intent", [])
                    if intents and isinstance(intents[0], dict):
                        need = intents[0].get("customer_need", "")
                need = need or "Product Inquiry"

                # Sentiment
                sentiment = cust.get("overall_sentiment")
                if not sentiment:
                    s_list = cust.get("sentiment", [])
                    if s_list and isinstance(s_list[0], dict):
                        sentiment = s_list[0].get("label", "Neutral")
                sentiment = (sentiment or "Neutral").title()

                # Buying intent
                buying = cust.get("buying_intent")
                if not buying:
                    b_score = cust.get("buying_intent_score", 0.5)
                    buying = "High" if b_score >= 0.7 else ("Medium" if b_score >= 0.4 else "Low")

                calls_list.append({
                    "id": r["id"],
                    "job_id": r["job_id"],
                    "audio_file": r["audio_file"],
                    "score": r["performance_score"] or sales.get("performance_score", 70),
                    "performance_score": r["performance_score"] or sales.get("performance_score", 70),
                    "sentiment": sentiment,
                    "buying_intent": buying,
                    "need": need,
                    "customer_need": need,
                    "duration": rep.get("call_information", {}).get("duration", 0),
                    "created_at": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
                })
            except Exception as e:
                print(f"[Calls] Error parsing row {r.get('id')}: {e}")

        return {
            "success": True,
            "calls": calls_list
        }
    except Exception as e:
        print(f"[Calls] Error: {e}")
        return {
            "success": False,
            "error": str(e),
            "calls": []
        }
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ==================================================
# ROUTE: GET SINGLE CALL DETAILS
# ==================================================
@app.get("/calls/{call_id}")
def get_single_call(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    # 1. First check in-memory finalized live copilot reports
    try:
        from live_copilot import get_finalized_report
        cached_report = get_finalized_report(call_id)
        if cached_report:
            return {
                "success": True,
                "id": call_id,
                "call_id": call_id,
                "report": cached_report
            }
    except Exception as e:
        print(f"[Single Call] Notice checking live copilot cache: {e}")

    # 2. Check MySQL database
    connection = get_connection()
    if connection:
        cursor = None
        try:
            cursor = connection.cursor(dictionary=True)
            if call_id.isdigit():
                cursor.execute(
                    """
                    SELECT id, job_id, audio_file, performance_score, created_at, report
                    FROM calls
                    WHERE id = %s
                    """,
                    (int(call_id),)
                )
            else:
                cursor.execute(
                    """
                    SELECT id, job_id, audio_file, performance_score, created_at, report
                    FROM calls
                    WHERE job_id = %s
                    """,
                    (call_id,)
                )
            row = cursor.fetchone()
            if row:
                report = json.loads(row["report"])
                report = enrich_report(report)

                return {
                    "success": True,
                    "id": row["id"],
                    "call_id": row["id"],
                    "job_id": row["job_id"],
                    "audio_file": row["audio_file"],
                    "performance_score": row["performance_score"],
                    "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                    "report": report
                }
        except Exception as e:
            print(f"[Single Call] Error: {e}")
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    # 3. Check in-memory background jobs
    job = jobs.get(call_id)
    if job and job.get("report"):
        return {
            "success": True,
            "id": call_id,
            "call_id": call_id,
            "report": job.get("report")
        }

    return {
        "success": False,
        "error": "Call report not found."
    }


# ==================================================
# ROUTE: REGISTER
# ==================================================
@app.post("/auth/register")
async def register_user(
    request: Request,
    name: str = None,
    email: str = None,
    password: str = None
):
    if not name or not email or not password:
        try:
            body = await request.json()
            name = name or body.get("name")
            email = email or body.get("email")
            password = password or body.get("password")
        except Exception:
            pass

    name = (name or "").strip()
    email = (email or "").strip().lower()
    password = password or ""

    if not name or not email or not password:
        return {
            "success": False,
            "error": "Name, email, and password are required."
        }

    connection = get_connection()
    if not connection:
        return {"success": False, "error": "Database connection failed."}

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return {"success": False, "error": "Email is already registered."}

        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
            (name, email, hashed)
        )
        connection.commit()
        user_id = cursor.lastrowid

        token_data = {
            "sub": str(user_id),
            "email": email,
            "name": name,
            "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

        return {
            "success": True,
            "message": "Registration successful.",
            "access_token": access_token,
            "user": {"id": user_id, "name": name, "email": email}
        }
    except Exception as e:
        print(f"[Auth] Register error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ==================================================
# ROUTE: LOGIN (Supports both Query Params and JSON Body)
# ==================================================
@app.post("/auth/login")
async def login_user(
    request: Request,
    email: str = None,
    password: str = None
):
    if not email or not password:
        try:
            body = await request.json()
            email = email or body.get("email")
            password = password or body.get("password")
        except Exception:
            pass

    email = (email or "").strip().lower()
    password = password or ""

    if not email or not password:
        return {
            "success": False,
            "error": "Email and password are required."
        }

    connection = get_connection()
    if not connection:
        return {"success": False, "error": "Database connection failed."}

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, password_hash FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user:
            return {"success": False, "error": "Invalid email or password."}

        is_valid = bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8"))
        if not is_valid:
            return {"success": False, "error": "Invalid email or password."}

        token_data = {
            "sub": str(user["id"]),
            "email": user["email"],
            "name": user["name"],
            "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

        return {
            "success": True,
            "message": "Login successful.",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        }
    except Exception as e:
        print(f"[Auth] Login error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ==================================================
# ROUTE: CURRENT USER
# ==================================================
@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "user": current_user
    }


# ==================================================
# LIVE COPILOT ROUTES (Zoom & Real-time Calling)
# ==================================================

@app.post("/live-call/start")
async def start_live_call(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    session_id = str(uuid.uuid4())
    rep_name = body.get("rep_name") or current_user.get("name", "Sales Representative")
    customer_name = body.get("customer_name") or "Prospective Client"
    meeting_title = body.get("meeting_title") or "Zoom Sales Consultation"

    session = create_live_session(
        session_id=session_id,
        user_id=current_user["id"],
        rep_name=rep_name,
        customer_name=customer_name
    )

    return {
        "success": True,
        "session_id": session_id,
        "rep_name": rep_name,
        "customer_name": customer_name,
        "meeting_title": meeting_title,
        "started_at": session["started_at"]
    }


@app.post("/live-call/turn")
async def submit_live_turn(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    body = await request.json()
    session_id = body.get("session_id")
    role = body.get("role", "SALES REPRESENTATIVE").upper()
    text = body.get("text", "").strip()

    if not session_id or not text:
        return {"success": False, "error": "session_id and text are required."}

    result = process_live_turn(session_id, role, text)
    if "error" in result:
        return {"success": False, "error": result["error"]}

    return {
        "success": True,
        "turn": result["turn"],
        "talk_stats": result["talk_stats"],
        "battlecard": result["battlecard"],
        "total_turns": result["total_turns"],
        "elapsed_seconds": result["elapsed_seconds"]
    }


@app.post("/live-call/finalize")
async def finalize_live_call(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    body = await request.json()
    session_id = body.get("session_id")

    if not session_id:
        return {"success": False, "error": "session_id is required."}

    result = finalize_live_call_and_save(session_id)
    if not result:
        return {"success": False, "error": "Failed to finalize call or no transcript turns found."}

    return {
        "success": True,
        "message": "Call finalized and audit report created successfully.",
        "call_id": result.get("call_id"),
        "report": result.get("report")
    }


@app.websocket("/ws/live-copilot/{session_id}")
async def websocket_live_copilot(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = get_live_session(session_id)
    if not session:
        session = create_live_session(session_id=session_id, user_id=1)

    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "message": "Connected to AI Sales Copilot Live Engine."
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "turn")

            if msg_type == "turn":
                role = data.get("role", "SALES REPRESENTATIVE").upper()
                text = data.get("text", "").strip()
                if text:
                    res = process_live_turn(session_id, role, text)
                    await websocket.send_json({
                        "type": "turn_processed",
                        "turn": res.get("turn"),
                        "talk_stats": res.get("talk_stats"),
                        "battlecard": res.get("battlecard"),
                        "elapsed_seconds": res.get("elapsed_seconds")
                    })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "finalize":
                res = finalize_live_call_and_save(session_id)
                await websocket.send_json({
                    "type": "finalized",
                    "call_id": res.get("call_id") if res else None,
                    "report": res.get("report") if res else None
                })
                break

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected from session {session_id}")
    except Exception as e:
        print(f"[WS] Live copilot exception: {e}")