#!/bin/sh
# Redeploy the jury server from this folder (run from app/): copy code, rebuild, migrate, restart.
# Server: Timeweb Cloud, Moscow, Ubuntu 24.04, SSH key only. Secrets live only in /opt/deanery/app/.env there.
set -e
HOST=root@5.129.242.179
C="docker compose -f compose.yaml -f compose.server.yaml"
rsync -az --delete --exclude node_modules --exclude .next --exclude '.env*' --exclude .vercel \
  --exclude vercel.json --exclude '*.tsbuildinfo' ./ $HOST:/opt/deanery/app/
ssh $HOST "cd /opt/deanery/app && cp deploy/compose.server.yaml deploy/Caddyfile . && $C build app && \
  $C run --rm --no-deps app node scripts/db-setup.mjs && $C up -d"
