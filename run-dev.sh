#!/usr/bin/env bash
cd /home/z/my-project
while true; do
  ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1
  echo "[supervisor] next exited, restarting in 2s" >> dev.log
  sleep 2
done
