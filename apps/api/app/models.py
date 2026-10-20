from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class DetectionCategory(str, Enum):
    AI_DETECTED = "AI-generated signals detected"
    NO_AI_DETECTED = "No AI-generated signals detected"
    INCONCLUSIVE = "Inconclusive"


class FileInfo(BaseModel):
    filename: str
    file_size_bytes: int
    file_size_formatted: str
    mime_type: str
    media_type: str  # "image" or "video"
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    container_format: Optional[str] = None


class ProvenanceResult(BaseModel):
    has_credentials: bool
    format: str  # "C2PA / JUMBF", "XMP Provenance", "None"
    status: str  # "Manifest Present", "No Manifest", "Corrupted / Incomplete"
    summary: str
    details: Dict[str, str] = Field(default_factory=dict)
    disclaimer: str = (
        "Content Credentials indicate whether provenance metadata is attached. "
        "Missing metadata does not prove human authorship, and metadata can be stripped or altered. "
        "Provenance alone is not proof of factual authenticity."
    )


class VideoFrameScore(BaseModel):
    position_seconds: float
    score: float


class DetectionResult(BaseModel):
    id: str
    category: DetectionCategory
    score: Optional[float] = None  # 0.0 to 1.0 (Sightengine genai score)
    score_percentage: Optional[float] = None  # 0 to 100%
    confidence_label: str
    provider: str = "Sightengine"
    method: str = "Sightengine genai deep-learning model"
    generator_scores: Dict[str, float] = Field(default_factory=dict)
    frames_summary: Optional[List[VideoFrameScore]] = None
    average_frame_score: Optional[float] = None
    peak_frame_score: Optional[float] = None
    provenance: Optional[ProvenanceResult] = None
    explanation: str
    limitations: List[str]
    file_info: FileInfo
    analyzed_at: str


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    provider_configured: bool


class ProviderStatusResponse(BaseModel):
    provider: str
    is_configured: bool
    image_endpoint: str
    video_sync_endpoint: str
    max_video_duration_seconds: int
    max_image_size_mb: int
    max_video_size_mb: int
    message: str
