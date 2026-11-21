@echo off
title IT Requirement Dashboard Launcher
echo =========================================================
echo   IT Requirement Dashboard Launcher
echo =========================================================
echo.
echo Syncing latest data from Excel spreadsheet...
python build_dashboard.py --fast
echo.
echo Opening IT Requirement Dashboard in web browser...
start "" "index.html"
exit