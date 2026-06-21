#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Running backend test suite..."
(cd "$ROOT_DIR/apps/backend" && npm run test:all)

echo "Running frontend test suite..."
(cd "$ROOT_DIR/apps/frontend" && npm run test:all)

echo "All tests completed successfully."