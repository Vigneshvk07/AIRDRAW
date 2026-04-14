// App.jsx — AirDraw: draw in air with your hands
import React, {
  useRef, useEffect, useState, useCallback, useReducer,
} from "react";
import { useHandTracking } from "./hooks/useHandTracking";
import {
  Stroke, renderAllStrokes, drawCursor, exportCanvas, PALETTE, renderStroke,
} from "./utils/canvasUtils";
import Toolbar from "./components/Toolbar.jsx";
import GestureGuide from "./components/GestureGuide.jsx";
import TextDisplay from "./components/TextDisplay.jsx";

// ─── Stroke reducer ──────────────────────────────────────────────────────────
function strokesReducer(state, action) {
  switch (action.type) {
    case "ADD_STROKE":    return [...state, action.stroke];
    case "UPDATE_STROKE": return state.map((s) => s.id === action.id ? action.stroke : s);
    case "UNDO":          return state.slice(0, -1);
    case "CLEAR":         return [];
    default:              return state;
  }
}

// ─── API helpers ─────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function recognizeLetter(strokes) {
  try {
    const res = await fetch(`${API}/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "", strokes }),
    });
    return res.ok ? (await res.json()).letter : "?";
  } catch { return "?"; }
}

async function autocorrectText(text) {
  try {
    const res = await fetch(`${API}/autocorrect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok ? (await res.json()).corrected : text;
  } catch { return text; }
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const videoRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentStrokeRef = useRef(null);
  const gestureRef = useRef("NONE");
  const pointRef = useRef({ x: 0.5, y: 0.5 });
  const lastPinchRef = useRef(null);
  const landmarksRef = useRef(null);
  const drawHoldRef = useRef(0); // frames held in INDEX_UP before drawing starts

  const [strokes, dispatch] = useReducer(strokesReducer, []);
  const strokesRef = useRef(strokes);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  
  // Track smoother reset for gesture changes
  const smootherResetRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const pointVelocityRef = useRef(0);

  const [color, setColor] = useState(PALETTE[0].hex);
  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);

  const [brushSize, setBrushSize] = useState(6);
  const brushRef = useRef(brushSize);
  useEffect(() => { brushRef.current = brushSize; }, [brushSize]);

  const [gesture, setGesture] = useState("NONE");
  const [recognizedText, setRecognizedText] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [fps, setFps] = useState(0);

  const fpsRef = useRef({ count: 0, last: Date.now() });

  // ── Resize canvases to video dimensions ────────────────────────────────────
  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const draw = drawCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !draw || !overlay) return;
    const { offsetWidth: w, offsetHeight: h } = video;
    if (draw.width !== w) { draw.width = w; overlay.width = w; }
    if (draw.height !== h) { draw.height = h; overlay.height = h; }
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(syncCanvasSize);
    if (videoRef.current) ro.observe(videoRef.current);
    return () => ro.disconnect();
  }, [syncCanvasSize]);

  // ── Main render loop ────────────────────────────────────────────────────────
  const renderLoop = useCallback(() => {
    animFrameRef.current = requestAnimationFrame(renderLoop);

    const drawCanvas = drawCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!drawCanvas || !overlay) return;

    syncCanvasSize();

    // Draw strokes
    const ctx = drawCanvas.getContext("2d");
    renderAllStrokes(ctx, strokesRef.current, drawCanvas.width, drawCanvas.height);

    // Draw current stroke in progress
    if (currentStrokeRef.current?.points.length > 1) {
      renderStroke(ctx, currentStrokeRef.current);
    }

    // Draw overlay (cursor + landmarks)
    const octx = overlay.getContext("2d");
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const px = pointRef.current.x * overlay.width;
    const py = pointRef.current.y * overlay.height;
    drawCursor(octx, px, py, gestureRef.current, colorRef.current, landmarksRef.current, overlay.width, overlay.height);

    // Draw skeleton landmarks
    if (landmarksRef.current) {
      _drawSkeleton(octx, landmarksRef.current, overlay.width, overlay.height);
    }

    // FPS counter
    const now = Date.now();
    fpsRef.current.count++;
    if (now - fpsRef.current.last >= 1000) {
      setFps(fpsRef.current.count);
      fpsRef.current.count = 0;
      fpsRef.current.last = now;
    }
  }, [syncCanvasSize]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [renderLoop]);

  // ── Gesture handler ─────────────────────────────────────────────────────────
  const handleGesture = useCallback(async (g, point) => {
    const prevGesture = gestureRef.current;
    gestureRef.current = g;
    setGesture(g);
    
    // Debug logging
    console.log('Gesture detected:', g, 'Previous:', prevGesture);

    // Clear current stroke when switching between drawing gestures
    if (currentStrokeRef.current && 
        ((prevGesture === "INDEX_UP" && g !== "INDEX_UP") ||
         (prevGesture === "TWO_FINGERS" && g !== "TWO_FINGERS"))) {
      // Commit current stroke if it has meaningful points
      if (currentStrokeRef.current.points.length > 2) {
        dispatch({ type: "ADD_STROKE", stroke: currentStrokeRef.current });
      }
      currentStrokeRef.current = null;
      drawHoldRef.current = 0;
    }

    if (g === "OPEN_PALM") {
      // Recognize before clearing
      if (strokesRef.current.length > 0) {
        const strokes = strokesRef.current.map((s) => ({ points: s.points }));
        const letter = await recognizeLetter(strokes);
        const newText = recognizedText + letter;
        const corrected = await autocorrectText(newText);
        setRecognizedText(corrected);
      }
      dispatch({ type: "CLEAR" });
      currentStrokeRef.current = null;
      drawHoldRef.current = 0;
    }

    if (g === "FIST" || g === "NONE") {
      // Commit current stroke if it has meaningful points
      if (currentStrokeRef.current?.points.length > 2) {
        dispatch({ type: "ADD_STROKE", stroke: currentStrokeRef.current });
      }
      currentStrokeRef.current = null;
      drawHoldRef.current = 0;
    }

    // Create new strokes for drawing gestures
    if (g === "TWO_FINGERS" && !currentStrokeRef.current) {
      currentStrokeRef.current = new Stroke({ size: brushRef.current * 3, isErase: true });
    }
  }, [recognizedText]);

  // ── Point handler ────────────────────────────────────────────────────────────
  const handlePoint = useCallback(({ x, y }) => {
    pointRef.current = { x, y };
    const g = gestureRef.current;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    // Calculate velocity to detect when finger stops
    const dx = x - lastPointRef.current.x;
    const dy = y - lastPointRef.current.y;
    const velocity = Math.sqrt(dx * dx + dy * dy);
    pointVelocityRef.current = velocity;
    lastPointRef.current = { x, y };

    if (g === "INDEX_UP") {
      // Create stroke immediately when INDEX_UP is detected (simplified)
      if (!currentStrokeRef.current) {
        currentStrokeRef.current = new Stroke({
          color: colorRef.current,
          size: brushRef.current,
          isErase: false,
        });
        console.log('Created new stroke for INDEX_UP at', x, y);
      }
      // Always add points for INDEX_UP gesture
      currentStrokeRef.current.addPoint(x * canvas.width, y * canvas.height);
      console.log('Added point to stroke. Total points:', currentStrokeRef.current.points.length);
      lastPinchRef.current = null;
    } else if (g === "TWO_FINGERS" && currentStrokeRef.current) {
      // Add points for TWO_FINGERS gesture
      currentStrokeRef.current.addPoint(x * canvas.width, y * canvas.height);
      lastPinchRef.current = null;
    } else if (g === "PINCH") {
      if (lastPinchRef.current) {
        const dx = (x - lastPinchRef.current.x) * canvas.width;
        const dy = (y - lastPinchRef.current.y) * canvas.height;
        for (const stroke of strokesRef.current) {
          for (const pt of stroke.points) {
            pt.x += dx;
            pt.y += dy;
          }
        }
      }
      lastPinchRef.current = { x, y };
    } else {
      lastPinchRef.current = null;
    }
  }, []);

  const handleLandmarks = useCallback((lm) => {
    landmarksRef.current = lm;
  }, []);

  useHandTracking({
    videoRef,
    onGesture: handleGesture,
    onPoint: handlePoint,
    onLandmarks: handleLandmarks,
  });

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    exportCanvas(drawCanvasRef.current, videoRef.current, true);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") dispatch({ type: "UNDO" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={styles.root}>
      {/* Background grid */}
      <div style={styles.grid} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>✦</span>
          <span style={styles.logoText}>AirDraw</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.fpsBadge}>{fps} FPS</span>
          {!cameraReady && <span style={styles.loadingBadge}>Initializing camera…</span>}
        </div>
      </header>

      {/* Main layout */}
      <main style={styles.main}>
        {/* Sidebar toolbar */}
        <Toolbar
          color={color} setColor={setColor}
          brushSize={brushSize} setBrushSize={setBrushSize}
          onUndo={() => dispatch({ type: "UNDO" })}
          onClear={() => dispatch({ type: "CLEAR" })}
          onExport={handleExport}
          strokeCount={strokes.length}
          gesture={gesture}
        />

        {/* Canvas area */}
        <div style={styles.canvasWrapper}>
          {/* Webcam */}
          <video
            ref={videoRef}
            autoPlay playsInline muted
            onCanPlay={() => setCameraReady(true)}
            style={styles.video}
          />
          {/* Drawing canvas */}
          <canvas ref={drawCanvasRef} style={styles.drawCanvas} />
          {/* Overlay (cursor + skeleton) */}
          <canvas ref={overlayCanvasRef} style={styles.overlayCanvas} />

          {/* Gesture guide overlay */}
          <GestureGuide />

          {/* Flash label when gesture changes */}
          <GestureFlash gesture={gesture} />
        </div>
      </main>

      {/* Bottom text panel */}
      <div style={styles.bottom}>
        <TextDisplay
          recognizedText={recognizedText}
          onClearText={() => setRecognizedText("")}
        />
      </div>

      <style>{globalCSS}</style>
    </div>
  );
}

