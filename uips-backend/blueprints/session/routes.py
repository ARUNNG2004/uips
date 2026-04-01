import os
import time
import json
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from database.db import db
from models.session import ExamSession
from models.exam import Exam
from models.media import MediaChunk
from utils.auth_helpers import role_required
from utils.report_generator import generate_report

session_bp = Blueprint("session", __name__)

import sys

if '__main__' in sys.modules and hasattr(sys.modules['__main__'], 'limiter'):
    limiter = sys.modules['__main__'].limiter
else:
    try:
        from app import limiter
    except ImportError:
        class DummyLimiter:
            def limit(self, *args, **kwargs):
                def decorator(f):
                    return f
                return decorator
        limiter = DummyLimiter()

@session_bp.route("/api/session/start", methods=["POST"])
@role_required("student")
def start_session():
    """Start an exam session."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    exam_id = data.get("exam_id")
    if not exam_id:
        return jsonify({"error": "exam_id is required"}), 400

    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    ex_status = exam.status.value if hasattr(exam.status, "value") else exam.status
    if ex_status != "active":
        return jsonify({"error": "Exam is not active"}), 400

    existing = ExamSession.query.filter_by(
        exam_id=exam_id, student_id=current_user.id, status="ongoing"
    ).first()
    if existing:
        # Return existing ongoing session so student can rejoin (e.g. after invigilator resume)
        return jsonify({
            "session_id": existing.id,
            "exam_id": exam_id,
            "started_at": existing.started_at.isoformat() if existing.started_at else None,
            "resumed": True
        }), 200

    session = ExamSession(
        exam_id=exam_id,
        student_id=current_user.id,
        status="ongoing",
        started_at=datetime.now(timezone.utc)
    )
    db.session.add(session)
    db.session.commit()

    base_dir = f"uploads/sessions/{session.id}"
    os.makedirs(f"{base_dir}/video", exist_ok=True)
    os.makedirs(f"{base_dir}/audio", exist_ok=True)
    os.makedirs(f"{base_dir}/behavior", exist_ok=True)

    return jsonify({
        "session_id": session.id,
        "exam_id": exam_id,
        "started_at": session.started_at.isoformat()
    }), 201


@session_bp.route("/api/session/end", methods=["POST"])
@role_required("student")
def end_session():
    """End an exam session and generate report."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session = ExamSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if session.student_id != current_user.id:
        return jsonify({"error": "Access denied"}), 403

    session.ended_at = datetime.now(timezone.utc)
    session.status = "completed"
    db.session.commit()

    generate_report(session.id)

    return jsonify({
        "session_id": session.id,
        "ended_at": session.ended_at.isoformat(),
        "suspicion_index": session.suspicion_index,
        "status": session.status.value if hasattr(session.status, "value") else session.status
    })


@session_bp.route("/api/session/my", methods=["GET"])
@role_required("student")
def my_sessions():
    """Get all sessions for current student."""
    sessions = ExamSession.query.filter_by(
        student_id=current_user.id
    ).order_by(ExamSession.started_at.desc()).all()
    return jsonify([s.to_dict() for s in sessions])


@session_bp.route("/api/session/stream/video", methods=["POST"])
@role_required("student")
@limiter.limit("10 per second")
def stream_video():
    """Upload video frame."""
    session_id = request.form.get("session_id")
    frame = request.files.get("frame")

    if not session_id or not frame:
        return jsonify({"error": "session_id and frame are required"}), 400

    session = ExamSession.query.get(session_id)
    if not session or session.student_id != current_user.id:
        return jsonify({"error": "Access denied or session not found"}), 403

    sess_status = session.status.value if hasattr(session.status, "value") else session.status
    if sess_status != "ongoing":
        return jsonify({"error": "Session is not ongoing"}), 400

    ts = int(time.time() * 1000)
    save_dir = f"uploads/sessions/{session_id}/video"
    os.makedirs(save_dir, exist_ok=True)
    file_path = f"{save_dir}/frame_{ts}.jpg"

    frame.save(file_path)

    chunk = MediaChunk(
        session_id=session.id,
        chunk_type="video",
        file_path=file_path
    )
    db.session.add(chunk)
    db.session.commit()

    return jsonify({"saved": True, "path": file_path})


@session_bp.route("/api/session/stream/audio", methods=["POST"])
@role_required("student")
@limiter.limit("5 per second")
def stream_audio():
    """Upload audio chunk."""
    session_id = request.form.get("session_id")
    chunk_file = request.files.get("chunk")

    if not session_id or not chunk_file:
        return jsonify({"error": "session_id and chunk are required"}), 400

    session = ExamSession.query.get(session_id)
    if not session or session.student_id != current_user.id:
        return jsonify({"error": "Access denied or session not found"}), 403

    sess_status = session.status.value if hasattr(session.status, "value") else session.status
    if sess_status != "ongoing":
        return jsonify({"error": "Session is not ongoing"}), 400

    ts = int(time.time() * 1000)
    save_dir = f"uploads/sessions/{session_id}/audio"
    os.makedirs(save_dir, exist_ok=True)
    file_path = f"{save_dir}/audio_{ts}.wav"

    chunk_file.save(file_path)

    chunk = MediaChunk(
        session_id=session.id,
        chunk_type="audio",
        file_path=file_path
    )
    db.session.add(chunk)
    db.session.commit()

    return jsonify({"saved": True})


