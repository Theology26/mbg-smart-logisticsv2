"""
============================================================================
MBG Smart Logistics — AI Microservice (GPU-Accelerated)
============================================================================
FastAPI application providing:
  1. Llama 3.2 90B Vision (NVIDIA NIM API) — semantic extraction & Epsilon scoring
  2. PaddleOCR endpoint (use_gpu=True) — local fallback for receipt scanning
  3. A2C PyTorch routing skeleton (CUDA) — reinforcement learning route optimizer
  4. Health check — reports GPU availability and model status

Target Hardware: NVIDIA RTX 5050 (8GB VRAM), 16GB RAM
============================================================================
"""

import io
import json
import logging
import re
import time
import base64
import requests
from datetime import datetime
from typing import Optional

import numpy as np
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("⚠️ PyTorch not found. A2C routing skeleton will be disabled.")

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

try:
    from paddleocr import PaddleOCR
    HAS_PADDLEOCR = True
except ImportError:
    HAS_PADDLEOCR = False
    logger.warning("⚠️ PaddleOCR not found. Local OCR fallback will be disabled.")
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
# FastAPI App & NVIDIA NIM Config
# ============================================================================
app = FastAPI(
    title="MBG Smart Logistics — AI Service",
    description="Vision Intelligence & Route Optimization for Food Delivery",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# NVIDIA NIM Config — Llama 3.2 90B Vision Instruct
NVIDIA_API_KEY = "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"
LLAMA_VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# ============================================================================
# GPU Device Selection
# ============================================================================
if HAS_TORCH:
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"🔧 PyTorch device: {DEVICE}")
    if torch.cuda.is_available():
        logger.info(f"🎮 GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"💾 VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")
else:
    DEVICE = "cpu"
    logger.warning("🔧 PyTorch not found. Defaulting DEVICE to cpu.")

# ============================================================================
# PaddleOCR Initialization (Local Fallback)
# ============================================================================
ocr_engine = None
if HAS_PADDLEOCR:
    logger.info("🔄 Loading PaddleOCR model...")
    try:
        # Try full feature OCR
        ocr_engine = PaddleOCR(use_angle_cls=True, lang="id")
        logger.info("✅ PaddleOCR loaded successfully")
    except Exception as e:
        logger.warning(f"⚠️  PaddleOCR full init failed: {e}. Trying safe mode...")
        try:
            # Try minimal OCR
            ocr_engine = PaddleOCR(lang="id")
            logger.info("✅ PaddleOCR loaded (safe mode)")
        except Exception as e2:
            logger.error(f"❌ PaddleOCR failed to initialize completely: {e2}")
            ocr_engine = None
            HAS_PADDLEOCR = False
else:
    logger.warning("⚠️ PaddleOCR is skipped because the module is not installed.")


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

a2c_model = None
if HAS_TORCH:
    a2c_model = A2CNetwork(STATE_DIM, ACTION_DIM).to(DEVICE)
    a2c_model.eval()  # Inference mode (no trained weights yet — skeleton)
    logger.info(f"✅ A2C model initialized on {DEVICE} "
                f"(state_dim={STATE_DIM}, action_dim={ACTION_DIM})")
else:
    logger.warning("⚠️ A2C model initialization skipped.")


# ============================================================================
# Pydantic Models (Request/Response)
# ============================================================================

# --- Models for Llama Vision ---
class LlamaIngredient(BaseModel):
    name: str
    quantity: str
    risk_level: str


class LlamaVisionResponse(BaseModel):
    ingredients: list[LlamaIngredient]
    urgency_min: int
    raw_llama_output: str
    inference_time_ms: float


# --- Models for PaddleOCR (Fallback) ---
class OCRResult(BaseModel):
    text: str
    confidence: float
    bbox: list


class OCRResponse(BaseModel):
    ingredients: list[dict]
    raw_texts: list[OCRResult]
    scan_time_ms: float
    gpu_used: bool


# --- Models for Menu Suggestion ---
class MenuSuggestRequest(BaseModel):
    ingredients: list[dict]

class MenuSuggestResponse(BaseModel):
    suggested_menu: str
    reasoning: str
    inference_time_ms: float


# --- Models for Routing ---
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
    model_type: str  # "a2c_skeleton" or "weighted_heuristic_v1"
    device: str
    inference_time_ms: float


# ============================================================================
# POST /vision/analyze — Llama 3.2 90B Vision Instruct (NVIDIA NIM)
# ============================================================================

@app.post("/vision/analyze/", response_model=LlamaVisionResponse)
def analyze_receipt_with_llama(file: UploadFile = File(...)):
    """
    Sends kitchen receipt images to Llama 3.2 Vision on NVIDIA NIM.
    Extracts ingredients and calculates biological spoilage risk (Epsilon / urgency_min).

    This replaces the previous Gemini-based approach with a self-hosted Llama model
    running on NVIDIA's NIM inference platform for better control and lower latency.
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Use JPEG or PNG images only.")

    start_time = time.time()

    image_bytes = file.file.read()
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    img_data_url = f"data:{file.content_type};base64,{b64_image}"

    logger.info(f"🧠 [Llama Vision] Sending {file.filename} to NVIDIA NIM...")

    system_prompt = """
    Kamu adalah AI Logistik Pangan. BACA GAMBAR NOTA/RESEP INI BARIS DEMI BARIS DENGAN SANGAT TELITI.
    ATURAN EKSTRAKSI:
    1. JANGAN MENEBAK BARANG YANG TIDAK ADA DI NOTA. Ekstrak sesuai teks asli.
    2. JIKA ADA PECAHAN TULISAN TANGAN seperti '1/2', tuliskan dengan desimal '0.5'.
    3. UNTUK ANGKA RIBUAN, hilangkan tanda titik (misal '4.000 kg' wajib ditulis '4000 kg').
    4. CONTEXT-AWARE EXTRACTION: Jika ada singkatan pasar (misal: 'b. mrh' -> 'Bawang Merah', 'bwg' -> 'Bawang', 'ken' -> 'Jerigen'), terjemahkan ke bentuk baku yang benar.
    5. Tentukan 'risk_level' (tinggi/sedang/rendah). Bahan basah/santan/daging = tinggi.
    6. Tentukan 'urgency_min' (waktu basi terpendek dalam menit dari semua bahan). Misal: santan = 60, sayur = 150, beras = 999.
    
    WAJIB KEMBALIKAN OUTPUT HANYA DALAM FORMAT JSON SEPERTI INI TANPA TEKS LAIN:
    {
      "ingredients": [{"name": "Ayam", "quantity": "2 kg", "risk_level": "tinggi"}],
      "urgency_min": 60
    }
    """

    payload = {
        "model": LLAMA_VISION_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": system_prompt},
                    {"type": "image_url", "image_url": {"url": img_data_url}},
                ],
            }
        ],
        "max_tokens": 512,
        "temperature": 0.1,
    }

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()

        llama_text = data["choices"][0]["message"]["content"]
        
        json_match = re.search(r'\{.*\}', llama_text, re.DOTALL)
        if json_match:
            clean_json_str = json_match.group(0)
            parsed_data = json.loads(clean_json_str)
        else:
            raise ValueError("No JSON object found in Llama output")
            
        inference_time_ms = (time.time() - start_time) * 1000

        logger.info(
            f"✅ [Llama Vision] Inference complete in {inference_time_ms:.0f}ms. "
            f"Urgency: {parsed_data.get('urgency_min')} mins."
        )

        return LlamaVisionResponse(
            ingredients=parsed_data.get("ingredients", []),
            urgency_min=parsed_data.get("urgency_min", 999),
            raw_llama_output=llama_text,
            inference_time_ms=round(inference_time_ms, 2),
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ [NVIDIA API Error]: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach NVIDIA NIM server.")
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"❌ [Parsing Error]: Llama returned invalid JSON. {e}")
        raise HTTPException(status_code=500, detail="Llama did not return valid JSON format.")


# ============================================================================
# POST /decision/suggest-menu — NVIDIA Llama 3.1 Nemotron 70B
# ============================================================================

@app.post("/decision/suggest-menu", response_model=MenuSuggestResponse)
def suggest_menu(request: MenuSuggestRequest):
    """
    Uses NVIDIA's Nemotron 70B model to suggest a menu that optimizes the
    usage of ingredients, specifically prioritizing those with high risk of spoilage.
    """
    start_time = time.time()
    
    logger.info("🧠 [Nemotron] Generating menu suggestion...")
    
    ingredients_str = json.dumps(request.ingredients, indent=2)
    
    system_prompt = """
    Anda adalah AI Chef Logistik Pangan MBG.
    Tugas Anda: Analisis stok bahan berikut dan sarankan 1 MENU UTAMA yang kreatif dan unik.
    Prioritas: Habiskan bahan dengan risk_level "tinggi" atau yang paling cepat basi (epsilon/urgency tinggi).
    PENTING: Jangan selalu menyarankan menu yang sama (seperti Gulai atau Kare). Buatlah variasi masakan nusantara atau modern yang menarik namun masuk akal untuk dimasak di dapur umum.
    Berikan format JSON murni tanpa markdown, contoh:
    {
      "suggested_menu": "Ayam Goreng Lengkuas",
      "reasoning": "Ayam memiliki risk_level tinggi dan harus segera dimasak."
    }
    """
    
    payload = {
        "model": "meta/llama-3.1-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Ini stok bahan saat ini:\n{ingredients_str}"}
        ],
        "max_tokens": 512,
        "temperature": 0.8,
    }
    
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    try:
        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        
        llama_text = data["choices"][0]["message"]["content"]
        
        json_match = re.search(r'\{.*\}', llama_text, re.DOTALL)
        if json_match:
            clean_json_str = json_match.group(0)
            parsed_data = json.loads(clean_json_str)
        else:
            raise ValueError("No JSON object found in Nemotron output")
            
        inference_time_ms = (time.time() - start_time) * 1000
        
        return MenuSuggestResponse(
            suggested_menu=parsed_data.get("suggested_menu", "Saran tidak valid"),
            reasoning=parsed_data.get("reasoning", "Tidak ada alasan"),
            inference_time_ms=round(inference_time_ms, 2)
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ [NVIDIA API Error]: {e}")
        raise HTTPException(status_code=502, detail="Failed to reach NVIDIA NIM server.")
    except Exception as e:
        logger.error(f"❌ [Nemotron Error]: {e}")
        raise HTTPException(status_code=500, detail="Nemotron parsing error")

class EpsilonRequest(BaseModel):
    menu_name: str

class EpsilonResponse(BaseModel):
    menu_name: str
    epsilon_score: float
    category: str
    reasoning: str

@app.post("/decision/calculate-epsilon", response_model=EpsilonResponse)
def calculate_epsilon(request: EpsilonRequest):
    """
    Uses Nemotron 70B to calculate the epsilon (urgency) score for a manual menu.
    """
    logger.info(f"🧠 [Nemotron] Calculating Epsilon for: {request.menu_name}")
    
    system_prompt = """
    Anda adalah AI Chef. Berikan klasifikasi kategori ("Santan", "Basah", atau "Kering") 
    serta skor Epsilon (angka float 0.0 - 1.0) yang merepresentasikan seberapa cepat basi menu makanan ini.
    Format JSON murni tanpa awalan/akhiran apapun:
    {"category": "Santan", "epsilon_score": 0.85, "reasoning": "Santan cepat basi..."}
    """
    
    payload = {
        "model": "meta/llama-3.1-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Menu: {request.menu_name}"}
        ],
        "max_tokens": 256,
        "temperature": 0.2,
    }
    
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    try:
        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()
        
        llama_text = data["choices"][0]["message"]["content"]
        json_match = re.search(r'\{.*\}', llama_text, re.DOTALL)
        if json_match:
            parsed_data = json.loads(json_match.group(0))
        else:
            parsed_data = {"epsilon_score": 0.5, "category": "Basah", "reasoning": "Fallback default"}
            
        return EpsilonResponse(
            menu_name=request.menu_name,
            epsilon_score=float(parsed_data.get("epsilon_score", 0.5)),
            category=parsed_data.get("category", "Basah"),
            reasoning=parsed_data.get("reasoning", "Dihitung oleh AI")
        )
    except Exception as e:
        logger.error(f"❌ [Epsilon Error]: {e}")
        return EpsilonResponse(
            menu_name=request.menu_name,
            epsilon_score=0.5,
            category="Basah",
            reasoning="Fallback due to error"
        )

# ============================================================================
# POST /ocr/scan — Local PaddleOCR (Fallback)
# ============================================================================

@app.post("/ocr/scan/", response_model=OCRResponse)
async def scan_receipt(file: UploadFile = File(...)):
    """
    Scan a receipt/nota image and extract ingredient data using PaddleOCR.
    This is the legacy/fallback OCR using local GPU when NVIDIA NIM is unavailable.

    - Accepts: image/jpeg, image/png
    - Returns: structured ingredient list with confidence scores
    - GPU: Uses CUDA if available for faster inference
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG or PNG.",
        )

    start_time = time.time()

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes))
    image_np = np.array(image)

    logger.info(f"📷 [OCR] Scanning: {file.filename} ({len(image_bytes)} bytes, "
                f"{image_np.shape[1]}x{image_np.shape[0]})")

    if not ocr_engine:
        logger.error("❌ OCR requested but engine is not initialized.")
        raise HTTPException(
            status_code=503,
            detail="Local OCR engine is unavailable on this system. Please use /vision/analyze (Llama Vision) instead."
        )

    result = ocr_engine.ocr(image_np)

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

    # Build state vector (used for future A2C inference)
    state = _build_state(
        depot_lat=request.depot_lat,
        depot_lng=request.depot_lng,
        schools=request.schools,
        current_load=0,
        vehicle_capacity=request.vehicle_capacity,
        time_remaining=request.max_time_minutes,
        max_time=request.max_time_minutes,
    )

    # HEURISTIC OPTIMIZATION (Weighted Nearest Neighbor)
    # Instead of random RL weights, we use a scoring formula:
    # Score = (1 / Distance) + (Urgency_Weight * EpsilonScore)

    scored_schools = []
    curr_lat, curr_lng = request.depot_lat, request.depot_lng

    # Calculate distance and urgency score for each school
    for s in request.schools:
        dist = ((s.latitude - curr_lat)**2 + (s.longitude - curr_lng)**2)**0.5
        dist = max(dist, 0.0001)  # Avoid division by zero

        # Urgency is s.time_window_minutes (Epsilon Score passed from Go)
        urgency = s.time_window_minutes

        # Heuristic: Closer is better, higher urgency is better
        # We weigh distance more heavily to avoid "muter-muter"
        score = (1.0 / dist) + (urgency * 5.0)
        scored_schools.append({'school': s, 'score': score})

    # Sort schools by calculated score descending
    scored_schools.sort(key=lambda x: x['score'], reverse=True)

    route = []
    cumulative_time = 0.0
    for seq, item in enumerate(scored_schools):
        school = item['school']
        # Simple sequence estimate for UI
        est_minutes = 10.0 + seq * 8.0
        cumulative_time += est_minutes

        if cumulative_time > request.max_time_minutes:
            break

        route.append(RouteStep(
            sequence=seq + 1,
            school_id=school.id,
            school_name=school.name,
            estimated_minutes=round(cumulative_time, 1),
        ))
        # Update current pos to last visited school for next step calculation
        curr_lat, curr_lng = school.latitude, school.longitude

    inference_time_ms = (time.time() - start_time) * 1000

    logger.info(f"🧠 [Routing] Route optimized: {len(route)}/{n_schools} schools "
                f"({inference_time_ms:.2f}ms)")

    return RouteOptimizeResponse(
        route=route,
        total_schools=len(route),
        model_type="weighted_heuristic_v1",
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
        "version": "1.1.0",
        "timestamp": datetime.now().isoformat(),
        "gpu": gpu_info,
        "pytorch_device": str(DEVICE),
        "models": {
            "llama_vision": {
                "loaded": "via_nvidia_nim",
                "model": LLAMA_VISION_MODEL,
                "api_key_configured": NVIDIA_API_KEY != "nvapi-MASUKKAN_KUNCI_NVIDIA_NIM_KAMU_DISINI",
            },
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
    logger.info("║   🤖 MBG Smart Logistics — AI Service v1.1.0            ║")
    logger.info("║   📍 Llama Vision API + GPU Route Optimization          ║")
    logger.info(f"║   🔧 Device: {str(DEVICE):44s}  ║")
    logger.info("║   📦 PaddleOCR (ID) + A2C PyTorch + Llama 3.2 90B      ║")
    logger.info("╚══════════════════════════════════════════════════════════╝")
