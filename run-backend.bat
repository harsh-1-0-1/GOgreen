@echo off
echo ========================================================
echo Starting Redis Server (Background)
echo ========================================================
start "" /B "C:\Users\Paras Trivedi\.gemini\antigravity\brain\b0831ef4-70a9-4d5a-af87-07431cd60799\scratch\redis\redis-server.exe"

echo ========================================================
echo Starting FastAPI Backend (http://127.0.0.1:8000)
echo ========================================================
cd backend
echo Ensuring environment variables are set for Windows...
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
uv run fastapi dev
