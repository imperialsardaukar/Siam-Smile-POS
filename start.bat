@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   SIAM SMILE POS - START (FRESH BUILD)
echo ==========================================

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js LTS then retry.
  pause
  exit /b 1
)

echo [1/4] Installing backend deps...
pushd backend
call npm install
if errorlevel 1 (
  echo Backend npm install failed.
  pause
  popd
  exit /b 1
)
popd

echo [2/4] Installing frontend deps...
pushd frontend
call npm install
if errorlevel 1 (
  echo Frontend npm install failed.
  pause
  popd
  exit /b 1
)
popd

echo [3/4] Starting backend (http://localhost:3001)...
start "SiamSmile Backend" cmd /k "cd /d %~dp0backend && npm start"

echo [4/4] Starting frontend (http://localhost:5173)...
start "SiamSmile Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Done. Open http://localhost:5173
