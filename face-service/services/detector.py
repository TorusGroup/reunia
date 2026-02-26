# =============================================================
# ReunIA Face Service — Face Detector
# Uses DeepFace with RetinaFace backend
# =============================================================

import logging
import time
from typing import List, Optional

import numpy as np
from PIL import Image

from config import settings
from models.schemas import DetectedFace, FaceBoundingBox
from services.preprocessor import (
    decode_base64_image,
    validate_image,
    normalize_image,
    image_to_numpy,
    estimate_face_quality,
)

logger = logging.getLogger(__name__)


def detect_faces_in_image(
    image_base64: str,
) -> tuple[List[DetectedFace], int, int, int]:
    """
    Detect faces in an image.
    Returns (detected_faces, image_width, image_height, processing_ms).
    Raises ValueError on invalid input.
    """
    start = time.time()

    # Decode and validate
    img = decode_base64_image(image_base64)
    img = normalize_image(img)
    width, height = validate_image(img)

    # Use DeepFace to detect faces (lazy import to avoid module-level side effects)
    try:
        from deepface import DeepFace

        np_img = image_to_numpy(img)
        face_objs = DeepFace.extract_faces(
            img_path=np_img,
            detector_backend=settings.DETECTOR_BACKEND,
            align=True,
            expand_percentage=0,
            enforce_detection=False,  # Don't raise if no face found
        )
    except Exception as exc:
        logger.warning({"msg": "Face detection failed", "error": str(exc)})
        face_objs = []

    detected: List[DetectedFace] = []
    for idx, face_obj in enumerate(face_objs):
        if idx >= settings.MAX_FACES_PER_IMAGE:
            break

        try:
            region = face_obj.get("facial_area", {})
            fx = int(region.get("x", 0))
            fy = int(region.get("y", 0))
            fw = int(region.get("w", 0))
            fh = int(region.get("h", 0))
            confidence = float(face_obj.get("confidence", 0.0))

            # Skip tiny faces
            if fw < settings.MIN_FACE_SIZE_PX or fh < settings.MIN_FACE_SIZE_PX:
                logger.debug({"msg": "Skipping small face", "w": fw, "h": fh})
                continue

            quality = estimate_face_quality(fw, fh, width, height)

            detected.append(
                DetectedFace(
                    face_index=idx,
                    bounding_box=FaceBoundingBox(x=fx, y=fy, w=fw, h=fh),
                    confidence=round(confidence, 4),
                    face_area_px=fw * fh,
                )
            )
        except Exception as exc:
            logger.warning({"msg": "Failed to parse face object", "idx": idx, "error": str(exc)})
            continue

    processing_ms = int((time.time() - start) * 1000)
    return detected, width, height, processing_ms
