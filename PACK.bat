@echo off
chcp 65001 >nul
title Belote - pack for friend
cd /d "%~dp0"

echo Creating zip without node_modules / dist / .git ...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\pack-for-friend.ps1" %*
if errorlevel 1 (
  echo [!] Failed.
  pause
  exit /b 1
)

echo.
echo Send belote-for-friend.zip to your friend.
echo They: unpack - read HOW-TO-RUN.txt - double-click START.bat
echo Login: admin / admin
echo.
pause
