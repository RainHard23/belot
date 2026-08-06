@echo off
setlocal
title Belote - start
cd /d "%~dp0"

set "LOG=%~dp0server-start.log"
set "HEALTH_URL=http://localhost:3001/health"

echo ========================================
echo   Belote - one-click start
echo ========================================
echo.
echo Need once:
echo   1. Node.js LTS     https://nodejs.org
echo   2. Docker Desktop  https://www.docker.com/products/docker-desktop/
echo      Docker must be RUNNING before you continue.
echo.
echo Log: %LOG%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install LTS from https://nodejs.org then run START.bat again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker not found.
  echo Without Docker the database cannot start, so the server fails.
  echo Install Docker Desktop, start it, then run START.bat again.
  start "" "https://www.docker.com/products/docker-desktop/"
  pause
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker is installed but NOT running.
  echo Open Docker Desktop, wait for it to finish starting, run START.bat again.
  pause
  exit /b 1
)
echo [OK] Docker

echo.
echo Freeing ports 3001 / 5173 if busy...
call :kill_port 3001
call :kill_port 5173

echo.
echo Starting Postgres...
docker compose up -d postgres >"%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] Could not start Postgres. Log:
  type "%LOG%"
  pause
  exit /b 1
)

echo Waiting for database...
set /a TRIES=0
:wait_pg
set /a TRIES+=1
docker compose exec -T postgres pg_isready -U belote -d belote >nul 2>&1
if not errorlevel 1 goto pg_ok
if %TRIES% GEQ 40 (
  echo [ERROR] Postgres did not become ready in about 2 minutes.
  echo Try: docker compose logs postgres
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul
goto wait_pg
:pg_ok
echo [OK] Postgres ready

if not exist "server\.env" (
  if exist ".env.example" (
    echo Copying server\.env from .env.example ...
    copy /Y ".env.example" "server\.env" >nul
  ) else (
    echo [ERROR] Missing server\.env and .env.example
    pause
    exit /b 1
  )
)

set "NEED_CLIENT=0"
set "NEED_SERVER=0"
if not exist "node_modules\vite\" set "NEED_CLIENT=1"
if not exist "server\node_modules\@prisma\client\" set "NEED_SERVER=1"
if not exist "server\node_modules\bcryptjs\" set "NEED_SERVER=1"

if "%NEED_CLIENT%"=="1" (
  echo.
  echo Installing client deps... this may take a few minutes
  call npm install >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Client npm install failed. See log:
    type "%LOG%"
    pause
    exit /b 1
  )
)

if "%NEED_SERVER%"=="1" (
  echo.
  echo Installing server deps... this may take a few minutes
  pushd server
  call npm install >>"%LOG%" 2>&1
  if errorlevel 1 (
    popd
    echo [ERROR] Server npm install failed. See log:
    type "%LOG%"
    pause
    exit /b 1
  )
  popd
)

echo.
echo Preparing database ^(migrate + admin/admin^)...
pushd server
call npx prisma generate >>"%LOG%" 2>&1
if errorlevel 1 goto db_fail
call npx prisma migrate deploy >>"%LOG%" 2>&1
if errorlevel 1 goto db_fail
call npm run prisma:seed >>"%LOG%" 2>&1
if errorlevel 1 goto db_fail
popd
echo [OK] Login: admin / admin
goto db_done

:db_fail
popd
echo [ERROR] Database setup failed. See log:
type "%LOG%"
pause
exit /b 1

:db_done
echo.
echo Starting server...
start "Belote Server" /D "%~dp0server" cmd /k "npm run dev"

echo Waiting for server %HEALTH_URL% ...
set /a TRIES=0
:wait_srv
set /a TRIES+=1
curl.exe -fsS "%HEALTH_URL%" >nul 2>&1
if not errorlevel 1 goto srv_ok
if %TRIES% GEQ 45 (
  echo.
  echo [ERROR] Server did not start.
  echo Open the "Belote Server" window - the real error is there.
  echo Also see: %LOG%
  echo.
  echo Common causes:
  echo   1. Docker was not running
  echo   2. Port 3001 already in use
  echo   3. Broken install - delete node_modules and server\node_modules, retry
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_srv

:srv_ok
echo [OK] Server is up

echo Starting client...
start "Belote Client" /D "%~dp0" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Ready!
echo   URL:    http://localhost:5173
echo   Login:  admin / admin
echo   Bot:    button Play with bot in lobby
echo.
echo Stop with STOP.bat
echo You can close this window - the game keeps running.
pause
exit /b 0

:kill_port
set "PORT=%~1"
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo   killing PID %%a on port %PORT%
  taskkill /PID %%a /F >nul 2>&1
)
exit /b 0
