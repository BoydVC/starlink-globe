#!/usr/bin/env bash
cd "$(dirname "$0")"
mkdir -p screenshots
if node --experimental-websocket tests/shot.mjs; then
  ls -la screenshots/00-best-home.png | awk '{print $5, $9}'
  exit 0
fi
NAME=${1:-00-best-home}; W=${2:-1440}; H=${3:-960}
PORT=${STARLINK_GLOBE_PORT:-4277}
URL=${URL:-"http://127.0.0.1:$PORT/?still=1"}
D=/tmp/sg-chrome-$$
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=$W,$H --virtual-time-budget=${BUDGET:-8000} --user-data-dir=$D \
  --screenshot="screenshots/$NAME.png" "$URL" 2>/dev/null >/dev/null
rm -rf "$D"
ls -la "screenshots/$NAME.png" | awk '{print $5, $9}'
