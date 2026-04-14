"""
AirDraw Backend - FastAPI server for handwriting recognition and drawing storage
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import base64
import io
import json
import os
import re
from typing import Optional, List
import uvicorn

app = FastAPI(title="AirDraw API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───────────────────────────────────────────────────────────────────

class RecognizeRequest(BaseModel):
    image: str          # base64 PNG of the drawn stroke
    strokes: List[dict] # raw stroke data for ML fallback

class AutocorrectRequest(BaseModel):
    text: str

class SaveDrawingRequest(BaseModel):
    image: str          # base64 PNG of full canvas
    filename: Optional[str] = "airdraw_export"

# ─── Handwriting Recognition ──────────────────────────────────────────────────

LETTER_MAP = {
    "circle": "O",
    "vertical_line": "I",
    "horizontal_line": "-",
    "triangle": "A",
    "square": "D",
}

def simple_stroke_recognizer(strokes: List[dict]) -> str:
    """
    Heuristic stroke recognizer based on bounding box and path shape.
    Replace this with a real TF/ONNX model inference call.
    """
    if not strokes:
        return ""
    
    all_points = []
    for stroke in strokes:
        all_points.extend(stroke.get("points", []))
    
    if not all_points:
        return ""

    xs = [p["x"] for p in all_points]
    ys = [p["y"] for p in all_points]
    
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    aspect = width / height if height > 0 else 1
    
    # Very rough heuristics — swap for real model
    if aspect > 3:
        return "-"
    elif aspect < 0.3:
        return "I"
    elif 0.8 < aspect < 1.2:
        return "O"
    else:
        return "?"

# ─── NLP Autocorrect ──────────────────────────────────────────────────────────

COMMON_WORDS = [
    "hello", "world", "the", "and", "is", "in", "it", "of", "to", "a",
    "that", "was", "he", "for", "on", "are", "with", "as", "you", "at",
    "this", "have", "from", "or", "had", "by", "not", "but", "what",
    "all", "were", "when", "we", "there", "can", "an", "your", "which",
    "their", "said", "do", "how", "will", "up", "about", "out", "many",
    "draw", "air", "write", "paint", "color", "create", "design",
]

def levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[-1]

def autocorrect(text: str) -> dict:
    words = text.lower().split()
    corrected = []
    suggestions_all = []
    
    for word in words:
        if word in COMMON_WORDS:
            corrected.append(word)
            suggestions_all.append([word])
            continue
        
        scored = sorted(COMMON_WORDS, key=lambda w: levenshtein(word, w))
        best = scored[:3]
        corrected.append(best[0] if levenshtein(word, best[0]) <= 2 else word)
        suggestions_all.append(best)
    
    return {
        "original": text,
        "corrected": " ".join(corrected),
        "suggestions": suggestions_all,
    }

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "AirDraw API running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/recognize")
async def recognize_letter(req: RecognizeRequest):
    """Recognize a drawn letter from stroke data."""
    try:
        letter = simple_stroke_recognizer(req.strokes)
        return {
            "letter": letter,
            "confidence": 0.75,
            "method": "heuristic",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/autocorrect")
async def autocorrect_text(req: AutocorrectRequest):
    """Autocorrect recognized text using edit-distance NLP."""
    try:
        result = autocorrect(req.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save")
async def save_drawing(req: SaveDrawingRequest):
    """Accept a base64 canvas image and return it as a download."""
    try:
        # Strip data URL header if present
        data = re.sub(r"^data:image/\w+;base64,", "", req.image)
        img_bytes = base64.b64decode(data)
        
        # In production: save to S3/disk. Here we echo back.
        return JSONResponse({
            "success": True,
            "filename": f"{req.filename}.png",
            "size_bytes": len(img_bytes),
            "message": "Drawing saved successfully",
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")

@app.post("/upload-model")
async def placeholder_model_upload():
    return {"message": "Model upload endpoint — connect your ONNX model here"}

# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
