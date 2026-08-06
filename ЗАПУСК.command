#!/bin/bash
cd "$(dirname "$0")"
clear

echo "========================================"
echo "  Belote — запуск в один клик"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js не найден."
  echo
  echo "Нужно один раз установить Node.js (LTS):"
  echo "  https://nodejs.org"
  echo
  echo "Или через Homebrew: brew install node"
  echo
  echo "После установки снова дважды кликните ЗАПУСК.command"
  echo
  open "https://nodejs.org/en/download" 2>/dev/null || true
  echo "Нажмите Enter, чтобы закрыть…"
  read -r
  exit 1
fi

echo "[OK] Node.js $(node -v)"
echo

if [ ! -d "node_modules" ]; then
  echo "Устанавливаю зависимости клиента… это может занять пару минут"
  npm install || { echo "[!] Ошибка установки клиента."; read -r; exit 1; }
  echo
fi

if [ ! -d "server/node_modules" ]; then
  echo "Устанавливаю зависимости сервера…"
  (cd server && npm install) || { echo "[!] Ошибка установки сервера."; read -r; exit 1; }
  echo
fi

echo "Запускаю сервер и клиент…"
echo "Не закрывайте это окно, пока играете."
echo "Чтобы остановить — закройте окно или нажмите Ctrl+C."
echo

npm run dev --prefix server &
SERVER_PID=$!

cleanup() {
  echo
  echo "Останавливаю…"
  kill "$SERVER_PID" 2>/dev/null
  # дочерние процессы vite / tsx
  pkill -P $$ 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

sleep 2
npm run dev &
CLIENT_PID=$!

sleep 3
open "http://localhost:5173" 2>/dev/null || true

echo
echo "Готово! Браузер должен открыться сам."
echo "Адрес: http://localhost:5173"
echo
echo "Это окно оставьте открытым."
wait "$CLIENT_PID"
