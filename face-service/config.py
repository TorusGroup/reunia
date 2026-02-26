# =============================================================
# ReunIA Face Service — Configuration
# =============================================================

from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # Model configuration
    MODEL_NAME: str = "ArcFace"
    DETECTOR_BACKEND: str = "retinaface"

    # Similarity thresholds (cosine similarity: 1 = identical, 0 = completely different)
    THRESHOLD_HIGH: float = 0.85      # >= HIGH → confident match
    THRESHOLD_MEDIUM: float = 0.70    # >= MEDIUM < HIGH → likely match
    THRESHOLD_LOW: float = 0.55       # >= LOW < MEDIUM → possible match
    THRESHOLD_REJECT: float = 0.55    # < REJECT → discard

    # Image validation limits
    MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10MB
    MIN_FACE_SIZE_PX: int = 48   # Minimum face bbox dimension
    MAX_FACES_PER_IMAGE: int = 10

    # Target dimensions for preprocessing
    TARGET_SIZE: int = 112  # ArcFace expects 112x112

    # Batch limits
    MAX_BATCH_SIZE: int = 50

    # API key for internal auth
    API_KEY: str = "local_face_engine_key"

    # Service info
    SERVICE_NAME: str = "reunia-face-service"
    VERSION: str = "1.0.0"

    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
