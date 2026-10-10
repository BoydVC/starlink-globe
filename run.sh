#!/usr/bin/env bash
# Starlink Globe remaster: collect + serve on 127.0.0.1:4277
#   ./run.sh            collect + (re)start
#   ./run.sh --offline  skip collect, serve existing data/globe.json
#   ./run.sh --test     ... then smoke test
set -uo pipefail
cd "$(dirname "$0")"
PORT=${STARLINK_GLOBE_PORT:-4277}
export STARLINK_GLOBE_PORT=$PORT
export STARLINK_GLOBE_HOST=127.0.0.1
mkdir -p data dist screenshots
if [[ "${1:-}" != "--offline" ]]; then
  python3 collect.py || echo "(collect warning — keeping last globe.json)"
fi
if [[ -f data/server.pid ]] && kill -0 "$(cat data/server.pid)" 2>/dev/null; then
  kill "$(cat data/server.pid)" 2>/dev/null || true
  sleep 0.5
fi
# free stale listeners on this port
if command -v fuser >/dev/null 2>&1; then fuser -k "${PORT}/tcp" 2>/dev/null || true; fi
nohup python3 server.py > data/server.log 2>&1 &
echo $! > data/server.pid
ok=0
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then ok=1; break; fi
  sleep 0.15
done
if [[ $ok -eq 1 ]]; then
  echo "Starlink Globe up: http://127.0.0.1:$PORT/  (pid $(cat data/server.pid))"
else
  echo "WARN: server may not be ready — see data/server.log" >&2
  tail -20 data/server.log >&2 || true
fi
python3 export_snapshot.py || true
if [[ "${1:-}" == "--test" || "${2:-}" == "--test" ]]; then
  python3 tests/smoke_test.py
fi
