# =============================================================
# ReunIA Face Service — ArcFace Embedding Generator
# Produces 512-dimensional float32 embeddings via DeepFace
# =============================================================

import logging
import time
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

from config import settings
from models.schemas import FaceBoundingBox
from services.preprocessor import (
    decode_base64_image,
    validate_image,
    normalize_image,
    image_to_numpy,
    crop_face,
    estimate_face_quality,
)

logger = logging.getLogger(__name__)


def generate_embedding(
    image_base64: str,
    face_bbox: Optional[FaceBoundingBox] = None,
) -> Tuple[List[float], Optional[float], Optional[float], int]:
    """
    Generate a 512-dimensional ArcFace embedding from an image.

    If face_bbox is provided, crops to that region first.
    If face_bbox is None, DeepFace auto-detects the largest face.

    Returns:
        (embedding, face_confidence, face_quality, processing_ms)
    Raises:
        ValueError: If no face detected or image invalid.
    """
    start = time.time()

    # Decode & normalize
    img = decode_base64_image(image_base64)
    img = normalize_image(img)
    width, height = validate_image(img)

    # Crop if bbox provided
    face_confidence: Optional[float] = None
    face_quality: Optional[float] = None

    if face_bbox is not None:
        img = crop_face(img, face_bbox.x, face_bbox.y, face_bbox.w, face_bbox.h)
        face_quality = estimate_face_quality(face_bbox.w, face_bbox.h, width, height)

    # Convert to numpy for DeepFace
    np_img = image_to_numpy(img)

    try:
        from deepface import DeepFace

        result = DeepFace.represent(
            img_path=np_img,
            model_name=settings.MODEL_NAME,
            detector_backend=settings.DETECTOR_BACKEND if face_bbox is None else "skip",
            align=True,
            enforce_detection=face_bbox is None,  # Only enforce detection if no bbox given
        )
    except Exception as exc:
        raise ValueError(f"Failed to generate embedding: {exc}") from exc

    if not result or len(result) == 0:
        raise ValueError("No face detected in image — cannot generate embedding")

    # Use the first (most prominent) face result
    embedding_obj = result[0]
    embedding: List[float] = embedding_obj.get("embedding", [])

    if len(embedding) != 512:
        raise ValueError(f"Unexpected embedding dimension: {len(embedding)} (expected 512)")

    # Extract face confidence and quality if available
    if face_bbox is None:
        facial_area = embedding_obj.get("facial_area", {})
        fw = facial_area.get("w", 0)
        fh = facial_area.get("h", 0)
        if fw > 0 and fh > 0:
            face_quality = estimate_face_quality(fw, fh, width, height)
        face_confidence = embedding_obj.get("face_confidence")

    processing_ms = int((time.time() - start) * 1000)
    return embedding, face_confidence, face_quality, processing_ms


def normalize_embedding(embedding: List[float]) -> List[float]:
    """
    L2-normalize a 512-dim embedding vector.
    Required for cosine similarity to equal dot product.
    """
    arr = np.array(embedding, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm == 0:
        return embedding
    normalized = arr / norm
    return normalized.tolist()
