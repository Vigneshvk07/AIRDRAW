#!/bin/bash
# start.sh — launches both backend and frontend in split terminals

echo "╔═══════════════════════════════════╗"
echo "║      ✦  AirDraw Launcher  ✦       ║"
echo "╚═══════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 not found. Install from https://python.org"
    exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
echo "▶ Starting backend..."
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
    echo "  Creating Python virtual env..."
    python3 -m venv venv
fi
source venv/bin/activate 2>/dev/null || venv\Scripts\activate 2>/dev/null
pip install -r requirements.txt -q
python main.py &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID — http://localhost:8000"

sleep 2

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "▶ Starting frontend..."
cd "$ROOT_DIR/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID — http://localhost:5173"

echo ""
echo "✅ AirDraw is running!"
echo "   Open http://localhost:5173 in Chrome"
echo "   Press Ctrl+C to stop both servers"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" SIGINT SIGTERM
wait
