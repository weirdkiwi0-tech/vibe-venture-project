#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"

run_backend() {
  echo "[TDD] Backend: unit -> integration -> e2e"
  (cd "$ROOT_DIR/apps/backend" && npm run test:all)
}

run_frontend() {
  echo "[TDD] Frontend: unit -> integration -> e2e"
  (cd "$ROOT_DIR/apps/frontend" && npm run test:all)
}

case "$TARGET" in
  backend)
    run_backend
    ;;
  frontend)
    run_frontend
    ;;
  all)
    run_backend
    run_frontend
    ;;
  *)
    echo "Usage: bash scripts/tdd-cycle.sh [backend|frontend|all]"
    exit 1
    ;;
esac

echo "[TDD] Completed: $TARGET"
