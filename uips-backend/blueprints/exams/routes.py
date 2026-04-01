from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import current_user

from database.db import db
from models.exam import Exam, ExamMode, ExamStatus
from models.session import ExamSession
from models.event import SuspicionEvent
from models.media import MediaChunk
from utils.auth_helpers import role_required
from utils.validators import validate_exam_mode

exams_bp = Blueprint("exams", __name__)


def _parse_exam_time(value):
    if not isinstance(value, str):
        raise ValueError("Time must be a string")

    normalized = value.strip()

    # Backward compatibility for clients that still send ISO datetime strings.
    if "T" in normalized:
        try:
            parsed_dt = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
            return parsed_dt.time().replace(tzinfo=None, microsecond=0)
        except ValueError:
            pass

    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue

    raise ValueError("Invalid time format")


@exams_bp.route("/api/exams", methods=["GET"])
@role_required("admin", "invigilator", "student")
def list_exams():
    """List all exams as JSON (admin + invigilator)."""
    exams = Exam.query.order_by(Exam.start_time.desc()).all()
    return jsonify([e.to_dict() for e in exams])


@exams_bp.route("/api/exams", methods=["POST"])
@role_required("admin", "invigilator")
def create_exam():
    """Create a new exam (admin/invigilator)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    mode = data.get("mode", "online")
    if not validate_exam_mode(mode):
        return jsonify({"error": "Invalid mode. Must be online or classroom"}), 400

    try:
        start_time_only = _parse_exam_time(data["start_time"])
        end_time_only = _parse_exam_time(data["end_time"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Valid start and end times are required (HH:MM or HH:MM:SS format)"}), 400

    if end_time_only <= start_time_only:
        return jsonify({"error": "end_time must be after start_time"}), 400

    today = datetime.utcnow().date()
    start_time = datetime.combine(today, start_time_only)
    end_time = datetime.combine(today, end_time_only)

    exam = Exam(
        title=title,
        description=data.get("description", ""),
        start_time=start_time,
        end_time=end_time,
        created_by=current_user.id,
        mode=ExamMode(mode),
        status=ExamStatus.scheduled,
    )

    try:
        db.session.add(exam)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create exam: {str(e)}"}), 500

    return jsonify({"success": True, "exam": exam.to_dict()}), 201


@exams_bp.route("/api/exams/<int:exam_id>", methods=["GET"])
@role_required("admin", "invigilator")
def get_exam(exam_id):
    """Get a single exam by ID."""
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    return jsonify(exam.to_dict())


@exams_bp.route("/api/exams/<int:exam_id>", methods=["PATCH"])
@role_required("admin")
def update_exam_status(exam_id):
    """Update exam status only (admin only)."""
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    status = data.get("status")
    if status not in ("active", "scheduled", "completed"):
        return jsonify({"error": "Invalid status"}), 400

    exam.status = status
    db.session.commit()

    return jsonify({"success": True, "exam": exam.to_dict()})


@exams_bp.route("/api/exams/<int:exam_id>", methods=["DELETE"])
@role_required("admin")
def delete_exam(exam_id):
    """Delete an exam (admin only)."""
    exam = Exam.query.get(exam_id)
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    try:
        sessions = ExamSession.query.filter_by(exam_id=exam.id).all()
        session_ids = [s.id for s in sessions]

        if session_ids:
            SuspicionEvent.query.filter(SuspicionEvent.session_id.in_(session_ids)).delete(
                synchronize_session=False
            )
            MediaChunk.query.filter(MediaChunk.session_id.in_(session_ids)).delete(
                synchronize_session=False
            )
            ExamSession.query.filter(ExamSession.id.in_(session_ids)).delete(
                synchronize_session=False
            )

        db.session.delete(exam)
        db.session.commit()
        return jsonify({"success": True, "message": "Exam deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete exam: {str(e)}"}), 500
