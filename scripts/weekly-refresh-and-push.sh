#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm run refresh
npm run snapshot:ig
npm run build

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git add data/cache/brand-assets.json data/history-manifest.json public/instagram-grid-snapshots public/history public/coco-loco package.json package-lock.json src index.html README.md scripts vercel.json .gitignore
    git commit -m "chore: refresh weekly radar snapshots" || true
    if git remote get-url origin >/dev/null 2>&1; then
      git push origin HEAD
    else
      echo "No git remote named origin configured; skipping push."
    fi
  else
    echo "No dashboard changes to commit."
  fi
else
  echo "Not inside a git repo; skipping commit/push."
fi
