@echo off
chcp 65001 >nul
title Belote - stop
cd /d "%~dp0"

echo Stopping Belote...
taskkill /FI "WINDOWTITLE eq Belote Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Belote Client*" /T /F >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo Done. Server and client stopped.
timeout /t 2 >nul
