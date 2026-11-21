@echo off
title RF & RL Dashboard Launcher
echo ========================================================
echo Tamil Nadu Forest Department - RF & RL Dashboard
echo Syncing latest data from Excel & KMLs folder...
echo ========================================================
python build_dashboard.py
echo.
echo Opening Dashboard in your default web browser...
start index.html
