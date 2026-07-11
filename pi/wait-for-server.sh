#!/usr/bin/env bash
# Attend que le serveur Node réponde avant de lancer le kiosk.
set -e
for _ in $(seq 1 60); do
	if curl -sf -o /dev/null "http://localhost:3000/"; then
		exit 0
	fi
	sleep 1
done
echo "Serveur Clash indisponible après 60s" >&2
exit 1
