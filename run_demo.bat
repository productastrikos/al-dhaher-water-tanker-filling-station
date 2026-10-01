@echo off
title Launching MEW Al Dhaher Water SCADA Demo
cls
echo =========================================================================
echo       MEW AL DHAHER WATER TANKER FILLING STATION - SCADA DEMO
echo =========================================================================
echo.
echo Starting local web server to serve app assets and launch demo...
echo.

cd /d "%~dp0"

:: Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Python detected. Starting http.server on http://localhost:8081 ...
    start "" "http://localhost:8081"
    python -m http.server 8081
    goto END
)

:: Check if Node / npx is available
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Node/npx detected. Starting http-server on http://localhost:8081 ...
    start "" "http://localhost:8081"
    npx -y http-server -p 8081 -c-1
    goto END
)

echo [WARNING] Neither Python nor Node was found in PATH.
echo Attempting to open index.html directly in browser...
start "" "%~dp0index.html"

:END
echo.
pause
