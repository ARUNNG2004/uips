import enum
from datetime import datetime, timezone

from database.db import db


class EventType(enum.Enum):
    face_absent = "face_absent"
    multiple_faces = "multiple_faces"
    audio_anomaly = "audio_anomaly"
    gaze_deviation = "gaze_deviation"
    typing_anomaly = "typing_anomaly"
    posture_alert = "posture_alert"


class Severity(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class SuspicionEvent(db.Model):
    __tablename__ = "suspicion_events"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(
        db.Integer, db.ForeignKey("exam_sessions.id"), nullable=False
    )
    timestamp = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    event_type = db.Column(db.Enum(EventType), nullable=False)
    severity = db.Column(db.Enum(Severity), nullable=False, default=Severity.low)
    score_delta = db.Column(db.Float, nullable=False, default=0.0)
    metadata_ = db.Column("metadata", db.JSON, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "event_type": (
                self.event_type.value
                if isinstance(self.event_type, EventType)
                else self.event_type
            ),
            "severity": (
                self.severity.value
                if isinstance(self.severity, Severity)
                else self.severity
            ),
            "score_delta": self.score_delta,
            "metadata": self.metadata_,
        }
