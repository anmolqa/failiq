#!/usr/bin/env bash
# FailIQ — one-click local start (no Docker required)
# Usage: ./start.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting FailIQ..."

# ── Backend ──────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "❌  backend/.env not found."
  echo "    Copy backend/.env.example → backend/.env and add your GEMINI_API_KEY."
  exit 1
fi

if [ ! -d "$ROOT/.venv" ]; then
  echo "📦  Creating Python virtual environment..."
  python3 -m venv "$ROOT/.venv"
fi

source "$ROOT/.venv/bin/activate"

echo "📦  Installing Python dependencies..."
pip install -q -r "$ROOT/requirements.txt"

echo "🔧  Starting backend on http://127.0.0.1:8000 ..."
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/frontend/.env.local" ]; then
  echo "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000" > "$ROOT/frontend/.env.local"
fi

echo "📦  Installing frontend dependencies..."
cd "$ROOT/frontend" && npm install --silent

echo "🌐  Starting frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅  FailIQ is running!"
echo "   Frontend → http://localhost:3000"
echo "   Backend  → http://127.0.0.1:8000"
echo ""
echo "Press Ctrl+C to stop both services."

# Wait and clean up on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
