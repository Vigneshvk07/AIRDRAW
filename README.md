# ✦ AirDraw — Draw in the Air with Your Hands

**AirDraw** is a real-time air-drawing application powered by MediaPipe hand tracking, React, and a FastAPI backend. Point your finger at a webcam and draw glowing neon strokes on a virtual canvas — no mouse or stylus needed.

![AirDraw UI](https://via.placeholder.com/800x400/06060f/00f5ff?text=AirDraw)

---

## 🗂 Project Structure

```
AirDraw/
├── frontend/                    # React app
│   ├── public/index.html
│   ├── src/
│   │   ├── App.jsx              # Main app, canvas logic, gesture wiring
│   │   ├── index.js
│   │   ├── components/
│   │   │   ├── Toolbar.jsx      # Color, brush, undo, clear, export
│   │   │   ├── GestureGuide.jsx # Floating gesture cheat-sheet
│   │   │   └── TextDisplay.jsx  # AI-recognized text display
│   │   ├── hooks/
│   │   │   └── useHandTracking.js  # MediaPipe Hands wrapper + gesture detection
│   │   └── utils/
│   │       └── canvasUtils.js   # Stroke, neon glow renderer, export
│   ├── package.json
│   └── .env
└── backend/                     # FastAPI Python server
    ├── main.py                  # API routes: /recognize, /autocorrect, /save
    └── requirements.txt
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+
- A webcam
- Chrome or Edge (best WebRTC support)

---

### 1. Start the Backend

```bash
cd AirDraw/backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
# → API available at http://localhost:8000
# → Swagger docs at http://localhost:8000/docs
```

---

### 2. Start the Frontend

```bash
cd AirDraw/frontend

# Install npm packages
npm install

# Start dev server
npm start
# → App available at http://localhost:3000
```

Open **http://localhost:3000** in Chrome. Grant camera permission when prompted.

---

## 🤚 Gestures

| Gesture | Action |
|---|---|
| ☝️ Index finger up | **Draw** — trace strokes in the air |
| ✊ Closed fist | **Pause** drawing |
| ✌️ Two fingers | **Erase** mode |
| 🖐 Open palm | **Clear** canvas + recognize letters |
| 🤏 Pinch (thumb + index) | **Drag / move** drawn content |

---

## 🎨 UI Features

| Feature | Detail |
|---|---|
| **Neon glow strokes** | Multi-layer glow with `globalCompositeOperation: lighter` |
| **8 colors** | Cyan, Magenta, Lime, Orange, Gold, White, Purple, Rose |
| **Brush size** | Slider 2–24 px |
| **Undo** | Ctrl+Z or button |
| **Export PNG** | Downloads canvas + webcam blend |
| **FPS counter** | Live render speed |
| **Hand skeleton** | Transparent landmark overlay |

---

## 🤖 AI Features

### Handwriting Recognition
- `POST /recognize` — accepts stroke data, returns letter character
- Replace `simple_stroke_recognizer()` in `main.py` with a real model:
  - **EMNIST** ONNX model for single-letter classification
  - **TrOCR** (Hugging Face) for word-level recognition from canvas PNG

### Autocorrect NLP
- `POST /autocorrect` — Levenshtein edit-distance against common word list
- Upgrade path: connect to **LanguageTool**, **OpenAI**, or **Hunspell**

---

## 🔧 Upgrading to a Real ML Model

Replace `simple_stroke_recognizer()` in `backend/main.py`:

```python
import onnxruntime as ort
import numpy as np
from PIL import Image
import base64, io, re

session = ort.InferenceSession("models/emnist_letters.onnx")

def simple_stroke_recognizer(strokes):
    # Render strokes to 28x28 grayscale image
    img = render_strokes_to_image(strokes, size=28)
    x = np.array(img).astype(np.float32) / 255.0
    x = x.reshape(1, 1, 28, 28)
    logits = session.run(None, {"input": x})[0]
    label = np.argmax(logits)
    return chr(ord('A') + label)
```

Download EMNIST ONNX: https://github.com/onnx/models/tree/main/validated/vision/body_analysis/ultraface

---

## 📱 Mobile Compatibility

AirDraw uses WebRTC — it works on mobile Chrome (Android/iOS) if you:
1. Deploy frontend to HTTPS (e.g., Vercel, Netlify)
2. Deploy backend to HTTPS (e.g., Railway, Render)
3. Update `REACT_APP_API_URL` in `.env`

---

## 🎬 Performance Tips

- Set `modelComplexity: 0` in `useHandTracking.js` for low-end devices
- Reduce video resolution: change `width: 640, height: 480` → `480, 360`
- Use `OffscreenCanvas` for stroke rendering on Chrome

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Hand tracking | MediaPipe Hands (JS CDN) |
| Frontend | React 18 + Canvas API |
| Webcam | WebRTC via MediaPipe Camera Utils |
| Backend | FastAPI + Uvicorn |
| Recognition | Heuristic (swap for ONNX/TF) |
| NLP | Levenshtein autocorrect |
| Styling | Pure CSS-in-JS with neon theme |

---

## 🛠 Scripts

```bash
# Frontend
npm start          # Dev server on :3000
npm run build      # Production build → /frontend/build

# Backend
python main.py     # Dev server on :8000 (auto-reload)
uvicorn main:app --port 8000 --reload   # Alternative
```

---

## 📄 License

MIT — build anything you want on top of it.

---

> Made with ✦ — AirDraw
