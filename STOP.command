#!/bin/bash
cd "$(dirname "$0")"
echo "Stopping Belote…"
pkill -f "tsx watch src/main.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
# free ports if still held
for port in 3001 5173; do
  pid=$(lsof -ti tcp:$port 2>/dev/null) || true
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null || true
  fi
done
echo "Done."
