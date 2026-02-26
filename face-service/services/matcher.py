# =============================================================
# ReunIA Face Service — Face Matcher
# Cosine similarity + threshold-based confidence tiers
# =============================================================

import logging
import time
from typing import List

import numpy as np

from config import settings
from models.schemas import MatchCandidate, CandidateRecord, ConfidenceTier

logger = logging.getLogger(__name__)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    Compute cosine similarity between two embedding vectors.
    Assumes vectors are already L2-normalized (dot product = cosine similarity).
    Returns value in [-1.0, 1.0]. Clamp to [0, 1] for face match context.
    """
    arr_a = np.array(a, dtype=np.float32)
    arr_b = np.array(b, dtype=np.float32)

    # Normalize both vectors
    norm_a = np.linalg.norm(arr_a)
    norm_b = np.linalg.norm(arr_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    similarity = float(np.dot(arr_a / norm_a, arr_b / norm_b))
    # Clamp to [0, 1] — negative similarity is meaningless for face matching
    return max(0.0, min(1.0, similarity))


def get_confidence_tier(similarity: float) -> ConfidenceTier:
    """
    Map cosine similarity score to a confidence tier.

    Thresholds (from architecture doc):
    - HIGH:     >= 0.85  (very confident match)
    - MEDIUM:   0.70 - 0.84  (likely match)
    - LOW:      0.55 - 0.69  (possible match)
    - REJECTED: < 0.55
    """
    if similarity >= settings.THRESHOLD_HIGH:
        return ConfidenceTier.HIGH
    elif similarity >= settings.THRESHOLD_MEDIUM:
        return ConfidenceTier.MEDIUM
    elif similarity >= settings.THRESHOLD_LOW:
        return ConfidenceTier.LOW
    else:
        return ConfidenceTier.REJECTED


def match_embedding_against_candidates(
    query_embedding: List[float],
    candidates: List[CandidateRecord],
    threshold: float = 0.55,
    max_results: int = 20,
) -> tuple[List[MatchCandidate], int]:
    """
    Compare a query embedding against a list of candidate embeddings.
    Returns (sorted_matches_above_threshold, processing_ms).

    Matches are sorted by similarity score descending (best matches first).
    Only candidates with similarity >= threshold are included.
    """
    start = time.time()

    if not candidates:
        return [], int((time.time() - start) * 1000)

    if len(query_embedding) != 512:
        raise ValueError(f"Query embedding must be 512-dim, got {len(query_embedding)}")

    results: List[MatchCandidate] = []

    for candidate in candidates:
        if len(candidate.embedding) != 512:
            logger.warning(
                {"msg": "Skipping candidate with wrong embedding dim", "id": candidate.face_embedding_id}
            )
            continue

        similarity = cosine_similarity(query_embedding, candidate.embedding)
        tier = get_confidence_tier(similarity)

        # Skip REJECTED entries (below threshold)
        if tier == ConfidenceTier.REJECTED or similarity < threshold:
            continue

        results.append(
            MatchCandidate(
                face_embedding_id=candidate.face_embedding_id,
                person_id=candidate.person_id,
                case_id=candidate.case_id,
                similarity=round(similarity, 6),
                confidence_tier=tier,
            )
        )

    # Sort by similarity descending — best matches first
    results.sort(key=lambda m: m.similarity, reverse=True)

    # Limit results
    results = results[:max_results]

    processing_ms = int((time.time() - start) * 1000)
    return results, processing_ms


def batch_compute_similarities(
    query_embedding: List[float],
    candidate_embeddings: List[List[float]],
) -> List[float]:
    """
    Vectorized cosine similarity computation for a query against multiple candidates.
    Faster than individual comparisons for large batches.
    """
    if not candidate_embeddings:
        return []

    query_arr = np.array(query_embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query_arr)

    if query_norm == 0:
        return [0.0] * len(candidate_embeddings)

    query_normalized = query_arr / query_norm

    # Stack all candidates into matrix: (N, 512)
    candidates_matrix = np.array(candidate_embeddings, dtype=np.float32)

    # Compute norms for each candidate row
    candidate_norms = np.linalg.norm(candidates_matrix, axis=1, keepdims=True)
    # Avoid division by zero
    candidate_norms = np.where(candidate_norms == 0, 1.0, candidate_norms)

    # Normalize rows
    candidates_normalized = candidates_matrix / candidate_norms

    # Batch dot product: (N,) similarities
    similarities = np.dot(candidates_normalized, query_normalized)

    # Clamp to [0, 1]
    similarities = np.clip(similarities, 0.0, 1.0)

    return similarities.tolist()
