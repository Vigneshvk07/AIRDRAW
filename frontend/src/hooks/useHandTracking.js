// useHandTracking.js
// Wraps MediaPipe Hands for real-time gesture detection & fingertip tracking

import { useEffect, useRef, useCallback } from "react";

// ─── Landmark indices ────────────────────────────────────────────────────────
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const THUMB_TIP = 4;
const THUMB_IP = 3;
const WRIST = 0;

// ─── Geometry helpers ────────────────────────────────────────────────────────
const dist = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const isFingerUp = (lm, tip, pip) => lm[tip].y < lm[pip].y;

const detectGesture = (lm) => {
  const indexUp = isFingerUp(lm, INDEX_TIP, INDEX_PIP);
  const middleUp = isFingerUp(lm, MIDDLE_TIP, 10);
  const ringUp = isFingerUp(lm, RING_TIP, 14);
  const pinkyUp = isFingerUp(lm, PINKY_TIP, 18);
  const thumbOut = lm[THUMB_TIP].x < lm[THUMB_IP].x;
  const thumbUp = lm[THUMB_TIP].y < lm[THUMB_IP].y;

  // More precise gesture detection
  const pinchDist = dist(lm[THUMB_TIP], lm[INDEX_TIP]);
  
  // Specific gesture checks with clear conditions
  const isOpenPalm = indexUp && middleUp && ringUp && pinkyUp && thumbOut;
  const isIndexUp = indexUp && !middleUp && !ringUp && !pinkyUp; // Only index finger up
  const isTwoFingers = indexUp && middleUp && !ringUp && !pinkyUp; // Peace sign
  const isFist = !indexUp && !middleUp && !ringUp && !pinkyUp; // All fingers down
  const isPinch = pinchDist < 0.04; // Thumb close to index
  const isThumbsUp = !indexUp && !middleUp && !ringUp && !pinkyUp && thumbUp;
  const isRockSign = indexUp && !middleUp && !ringUp && pinkyUp;

  // Priority order: check most specific gestures first
  if (isOpenPalm) return "OPEN_PALM";
  if (isIndexUp && !isPinch) return "INDEX_UP"; // Only if not pinching
  if (isFist && !isPinch) return "FIST"; // Only if not pinching
  if (isPinch) return "PINCH";
  if (isTwoFingers) return "TWO_FINGERS";
  if (isThumbsUp) return "THUMBS_UP";
  if (isRockSign) return "ROCK_SIGN";
  return "UNKNOWN";
};

