@echo off
chcp 65001 >nul
title Belote — остановка
cd /d "%~dp0"

echo Останавливаю Belote...
taskkill /FI "WINDOWTITLE eq Belote Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Belote Client*" /T /F >nul 2>&1

REM На случай, если процессы остались без окна
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo Готово. Окна сервера и клиента закрыты.
timeout /t 2 >nul
