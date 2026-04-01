from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user

from database.db import db, bcrypt
from models.user import User
from models.exam import Exam
from models.session import ExamSession
from models.event import SuspicionEvent
from models.media import MediaChunk
from utils.auth_helpers import role_required
from utils.validators import validate_email, validate_role

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate user with email and password."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Invalid email or password"}), 401

    login_user(user, remember=True)
    return jsonify(
        {
            "success": True,
            "role": user.role.value if hasattr(user.role, "value") else user.role,
            "name": user.name,
            "id": user.id,
        }
    )


@auth_bp.route("/api/auth/logout", methods=["POST"])
@login_required
def logout():
    """Log out the current user."""
    logout_user()
    return jsonify({"success": True})


@auth_bp.route("/api/auth/me", methods=["GET"])
@login_required
def me():
    """Return current authenticated user info."""
    return jsonify(current_user.to_dict())


@auth_bp.route("/api/users", methods=["GET"])
@role_required("admin")
def list_users():
    """List all users (admin only)."""
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@auth_bp.route("/api/users", methods=["POST"])
@role_required("admin")
def create_user():
    """Create a new user (admin only)."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "student")

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    if not validate_role(role):
        return jsonify({"error": "Invalid role. Must be student, invigilator, or admin"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 409

    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(name=name, email=email, password=hashed_pw, role=role)
    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True, "user": user.to_dict()}), 201


@auth_bp.route("/api/users/<int:user_id>", methods=["DELETE"])
@role_required("admin")
def delete_user(user_id):
    """Delete a user (admin only, cannot delete self)."""
    if current_user.id == user_id:
        return jsonify({"error": "Cannot delete your own account"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Prevent deleting users that authored exams, because exams.created_by is non-nullable.
    authored_exam_count = Exam.query.filter_by(created_by=user.id).count()
    if authored_exam_count > 0:
        return jsonify({
            "error": "Cannot erase this user because they created exams. Delete/reassign those exams first."
        }), 400

    try:
        # Remove session-dependent records first to avoid FK violations.
        sessions = ExamSession.query.filter_by(student_id=user.id).all()
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

        db.session.delete(user)
        db.session.commit()
        return jsonify({"success": True, "message": f"User {user.email} deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to erase user: {str(e)}"}), 500
