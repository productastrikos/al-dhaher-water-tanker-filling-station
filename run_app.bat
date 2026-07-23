@echo off
title Launching AMO Conference 3D Digital Twin Platform
cls
echo =========================================================================
echo       AMO CONFERENCE CAMPUS - 3D DIGITAL TWIN & ASSET EDITOR
echo =========================================================================
echo.
echo Starting local web server to serve GLB assets and launch 3D application...
echo.

:: Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Python detected. Starting http.server on http://localhost:8000 ...
    start "" "http://localhost:8000"
    python -m http.server 8000
    goto END
)

:: Check if Node / npx is available
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Node/npx detected. Starting http-server on http://localhost:8000 ...
    start "" "http://localhost:8000"
    npx -y http-server -p 8000 -c-1
    goto END
)

echo [WARNING] Neither Python nor Node was found in PATH.
echo Attempting to open index.html directly in browser...
start "" "%~dp0index.html"

:END
echo.
pause
