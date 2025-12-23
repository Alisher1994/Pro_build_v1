@echo off
echo Starting ProBIM Project...
echo.

echo Starting Backend...
start "ProBIM Backend" cmd /k "cd backend && npm start"

echo Starting Frontend...
start "ProBIM Frontend" cmd /k "cd frontend && python -m http.server 8000"

echo.
echo Project started!
echo Frontend: http://localhost:8000
echo Backend: http://localhost:3001
