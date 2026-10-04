#!/bin/sh
# Runs the dev server at http://localhost:8765 (installs dependencies on first run).
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
exec npm run dev
