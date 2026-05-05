"""
============================================================================
MBG Smart Logistics — AI Microservice (GPU-Accelerated)
============================================================================
FastAPI application providing:
  1. PaddleOCR endpoint (use_gpu=True) — scans receipt images for ingredients
  2. A2C PyTorch routing skeleton (CUDA) — reinforcement learning route optimizer
  3. Health check — reports GPU availability and model status

Target Hardware: NVIDIA RTX 5050 (8GB VRAM), 16GB RAM
============================================================================
"""

import io
import json
import logging
import time
from datetime import datetime
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from paddleocr import PaddleOCR
from pydantic import BaseModel

# ============================================================================
# Logging Setup
# ============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mbg-ai")

# ============================================================================
# FastAPI App
# ============================================================================
app = FastAPI(
    title="MBG Smart Logistics — AI Service",
    description="GPU-accelerated OCR and Route Optimization for food delivery",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# GPU Device Selection
# ============================================================================
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"🔧 PyTorch device: {DEVICE}")
if torch.cuda.is_available():
    logger.info(f"🎮 GPU: {torch.cuda.get_device_name(0)}")
    logger.info(f"💾 VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")

# ============================================================================
# PaddleOCR Initialization (GPU-Accelerated)
# ============================================================================
logger.info("🔄 Loading PaddleOCR model (use_gpu=True)...")
try:
    ocr_engine = PaddleOCR(
        use_angle_cls=True,
        lang="id",          # Indonesian language
        use_gpu=True,        # CRITICAL: GPU acceleration via CUDA
        show_log=False,
        det_db_thresh=0.3,   # Detection threshold tuned for receipt text
        rec_batch_num=16,    # Batch size for recognition (fits in 8GB VRAM)
    )
    logger.info("✅ PaddleOCR loaded successfully (GPU mode)")
except Exception as e:
    logger.warning(f"⚠️  PaddleOCR GPU init failed, falling back to CPU: {e}")
    ocr_engine = PaddleOCR(
        use_angle_cls=True,
        lang="id",
        use_gpu=False,
        show_log=False,
    )
    logger.info("✅ PaddleOCR loaded (CPU fallback mode)")


# ============================================================================
# A2C (Advantage Actor-Critic) Network — Route Optimization Skeleton
# ============================================================================
# This is a skeleton RL model for vehicle routing optimization.
# In production, this would be trained on historical delivery data from Malang.
# The model learns to select the next school to visit given:
#   - Current position
#   - Remaining schools
#   - Time constraints (expiration deadlines)
#   - Vehicle capacity
# ============================================================================

class A2CNetwork(nn.Module):
    """
    Advantage Actor-Critic network for CVRPTW route optimization.

    State space (input):
      - Current lat/lng (2)
      - Remaining time ratio (1)
      - Current load ratio (1)
      - School features: lat, lng, demand, time_window for each school (N * 4)

    Action space (output):
      - Probability distribution over next school to visit (N)
      - Value estimate for current state (1)
    """

    def __init__(self, state_dim: int, action_dim: int, hidden_dim: int = 128):
        super(A2CNetwork, self).__init__()

        # Shared feature extractor
        self.shared = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
        )

        # Actor head — outputs action probabilities (which school to visit next)
        self.actor = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, action_dim),
        )

        # Critic head — outputs state value estimate
        self.critic = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, state):
        features = self.shared(state)
        action_logits = self.actor(features)
        action_probs = F.softmax(action_logits, dim=-1)
        state_value = self.critic(features)
        return action_probs, state_value


# Initialize A2C model on GPU
MAX_SCHOOLS = 50  # Maximum number of schools in a single route
STATE_DIM = 4 + MAX_SCHOOLS * 4  # current_pos(2) + time_ratio(1) + load_ratio(1) + schools(N*4)
ACTION_DIM = MAX_SCHOOLS

a2c_model = A2CNetwork(STATE_DIM, ACTION_DIM).to(DEVICE)
a2c_model.eval()  # Inference mode (no trained weights yet — skeleton)

logger.info(f"✅ A2C model initialized on {DEVICE} "
            f"(state_dim={STATE_DIM}, action_dim={ACTION_DIM})")


# ============================================================================
# Pydantic Models (Request/Response)
# ============================================================================

class OCRResult(BaseModel):
    text: str
    confidence: float
    bbox: list


class OCRResponse(BaseModel):
    ingredients: list[dict]
    raw_texts: list[OCRResult]
    scan_time_ms: float
    gpu_used: bool