// ── Skeleton renderer ────────────────────────────────────────────────────────
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

function _drawSkeleton(ctx, lm, w, h) {
  ctx.save();
  
  // Calculate hand size for adaptive scaling
  const wrist = lm[0];
  const middleTip = lm[12];
  const handSize = Math.sqrt(
    Math.pow((1 - wrist.x) - (1 - middleTip.x), 2) * w * w +
    Math.pow(wrist.y - middleTip.y, 2) * h * h
  );
  
  // Adaptive scaling based on hand size and canvas size
  const scaleFactor = Math.min(handSize / 200, Math.min(w, h) / 1000);
  const lineWidth = Math.max(1, Math.min(3, 1.5 * scaleFactor));
  const pointRadius = Math.max(1.5, Math.min(4, 2.5 * scaleFactor));
  
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#00f5ff";
  ctx.lineWidth = lineWidth;
  
  // Draw connections
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo((1 - lm[a].x) * w, lm[a].y * h);
    ctx.lineTo((1 - lm[b].x) * w, lm[b].y * h);
    ctx.stroke();
  }
  
  // Draw points with adaptive sizing
  ctx.fillStyle = "#fff";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc((1 - p.x) * w, p.y * h, pointRadius, 0, Math.PI * 2);
    ctx.globalAlpha = 0.5;
    ctx.fill();
  }
  
  ctx.restore();
}

