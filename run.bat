@echo off
rem HAL Dashboard - Windows launcher
cd /d "%~dp0"
where python >nul 2>nul || (echo Python not found. Install from python.org and retry. & pause & exit /b)
echo.
echo Starting HAL Dashboard... open http://localhost:8000 on this PC,
echo or http://YOUR-PC-IP:8000 on your phone (same Wi-Fi).
echo Press Ctrl+C to stop.
echo.
python server.py
pause
