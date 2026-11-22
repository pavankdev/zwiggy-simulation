@echo off
echo ========================================================
echo  Zwiggy Delivery System - Automated GitHub Push Script
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Initializing Git repository...
git init
if %errorlevel% neq 0 (
    echo Git is not installed or not in PATH. Please install Git: https://git-scm.com/
    pause
    exit /b
)

echo [2/4] Staging all files...
git add .

echo [3/4] Creating initial commit...
git commit -m "Deploy Zwiggy Food Delivery Simulation"

echo.
echo [4/4] Linking to GitHub:
echo Please paste your GitHub Repository URL (e.g. https://github.com/yourname/zwiggy.git):
set /p REPO_URL="URL: "

if "%REPO_URL%"=="" (
    echo No URL entered. Aborting.
    pause
    exit /b
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo  SUCCESS! Code pushed to GitHub!
echo  Now open https://dashboard.render.com or https://railway.app
echo  and select your repo to deploy with 1 click.
echo ========================================================
pause
