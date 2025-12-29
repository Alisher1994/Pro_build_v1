@echo off
chcp 65001 >nul
SETLOCAL EnableDelayedExpansion
title ProBIM Unified Starter

echo ===================================================
echo 🔥 ProBIM: Unified Project Starter
echo ===================================================
echo.

:: 1. Check if Ollama is running
echo [1/4] Checking Ollama Status...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama is NOT running locally.
    echo Trying to start Ollama Desktop...
    start "" "ollama"
    echo Waiting for Ollama to initialize (5s)...
    timeout /t 5 /nobreak >nul
) else (
    echo [+] Ollama is running.
)
echo.

:: 2. Cleanup old processes
echo [2/4] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Finishing old backend (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Finishing old frontend (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
echo.

:: 3. Launch Backend
echo [3/4] Starting Backend (Port 3001)...
start "ProBIM Backend" cmd /k "cd backend && npx prisma generate && npm run dev"

:: 4. Launch Frontend
echo [4/4] Starting Frontend (Port 8000)...
start "ProBIM Frontend" cmd /k "cd frontend && python -m http.server 8000"

echo.
echo ===================================================
echo ✅ PROJECT STARTED
echo ===================================================
echo Frontend: http://localhost:8000
echo Backend:  http://localhost:3001
echo.
pause
