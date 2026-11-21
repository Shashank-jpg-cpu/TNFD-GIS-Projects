@echo off
title Update RF & RL Dashboard
echo ========================================================
echo Re-parsing Excel data, Syncing KMLs & Updating Dashboard...
echo ========================================================
python build_dashboard.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   Dashboard updated successfully!
    echo   Opening Dashboard in your web browser...
    echo ========================================================
    start index.html
) else (
    echo.
    echo Error updating dashboard. Please check Python installation.
    pause
)
