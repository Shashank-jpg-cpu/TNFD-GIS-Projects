@echo off
if exist "C:\Python314\pythonw.exe" (
    @"C:\Python314\pythonw.exe" "%~dp0open_earth.py" %*
) else (
    @pythonw "%~dp0open_earth.py" %*
)