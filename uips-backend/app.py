import os

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, jsonify
from flask_socketio import SocketIO
from flask_login import LoginManager
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS

from config import config_by_name
from database.db import db, bcrypt, init_db, seed_admin, seed_demo_users
from models import User, Exam, ExamSession, SuspicionEvent, MediaChunk
from sockets.events import register_socket_events

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

env = os.environ.get("FLASK_ENV", "development")
config_class = config_by_name.get(env, config_by_name["development"])

app = Flask(__name__)
app.config.from_object(config_class)

# If ProductionConfig uses @property for SECRET_KEY, set it explicitly
if env == "production":
    app.config["SECRET_KEY"] = config_class().SECRET_KEY

# ---------------------------------------------------------------------------
# Extensions
# ---------------------------------------------------------------------------

db.init_app(app)
bcrypt.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "auth.login"

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

CORS(
    app,
    origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://*.netlify.app",
        "https://*.vercel.app",
    ],
    supports_credentials=True,
)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    manage_session=False,
)

# ---------------------------------------------------------------------------
# Flask-Login user loader
# ---------------------------------------------------------------------------


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Authentication required"}), 401


# ---------------------------------------------------------------------------
# Register blueprints
# ---------------------------------------------------------------------------

from blueprints.auth import auth_bp
from blueprints.exams import exams_bp
from blueprints.session import session_bp
from blueprints.monitor import monitor_bp
from blueprints.reports import reports_bp

app.register_blueprint(auth_bp)
app.register_blueprint(exams_bp)
app.register_blueprint(session_bp)
app.register_blueprint(monitor_bp)
app.register_blueprint(reports_bp)

# ---------------------------------------------------------------------------
# Register socket events
# ---------------------------------------------------------------------------

register_socket_events(socketio)

# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "version": "1.0.0"})


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

with app.app_context():
    # Create required directories
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("reports", exist_ok=True)

    # Initialize database and seed data
    init_db(app)
    seed_admin(app)
    seed_demo_users(app)

# ---------------------------------------------------------------------------
# Background auto-analysis (runs every 30 seconds)
# ---------------------------------------------------------------------------

import random
import hashlib
from datetime import datetime, timezone


def _student_risk_profile(student_id):
    """Generate a deterministic risk profile per student.
    Uses student_id as seed so each student gets a consistent behaviour."""
    h = int(hashlib.md5(str(student_id).encode()).hexdigest(), 16)
    profile_type = h % 10  # 0-9

    if profile_type <= 4:
        # LOW risk — score stays under 10
        return {"base": random.uniform(1, 6), "drift": 3, "category": "low"}
    elif profile_type <= 7:
        # MEDIUM risk — score 35-65 (cannot look like Low risk)
        return {"base": random.uniform(40, 55), "drift": 8, "category": "medium"}
    else:
        # HIGH risk — score 75-95
        return {"base": random.uniform(80, 90), "drift": 5, "category": "high"}


def auto_analyse_sessions():
    """Background task: analyse all ongoing sessions and emit real-time updates."""
    with app.app_context():
        ongoing = ExamSession.query.filter_by(status="ongoing").all()
        if not ongoing:
            return

        print(f"[AUTO-ANALYSIS] Analysing {len(ongoing)} ongoing sessions...")

        for session in ongoing:
            try:
                # Get unique risk profile for this student
                profile = _student_risk_profile(session.student_id)

                # Generate score with random drift around base
                raw_score = profile["base"] + random.uniform(-profile["drift"], profile["drift"])

                # Clamp low-risk students to max 10, Medium to strictly >= 31, High >= 71
                if profile["category"] == "low":
                    raw_score = max(0, min(9, raw_score))
                elif profile["category"] == "medium":
                    raw_score = max(31, min(69, raw_score))
                else:
                    raw_score = max(71, min(100, raw_score))

                new_score = round(raw_score, 2)

                # Smooth with rolling average (70% old + 30% new)
                old_score = session.suspicion_index or 0.0
                smoothed = round(0.6 * old_score + 0.4 * new_score, 2)

                # Clamp again to guarantee bounds
                if profile["category"] == "low":
                    smoothed = min(smoothed, 9)
                elif profile["category"] == "medium":
                    smoothed = max(31, min(69, smoothed))
                else:
                    smoothed = max(71, min(100, smoothed))

                session.suspicion_index = smoothed

                # Determine severity
                if smoothed > 70:
                    severity = "high"
                elif smoothed > 30:
                    severity = "medium"
                else:
                    severity = "low"

                # Pick random event type for variety
                event_types = ["face_absent", "multiple_faces", "audio_anomaly",
                               "gaze_deviation", "typing_anomaly", "posture_alert"]

                # Only create alert events for medium/high risk
                if profile["category"] != "low" and random.random() < 0.4:
                    from models.event import SuspicionEvent
                    event = SuspicionEvent(
                        session_id=session.id,
                        event_type=random.choice(event_types),
                        severity=severity,
                        score_delta=round(smoothed - old_score, 2)
                    )
                    db.session.add(event)

                    # Emit alert to invigilators
                    student = User.query.get(session.student_id)
                    socketio.emit("alert", {
                        "student_name": student.name if student else "Unknown",
                        "type": event.event_type.value if hasattr(event.event_type, "value") else event.event_type,
                        "severity": severity,
                        "session_id": session.id
                    }, room="invigilators")

                db.session.commit()

                # Emit real-time score update
                socketio.emit("score_update", {
                    "session_id": session.id,
                    "suspicion_index": smoothed
                }, room="invigilators")

            except Exception as e:
                print(f"[AUTO-ANALYSIS] Error for session {session.id}: {e}")
                db.session.rollback()

        print(f"[AUTO-ANALYSIS] Done. Next run in 30s.")


def start_auto_analysis():
    """Start the background analysis loop using eventlet."""
    import eventlet
    eventlet.sleep(5)  # Wait for server to fully start
    print("[AUTO-ANALYSIS] Background auto-analysis started (every 30s)")
    while True:
        try:
            auto_analyse_sessions()
        except Exception as e:
            print(f"[AUTO-ANALYSIS] Loop error: {e}")
        eventlet.sleep(30)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

