@echo off
chcp 65001 >nul
title Belote — запуск
cd /d "%~dp0"

echo ========================================
echo   Belote — запуск в один клик
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [!] Node.js не найден.
  echo.
  echo Нужно один раз установить Node.js ^(LTS^):
  echo   https://nodejs.org
  echo.
  echo После установки закройте это окно и снова
  echo дважды кликните по ЗАПУСК.bat
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%
echo.

if not exist "node_modules\" (
  echo Устанавливаю зависимости клиента... это может занять пару минут
  call npm install
  if errorlevel 1 (
    echo [!] Ошибка установки клиента.
    pause
    exit /b 1
  )
  echo.
)

if not exist "server\node_modules\" (
  echo Устанавливаю зависимости сервера...
  pushd server
  call npm install
  if errorlevel 1 (
    popd
    echo [!] Ошибка установки сервера.
    pause
    exit /b 1
  )
  popd
  echo.
)

echo Запускаю сервер и клиент...
echo Не закрывайте окна «Belote Server» и «Belote Client».
echo Чтобы остановить игру — закройте оба этих окна.
echo.

start "Belote Server" /D "%~dp0server" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
start "Belote Client" /D "%~dp0" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Готово! Браузер должен открыться сам.
echo Адрес: http://localhost:5173
echo.
echo Это окно можно закрыть — игра продолжит работать.
pause