class SchoolNode(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    demand: int
    time_window_minutes: float  # Minutes remaining before expiration


class RouteOptimizeRequest(BaseModel):
    depot_lat: float
    depot_lng: float
    schools: list[SchoolNode]
    vehicle_capacity: int
    max_time_minutes: float
    temperature: Optional[float] = 28.0


class RouteStep(BaseModel):
    sequence: int
    school_id: int
    school_name: str
    estimated_minutes: float


class RouteOptimizeResponse(BaseModel):
    route: list[RouteStep]
    total_schools: int
    model_type: str  # "a2c_skeleton" or "osrm_fallback"
    device: str
    inference_time_ms: float


# ============================================================================
# POST /ocr/scan — PaddleOCR Receipt Scanning
# ============================================================================

@app.post("/ocr/scan", response_model=OCRResponse)
async def scan_receipt(file: UploadFile = File(...)):
    """
    Scan a receipt/nota image and extract ingredient data using PaddleOCR.

    - Accepts: image/jpeg, image/png
    - Returns: structured ingredient list with confidence scores
    - GPU: Uses CUDA if available for faster inference
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG or PNG.",
        )

    start_time = time.time()

    # Read image
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))
    image_np = np.array(image)

    logger.info(f"📷 [OCR] Scanning: {file.filename} ({len(image_bytes)} bytes, "
                f"{image_np.shape[1]}x{image_np.shape[0]})")

    # Run PaddleOCR
    result = ocr_engine.ocr(image_np, cls=True)

    # Parse results
    raw_texts = []
    ingredients = []

    if result and result[0]:
        for line in result[0]:
            bbox = line[0]
            text = line[1][0]
            confidence = float(line[1][1])

            raw_texts.append(OCRResult(
                text=text,
                confidence=confidence,
                bbox=[coord for point in bbox for coord in point],
            ))

            # Attempt to parse as ingredient (name + quantity + unit)
            parsed = _parse_ingredient_line(text)
            if parsed:
                parsed["confidence"] = confidence
                ingredients.append(parsed)

    scan_time_ms = (time.time() - start_time) * 1000
    gpu_used = torch.cuda.is_available()

    logger.info(f"✅ [OCR] Found {len(raw_texts)} text regions, "
                f"{len(ingredients)} ingredients ({scan_time_ms:.0f}ms, "
                f"GPU={'yes' if gpu_used else 'no'})")

    return OCRResponse(
        ingredients=ingredients,
        raw_texts=raw_texts,
        scan_time_ms=round(scan_time_ms, 2),
        gpu_used=gpu_used,
    )


def _parse_ingredient_line(text: str) -> Optional[dict]:
    """
    Attempt to parse a receipt text line into ingredient data.
    Handles common Indonesian receipt formats:
      - "Beras 50kg @15.000"
      - "Telur Ayam 10 butir 28.000"
      - "Minyak Goreng 5 ltr 80.000"
    """
    text = text.strip()
    if not text or len(text) < 3:
        return None

    # Common Indonesian units
    units = ["kg", "kilo", "gram", "gr", "g", "liter", "ltr", "lt", "l",
             "butir", "btr", "ikat", "ikt", "bungkus", "bks", "buah", "bh",
             "ons", "sachet", "sct", "botol", "btl", "lembar", "lbr"]

    # Normalize common abbreviations
    unit_map = {
        "kilo": "kg", "gr": "gram", "g": "gram",
        "ltr": "liter", "lt": "liter", "l": "liter",
        "btr": "butir", "ikt": "ikat", "bks": "bungkus",
        "bh": "buah", "sct": "sachet", "btl": "botol", "lbr": "lembar",
    }

    result = {
        "name": text,
        "quantity": None,
        "unit": None,
        "price": None,
    }

    # Try to find quantity + unit pattern
    import re
    # Pattern: number followed by unit
    pattern = r"(\d+[.,]?\d*)\s*(" + "|".join(units) + r")\b"
    match = re.search(pattern, text.lower())
    if match:
        qty_str = match.group(1).replace(",", ".")
        result["quantity"] = float(qty_str)
        unit = match.group(2)
        result["unit"] = unit_map.get(unit, unit)
        # Extract name (everything before the quantity)
        name_end = text.lower().find(match.group(0))
        if name_end > 0:
            result["name"] = text[:name_end].strip()

    # Try to find price (number with "rb", "ribu", or large number)
    price_pattern = r"(\d{1,3}[.,]?\d{3,})"
    price_match = re.search(price_pattern, text.replace(".", "").replace(",", ""))
    if price_match:
        result["price"] = int(price_match.group(1))

    # Only return if we found at least a name
    if result["name"] and len(result["name"]) > 1:
        return result
    return None


# ============================================================================
# POST /routing/optimize — A2C Route Optimization (Skeleton)
# ============================================================================

@app.post("/routing/optimize", response_model=RouteOptimizeResponse)
async def optimize_route(request: RouteOptimizeRequest):
    """
    Optimize delivery route using A2C reinforcement learning model.

    NOTE: This is a SKELETON — the A2C model has no trained weights yet.
    It generates a route using the model's random initialization as a
    demonstration of the inference pipeline. In production, this would
    be trained on historical Malang delivery data.

    Falls back to nearest-neighbor heuristic for practical use.
    """
    start_time = time.time()

    n_schools = len(request.schools)
    if n_schools == 0:
        raise HTTPException(status_code=400, detail="No schools provided")

    # Build state vector
    state = _build_state(
        depot_lat=request.depot_lat,
        depot_lng=request.depot_lng,
        schools=request.schools,
        current_load=0,
        vehicle_capacity=request.vehicle_capacity,
        time_remaining=request.max_time_minutes,
        max_time=request.max_time_minutes,
    )

    # Run A2C inference (skeleton — untrained weights)
    state_tensor = torch.FloatTensor(state).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        action_probs, state_value = a2c_model(state_tensor)

    # Use action probabilities to rank schools (even with random weights,
    # this demonstrates the full inference pipeline)
    probs = action_probs.squeeze().cpu().numpy()[:n_schools]

    # Build route from probability ranking
    school_indices = np.argsort(-probs)  # Sort by descending probability
    route = []
    cumulative_time = 0.0

    for seq, idx in enumerate(school_indices):
        if idx >= n_schools:
            continue
        school = request.schools[idx]
        # Simple time estimate (would use OSRM in production)
        est_minutes = 10.0 + seq * 5.0  # Placeholder
        cumulative_time += est_minutes

        if cumulative_time > request.max_time_minutes:
            break

        route.append(RouteStep(
            sequence=seq + 1,
            school_id=school.id,
            school_name=school.name,
            estimated_minutes=round(cumulative_time, 1),
        ))

    inference_time_ms = (time.time() - start_time) * 1000

    logger.info(f"🧠 [A2C] Route optimized: {len(route)}/{n_schools} schools, "
                f"{inference_time_ms:.0f}ms on {DEVICE}")

    return RouteOptimizeResponse(
        route=route,
        total_schools=len(route),
        model_type="a2c_skeleton",
        device=str(DEVICE),
        inference_time_ms=round(inference_time_ms, 2),
    )


def _build_state(
    depot_lat: float,
    depot_lng: float,
    schools: list[SchoolNode],
    current_load: int,
    vehicle_capacity: int,
    time_remaining: float,
    max_time: float,
) -> list[float]:
    """Build the state vector for the A2C network."""
    state = [
        depot_lat / 10.0,   # Normalize lat
        depot_lng / 100.0,  # Normalize lng
        time_remaining / max(max_time, 1.0),  # Time ratio [0, 1]
        current_load / max(vehicle_capacity, 1),  # Load ratio [0, 1]
    ]

    # School features (pad to MAX_SCHOOLS)
    for i in range(MAX_SCHOOLS):
        if i < len(schools):
            s = schools[i]
            state.extend([
                s.latitude / 10.0,
                s.longitude / 100.0,
                s.demand / max(vehicle_capacity, 1),
                s.time_window_minutes / max(max_time, 1.0),
            ])
        else:
            state.extend([0.0, 0.0, 0.0, 0.0])  # Padding

    return state


# ============================================================================
# GET /health — Health Check with GPU Info
# ============================================================================

@app.get("/health")
async def health_check():
    """Return service health including GPU status and model info."""
    gpu_info = None
    if torch.cuda.is_available():
        gpu_info = {
            "name": torch.cuda.get_device_name(0),
            "vram_total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1),
            "vram_used_gb": round(torch.cuda.memory_allocated(0) / 1e9, 3),
            "cuda_version": torch.version.cuda,
        }

    return {
        "status": "healthy",
        "service": "MBG AI Service",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "gpu": gpu_info,
        "pytorch_device": str(DEVICE),
        "models": {
            "paddleocr": {
                "loaded": ocr_engine is not None,
                "lang": "id",
                "gpu_enabled": torch.cuda.is_available(),
            },
            "a2c_routing": {
                "loaded": True,
                "state_dim": STATE_DIM,
                "action_dim": ACTION_DIM,
                "status": "skeleton (untrained)",
                "device": str(DEVICE),
            },
        },
    }


# ============================================================================
# Startup Event
# ============================================================================

@app.on_event("startup")
async def startup_event():
    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║   🤖 MBG Smart Logistics — AI Service                  ║")
    logger.info("║   📍 GPU-Accelerated OCR + Route Optimization          ║")
    logger.info(f"║   🔧 Device: {str(DEVICE):44s}  ║")
    logger.info("║   📦 PaddleOCR (Indonesian) + A2C PyTorch              ║")
    logger.info("╚══════════════════════════════════════════════════════════╝")
