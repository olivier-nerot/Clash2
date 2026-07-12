# Design — App Show native (Raspberry Pi)

Date : 2026-07-12
Statut : validé (design), à décliner en plan d'implémentation.

## Contexte

La vue spectacle (`/show`) tourne aujourd'hui dans Chromium (kiosk `cage`) sur le Pi.
Sur Raspberry Pi 3, Chromium décode le H.264 **en logiciel** (~30 % du temps réel,
injouable), et son décodage matériel V4L2 ne s'engage pas sous `cage`. Un POC GStreamer
(`filesrc ! qtdemux ! h264parse ! v4l2h264dec ! kmssink`) a joué le 1080p à **0 frame
perdue** en décodage matériel. Décision : remplacer la vue `/show` du navigateur par une
**app native GPU** utilisant le décodeur matériel du Pi.

## Objectifs et périmètre

**Dans le périmètre**
- Une app native rendant le spectacle sur la sortie HDMI (KMS, sans bureau).
- Look **proche** de l'actuel `Show.js` (polices, couleurs, disposition) avec **animations
  simplifiées** (fondu / glissement / échelle au lieu des flips 3D).
- Décodage vidéo **matériel** (fluide sur Pi3).
- Pilotée par l'état du serveur via **WebSocket** (mêmes messages que la Régie/LCD).

**Hors périmètre (inchangés)**
- Serveur Node (WS + machine à états), Régie web (téléphone), contrôleur LCD Python.
- La vue web `/show` reste disponible pour le développement.

## Stack et prérequis plateforme

- **Python 3** (cohérent avec `pi/lcd/`).
- **SDL2 / pygame en KMSDRM** : contexte GL plein écran sans serveur graphique
  (SDL2 + EGL mesa + GBM présents sur le Pi — vérifié).
- **GStreamer** via `python3-gi` : décodage matériel `v4l2h264dec`, frames via `appsink`.
- **moderngl** : compositing des couches + shaders.
- **Client WS** : repris de `pi/lcd/wsclient.py`.

Prérequis à installer (ajouts `install.sh`) : `python3-gi`, `gir1.2-gst-plugins-base-1.0`,
`gir1.2-gstreamer-1.0`, `python3-gst-1.0`, `python3-pygame`, `python3-moderngl`
(ou pip dans le venv), plugins GStreamer déjà installés (`-base -good -bad -libav -alsa -pulseaudio`).

## Architecture

État → rendu, comme `Show.js`. Modules dans `pi/show/` :

- **`state.py`** — miroir thread-safe de l'état serveur (`currentStepName`, `actors`,
  `scores`, `cardVisible`, `catChecked`, `viewWebcam`, `volume`, `countdown`, `clashN`).
  Réutilise le patron de `pi/lcd/state.py`.
- **`wsclient.py`** — client WS (reconnexion), applique snapshot/patch. Repris de `pi/lcd/`.
- **`scenes.py`** — mappe `currentStepName` → description de scène (fichier vidéo de fond,
  audio à déclencher, textes). Portage **exact** de la logique de `Show.js` (voir § Scènes).
- **`videolayer.py`** — `VideoLayer` : pipeline GStreamer
  `filesrc ! qtdemux ! h264parse ! v4l2h264dec ! (gl) ! appsink`, expose la dernière frame
  comme **texture GL**. Utilisé pour le fond et chaque avatar. `set_source(path, loop=…)`
  re-cible le fichier à chaque changement de scène ; `loop=True` pour les avatars.
- **`audio.py`** — `AudioPlayer` : `playbin` GStreamer pour musiques/sfx
  (`C{clashN+1}.mp3`, `suspens.mp3`, `love.mp3` en boucle, `Gong.mp3`). Sortie audio
  **configurable** (env `CLASH_AUDIO_SINK` : `jack` par défaut, ou `hdmi`). Volume suivi de l'état.
- **`webcam.py`** — source `v4l2src` (caméra USB) → texture → shader de **postérisation
  simplifiée** (quantification de teinte allégée), cadre circulaire. Actif si `viewWebcam`
  et caméra présente (dégradé propre si absente).
- **`renderer.py`** — boucle GL (vsync). Compose chaque frame :
  1. fond vidéo plein écran (`object-fit: cover`),
  2. cercle webcam (si `viewWebcam`),
  3. 3 cartes (vidéo avatar + nom + barre de score `hauteur = 100 + score`),
  4. textes : catégorie (apparition), texte « fuck » (zoom simple), compte à rebours (haut
     centre), écran d'accueil.
  Animations simplifiées par interpolation temporelle (alpha / position / échelle).
  Textes pré-rendus en textures via `pygame.font` + polices `public/font/bison.ttf`,
  `Sarpanch-Black.ttf`.
- **`main.py`** — assemble state + wsclient + audio + renderer ; boucle principale.

## Scènes (portage exact de `Show.js`)

Déclenché sur changement de `currentStepName`. Chemins servis par le serveur sous `/movies`,
`/music` (base URL = `http://localhost:3000`). Données `roue`/`fuck` portées en Python.

