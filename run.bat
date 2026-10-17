@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node 22.10+ and retry. & exit /b 1)
where npm >nul 2>nul || (echo npm was not found. Install Node with npm and retry. & exit /b 1)
if not defined PYTHON set "PYTHON=python"
"%PYTHON%" --version >nul 2>nul || (echo Install Python 3.11+ or set PYTHON to its executable. & exit /b 1)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
echo Starting HAL Desk. Default URL: http://localhost:3000. Configure .env from .env.example first.
call npm run dev
exit /b %errorlevel%

