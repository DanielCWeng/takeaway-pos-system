#!/usr/bin/env bash
set -euo pipefail

# Start the takeaway POS development services from the repository root.
# On Linux/Raspberry Pi, TELEPHONY_PROVIDER=tapi is not supported; use none or
# asterisk_ami in server/.env when telephony hardware is configured.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

cleanup() {
  if ((${#PIDS[@]} > 0)); then
    echo
    echo "Stopping services..."
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi
}

require_dir() {
  local path="$1"
  local message="$2"

  if [[ ! -d "$path" ]]; then
    echo "$message"
    exit 1
  fi
}

start_service() {
  local name="$1"
  local dir="$2"
  shift 2

  echo "Starting $name..."
  (
    cd "$dir"
    "$@"
  ) &
  PIDS+=("$!")
}

detect_lan_ip() {
  local ip

  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -n "$ip" ]]; then
    echo "$ip"
    return
  fi

  ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
  if [[ -n "$ip" ]]; then
    echo "$ip"
    return
  fi

  echo "localhost"
}

trap cleanup EXIT INT TERM

require_dir "$ROOT/server/node_modules" "Server dependencies are missing. Run: cd server && npm install"
require_dir "$ROOT/client/node_modules" "Client dependencies are missing. Run: cd client && npm install"
require_dir "$ROOT/kitchen/node_modules" "Kitchen dependencies are missing. Run: cd kitchen && npm install"

if [[ ! -f "$ROOT/server/.env" ]]; then
  echo "server/.env is missing. Copy server/.env.example to server/.env and configure it."
  exit 1
fi

LAN_IP="${POS_HOST:-$(detect_lan_ip)}"
CLIENT_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
if [[ "$LAN_IP" != "localhost" ]]; then
  CLIENT_ORIGINS="$CLIENT_ORIGINS,http://$LAN_IP:5173"
fi

start_service "POS server" "$ROOT/server" env CORS_ORIGIN="$CLIENT_ORIGINS" npm start
start_service "POS client" "$ROOT/client" env VITE_API_URL="http://$LAN_IP:4000/api" VITE_WS_URL="ws://$LAN_IP:4000" npm run dev -- --host 0.0.0.0
start_service "kitchen display" "$ROOT/kitchen" npm run dev -- --host 0.0.0.0

echo
echo "Services started."
echo "POS client:      http://localhost:5173"
echo "Kitchen display: http://localhost:5174"
echo "Server API:      http://localhost:4000/api"
if [[ "$LAN_IP" != "localhost" ]]; then
  echo
  echo "LAN URLs:"
  echo "POS client:      http://$LAN_IP:5173"
  echo "Kitchen display: http://$LAN_IP:5174"
  echo "Server API:      http://$LAN_IP:4000/api"
fi
echo
echo "From another device on the same network, replace localhost with this Raspberry Pi's IP address."
echo "Press Ctrl+C to stop all services."

wait -n "${PIDS[@]}"
