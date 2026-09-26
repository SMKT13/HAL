#!/bin/sh
# HAL Dashboard - Mac/Linux launcher
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }
echo "Starting HAL Dashboard... http://localhost:8000"
echo "Press Ctrl+C to stop."
exec python3 server.py
