# ============================================================================
# MBG Smart Logistics — AI Service Dockerfile (NVIDIA GPU)
# ============================================================================
# Base: NVIDIA CUDA 12.6 + Ubuntu 22.04
# Target: RTX 5050 (8GB VRAM), 16GB RAM
# ============================================================================

FROM nvidia/cuda:12.6.3-devel-ubuntu22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Jakarta

# Install Python 3.11 and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# Upgrade pip
RUN python3 -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Install PaddlePaddle GPU first (requires special index)
RUN pip install paddlepaddle-gpu==3.1.0 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cu126/

# Install PyTorch with CUDA 12.6 support
RUN pip install torch --index-url https://download.pytorch.org/whl/cu126

# Copy and install remaining requirements
COPY requirements.txt .
# Install everything except paddle and torch (already installed above)
RUN grep -v -E "^(paddlepaddle|torch)" requirements.txt > requirements_filtered.txt \
    && pip install --no-cache-dir -r requirements_filtered.txt

# Copy application code
COPY app.py .

# Expose FastAPI port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import httpx; r = httpx.get('http://localhost:9000/health'); assert r.status_code == 200"

# Run with uvicorn
CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000", "--workers", "1"]
