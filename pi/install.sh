#!/usr/bin/env bash
# Installation autonome de Clash sur Raspberry Pi OS (Bookworm).
# Suppose le dépôt cloné dans /home/pi/Clash2 (adapter REPO sinon).
set -e

REPO="${CLASH_REPO:-/home/pi/Clash2}"
cd "$REPO"

echo "== 1/7 Paquets système =="
sudo apt-get update
sudo apt-get install -y \
	nodejs npm git git-lfs \
	chromium-browser cage \
	python3-venv python3-pip \
	fonts-dejavu curl

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

echo "== 6/7 Services systemd =="
sudo cp pi/systemd/clash-server.service /etc/systemd/system/
sudo cp pi/systemd/clash-kiosk.service /etc/systemd/system/
sudo cp pi/systemd/clash-lcd.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable clash-server.service clash-kiosk.service clash-lcd.service

echo "== 7/7 Point d'accès WiFi =="
echo "  Lancer manuellement (rompt le WiFi client !) : sudo -E bash pi/setup-ap.sh"

echo
echo "Installation terminée. Redémarrer : sudo reboot"
echo "Au boot : /show sur HDMI, LCD actif, Régie sur http://192.168.4.1:3000/regie"