@session_bp.route("/api/session/stream/behavior", methods=["POST"])
@role_required("student")
@limiter.limit("20 per second")
def stream_behavior():
    """Upload behavior logs."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    session_id = data.get("session_id")
    event_type = data.get("event_type")
    timestamp = data.get("timestamp")

    if not session_id or not event_type:
        return jsonify({"error": "session_id and event_type are required"}), 400

    session = ExamSession.query.get(session_id)
    if not session or session.student_id != current_user.id:
        return jsonify({"error": "Access denied or session not found"}), 403

    sess_status = session.status.value if hasattr(session.status, "value") else session.status
    if sess_status != "ongoing":
        return jsonify({"error": "Session is not ongoing"}), 400

    save_dir = f"uploads/sessions/{session_id}/behavior"
    os.makedirs(save_dir, exist_ok=True)
    file_path = f"{save_dir}/log.json"

    with open(file_path, "a", encoding="utf-8") as f:
        json.dump({"event_type": event_type, "timestamp": timestamp}, f)
        f.write("\n")

    chunk = MediaChunk(
        session_id=session.id,
        chunk_type="behavior",
        file_path=file_path
    )
    db.session.add(chunk)
    db.session.commit()

    return jsonify({"logged": True})


@session_bp.route("/api/session/ml-analysis", methods=["POST"])
@role_required("student")
def ml_analysis():
    """Run ML inference on session data and return integrity scores."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session = ExamSession.query.get(session_id)
    if not session or session.student_id != current_user.id:
        return jsonify({"error": "Access denied or session not found"}), 403

    try:
        # Import ML inference module
        from ml.inference import run_inference

        # Run ML inference on session data
        ml_results = run_inference(session_id)

        # Extract risk scores from results
        # ML returns a dict with suspicion metrics - convert to risk scores
        suspicion_index = float(ml_results.get('suspicion_index', 0))

        # Convert suspicion index (0-100) to risk scores
        # Higher suspicion = higher risk
        audio_risk = min(100, suspicion_index * 0.7)  # Audio contributes 70% of risk
        visual_risk = min(100, suspicion_index * 0.8)  # Visual contributes 80% of risk
        behavior_risk = min(100, suspicion_index * 0.9)  # Behavior contributes 90% of risk

        # Calculate overall integrity score (0-100, where 100 is highest integrity)
        # Integrity = 100 - average risk
        avg_risk = (audio_risk + visual_risk + behavior_risk) / 3
        integrity_score = max(0, int(100 - avg_risk))

        # Extract detailed detection results from trained ML model
        face_detected = ml_results.get('face_detected', False)
        face_count = ml_results.get('face_count', 0)
        anomalies = ml_results.get('anomalies', [])

        return jsonify({
            "audio_risk": round(audio_risk, 2),
            "visual_risk": round(visual_risk, 2),
            "behavior_risk": round(behavior_risk, 2),
            "integrity_score": integrity_score,
            "face_detected": face_detected,
            "face_count": face_count,
            "anomalies": anomalies
        })

    except Exception as e:
        print(f"ML Analysis error: {e}")
        # Return safe defaults on any error - assume good behavior until proven otherwise
        return jsonify({
            "audio_risk": 0,
            "visual_risk": 0,
            "behavior_risk": 0,
            "integrity_score": 100
        })


@session_bp.route("/api/session/submit-exam-analysis", methods=["POST"])
@role_required("student")
def submit_exam_analysis():
    """Submit exam answers and ML analysis scores, finalizing the session."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    session_id = data.get("session_id")
    answers = data.get("answers", {})
    score = data.get("score", 0)
    ml_analysis = data.get("ml_analysis", {})

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    session = ExamSession.query.get(session_id)
    if not session or session.student_id != current_user.id:
        return jsonify({"error": "Access denied or session not found"}), 403

    # Update session with exam results
    session.answers = answers
    session.score = float(score)
    session.audio_risk = float(ml_analysis.get("audio_risk", 0))
    session.visual_risk = float(ml_analysis.get("visual_risk", 0))
    session.behavior_risk = float(ml_analysis.get("behavior_risk", 0))
    session.integrity_score = float(ml_analysis.get("integrity_score", 100))

    # Mark session as completed
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)

    try:
        db.session.commit()

        # Generate report for completed session
        generate_report(session.id)

        return jsonify({
            "success": True,
            "session_id": session.id,
            "message": "Exam completed and analysis saved"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving exam analysis: {e}")
        return jsonify({"error": "Failed to save exam analysis"}), 500