// ─── Double exponential smoothing (Holt's method) ───────────────────────────
// alpha: weight on new data (lower = smoother but more lag)
// beta:  weight on trend (velocity) update
class PointSmoother {
  constructor(alpha = 0.15, beta = 0.05) {
    this.alpha = alpha;  // Increased alpha for faster response
    this.beta  = beta;   // Reduced beta to reduce overshoot
    this.s  = null; // smoothed position
    this.t  = null; // smoothed trend (velocity)
  }
  smooth(x, y) {
    if (!this.s) {
      this.s = { x, y };
      this.t = { x: 0, y: 0 };
      return { x, y };
    }
    const prevS = this.s;
    const prevT = this.t;

    // Level update - more responsive to new data
    const sx = this.alpha * x + (1 - this.alpha) * (prevS.x + prevT.x);
    const sy = this.alpha * y + (1 - this.alpha) * (prevS.y + prevT.y);

    // Trend update - dampened to prevent overshoot
    const tx = this.beta * (sx - prevS.x) + (1 - this.beta) * prevT.x;
    const ty = this.beta * (sy - prevS.y) + (1 - this.beta) * prevT.y;
    
    // Apply damping to prevent overshoot when stopping
    const maxVelocity = 0.02;
    const dampedTx = Math.max(-maxVelocity, Math.min(maxVelocity, tx));
    const dampedTy = Math.max(-maxVelocity, Math.min(maxVelocity, ty));

    this.s = { x: sx, y: sy };
    this.t = { x: dampedTx, y: dampedTy };
    return { x: sx, y: sy };
  }
  reset() {
    this.s = null;
    this.t = null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useHandTracking({ videoRef, onGesture, onPoint, onLandmarks }) {
  const handsRef = useRef(null);
  const smootherRef = useRef(new PointSmoother(0.12, 0.08));
  const animRef = useRef(null);
  const lastGestureRef = useRef(null);
  const gestureBufferRef = useRef(0);
  const gestureHistoryRef = useRef([]);
  const confidenceRef = useRef(0);

  const handleResults = useCallback((results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (lastGestureRef.current !== "NONE") {
        lastGestureRef.current = "NONE";
        onGesture?.("NONE");
      }
      return;
    }

    const lm = results.multiHandLandmarks[0];
    let gesture = detectGesture(lm);

    // Simplified gesture detection for better responsiveness
    gestureHistoryRef.current.push(gesture);
    if (gestureHistoryRef.current.length > 4) { // Reduced history length
      gestureHistoryRef.current.shift();
    }
    
    // Calculate gesture confidence based on history
    const gestureCounts = {};
    gestureHistoryRef.current.forEach(g => {
      gestureCounts[g] = (gestureCounts[g] || 0) + 1;
    });
    
    const mostFrequent = Object.entries(gestureCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostFrequent) {
      confidenceRef.current = mostFrequent[1] / gestureHistoryRef.current.length;
      
      // Lowered confidence threshold for faster response
      if (confidenceRef.current >= 0.4) { // Reduced from 0.6
        gesture = mostFrequent[0];
      } else {
        // Keep last stable gesture instead of flickering
        gesture = lastGestureRef.current || "UNKNOWN";
      }
    }
    
    // Special handling for OPEN_PALM to prevent accidental clears
    if (gesture === "OPEN_PALM") {
      gestureBufferRef.current++;
      if (gestureBufferRef.current < 8 && lastGestureRef.current && lastGestureRef.current !== "OPEN_PALM") {
        gesture = lastGestureRef.current;
      }
    } else {
      gestureBufferRef.current = 0;
    }

    // Fingertip position (index finger tip), mirrored for selfie view
    const rawX = 1 - lm[INDEX_TIP].x;
    const rawY = lm[INDEX_TIP].y;
    const { x, y } = smootherRef.current.smooth(rawX, rawY);

    if (gesture !== lastGestureRef.current) {
      // Reset smoother when gesture changes to prevent position artifacts
      if ((lastGestureRef.current === "INDEX_UP" && gesture !== "INDEX_UP") ||
          (lastGestureRef.current === "TWO_FINGERS" && gesture !== "TWO_FINGERS") ||
          (lastGestureRef.current === "FIST" && gesture === "INDEX_UP")) {
        smootherRef.current.reset();
      }
      lastGestureRef.current = gesture;
      onGesture?.(gesture, { x, y });
    }

    onPoint?.({ x, y, raw: { x: rawX, y: rawY } });
    onLandmarks?.(lm, results);
  }, [onGesture, onPoint, onLandmarks]);

  useEffect(() => {
    let hands = null;
    let camera = null;
    let active = true;

    const init = async () => {
      const mpHands = await import("@mediapipe/hands");
      const mpCamera = await import("@mediapipe/camera_utils");
      const Hands = mpHands.Hands || mpHands.default?.Hands || window.Hands;
      const Camera = mpCamera.Camera || mpCamera.default?.Camera || window.Camera;

      if (!active) return;

      hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,  // Reduced for better performance at high resolution
        minDetectionConfidence: 0.7,  // Slightly reduced for faster detection
        minTrackingConfidence: 0.6,  // Slightly reduced for smoother tracking
      });

      hands.onResults(handleResults);
      handsRef.current = hands;

      if (videoRef.current) {
        // Try multiple resolutions in order of preference
        const resolutions = [
          { width: 1920, height: 1080 },
          { width: 1600, height: 900 },
          { width: 1280, height: 720 },
          { width: 1024, height: 768 }
        ];
        
        let cameraStarted = false;
        for (const res of resolutions) {
          try {
            camera = new Camera(videoRef.current, {
              onFrame: async () => {
                if (handsRef.current && videoRef.current) {
                  await handsRef.current.send({ image: videoRef.current });
                }
              },
              width: res.width,
              height: res.height,
            });
            await camera.start();
            console.log(`Camera started at ${res.width}x${res.height}`);
            cameraStarted = true;
            break;
          } catch (error) {
            console.warn(`Failed to start camera at ${res.width}x${res.height}:`, error);
            continue;
          }
        }
        
        if (!cameraStarted) {
          console.error('Could not start camera at any resolution');
        }
      }
    };

    init().catch(console.error);

    return () => {
      active = false;
      camera?.stop();
      hands?.close();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [handleResults, videoRef]);

  return { smoother: smootherRef.current };
}
