#!/bin/bash
set -euo pipefail

cd "/Users/lukewilcoxson/Documents/Claude/Projects/Coco Loco/premium-fashion-inspo-dashboard"

# Keep the bookmarked local URL stable.
export HOST=127.0.0.1
export PORT=5173

exec /Users/lukewilcoxson/.hermes/node/bin/npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
