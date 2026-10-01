@echo off
title MEW Al Dhaher - S!aP demo (dev server, port 3251)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node 20+ from https://nodejs.org and run again.
  pause
  exit /b 1
)

if not exist "node_modules\vite" (
  echo [INFO] First run: installing dependencies...
  call npm install --prefix "%~dp0"
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo  Desktop console : http://localhost:3251
echo  Driver app      : http://localhost:3251/mobile
echo  (press Ctrl+C to stop)
echo.
start "" "http://localhost:3251"
call npm run dev
pause
