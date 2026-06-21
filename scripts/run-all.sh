#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend and frontend development servers..."

(
  cd "$ROOT_DIR/apps/backend"
  PORT=3001 npm run start:dev
) &
BACKEND_PID=$!

(
  cd "$ROOT_DIR/apps/frontend"
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 npm run dev
) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"