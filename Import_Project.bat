@echo off
title Import Project Zip
color 0a
cd /d "%~dp0"

echo =====================================================================
echo           GIS and Web Projects Hub - Import Project (.zip)
echo =====================================================================
echo.

set "ZIPFILE=%~1"

if "%ZIPFILE%"=="" (
    echo Drag and drop a .zip file onto this script, or enter the full path:
    set /p "ZIPFILE=Enter path to .zip file: "
)

set ZIPFILE=%ZIPFILE:"=%

if "%ZIPFILE%"=="" (
    echo [ERROR] No file provided. Exiting.
    pause
    exit /b 1
)

if not exist "%ZIPFILE%" (
    echo [ERROR] File not found: "%ZIPFILE%"
    pause
    exit /b 1
)

for %%F in ("%ZIPFILE%") do (
    set "PROJECTNAME=%%~nF"
)

echo.
echo [+] Archive:   %ZIPFILE%
echo [+] Project:   %PROJECTNAME%
echo [+] Extracting into projects\%PROJECTNAME% ...
echo.

if not exist "projects" mkdir "projects"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$dest = Join-Path (Get-Location) ('projects\' + '%PROJECTNAME%'); Expand-Archive -LiteralPath '%ZIPFILE%' -DestinationPath $dest -Force; $subdirs = Get-ChildItem -Path $dest -Directory; $files = Get-ChildItem -Path $dest -File; if ($subdirs.Count -eq 1 -and $files.Count -eq 0) { $nested = $subdirs[0].FullName; Get-ChildItem -Path $nested | Move-Item -Destination $dest -Force; Remove-Item -Path $nested -Recurse -Force -ErrorAction SilentlyContinue }; Write-Host '  Extraction complete!' -ForegroundColor Green"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to extract archive.
    pause
    exit /b 1
)

echo.
echo [+] Re-scanning projects directory...
call Scan_Projects.bat

echo.
echo =====================================================================
echo [SUCCESS] Project '%PROJECTNAME%' has been imported!
echo Opening Central Portal...
echo =====================================================================
start index.html