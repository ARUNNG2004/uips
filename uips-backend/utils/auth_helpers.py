from functools import wraps

from flask import jsonify
from flask_login import current_user


def role_required(*roles):
    """Decorator that restricts access to users with specific roles.

    Usage:
        @role_required("admin")
        @role_required("admin", "invigilator")
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({"error": "Authentication required"}), 401

            user_role = (
                current_user.role.value
                if hasattr(current_user.role, "value")
                else current_user.role
            )
            if user_role not in roles:
                return (
                    jsonify({"error": "Insufficient permissions"}),
                    403,
                )

            return f(*args, **kwargs)

        return decorated_function

    return decorator
