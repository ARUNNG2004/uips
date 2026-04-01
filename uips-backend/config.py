import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Base configuration shared across all environments."""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB max upload


class DevelopmentConfig(BaseConfig):
    """Development configuration — uses local SQLite and .env secret key."""
    DEBUG = True
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-fallback-secret-key")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///uips.db"
    )


class ProductionConfig(BaseConfig):
    """Production configuration — requires SECRET_KEY from environment."""
    DEBUG = False

    @property
    def SECRET_KEY(self):
        key = os.environ.get("SECRET_KEY")
        if not key:
            raise ValueError(
                "SECRET_KEY environment variable is required in production"
            )
        return key

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///uips.db"
    )


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
