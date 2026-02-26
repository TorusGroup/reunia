# =============================================================
# ReunIA Face Service — FastAPI Application
# Python microservice for face detection and embedding
# =============================================================

import logging
import time
from typing import List

from fastapi import FastAPI, HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from models.schemas import (
    DetectRequest,
    DetectResponse,
    EmbedRequest,
    EmbedResponse,
    MatchRequest,
    MatchResponse,
    BatchEmbedRequest,
    BatchEmbedResponse,
    BatchEmbedResult,
    HealthResponse,
)
from services.detector import detect_faces_in_image
from services.embedder import generate_embedding
from services.matcher import match_embedding_against_candidates

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------

app = FastAPI(
    title="ReunIA Face Service",
    description="Face detection and ArcFace embedding microservice for the ReunIA platform",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — only allow internal service communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://reunia-web:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------

bearer_scheme = HTTPBearer()


async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> str:
    """Validate Bearer API key for internal service auth."""
    if credentials.credentials != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": "Invalid API key"},
        )
    return credentials.credentials


# ---------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint — no auth required."""
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.VERSION,
        model=settings.MODEL_NAME,
        detector=settings.DETECTOR_BACKEND,
    )


# ---------------------------------------------------------------
# POST /detect
# ---------------------------------------------------------------

@app.post("/detect", response_model=DetectResponse, tags=["Face"], dependencies=[Depends(verify_api_key)])
async def detect_faces(request: DetectRequest):
    """
    Detect faces in an image.
    Returns bounding boxes and confidence scores for all detected faces.
    """
    try:
        faces, width, height, processing_ms = detect_faces_in_image(request.image_base64)
        return DetectResponse(
            success=True,
            faces=faces,
            face_count=len(faces),
            image_width=width,
            image_height=height,
            processing_ms=processing_ms,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"success": False, "error": str(exc)},
        )
    except Exception as exc:
        logger.error({"msg": "Unexpected error in /detect", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "error": "Internal face detection error"},
        )


# ---------------------------------------------------------------
# POST /embed
# ---------------------------------------------------------------

@app.post("/embed", response_model=EmbedResponse, tags=["Face"], dependencies=[Depends(verify_api_key)])
async def embed_face(request: EmbedRequest):
    """
    Generate a 512-dimensional ArcFace embedding from a face image.
    Optionally accepts a bounding box to skip detection.
    """
    try:
        embedding, face_confidence, face_quality, processing_ms = generate_embedding(
            request.image_base64,
            face_bbox=request.face_bbox,
        )
        return EmbedResponse(
            success=True,
            embedding=embedding,
            embedding_dims=len(embedding),
            face_confidence=face_confidence,
            face_quality=face_quality,
            processing_ms=processing_ms,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"success": False, "error": str(exc)},
        )
    except Exception as exc:
        logger.error({"msg": "Unexpected error in /embed", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "error": "Internal embedding error"},
        )


# ---------------------------------------------------------------
# POST /match
# ---------------------------------------------------------------

@app.post("/match", response_model=MatchResponse, tags=["Face"], dependencies=[Depends(verify_api_key)])
async def match_faces(request: MatchRequest):
    """
    Compare a query embedding against candidate embeddings.
    Returns ranked matches above the similarity threshold.

    NOTE: This endpoint performs in-process cosine similarity.
    For large databases (>10K embeddings), use the pgvector HNSW index
    via the Node.js embedding-store service instead.
    """
    try:
        matches, processing_ms = match_embedding_against_candidates(
            query_embedding=request.query_embedding,
            candidates=request.candidates,
            threshold=request.threshold,
            max_results=request.max_results,
        )
        return MatchResponse(
            success=True,
            matches=matches,
            match_count=len(matches),
            query_threshold=request.threshold,
            processing_ms=processing_ms,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"success": False, "error": str(exc)},
        )
    except Exception as exc:
        logger.error({"msg": "Unexpected error in /match", "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "error": "Internal matching error"},
        )


# ---------------------------------------------------------------
# POST /batch-embed
# ---------------------------------------------------------------

@app.post("/batch-embed", response_model=BatchEmbedResponse, tags=["Face"], dependencies=[Depends(verify_api_key)])
async def batch_embed_faces(request: BatchEmbedRequest):
    """
    Process multiple images in a single request for the ingestion pipeline.
    Failed images are included in results with error field set.
    """
    start = time.time()
    results: List[BatchEmbedResult] = []

    for item in request.images:
        try:
            embedding, face_confidence, face_quality, _ = generate_embedding(item.image_base64)
            results.append(
                BatchEmbedResult(
                    image_id=item.image_id,
                    success=True,
                    embedding=embedding,
                    face_confidence=face_confidence,
                    face_quality=face_quality,
                )
            )
        except Exception as exc:
            logger.warning({"msg": "Batch embed failed for image", "image_id": item.image_id, "error": str(exc)})
            results.append(
                BatchEmbedResult(
                    image_id=item.image_id,
                    success=False,
                    error=str(exc),
                )
            )

    succeeded = sum(1 for r in results if r.success)
    failed = len(results) - succeeded
    processing_ms = int((time.time() - start) * 1000)

    return BatchEmbedResponse(
        success=True,
        results=results,
        processed=len(results),
        succeeded=succeeded,
        failed=failed,
        processing_ms=processing_ms,
    )


# ---------------------------------------------------------------
# App startup event
# ---------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    logger.info(
        {
            "msg": "ReunIA Face Service starting",
            "model": settings.MODEL_NAME,
            "detector": settings.DETECTOR_BACKEND,
            "version": settings.VERSION,
        }
    )