// ── Gesture flash label ───────────────────────────────────────────────────────
function GestureFlash({ gesture }) {
  const labels = {
    OPEN_PALM: "🖐 CLEAR",
    TWO_FINGERS: "✌️ ERASE",
    FIST: "✊ STOP",
    INDEX_UP: "☝️ DRAW",
    PINCH: "🤏 DRAG",
  };
  const label = labels[gesture];
  if (!label) return null;
  return (
    <div key={gesture} style={styles.flash}>
      {label}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "#06060f",
    color: "#fff",
    fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    background: "rgba(6,6,15,0.8)",
    backdropFilter: "blur(20px)",
    position: "relative",
    zIndex: 10,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoIcon: {
    fontSize: "20px",
    color: "#00f5ff",
    filter: "drop-shadow(0 0 8px #00f5ff)",
  },
  logoText: {
    fontSize: "22px",
    fontWeight: "900",
    letterSpacing: "0.08em",
    background: "linear-gradient(135deg, #00f5ff, #ff00e5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textTransform: "uppercase",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  fpsBadge: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#39ff14",
    background: "rgba(57,255,20,0.1)",
    border: "1px solid rgba(57,255,20,0.2)",
    borderRadius: "6px",
    padding: "4px 10px",
    letterSpacing: "0.05em",
  },
  loadingBadge: {
    fontSize: "11px",
    color: "#ffdd00",
    animation: "blink 1s ease-in-out infinite",
  },
  main: {
    display: "flex",
    gap: "16px",
    padding: "16px",
    flex: 1,
    position: "relative",
    zIndex: 1,
  },
  canvasWrapper: {
    flex: 1,
    position: "relative",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(0,245,255,0.1)",
    boxShadow: "0 0 40px rgba(0,245,255,0.05), inset 0 0 80px rgba(0,0,0,0.5)",
    background: "rgba(0,0,0,0.4)",
    minHeight: "480px",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    transform: "scaleX(-1)",
    display: "block",
    opacity: 0.35,
  },
  drawCanvas: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  overlayCanvas: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 20,
  },
  flash: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: "42px",
    fontWeight: "900",
    letterSpacing: "0.15em",
    color: "#fff",
    textShadow: "0 0 40px rgba(0,245,255,1), 0 0 10px rgba(255,255,255,0.5)",
    pointerEvents: "none",
    animation: "flashIn 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
    zIndex: 30,
    whiteSpace: "nowrap",
  },
  bottom: {
    padding: "0 16px 16px",
    position: "relative",
    zIndex: 5,
  },
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #06060f; overflow: hidden; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.7); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes flashIn {
    0%   { opacity: 0; transform: translate(-50%, -30%) scale(0.6); filter: blur(10px); }
    15%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); filter: blur(0px); }
    30%  { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0px); }
    80%  { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0px); }
    100% { opacity: 0; transform: translate(-50%, -70%) scale(0.85); filter: blur(8px); }
  }

  input[type=range] {
    -webkit-appearance: none;
    height: 4px;
    border-radius: 4px;
    background: rgba(255,255,255,0.1);
    outline: none;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #00f5ff;
    cursor: pointer;
    box-shadow: 0 0 8px #00f5ff;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,245,255,0.2); border-radius: 4px; }
`;
