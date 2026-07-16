@echo off
REM Release-dev build — minifies Dev\src into Dev\BBGLRelease.js (DevBranch header, for pre-merge testing)
powershell -ExecutionPolicy Bypass -File "%~dp0..\..\..\..\Build Tools\BBGL\release-build.ps1"
if errorlevel 1 ( echo. & echo *** BUILD FAILED *** ) else ( echo. & echo Release OK. )
echo.
echo Press any key to close...
pause >nul
