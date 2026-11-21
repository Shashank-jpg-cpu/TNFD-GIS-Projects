@echo off
title Update IT Requirement Dashboard
echo =========================================================
echo   Syncing Latest Data: Google Sheet & Local Excel
echo =========================================================
echo.
echo Attempting to sync from live Google Sheet...
python sync_google_sheet.py
if %ERRORLEVEL% NEQ 0 (
    echo Sync from cloud skipped or offline. Re-building from local master Excel...
    python build_dashboard.py --fast
)
echo.
echo =========================================================
echo   Update completed! Opening dashboard...
echo =========================================================
start "" "index.html"
timeout /t 3 >nul
exit