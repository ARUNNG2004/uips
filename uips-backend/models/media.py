import enum
from datetime import datetime, timezone

from database.db import db


class ChunkType(enum.Enum):
    video = "video"
    audio = "audio"
    behavior = "behavior"


class MediaChunk(db.Model):
    __tablename__ = "media_chunks"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(
        db.Integer, db.ForeignKey("exam_sessions.id"), nullable=False
    )
    chunk_type = db.Column(db.Enum(ChunkType), nullable=False)
    timestamp = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    file_path = db.Column(db.String(512), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "chunk_type": (
                self.chunk_type.value
                if isinstance(self.chunk_type, ChunkType)
                else self.chunk_type
            ),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "file_path": self.file_path,
        }
