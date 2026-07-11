#!/usr/bin/env bash
# Crée le point d'accès WiFi du Raspberry Pi (Raspberry Pi OS Bookworm, NetworkManager).
# Les clients (téléphone/tablette) s'y connectent puis ouvrent http://192.168.4.1:3000/regie
#
# ATTENTION : couper le WiFi client actif rompra une éventuelle connexion SSH WiFi.
# À exécuter de préférence via Ethernet ou console série.

set -e

SSID="${CLASH_SSID:-CLASH}"
PSK="${CLASH_PSK:-clashclash}"        # 8 caractères minimum (WPA2)
IFACE="${CLASH_WIFI_IFACE:-wlan0}"
IP="${CLASH_AP_IP:-192.168.4.1/24}"
CON="clash-ap"

if ! command -v nmcli >/dev/null 2>&1; then
	echo "nmcli (NetworkManager) requis. Sur Bookworm il est présent par défaut." >&2
	exit 1
fi

echo "Création du point d'accès '$SSID' sur $IFACE (IP ${IP})…"

nmcli connection delete "$CON" >/dev/null 2>&1 || true

nmcli connection add type wifi ifname "$IFACE" con-name "$CON" autoconnect yes ssid "$SSID"
nmcli connection modify "$CON" \
	802-11-wireless.mode ap \
	802-11-wireless.band bg \
	ipv4.method shared \
	ipv4.addresses "$IP" \
	wifi-sec.key-mgmt wpa-psk \
	wifi-sec.psk "$PSK"

nmcli connection up "$CON"

echo "Point d'accès actif."
echo "  SSID : $SSID"
echo "  Mot de passe : $PSK"
echo "  Régie : http://${IP%/*}:3000/regie"
