#!/bin/sh
# HAL Dashboard - Mac/Linux launcher
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }
python3 -c "import qrcode" 2>/dev/null || pip3 install -q qrcode
echo "Starting HAL Dashboard... http://localhost:8000  (QR for phone: http://localhost:8000/qr)"
echo "Press Ctrl+C to stop."
exec python3 server.py
