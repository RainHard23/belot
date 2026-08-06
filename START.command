#!/bin/bash
cd "$(dirname "$0")"
clear
LOG="$(pwd)/server-start.log"
HEALTH="http://localhost:3001/health"

echo "========================================"
echo "  Belote - one-click start"
echo "========================================"
echo
echo "Need once:"
echo "  - Node.js LTS    https://nodejs.org"
echo "  - Docker Desktop https://www.docker.com/products/docker-desktop/"
echo "    (Docker must be RUNNING)"
echo
echo "Log file: $LOG"
echo

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  freeing port $port (pids $pids)"
    kill $pids 2>/dev/null || true
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js not found."
  open "https://nodejs.org/en/download" 2>/dev/null || true
  read -r
  exit 1
fi
echo "[OK] Node.js $(node -v)"

if ! command -v docker >/dev/null 2>&1; then
  echo "[!] Docker not found. Server cannot start without DB."
  open "https://www.docker.com/products/docker-desktop/" 2>/dev/null || true
  read -r
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "[!] Docker is installed but NOT running. Open Docker Desktop first."
  read -r
  exit 1
fi
echo "[OK] Docker"

echo
echo "Freeing ports 3001 / 5173 if busy..."
kill_port 3001
kill_port 5173

echo
echo "Starting Postgres…"
if ! docker compose up -d postgres >"$LOG" 2>&1; then
  echo "[!] Could not start Postgres. Log:"
  cat "$LOG"
  read -r
  exit 1
fi

echo "Waiting for database…"
tries=0
until docker compose exec -T postgres pg_isready -U belote -d belote >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 40 ]; then
    echo "[!] Postgres did not become ready."
    read -r
    exit 1
  fi
  sleep 3
done
echo "[OK] Postgres ready"

if [ ! -f "server/.env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example server/.env
  else
    echo "[!] Missing server/.env and .env.example"
    read -r
    exit 1
  fi
fi

NEED_CLIENT=0
NEED_SERVER=0
[ -d "node_modules/vite" ] || NEED_CLIENT=1
[ -d "server/node_modules/@prisma/client" ] && [ -d "server/node_modules/bcryptjs" ] || NEED_SERVER=1

if [ "$NEED_CLIENT" = 1 ]; then
  echo
  echo "Installing client deps…"
  npm install >>"$LOG" 2>&1 || { echo "[!] Client npm install failed."; cat "$LOG"; read -r; exit 1; }
fi

if [ "$NEED_SERVER" = 1 ]; then
  echo
  echo "Installing server deps…"
  (cd server && npm install >>"$LOG" 2>&1) || { echo "[!] Server npm install failed."; cat "$LOG"; read -r; exit 1; }
fi

echo
echo "Preparing DB (migrations + admin/admin)…"
(
  cd server
  npx prisma generate >>"$LOG" 2>&1 &&
  npx prisma migrate deploy >>"$LOG" 2>&1 &&
  npm run prisma:seed >>"$LOG" 2>&1
) || { echo "[!] DB setup failed. Log:"; cat "$LOG"; read -r; exit 1; }
echo "[OK] Login: admin / admin"

echo
echo "Starting server…"
npm run dev --prefix server >>"$LOG" 2>&1 &
SERVER_PID=$!

cleanup() {
  echo
  echo "Stopping…"
  kill "$SERVER_PID" 2>/dev/null
  pkill -P $$ 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

echo "Waiting for server health $HEALTH …"
tries=0
until curl -fsS "$HEALTH" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 40 ]; then
    echo
    echo "[!] Server did not start / Сервер не запустился."
    echo "Common causes: Docker not running, port 3001 busy, broken node_modules."
    echo "Log: $LOG"
    tail -n 40 "$LOG" || true
    read -r
    exit 1
  fi
  # also bail if process died
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[!] Server process exited. Log:"
    tail -n 40 "$LOG" || true
    read -r
    exit 1
  fi
  sleep 2
done
echo "[OK] Server is up"

echo "Starting client…"
npm run dev &
CLIENT_PID=$!
sleep 4
open "http://localhost:5173" 2>/dev/null || true

echo
echo "Ready!"
echo "  URL:    http://localhost:5173"
echo "  Login:  admin / admin"
echo "  Bot:    Play with bot in lobby"
echo
echo "Leave this window open. Ctrl+C or STOP.command to stop."
wait "$CLIENT_PID"
