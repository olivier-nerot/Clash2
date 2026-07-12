#!/usr/bin/env bash
# Lance Chromium en kiosk plein écran sur la vue /show.
# Exécuté par cage (voir clash-kiosk.service).
set -e

URL="http://localhost:3000/show"

# Nom du binaire Chromium selon la distribution.
if command -v chromium-browser >/dev/null 2>&1; then
	CHROME=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
	CHROME=chromium
else
	echo "Chromium introuvable" >&2
	exit 1
fi

exec "$CHROME" \
	${CLASH_KIOSK_DEBUG:+--remote-debugging-port=9222 --remote-allow-origins=*} \
	--kiosk \
	--start-fullscreen \
	--noerrdialogs \
	--disable-infobars \
	--disable-session-crashed-bubble \
	--no-first-run \
	--autoplay-policy=no-user-gesture-required \
	--use-fake-ui-for-media-stream \
	--check-for-update-interval=31536000 \
	--ozone-platform=wayland \
	"$URL"
