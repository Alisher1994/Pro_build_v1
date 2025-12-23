@echo off
SETLOCAL EnableDelayedExpansion
title ProBIM Unified Starter (With Ollama Support)

echo ===================================================
echo 🔥 ProBIM: Unified Project Starter (AI + Full Stack)
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

:: 3. Launch Backend (Dev Mode with AI Support)
echo [3/4] Starting Backend (Port 3001)...
echo Includes: AI Services, mc.uz Scraper, API
start "ProBIM Backend [3001]" cmd /k "cd backend && echo === BACKEND LOGS === && npm run dev"

:: 4. Launch Frontend
echo [4/4] Starting Frontend (Port 8000)...
start "ProBIM Frontend [8000]" cmd /k "cd frontend && echo === FRONTEND LOGS === && python -m http.server 8000"

echo.
echo ===================================================
echo ✅ PROJECT STARTED SUCCESSFULLY!
echo ===================================================
echo 🌍 Frontend: http://localhost:8000
echo 📊 Backend API: http://localhost:3001/api
echo 🤖 AI Model (Norms): llama3.2:3b
echo 🤖 AI Model (Instructions): llama3.2:1b
echo 🔍 mc.uz Parsing: Active
echo ===================================================
echo.
echo You can close THIS window. Keep the others open.
echo If AI doesn't respond, check if models are pulled:
echo 'ollama pull llama3.2:1b' and 'ollama pull llama3.2:3b'
echo.
pause
