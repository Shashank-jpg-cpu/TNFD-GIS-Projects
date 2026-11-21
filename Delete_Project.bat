@echo off
title Delete Project
color 0c
cd /d "%~dp0"

echo =====================================================================
echo           GIS & Web Projects Hub - Delete Project
echo =====================================================================
echo.

set "PROJECTNAME=%~1"

if "%PROJECTNAME%"=="" (
    echo Available projects in projects folder:
    dir /b /ad projects
    echo.
    set /p "PROJECTNAME=Enter folder name of project to delete: "
)

set PROJECTNAME=%PROJECTNAME:"=%

if "%PROJECTNAME%"=="" (
    echo [ERROR] No project name specified.
    pause
    exit /b 1
)

if not exist "projects\%PROJECTNAME%" (
    echo [ERROR] Project folder not found: "projects\%PROJECTNAME%"
    pause
    exit /b 1
)

echo.
echo [WARNING] About to permanently delete folder: "projects\%PROJECTNAME%"
set /p "CONFIRM=Are you sure you want to delete this project? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Cancelled.
    exit /b 0
)

echo Deleting "projects\%PROJECTNAME%" ...
rmdir /s /q "projects\%PROJECTNAME%"

echo.
echo [+] Re-scanning projects catalog...
call Scan_Projects.bat

echo.
echo [SUCCESS] Project '%PROJECTNAME%' has been deleted from disk and catalog updated!
pause
