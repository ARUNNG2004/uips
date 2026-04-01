import enum
from datetime import datetime, timezone

from database.db import db


class ExamMode(enum.Enum):
    online = "online"
    classroom = "classroom"


class ExamStatus(enum.Enum):
    scheduled = "scheduled"
    active = "active"
    completed = "completed"


class Exam(db.Model):
    __tablename__ = "exams"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    mode = db.Column(db.Enum(ExamMode), nullable=False, default=ExamMode.online)
    status = db.Column(
        db.Enum(ExamStatus), nullable=False, default=ExamStatus.scheduled
    )
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    sessions = db.relationship("ExamSession", backref="exam", lazy=True)

    @staticmethod
    def _format_time_only(value):
        if not value:
            return None

        if isinstance(value, datetime):
            return value.strftime("%H:%M:%S")

        # Backward compatibility for previously stored string values.
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value)
                return parsed.strftime("%H:%M:%S")
            except ValueError:
                pass

            if len(value) == 5:
                return f"{value}:00"
            return value

        if hasattr(value, "strftime"):
            return value.strftime("%H:%M:%S")

        return str(value)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "start_time": self._format_time_only(self.start_time),
            "end_time": self._format_time_only(self.end_time),
            "created_by": self.created_by,
            "mode": self.mode.value if isinstance(self.mode, ExamMode) else self.mode,
            "status": (
                self.status.value
                if isinstance(self.status, ExamStatus)
                else self.status
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
