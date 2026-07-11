# Clash — Version autonome Raspberry Pi

Le Raspberry Pi, au démarrage :

1. crée son propre réseau **WiFi** ;
2. lance le **serveur Node** (état autoritatif + WebSocket) ;
3. affiche la vue **spectacle** (`/show`) en plein écran sur la sortie **HDMI** ;
4. lance le **contrôleur LCD** (HAT Waveshare 1.3").

L'admin reste accessible depuis un téléphone/tablette connecté au WiFi du Pi :
`http://192.168.4.1:3000/regie`

## Architecture

Tous les contrôleurs (LCD, Régie web, Show) parlent au serveur Node via WebSocket.
Le serveur détient l'état et le séquenceur du show ; il diffuse chaque changement à
tous les clients. Voir `server/showStore.js`.

```
Chromium kiosk (/show, HDMI) ─┐
Contrôleur LCD Python ────────┼─ WS ─> serveur Node (Express + ws, :3000)
Régie WiFi (téléphone) ───────┘        état + state machine + broadcast
```

## Matériel — HAT Waveshare 1.3" LCD

- Écran ST7789 240×240 (SPI0).
- Joystick 5 directions + 3 boutons (KEY1/2/3).
- Brochage BCM utilisé (voir `pi/lcd/hardware.py`, à confirmer selon la révision) :

| Fonction | GPIO |
|---|---|
| LCD DC | 25 |
| LCD RST | 27 |
| LCD BL (rétroéclairage) | 24 |
| LCD CS | 8 (CE0) |
| Joystick UP / DOWN / LEFT / RIGHT / PRESS | 6 / 19 / 5 / 26 / 13 |
| KEY1 / KEY2 / KEY3 | 21 / 20 / 16 |

## Installation

```bash
git clone <repo> /home/pi/Clash2
cd /home/pi/Clash2
bash pi/install.sh
sudo -E bash pi/setup-ap.sh   # crée le WiFi (coupe le WiFi client !)
sudo reboot
```

`install.sh` : paquets système, activation SPI, `git lfs pull`, build React, venv
Python du LCD, copie + activation des services systemd.

## Utilisation du contrôleur LCD

**Menu Options** (spectacle arrêté) :
- *Lancer le spectacle* — démarre (bascule auto sur le menu Spectacle).
- *Comédiens* — édite les noms (UP/DOWN change le caractère, LEFT/RIGHT déplace le curseur, KEY1 valide).
- *Catégories* — choisit la catégorie de chaque étape ; KEY1/PRESS sur « Ajouter » crée une étape.
- *Scores* — UP/DOWN sélectionne un comédien, LEFT/RIGHT = −10 / +10.
- *Réseau* — affiche l'URL de la Régie WiFi et l'état de la connexion serveur.

**Menu Spectacle** (en cours) :
- Grand **timer** + nom de l'étape.
- **KEY1 = NEXT** (étape suivante).
- **KEY3 = STOP**.
- Contextuel selon la phase :
  - catégorie **Hot fires** → **KEY2 = PLAY/STOP LOVE** ;
  - phase **Roue** → UP/DOWN choisit un comédien, LEFT/RIGHT = −10 / +10 ;
  - autres → KEY2 déclenche la Roue.

Le menu bascule automatiquement Options ↔ Spectacle selon que le show est lancé,
qu'il soit démarré depuis le LCD ou depuis la Régie WiFi.

## Développement / test sans matériel

Le contrôleur LCD tourne en mode **mock** (rend les frames en PNG au lieu du HAT) :

```bash
cd pi/lcd
python3 -m venv venv && venv/bin/pip install Pillow websocket-client
CLASH_LCD_MOCK=1 CLASH_LCD_FRAME=/tmp/lcd.png venv/bin/python main.py
# w/s/a/d = joystick, espace = press, 1/2/3 = KEY1/2/3, q = quitter
```

Côté serveur : `NODE_OPTIONS=--openssl-legacy-provider npm run server` puis ouvrir
`/show` et `/regie` dans deux navigateurs (même sur deux machines : la synchro passe
par le serveur).

## Performances (Raspberry Pi 3)

- **Effet de postérisation webcam** (`src/pages/Show.js`) : traitement per-pixel en JS
  à la résolution native — trop lourd sur Pi3. Pistes : traiter le canvas en basse
  résolution (ex. 160×120 puis upscale CSS), réécrire l'effet en WebGL, ou le rendre
  désactivable. À trancher selon le modèle retenu.
- **Vidéos** : ré-encoder en H.264 720p (voire 540p) débit modéré pour le décodage
  matériel de Chromium :

  ```bash
  for f in public/movies/*.mp4; do
    ffmpeg -i "$f" -vf scale=-2:720 -c:v libx264 -preset veryfast -crf 23 \
      -c:a aac -b:a 128k "out/$(basename "$f")"
  done
  ```

## Dépannage

- `journalctl -u clash-server -f` / `-u clash-lcd -f` / `-u clash-kiosk -f`.
- LCD noir : vérifier SPI activé (`ls /dev/spidev*`), brochage, `st7789`/`gpiozero` installés.
- Kiosk ne démarre pas : vérifier `cage` installé et le binaire Chromium (`chromium-browser`).
- Régie inaccessible : vérifier le point d'accès (`nmcli connection show clash-ap`).
- Vidéos manquantes : `git lfs pull` ou copier `public/movies` et `public/music`.
