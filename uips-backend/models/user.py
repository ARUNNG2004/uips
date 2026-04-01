import enum
from datetime import datetime, timezone

from flask_login import UserMixin

from database.db import db


class UserRole(enum.Enum):
    student = "student"
    invigilator = "invigilator"
    admin = "admin"


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.student)
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    exams_created = db.relationship(
        "Exam", backref="creator", lazy=True, foreign_keys="Exam.created_by"
    )
    sessions = db.relationship("ExamSession", backref="student", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value if isinstance(self.role, UserRole) else self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
