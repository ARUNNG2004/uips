from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from sqlalchemy import inspect, text

db = SQLAlchemy()
bcrypt = Bcrypt()


def init_db(app):
    """Create all database tables, run lightweight migrations, and print table names."""
    with app.app_context():
        db.create_all()
        _migrate_exam_sessions_table()
        table_names = db.engine.table_names() if hasattr(db.engine, "table_names") else [
            t.name for t in db.metadata.sorted_tables
        ]
        print(f"[DB] Tables created: {table_names}")


def _migrate_exam_sessions_table():
    """Add newly introduced columns to exam_sessions for existing SQLite databases."""
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    if "exam_sessions" not in tables:
        return

    existing_columns = {col["name"] for col in inspector.get_columns("exam_sessions")}
    required_columns = {
        "answers": "TEXT",
        "score": "FLOAT",
        "audio_risk": "FLOAT DEFAULT 0.0",
        "visual_risk": "FLOAT DEFAULT 0.0",
        "behavior_risk": "FLOAT DEFAULT 0.0",
        "integrity_score": "FLOAT DEFAULT 100.0",
    }

    with db.engine.begin() as conn:
        for column_name, column_sql in required_columns.items():
            if column_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE exam_sessions ADD COLUMN {column_name} {column_sql}"))
                print(f"[DB] Added missing column exam_sessions.{column_name}")


def seed_admin(app):
    """Create default admin user if no users exist."""
    from models.user import User

    with app.app_context():
        if User.query.count() == 0:
            hashed_pw = bcrypt.generate_password_hash("admin123").decode("utf-8")
            admin = User(
                name="Admin",
                email="admin@uips.com",
                password=hashed_pw,
                role="admin",
            )
            db.session.add(admin)
            db.session.commit()
            print("[SEED] Admin user created: admin@uips.com / admin123")


def seed_demo_users(app):
    """Create demo student and invigilator accounts if user count < 4."""
    from models.user import User

    with app.app_context():
        if User.query.count() < 4:
            demo_accounts = [
                {
                    "name": "Student One",
                    "email": "student1@uips.com",
                    "role": "student",
                },
                {
                    "name": "Student Two",
                    "email": "student2@uips.com",
                    "role": "student",
                },
                {
                    "name": "Invigilator One",
                    "email": "inv1@uips.com",
                    "role": "invigilator",
                },
            ]

            created = 0
            for acct in demo_accounts:
                if not User.query.filter_by(email=acct["email"]).first():
                    hashed_pw = bcrypt.generate_password_hash("demo123").decode(
                        "utf-8"
                    )
                    user = User(
                        name=acct["name"],
                        email=acct["email"],
                        password=hashed_pw,
                        role=acct["role"],
                    )
                    db.session.add(user)
                    created += 1

            db.session.commit()
            print(f"[SEED] Demo users created: {created}")
            print(f"[SEED] Total users now: {User.query.count()}")
