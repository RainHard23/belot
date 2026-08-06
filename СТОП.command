#!/bin/bash
cd "$(dirname "$0")"

echo "Останавливаю Belote…"

# Убиваем процессы на портах игры
for port in 3001 5173; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null
  fi
done

echo "Готово."
sleep 1
