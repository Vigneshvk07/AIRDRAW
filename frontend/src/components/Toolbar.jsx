// Toolbar.jsx — color picker, brush size, undo, clear, export
import React from "react";
import { PALETTE } from "../utils/canvasUtils";

const BrushIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
    <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
  </svg>
);
const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export default function Toolbar({
  color, setColor,
  brushSize, setBrushSize,
  onUndo, onClear, onExport,
  strokeCount,
  gesture,
}) {
  const gestureLabel = {
    INDEX_UP: "✏️ Drawing",
    TWO_FINGERS: "🧹 Erasing",
    FIST: "✊ Paused",
    OPEN_PALM: "🖐 Clear",
    PINCH: "🤏 Pinch",
    NONE: "✋ No hand",
    UNKNOWN: "👋 Ready",
  }[gesture] || "👋 Ready";

  const gestureColor = {
    INDEX_UP: "#39ff14",
    TWO_FINGERS: "#ff4444",
    FIST: "#ffdd00",
    OPEN_PALM: "#ff00e5",
    PINCH: "#ffd700",
    NONE: "#555",
  }[gesture] || "#888";

  return (
    <div style={styles.toolbar}>
      {/* Gesture indicator */}
      <div style={{ ...styles.gestureTag, borderColor: gestureColor, color: gestureColor }}>
        <span style={{ ...styles.gestureDot, background: gestureColor }} />
        {gestureLabel}
      </div>

      {/* Color palette */}
      <div style={styles.section}>
        <span style={styles.label}>COLOR</span>
        <div style={styles.palette}>
          {PALETTE.map((c) => (
            <button
              key={c.hex}
              title={c.name}
              onClick={() => setColor(c.hex)}
              style={{
                ...styles.swatch,
                background: c.hex,
                boxShadow: color === c.hex
                  ? `0 0 0 2px #0a0a0f, 0 0 0 4px ${c.hex}, 0 0 12px ${c.hex}`
                  : "none",
                transform: color === c.hex ? "scale(1.25)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Brush size */}
      <div style={styles.section}>
        <span style={styles.label}>SIZE <span style={{ color }}>{brushSize}px</span></span>
        <input
          type="range" min="2" max="24" value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          style={styles.slider}
        />
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button
          onClick={onUndo}
          disabled={strokeCount === 0}
          style={{ ...styles.btn, opacity: strokeCount === 0 ? 0.3 : 1 }}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon /> Undo
        </button>
        <button onClick={onClear} style={{ ...styles.btn, ...styles.btnDanger }} title="Clear All">
          <TrashIcon /> Clear
        </button>
        <button onClick={onExport} style={{ ...styles.btn, ...styles.btnAccent }} title="Export PNG">
          <DownloadIcon /> Save
        </button>
      </div>

      {/* Stroke count */}
      <div style={styles.meta}>
        {strokeCount} stroke{strokeCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px 16px",
    background: "rgba(10,10,20,0.92)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "16px",
    width: "220px",
    flexShrink: 0,
  },
  gestureTag: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.05em",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid",
    transition: "all 0.3s ease",
  },
  gestureDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
    animation: "pulse 1.5s ease-in-out infinite",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.15em",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  },
  palette: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },
  swatch: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  slider: {
    width: "100%",
    accentColor: "#00f5ff",
    cursor: "pointer",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
  btnDanger: {
    borderColor: "rgba(255,68,68,0.3)",
    color: "#ff4444",
  },
  btnAccent: {
    borderColor: "rgba(0,245,255,0.3)",
    color: "#00f5ff",
    background: "rgba(0,245,255,0.08)",
  },
  meta: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
  },
};
