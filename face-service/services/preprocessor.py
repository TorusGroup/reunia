# =============================================================
# ReunIA Face Service — Image Preprocessor
# =============================================================

import base64
import io
import logging
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

from config import settings

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MIN_DIMENSION_PX = 48


def decode_base64_image(image_base64: str) -> Image.Image:
    """
    Decode a base64 string to a PIL Image.
    Handles optional data URI prefix (data:image/jpeg;base64,...).
    Raises ValueError on invalid input.
    """
    try:
        # Strip data URI prefix if present
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        # Add padding if missing
        padding = 4 - len(image_base64) % 4
        if padding != 4:
            image_base64 += "=" * padding

        raw_bytes = base64.b64decode(image_base64)
    except Exception as exc:
        raise ValueError(f"Invalid base64 encoding: {exc}") from exc

    if len(raw_bytes) > settings.MAX_IMAGE_SIZE_BYTES:
        raise ValueError(
            f"Image too large: {len(raw_bytes)} bytes "
            f"(max {settings.MAX_IMAGE_SIZE_BYTES} bytes)"
        )

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img.verify()  # Verify it's a valid image
        # Re-open after verify (verify closes the stream)
        img = Image.open(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise ValueError(f"Cannot decode image: {exc}") from exc

    return img


def validate_image(img: Image.Image) -> Tuple[int, int]:
    """
    Validate image dimensions and format.
    Returns (width, height).
    Raises ValueError on invalid images.
    """
    width, height = img.size

    if width < MIN_DIMENSION_PX or height < MIN_DIMENSION_PX:
        raise ValueError(
            f"Image too small: {width}x{height}px "
            f"(minimum {MIN_DIMENSION_PX}x{MIN_DIMENSION_PX}px)"
        )

    return width, height


def normalize_image(img: Image.Image) -> Image.Image:
    """
    Convert to RGB (handles RGBA, grayscale, palette), apply EXIF orientation.
    """
    # Apply EXIF orientation if present
    img = ImageOps.exif_transpose(img)

    # Convert to RGB (3-channel)
    if img.mode != "RGB":
        if img.mode == "RGBA":
            # Composite onto white background
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
            img = background
        else:
            img = img.convert("RGB")

    return img


def crop_face(
    img: Image.Image,
    bbox_x: int,
    bbox_y: int,
    bbox_w: int,
    bbox_h: int,
    padding_factor: float = 0.1,
) -> Image.Image:
    """
    Crop face from image with optional padding, clamped to image bounds.
    """
    width, height = img.size

    pad_x = int(bbox_w * padding_factor)
    pad_y = int(bbox_h * padding_factor)

    x1 = max(0, bbox_x - pad_x)
    y1 = max(0, bbox_y - pad_y)
    x2 = min(width, bbox_x + bbox_w + pad_x)
    y2 = min(height, bbox_y + bbox_h + pad_y)

    return img.crop((x1, y1, x2, y2))


def resize_for_embedding(img: Image.Image, target_size: int = 112) -> np.ndarray:
    """
    Resize image to target_size x target_size and convert to numpy array
    in the format expected by DeepFace ArcFace (112x112 RGB uint8).
    """
    img = img.resize((target_size, target_size), Image.LANCZOS)
    arr = np.array(img, dtype=np.uint8)
    return arr


def image_to_numpy(img: Image.Image) -> np.ndarray:
    """Convert PIL Image to BGR numpy array (DeepFace expectation)."""
    rgb_array = np.array(img, dtype=np.uint8)
    # DeepFace internals use BGR (OpenCV convention)
    bgr_array = rgb_array[:, :, ::-1]
    return bgr_array


def estimate_face_quality(face_width: int, face_height: int, image_width: int, image_height: int) -> float:
    """
    Estimate face quality based on:
    - Face area relative to image area (bigger = better)
    - Minimum face dimension (larger faces have more detail)
    Returns 0.0 - 1.0
    """
    face_area = face_width * face_height
    image_area = image_width * image_height

    if image_area == 0:
        return 0.0

    area_ratio = min(face_area / image_area, 1.0)
    min_dim = min(face_width, face_height)

    # Quality formula: blend of area ratio and minimum dimension score
    # Faces >= 112px get full score for dimension component
    dim_score = min(min_dim / 112.0, 1.0)

    # Penalize very small faces heavily
    if min_dim < settings.MIN_FACE_SIZE_PX:
        return 0.0

    quality = 0.4 * area_ratio + 0.6 * dim_score
    return round(min(quality, 1.0), 4)
