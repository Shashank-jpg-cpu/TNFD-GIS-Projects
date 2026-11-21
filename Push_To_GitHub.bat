@echo off
title Push Full GIS Suite (14 Projects) to GitHub
cd /d "%~dp0"

echo ==========================================================
echo    Push TNFD GIS Portal (All 14 Projects) to GitHub
echo ==========================================================
echo.
git add .
git commit -m "Update TNFD GIS Portal - Complete Suite of 14 Applications"
echo.
echo Pushing to GitHub (https://github.com/Shashank-jpg-cpu/TNFD-GIS-Projects.git)...
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Entire GIS suite (all 14 projects) pushed to GitHub successfully!
) else (
    echo [NOTE] If repository does not exist yet on your GitHub:
    echo 1. Open your browser and go to: https://github.com/new
    echo 2. Set Repository name: TNFD-GIS-Projects
    echo 3. Choose Public or Private, and leave "Add a README" UNCHECKED
    echo 4. Click "Create repository"
    echo 5. Double-click this script again to push!
)
echo.
pause
