@echo off
title Zwiggy - Food Delivery Simulation Server
cd /d "%~dp0"

echo =======================================================
echo    Zwiggy - Food Delivery Simulation Platform
echo =======================================================
echo.
echo [1/2] Launching server...

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org/ to run the simulation.
    echo.
    pause
    exit /b
)

:: Wait 1.5 seconds then open the default browser automatically
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

echo [2/2] Opening browser at http://localhost:3000 ...
echo.
echo =======================================================
echo   Server is LIVE and running!
echo   Website: http://localhost:3000
echo.
echo   * Keep this window open while using the simulation.
echo   * To stop the server, press Ctrl + C or close this window.
echo =======================================================
echo.

node server.js

pause
