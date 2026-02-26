# =============================================================
# ReunIA Face Service — Dockerfile
# =============================================================
FROM python:3.11-slim

# Install system dependencies for OpenCV and DeepFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create model cache directory — DeepFace downloads models here
RUN mkdir -p /root/.deepface/weights

# Pre-warm models on build (optional — comment out for faster builds)
# RUN python -c "from deepface import DeepFace; DeepFace.build_model('ArcFace')" || true

EXPOSE 8001

# Use single uvicorn worker for predictable memory usage
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--log-level", "info"]