| `currentStepName` | Fond vidéo | Audio | Texte / effet |
|---|---|---|---|
| `welcome` | aucun | — | écran d'accueil (CLASH + URL Régie) |
| `Generique` | `01-Intro Clash.mp4` | — | **cartes masquées** |
| `Generique FIN` | `05-finclash.mp4` | — | — |
| `Applaudimetre` | `Applaudimetre{1..30}.mp4` (aléatoire) | — | **cartes affichées une par une** (chorégraphie serveur) |
| `Roue` | `Roue {valeur}.mp4` (valeur ∈ roue) | — | si `valeur=="fuck"` : après 8 s, `randomFuck()` |
| `Category : X` | `02-Annonce categorie.mp4` | `C{clashN+1}.mp3` | affiche `X` après 3 s ; countdown ON ; `incClashN()` |
| `Clash public` | `02-Annonce categorie.mp4` | `suspens.mp3` | « CLASH PUBLIC !!!! » après 3 s ; countdown OFF |
| `Alarm` | `04-Fin du temps.mp4` | — | countdown OFF |
| `show roue` | `Roue 80.mp4` | — | — |
| `show fuck` | `Roue fuck.mp4` | — | — |
| `show alarm` | `04-Fin du temps.mp4` | — | — |
| `play love` | (fond inchangé) | `love.mp3` (boucle) | — |
| `stop love` | (fond inchangé) | stop love | — |
| `stop` | pause du fond | — | — |
| `viewWebcam` (flag) | — | `Gong.mp3` à l'activation | cercle webcam + shader |

Données portées :
- `roue = ["20","30","40","50","60","70","80","90","100","200","fuck","fuck","fuck","fuck"]`
- `fuck = ["-10","-100","Multiplie ton score par 2","Remets un de tes collègues à 0",
  "Echange ton score avec le dernier","Prends un score supplémentaire entre 10 et 100",
  "Prends la moitié des points de chacun des deux autres"]`
- `randomFuck()` : boucle ~200 itérations à intervalle croissant, affiche un `fuck[]` aléatoire
  (effet « machine à sous » de texte).

Cartes : avatar = `avatar-{num}.mp4`, ou `avatar-CAT.mp4` si `catChecked[actorN]`.
Barre de score rouge, hauteur `100 + score` px (échelle à adapter au natif).
`cardVisible[actorN]` pilote apparition/disparition (fondu/glissement).

**Visibilité des cartes (piloté serveur, l'app native reflète `cardVisible`)** :
- **Générique** : cartes masquées → petit ajustement du séquenceur serveur : `toggleStart`
  (branche start) met `cardVisible` des 3 acteurs à `false`. Bénéficie aussi au Show web.
- **Applaudimètre** : cartes affichées **une par une** — chorégraphie **déjà** présente dans
  le `next()` serveur (actor3 à 3 s, actor2 à 8 s, actor1 à 14 s, masquées entre-temps).

## Risque de performance et dé-risquage

Le décodage est matériel (validé). Le point sensible devient **frame décodée → texture GL** :
- **Zéro-copie** (idéal) : éléments GStreamer GL (`glupload`/`appsink` en mémoire GL)
  partageant le **contexte EGL de SDL**. Avancé mais garde tout sur GPU.
- **Upload CPU** (simple) : `appsink` NV12/RGBA → `glTexImage` par frame. Risque sur Pi3 en
  multi-couches.

**Première étape d'implémentation = POC de dé-risquage** : valider le chemin frame→texture
sur le **fond 1080p en temps réel** (mesure du timing). Si l'upload CPU sature, basculer sur
le chemin **gst-gl zéro-copie** partagé avec SDL. Ce choix conditionne le reste ; il est tranché
par le POC, pas a priori.

## Déploiement

- Service `clash-show.service` : lance l'app sur KMS au boot, **remplace `clash-kiosk`**
  (désactivé). `After=clash-server`, `Restart=always`. Accès DRM/GPU (groupes `video`,
  `render` — déjà OK pour `clash`).
- `install.sh` : ajoute les paquets GStreamer/GI/pygame/moderngl ; crée le venv
  (`--system-site-packages` pour voir les bindings GI système).
- Config : `CLASH_AUDIO_SINK` (`jack`/`hdmi`, défaut `jack`), `CLASH_WS_URL`.

## Ordre de construction (phases)

1. **Cœur** : POC frame→texture (dé-risquage) → fond vidéo (matériel) + audio + écran
   d'accueil + compte à rebours + textes catégorie/fuck. Spectacle vidéo fluide de bout en bout.
2. **Cartes de score** : 3 avatars (vidéo) + noms + barres, apparition/disparition simplifiées.
3. **Webcam** : cercle + shader postérisation simplifié.

Chaque phase testable indépendamment sur le Pi.

## Vérification

- Piloter via commandes WS (scripts réutilisés de la session) et comparer chaque scène au
  Show web.
- Mesurer le timing de rendu (cible : fond 1080p en temps réel, ~0 frame perdue).
- Test de bout en bout : au boot, l'app native affiche l'accueil ; « Lancer » depuis le LCD
  enchaîne les scènes de façon fluide avec le son.

## Points ouverts

- Modèle exact de webcam USB (non branchée au moment du design) — l'effet sera calibré à
  l'intégration.
- Décision zéro-copie vs upload CPU : tranchée par le POC de la Phase 1.
- Reproduction fine des animations (courbes/durées) : ajustée visuellement contre le Show web.
