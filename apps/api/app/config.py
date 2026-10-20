from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """MediaCheck AI application configuration."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "MediaCheck AI"
    APP_VERSION: str = "1.0.0"
    API_BASE_URL: str = "http://localhost:8000"

    # Sightengine credentials
    SIGHTENGINE_API_USER: str = ""
    SIGHTENGINE_API_SECRET: str = ""

    # Endpoints
    SIGHTENGINE_IMAGE_ENDPOINT: str = "https://api.sightengine.com/1.0/check.json"
    SIGHTENGINE_VIDEO_SYNC_ENDPOINT: str = "https://api.sightengine.com/1.0/video/check-sync.json"

    # Limits
    MAX_IMAGE_SIZE_MB: int = 20
    MAX_VIDEO_SIZE_MB: int = 50
    MAX_VIDEO_DURATION_SECONDS: int = 60

    # CORS & Network
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "chrome-extension://*",
    ]
    REQUEST_TIMEOUT_SECONDS: float = 45.0
    RATE_LIMIT_PER_MINUTE: int = 60


settings = Settings()
