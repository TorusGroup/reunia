# =============================================================
# ReunIA Face Service — Pydantic Schemas
# =============================================================

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ---------------------------------------------------------------
# Enums
# ---------------------------------------------------------------

class ConfidenceTier(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    REJECTED = "REJECTED"


# ---------------------------------------------------------------
# Face Detection
# ---------------------------------------------------------------

class FaceBoundingBox(BaseModel):
    x: int = Field(..., description="Left edge in pixels")
    y: int = Field(..., description="Top edge in pixels")
    w: int = Field(..., description="Width in pixels")
    h: int = Field(..., description="Height in pixels")


class DetectedFace(BaseModel):
    face_index: int = Field(..., description="0-based index in image")
    bounding_box: FaceBoundingBox
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    face_area_px: int = Field(..., description="Width * height in pixels")


class DetectRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image (JPEG/PNG/WEBP)")
    image_url: Optional[str] = Field(None, description="Alternative: image URL (fetched server-side)")


class DetectResponse(BaseModel):
    success: bool
    faces: List[DetectedFace]
    face_count: int
    image_width: int
    image_height: int
    processing_ms: int


# ---------------------------------------------------------------
# Embedding Generation
# ---------------------------------------------------------------

class EmbedRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image (face crop or full image with single face)")
    face_bbox: Optional[FaceBoundingBox] = Field(None, description="Optional crop hint — if None, auto-detects")


class EmbedResponse(BaseModel):
    success: bool
    embedding: List[float] = Field(..., description="512-dimensional ArcFace embedding (float32)")
    embedding_dims: int = Field(512, description="Always 512 for ArcFace buffalo_l")
    face_confidence: Optional[float] = Field(None, description="Detection confidence of the face used")
    face_quality: Optional[float] = Field(None, description="Quality score 0-1 (estimated from face size/clarity)")
    processing_ms: int


# ---------------------------------------------------------------
# Face Matching
# ---------------------------------------------------------------

class MatchCandidate(BaseModel):
    face_embedding_id: str = Field(..., description="UUID of FaceEmbedding record")
    person_id: str = Field(..., description="UUID of Person record")
    case_id: str = Field(..., description="UUID of Case record")
    similarity: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score")
    confidence_tier: ConfidenceTier


class MatchRequest(BaseModel):
    query_embedding: List[float] = Field(..., min_length=512, max_length=512, description="512-dim query embedding")
    candidates: List["CandidateRecord"] = Field(..., description="Candidate embeddings to compare against")
    threshold: float = Field(0.55, ge=0.0, le=1.0, description="Minimum similarity to include in results")
    max_results: int = Field(20, ge=1, le=100, description="Maximum number of results to return")


class CandidateRecord(BaseModel):
    face_embedding_id: str
    person_id: str
    case_id: str
    embedding: List[float] = Field(..., min_length=512, max_length=512)


class MatchResponse(BaseModel):
    success: bool
    matches: List[MatchCandidate]
    match_count: int
    query_threshold: float
    processing_ms: int


# ---------------------------------------------------------------
# Batch Embedding
# ---------------------------------------------------------------

class BatchEmbedItem(BaseModel):
    image_id: str = Field(..., description="External reference ID (UUID of Image record)")
    image_base64: str


class BatchEmbedRequest(BaseModel):
    images: List[BatchEmbedItem] = Field(..., max_length=50, description="Max 50 images per batch")


class BatchEmbedResult(BaseModel):
    image_id: str
    success: bool
    embedding: Optional[List[float]] = None
    face_confidence: Optional[float] = None
    face_quality: Optional[float] = None
    error: Optional[str] = None


class BatchEmbedResponse(BaseModel):
    success: bool
    results: List[BatchEmbedResult]
    processed: int
    succeeded: int
    failed: int
    processing_ms: int


# ---------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model: str
    detector: str
