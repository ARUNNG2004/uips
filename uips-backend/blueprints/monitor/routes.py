from flask import Blueprint, jsonify, request
from flask_login import login_required

from database.db import db
from models.session import ExamSession
from models.event import SuspicionEvent
from models.user import User
from utils.auth_helpers import role_required

from ml.inference import run_inference
import sys

if '__main__' in sys.modules and hasattr(sys.modules['__main__'], 'socketio'):
    socketio = sys.modules['__main__'].socketio
else:
    try:
        from app import socketio
    except ImportError:
        class DummySocketIO:
            def emit(self, *args, **kwargs):
                pass
        socketio = DummySocketIO()

monitor_bp = Blueprint("monitor", __name__)


@monitor_bp.route("/api/monitor/live", methods=["GET"])
@role_required("admin", "invigilator")
def live_sessions():
    """All ongoing and completed ExamSession values for active exams."""
    sessions = ExamSession.query.filter(ExamSession.status.in_(["ongoing", "completed"])).all()
    results = []
    for s in sessions:
        student = User.query.get(s.student_id)
        results.append({
            "session_id": s.id,
            "student_id": s.student_id,
            "student_name": student.name if student else "Unknown",
            "exam_id": s.exam_id,
            "suspicion_index": s.suspicion_index,
            "status": s.status.value if hasattr(s.status, "value") else s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None
        })
    return jsonify(results)


@monitor_bp.route("/api/monitor/analyse/<int:session_id>", methods=["POST"])
@role_required("admin", "invigilator")
def analyse_session(session_id):
    """Call run_inference, save result, emit update via SocketIO."""
    session = ExamSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    result = run_inference(session_id)
    
    session.suspicion_index = result.get("suspicion_index", 0.0)
    db.session.commit()

    try:
        socketio.emit(
            "score_update",
            {
                "session_id": session_id,
                "suspicion_index": session.suspicion_index,
                "anomalies": result.get("anomalies", [])
            },
            room="invigilators"
        )
    except NameError:
        pass

    return jsonify(result)


@monitor_bp.route("/api/monitor/<int:student_id>/alerts", methods=["GET"])
@role_required("admin", "invigilator")
def student_alerts(student_id):
    """All SuspicionEvents for student, DESC limited to 50."""
    sessions = ExamSession.query.filter_by(student_id=student_id).all()
    session_ids = [s.id for s in sessions]
    if not session_ids:
        return jsonify([])

    events = SuspicionEvent.query.filter(
        SuspicionEvent.session_id.in_(session_ids)
    ).order_by(SuspicionEvent.timestamp.desc()).limit(50).all()

    return jsonify([e.to_dict() for e in events])


@monitor_bp.route("/api/monitor/session/<int:session_id>/status", methods=["PATCH"])
@role_required("admin", "invigilator")
def update_session_status(session_id):
    """Invigilator can force end or resume an exam."""
    data = request.get_json()
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "Status is required"}), 400

    session = ExamSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if new_status == 'completed':
        session.status = 'completed'
    elif new_status == 'ongoing':
        session.status = 'ongoing'
    else:
        return jsonify({"error": "Invalid status"}), 400

    db.session.commit()

    try:
        payload = {
            "session_id": session_id,
            "status": new_status,
            "student_id": session.student_id,
            "action": "force_status_update"
        }
        # Emit to students so the student's exam page detects force-end
        socketio.emit("session_status_update", payload, room="students")
        # Also emit to invigilators so dashboard updates
        socketio.emit("session_status_update", payload, room="invigilators")
    except NameError:
        pass

    return jsonify({"message": f"Session status updated to {new_status}"})

@monitor_bp.route("/api/sessions/<int:session_id>", methods=["GET"])
@role_required("admin", "invigilator")
def get_session_detail(session_id):
    session = ExamSession.query.get(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
        
    student = User.query.get(session.student_id)
    return jsonify({
        "session_id": session.id,
        "student_id": session.student_id,
        "student_name": student.name if student else "Unknown",
        "exam_id": session.exam_id,
        "suspicion_index": session.suspicion_index,
        "status": session.status.value if hasattr(session.status, "value") else session.status,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": session.ended_at.isoformat() if session.ended_at else None
    })
