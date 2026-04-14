// canvasUtils.js — stroke management, neon glow rendering, export helpers

// ─── Stroke ──────────────────────────────────────────────────────────────────
export class Stroke {
  constructor({ color = "#00f5ff", size = 6, isErase = false } = {}) {
    this.id = Math.random().toString(36).slice(2);
    this.points = [];
    this.color = color;
    this.size = size;
    this.isErase = isErase;
    this.createdAt = Date.now();
  }
  addPoint(x, y) {
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      // Ignore micro-movements smaller than 3px to kill jitter (reduced from 8px)
      if (Math.hypot(last.x - x, last.y - y) < 3) return;
    }
    this.points.push({ x, y });
  }
  get length() {
    return this.points.length;
  }
}

// ─── Neon glow renderer ──────────────────────────────────────────────────────
export function renderStroke(ctx, stroke, scale = 1) {
  if (stroke.points.length < 2) return;

  const { points, color, size, isErase } = stroke;

  if (isErase) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = size * 3 * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    _drawPath(ctx, points);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Outer glow pass
  for (let i = 3; i >= 1; i--) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.lineWidth = (size + i * 4) * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.06 / i;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * i;
    _drawPath(ctx, points);
    ctx.stroke();
    ctx.restore();
  }

  // Core line
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.globalAlpha = 1;
  _drawPath(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function _drawPath(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  // Smooth Catmull-Rom spline via midpoint averaging
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  // End at the last point exactly
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
}

// ─── Full canvas render ──────────────────────────────────────────────────────
export function renderAllStrokes(ctx, strokes, width, height) {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
}

// ─── Fingertip cursor ────────────────────────────────────────────────────────
export function drawCursor(ctx, x, y, gesture, color, landmarks = null, canvasWidth = 0, canvasHeight = 0) {
  // Calculate adaptive cursor size based on finger length
  let radius = 8; // default
  if (landmarks && canvasWidth && canvasHeight) {
    const indexBase = landmarks[5]; // index finger base
    const indexTip = landmarks[8];  // index finger tip
    const fingerLength = Math.sqrt(
      Math.pow((1 - indexBase.x) - (1 - indexTip.x), 2) * canvasWidth * canvasWidth +
      Math.pow(indexBase.y - indexTip.y, 2) * canvasHeight * canvasHeight
    );
    // Scale cursor based on finger length (proportional scaling)
    const scaleFactor = Math.min(fingerLength / 100, 2.5); // Cap at 2.5x
    radius = gesture === "TWO_FINGERS" ? 18 * scaleFactor : 8 * scaleFactor;
    radius = Math.max(4, Math.min(25, radius)); // Bounds: 4-25px
  } else {
    radius = gesture === "TWO_FINGERS" ? 18 : 8;
  }
  
  const glowColor = gesture === "TWO_FINGERS" ? "#ff4444" :
                    gesture === "PINCH" ? "#ffdd00" : color;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  
  // Outer pulsating ring
  const time = Date.now() / 300;
  const pulse = Math.abs(Math.sin(time)) * 4;
  
  ctx.beginPath();
  ctx.arc(x, y, radius + 4 + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = Math.max(0.1, 0.5 - (pulse * 0.05));
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 15;
  ctx.stroke();

  // Inner dot
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 25;
  ctx.fill();
  ctx.restore();
}

// ParticleManager removed — particles added visual noise to drawing

// ─── Export as PNG ───────────────────────────────────────────────────────────
export function exportCanvas(drawCanvas, videoCanvas, withBackground = true) {
  const offscreen = document.createElement("canvas");
  offscreen.width = drawCanvas.width;
  offscreen.height = drawCanvas.height;
  const ctx = offscreen.getContext("2d");

  if (withBackground && videoCanvas) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-offscreen.width, 0);
    ctx.drawImage(videoCanvas, 0, 0);
    ctx.restore();
  } else {
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  }

  ctx.drawImage(drawCanvas, 0, 0);

  const link = document.createElement("a");
  link.download = `airdraw_${Date.now()}.png`;
  link.href = offscreen.toDataURL("image/png");
  link.click();
}

// ─── Color palette ───────────────────────────────────────────────────────────
export const PALETTE = [
  { name: "Cyan",    hex: "#00f5ff" },
  { name: "Magenta", hex: "#ff00e5" },
  { name: "Lime",    hex: "#39ff14" },
  { name: "Orange",  hex: "#ff6b00" },
  { name: "Gold",    hex: "#ffd700" },
  { name: "White",   hex: "#ffffff" },
  { name: "Purple",  hex: "#bf5fff" },
  { name: "Rose",    hex: "#ff2d78" },
];
