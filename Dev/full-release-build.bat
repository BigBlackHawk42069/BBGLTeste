@echo off
REM Full release build — minifies Dev\src into BigBlackGymLog.js with the main-branch header
powershell -ExecutionPolicy Bypass -File "%~dp0..\..\..\..\Build Tools\BBGL\full-release-build.ps1"
if errorlevel 1 ( echo. & echo *** BUILD FAILED *** ) else ( echo. & echo Release OK. )
echo.
echo Press any key to close...
pause >nul
