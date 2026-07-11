#!/usr/bin/env bash
# Installation autonome de Clash sur Raspberry Pi OS (Bookworm).
# Indépendant du nom d'utilisateur : le dépôt est supposé dans ~/Clash2.
set -e

REPO="${CLASH_REPO:-$HOME/Clash2}"
RUNUSER="$(id -un)"
RUNUID="$(id -u)"
cd "$REPO"

echo "== 1/7 Paquets système =="
sudo apt-get update
sudo apt-get install -y \
	nodejs npm git git-lfs \
	cage \
	python3-venv python3-pip \
	fonts-dejavu-core curl
# Chromium : nom du paquet variable selon la distribution (chromium / chromium-browser).
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser

echo "== 2/7 Activation SPI (écran ST7789) =="
sudo raspi-config nonint do_spi 0 || true

echo "== 3/7 Assets média =="
git lfs install || true
git lfs pull || echo "  (pas de LFS — les médias sont copiés à part, cf README-pi.md)"
# Normalise la casse des extensions (.MP4 -> .mp4) : requis sur ext4 sensible à la casse.
bash pi/normalize-media.sh public || true

echo "== 4/7 Build du front React =="
npm install
# react-scripts + Node >= 17 : provider OpenSSL legacy nécessaire au build.
NODE_OPTIONS=--openssl-legacy-provider CI=false npm run build

echo "== 5/7 Environnement Python du contrôleur LCD =="
python3 -m venv pi/lcd/venv
pi/lcd/venv/bin/pip install --upgrade pip
pi/lcd/venv/bin/pip install -r pi/lcd/requirements.txt

echo "== 6/7 Services systemd (adaptés à l'utilisateur $RUNUSER) =="
# Substitue user / chemin du dépôt / uid dans les templates (qui utilisent pi / /home/pi/Clash2 / 1000).
for svc in clash-server clash-kiosk clash-lcd; do
	sed -e "s#/home/pi/Clash2#$REPO#g" \
		-e "s#^User=pi#User=$RUNUSER#" \
		-e "s#/run/user/1000#/run/user/$RUNUID#g" \
		"pi/systemd/$svc.service" | sudo tee "/etc/systemd/system/$svc.service" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable clash-server.service clash-kiosk.service clash-lcd.service

echo "== 7/7 Point d'accès WiFi =="
echo "  Lancer manuellement (rompt le WiFi client !) : sudo -E bash pi/setup-ap.sh"

echo
echo "Installation terminée. Redémarrer : sudo reboot"
echo "Au boot : /show sur HDMI, LCD actif, Régie sur http://192.168.4.1:3000/regie"
