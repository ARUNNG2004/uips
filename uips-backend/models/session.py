import enum
from datetime import datetime, timezone

from database.db import db


class SessionStatus(enum.Enum):
    ongoing = "ongoing"
    completed = "completed"
    flagged = "flagged"


class ExamSession(db.Model):
    __tablename__ = "exam_sessions"

    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey("exams.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    started_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ended_at = db.Column(db.DateTime, nullable=True)
    suspicion_index = db.Column(db.Float, default=0.0)
    status = db.Column(
        db.Enum(SessionStatus), nullable=False, default=SessionStatus.ongoing
    )

    # Exam answers and scoring
    answers = db.Column(db.JSON, nullable=True)  # Stores selected answers: {"q1": "A", "q2": "B", ...}
    score = db.Column(db.Float, nullable=True)  # Exam score as percentage

    # ML-based integrity analysis
    audio_risk = db.Column(db.Float, nullable=True, default=0.0)
    visual_risk = db.Column(db.Float, nullable=True, default=0.0)
    behavior_risk = db.Column(db.Float, nullable=True, default=0.0)
    integrity_score = db.Column(db.Float, nullable=True, default=100.0)

    # Relationships
    events = db.relationship("SuspicionEvent", backref="session", lazy=True)
    media_chunks = db.relationship("MediaChunk", backref="session", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "suspicion_index": self.suspicion_index,
            "status": (
                self.status.value
                if isinstance(self.status, SessionStatus)
                else self.status
            ),
            "answers": self.answers,
            "score": self.score,
            "audio_risk": self.audio_risk,
            "visual_risk": self.visual_risk,
            "behavior_risk": self.behavior_risk,
            "integrity_score": self.integrity_score,
        }
