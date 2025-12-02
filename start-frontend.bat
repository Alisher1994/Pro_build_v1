@echo off
echo ========================================
echo ProBIM - Starting Application
echo ========================================
echo.
echo Starting Frontend on http://localhost:8000
echo.
cd frontend
start http://localhost:8000
python -m http.server 8000
