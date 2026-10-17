#!/bin/sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node 22.10+ and retry."; exit 1; }
command -v npm >/dev/null || { echo "npm was not found. Install Node with npm and retry."; exit 1; }
if [ ! -d node_modules ]; then
  npm ci
fi
echo "Starting HAL Desk (default http://localhost:3000). Configure .env from .env.example first."
exec npm run dev

