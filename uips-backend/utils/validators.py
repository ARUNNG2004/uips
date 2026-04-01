import re


def validate_email(email: str) -> bool:
    """Validate email format using regex."""
    if not email or not isinstance(email, str):
        return False
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_role(role: str) -> bool:
    """Validate that role is one of the allowed values."""
    return role in ("student", "invigilator", "admin")


def validate_exam_mode(mode: str) -> bool:
    """Validate that exam mode is one of the allowed values."""
    return mode in ("online", "classroom")
