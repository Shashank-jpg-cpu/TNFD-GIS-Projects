@echo off
title TNFD GIS Projects Desktop Server
cd /d "%~dp0"
echo ========================================================
echo       Starting TNFD GIS Projects Desktop Portal...
echo ========================================================
node desktop_server.js
if %errorlevel% neq 0 (
    echo.
    echo Node.js not detected. Opening portal directly in Chrome...
    start "" "index.html"
)
pause
