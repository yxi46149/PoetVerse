#!/bin/bash
# 一个容器跑两个进程：NestJS API + Nginx。
# 任一进程退出则整体退出，交给 docker restart 策略 / compose restart: unless-stopped 处理。
set -euo pipefail

cd /app/server

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8091}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[entrypoint] WARN: DATABASE_URL 未设置，/api/* 会返回 503（容器本身仍会起来）" >&2
fi

echo "[entrypoint] starting API on ${HOST}:${PORT}"
node dist/main.js &
API_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

echo "[entrypoint] api_pid=${API_PID} nginx_pid=${NGINX_PID}"

cleanup() {
  kill -TERM "$API_PID" "$NGINX_PID" 2>/dev/null || true
}
trap cleanup TERM INT QUIT

STATUS=0
wait -n "$API_PID" "$NGINX_PID" || STATUS=$?
echo "[entrypoint] child process exited (status=${STATUS}), shutting down" >&2

cleanup
wait 2>/dev/null || true
exit "$STATUS"
