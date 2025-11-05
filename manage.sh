#!/usr/bin/env bash
set -euo pipefail

# Ensure nvm is available in non-interactive shells
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

WORKDIR='/home/arbiter/Dropbox/!Umysql_PVM/LOINC'
NODE_VERSION='22.15.0'
LOGFILE='/tmp/loinc-server.log'
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"

cd "$WORKDIR"

start_bg() {
  nvm use "$NODE_VERSION" >/dev/null 2>&1
  nohup node loinc-search-server.js >"$LOGFILE" 2>&1 & disown
  echo "Started in background. Logs: $LOGFILE"
}

start_fg() {
  nvm use "$NODE_VERSION"
  node loinc-search-server.js
}

stop() {
  pkill -f loinc-search-server.js || true
  echo "Stopped."
}

status() {
  pgrep -af loinc-search-server.js || echo "Not running."
}

logs() {
  tail -n 200 -f "$LOGFILE"
}

restart() {
  stop
  sleep 1
  start_bg
}

case "${1:-}" in
  start) start_bg ;;
  start-fg) start_fg ;;
  stop) stop ;;
  restart) restart ;;
  status) status ;;
  logs) logs ;;
  *) echo "Usage: $0 {start|start-fg|stop|restart|status|logs}"; exit 1 ;;
esac
