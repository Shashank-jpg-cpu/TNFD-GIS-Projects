@echo off
title Create Portal Update Bundle
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_update_bundle.ps1"
pause
