# App Show native — Phase 1 (cœur) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le spectacle (fond vidéo en décodage matériel + audio + écran d'accueil + compte à rebours + textes catégorie/fuck) dans une app native GPU sur le Pi, pilotée par le serveur WS, en remplacement du kiosk navigateur.

**Architecture:** App Python « état → rendu » (comme `Show.js`). Un client WS maintient l'état miroir ; un module `scenes` mappe `currentStepName` vers (fond vidéo, audio, textes) ; GStreamer décode en matériel (`v4l2h264dec`) et fournit les frames en texture GL ; une boucle de rendu SDL2/KMSDRM + moderngl compose fond + textes. Audio via `playbin` GStreamer, sortie configurable.

**Tech Stack:** Python 3, SDL2/pygame (KMSDRM), GStreamer via python3-gi (`v4l2h264dec`, `appsink`, `playbin`), moderngl, websocket-client.

## Global Constraints

- Plateforme : Raspberry Pi OS Trixie (Debian 13), aarch64, user `clash`, sudo sans mot de passe.
- Décodage vidéo **matériel obligatoire** (`v4l2h264dec` / `/dev/video10`) — pas de décodage logiciel.
- Rendu plein écran **sans serveur graphique** : SDL2 driver `kmsdrm`.
- L'app se connecte au serveur sur `CLASH_WS_URL` (défaut `ws://localhost:3000`) ; médias servis sous `http://localhost:3000/movies` et `/music`.
- Sortie audio via `CLASH_AUDIO_SINK` ∈ {`jack`, `hdmi`}, défaut `jack`.
- Dépôt : `github.com/olivier-nerot/Clash2`. Fichiers Python en `pi/show/`, tests en `pi/show/tests/`.
- Commits en anglais, terminaison `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Ne PAS `git add -A` : staging sélectif.
- Environnement d'exécution/test : venv `pi/show/venv` créé avec `--system-site-packages` (pour voir `gi`/GStreamer système). pytest lancé via `pi/show/venv/bin/pytest`.

---

## File Structure

- `pi/show/data.py` — constantes `ROUE`, `FUCK`, `HOT_FIRES`, `ACTOR_KEYS`, `MEDIA` (chemins). Logique pure.
- `pi/show/config.py` — lecture des variables d'environnement (WS URL, base médias, audio sink). Logique pure.
- `pi/show/state.py` — `ShowState` miroir thread-safe (adapté de `pi/lcd/state.py`). Logique pure.
- `pi/show/scenes.py` — `scene_for(step)` → `Scene` (fond vidéo, audio, texte). Cœur porté de `Show.js`. Logique pure.
- `pi/show/wsclient.py` — client WS (adapté de `pi/lcd/wsclient.py`). Matériel réseau.
- `pi/show/videolayer.py` — `VideoLayer` : pipeline GStreamer décode→texture GL. Matériel.
- `pi/show/audio.py` — `AudioPlayer` : `playbin` GStreamer, sink configurable. Matériel.
- `pi/show/renderer.py` — boucle GL SDL2/moderngl : fond + textes + accueil + compte à rebours. Matériel/GL.
- `pi/show/main.py` — assemblage.
- `pi/show/poc_texture.py` — POC de dé-risquage frame→texture (jetable/référence).
- `pi/show/requirements.txt` — dépendances pip.
- `pi/show/tests/test_data.py`, `test_config.py`, `test_state.py`, `test_scenes.py` — pytest.
- `pi/systemd/clash-show.service` — service systemd (remplace kiosk).
- `pi/install.sh` — ajout des paquets/venv Show (modif).
- `server/showStore.js` — masquer les cartes au start (modif).

---

## Task 0 : POC de dé-risquage frame→texture

**But :** trancher zéro-copie vs upload CPU AVANT d'écrire le renderer. Décode le fond 1080p en matériel et l'affiche via une texture GL SDL2/KMSDRM, en mesurant le débit.

**Files:**
- Create: `pi/show/poc_texture.py`

**Interfaces:**
- Produces: décision documentée (zéro-copie gst-gl vs upload CPU) reprise par Task 6 (`videolayer.py`).

- [ ] **Step 1 : Installer les dépendances système sur le Pi**

Run (sur le Pi via ssh) :
```bash
sudo apt-get install -y python3-gi gir1.2-gstreamer-1.0 gir1.2-gst-plugins-base-1.0 python3-gst-1.0 python3-pygame python3-moderngl python3-numpy python3-opengl
```
Expected : installation OK (GStreamer déjà présent depuis le POC précédent).

- [ ] **Step 2 : Écrire le POC (upload CPU d'abord, le plus simple)**

Create `pi/show/poc_texture.py` : ouvre une fenêtre SDL2 plein écran en `kmsdrm`
(`os.environ["SDL_VIDEODRIVER"]="kmsdrm"`), crée un contexte moderngl, construit un pipeline
GStreamer `filesrc location=<intro> ! qtdemux ! h264parse ! v4l2h264dec ! videoconvert !
video/x-raw,format=RGBA ! appsink emit-signals=true max-buffers=2 drop=true`, et à chaque
frame `appsink` uploade le buffer dans une texture moderngl affichée en plein écran.
Compte les frames rendues et le temps vidéo écoulé sur 5 s ; imprime `fps_rendu`, `frames_perdues`,
et si `/dev/video10` est utilisé (`v4l2h264dec` actif).

- [ ] **Step 3 : Lancer le POC sur le Pi et mesurer**

Run (après `sudo systemctl stop clash-kiosk` pour libérer le DRM) :
```bash
CLASH_MEDIA="/home/clash/Clash2/public/movies/01-Intro Clash.mp4" pi/show/venv/bin/python pi/show/poc_texture.py
```
Expected : vidéo fluide plein écran ; `/dev/video10` utilisé ; débit ≈ temps réel (≥ 25 fps rendus, frames_perdues faible). **Confirmation visuelle utilisateur requise.**

- [ ] **Step 4 : Si l'upload CPU sature, tester la voie zéro-copie**

Remplacer la fin du pipeline par `... ! v4l2h264dec ! glupload ! glcolorconvert ! appsink caps="video/x-raw(memory:GLMemory),format=RGBA"`
et importer la texture GL directement (partage du contexte EGL SDL via `Gst.gl`). Re-mesurer.
Retenir la voie qui atteint le temps réel. **Documenter la décision en tête de `videolayer.py`.**

- [ ] **Step 5 : Commit**

```bash
git add pi/show/poc_texture.py
git commit -m "show: frame-to-GL-texture POC (hardware decode path decision)"
```

---

## Task 1 : Données statiques (`data.py`)

**Files:**
- Create: `pi/show/data.py`
- Test: `pi/show/tests/test_data.py`

**Interfaces:**
- Produces: `ROUE: list[str]`, `FUCK: list[str]`, `HOT_FIRES: str`, `ACTOR_KEYS: list[str]`,
  `movie_url(name: str) -> str`, `music_url(name: str) -> str` (construits sur `config.MEDIA_BASE`).

- [ ] **Step 1 : Écrire le test**

Create `pi/show/tests/test_data.py` :
```python
from pi.show import data

def test_roue_values():
    assert data.ROUE == ["20","30","40","50","60","70","80","90","100","200","fuck","fuck","fuck","fuck"]

def test_fuck_values():
    assert data.FUCK[0] == "-10"
    assert "Multiplie ton score par 2" in data.FUCK[2]
    assert len(data.FUCK) == 7

def test_actor_keys():
    assert data.ACTOR_KEYS == ["actor1","actor2","actor3"]

def test_hot_fires():
    assert data.HOT_FIRES == "Hot fires"
```

- [ ] **Step 2 : Lancer le test (échoue)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_data.py -v`
Expected: FAIL (module `pi.show.data` introuvable).

- [ ] **Step 3 : Implémenter `data.py`**

```python
"""Données statiques du spectacle (miroir de src/setup/*.js)."""
from pi.show import config

ROUE = ["20","30","40","50","60","70","80","90","100","200","fuck","fuck","fuck","fuck"]
FUCK = [
    "-10", "-100", "Multiplie ton score par 2", "Remets un de tes collègues à 0",
    "Echange ton score avec le dernier", "Prends un score supplémentaire entre 10 et 100",
    "Prends la moitié des points de chacun des deux autres",
]
HOT_FIRES = "Hot fires"
ACTOR_KEYS = ["actor1", "actor2", "actor3"]

def movie_url(name: str) -> str:
    return f"{config.MEDIA_BASE}/movies/{name}"

def music_url(name: str) -> str:
    return f"{config.MEDIA_BASE}/music/{name}"
```

- [ ] **Step 4 : Lancer le test (passe)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_data.py -v`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add pi/show/data.py pi/show/tests/test_data.py
git commit -m "show: static data (roue, fuck, actors, media urls)"
```

---

## Task 2 : Configuration (`config.py`)

**Files:**
- Create: `pi/show/config.py`
- Test: `pi/show/tests/test_config.py`

**Interfaces:**
- Produces: `WS_URL: str`, `MEDIA_BASE: str`, `AUDIO_SINK: str` (valeur `jack`|`hdmi`),
  `gst_audio_sink() -> str` (élément GStreamer selon `AUDIO_SINK`).

- [ ] **Step 1 : Écrire le test**

Create `pi/show/tests/test_config.py` :
```python
import importlib

def reload_config(monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    import pi.show.config as c
    return importlib.reload(c)

def test_defaults(monkeypatch):
    for k in ["CLASH_WS_URL","CLASH_MEDIA_BASE","CLASH_AUDIO_SINK"]:
        monkeypatch.delenv(k, raising=False)
    c = reload_config(monkeypatch)
    assert c.WS_URL == "ws://localhost:3000"
    assert c.MEDIA_BASE == "http://localhost:3000"
    assert c.AUDIO_SINK == "jack"

def test_audio_sink_hdmi(monkeypatch):
    c = reload_config(monkeypatch, CLASH_AUDIO_SINK="hdmi")
    assert c.AUDIO_SINK == "hdmi"
    assert "alsasink" in c.gst_audio_sink()
```

- [ ] **Step 2 : Lancer le test (échoue)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_config.py -v`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `config.py`**

```python
"""Configuration par variables d'environnement."""
import os

WS_URL = os.environ.get("CLASH_WS_URL", "ws://localhost:3000")
MEDIA_BASE = os.environ.get("CLASH_MEDIA_BASE", "http://localhost:3000")
AUDIO_SINK = os.environ.get("CLASH_AUDIO_SINK", "jack")

def gst_audio_sink() -> str:
    # Cartes ALSA : jack = carte analogique (hw:Headphones), hdmi = hw:vc4hdmi.
    device = "hw:Headphones" if AUDIO_SINK == "hdmi" and False else None
    if AUDIO_SINK == "hdmi":
        return "alsasink device=hw:vc4hdmi"
    return "alsasink device=hw:Headphones"
```
Note : les noms de cartes ALSA (`hw:Headphones`, `hw:vc4hdmi`) sont à confirmer via `aplay -l`
lors de la vérification (Task 7) ; ajuster si besoin.

- [ ] **Step 4 : Lancer le test (passe)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add pi/show/config.py pi/show/tests/test_config.py
git commit -m "show: env configuration (ws url, media base, audio sink)"
```

---

## Task 3 : État miroir (`state.py`)

**Files:**
- Create: `pi/show/state.py` (adapté de `pi/lcd/state.py`)
- Test: `pi/show/tests/test_state.py`

**Interfaces:**
- Produces: classe `ShowState` avec `apply_snapshot(dict)`, `apply_patch(dict)`,
  `get(key, default=None)`, `snapshot() -> dict`, attribut `revision: int`.

- [ ] **Step 1 : Écrire le test**

Create `pi/show/tests/test_state.py` :
```python
from pi.show.state import ShowState

def test_snapshot_and_patch():
    s = ShowState()
    r0 = s.revision
    s.apply_snapshot({"currentStepName": "Generique", "scores": {"actor1": 0}})
    assert s.get("currentStepName") == "Generique"
    assert s.revision == r0 + 1
    s.apply_patch({"scores": {"actor1": 10}})
    assert s.get("scores")["actor1"] == 10
    assert s.revision == r0 + 2

def test_defaults():
    s = ShowState()
    assert s.get("currentStepName") == "welcome"
    assert s.get("countdown") == 59 * 60 + 27
```

- [ ] **Step 2 : Lancer le test (échoue)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_state.py -v`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `state.py`**

Copier la classe `ShowState` de `pi/lcd/state.py` (défauts identiques : `currentStepName="welcome"`,
`countdown=59*60+27`, `actors`, `scores`, `cardVisible`, `catChecked`, `selectedCategories`,
`numDropdowns`, `viewWebcam`, `isRunning`, `nextStep`, `isLoveRunning`, `clashN`, `volume`),
sans les constantes (importer depuis `data`). Mécanisme `_lock` + `revision` identique.

- [ ] **Step 4 : Lancer le test (passe)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_state.py -v`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add pi/show/state.py pi/show/tests/test_state.py
git commit -m "show: mirrored ShowState (thread-safe)"
```

---

## Task 4 : Mapping des scènes (`scenes.py`) — cœur

**Files:**
- Create: `pi/show/scenes.py`
- Test: `pi/show/tests/test_scenes.py`

**Interfaces:**
- Consumes: `data.movie_url`, `data.ROUE`.
- Produces: dataclass `Scene(bg_video: str|None, bg_loop: bool, audio: str|None,
  audio_loop: bool, pause_bg: bool, show_countdown: bool|None, is_welcome: bool)`
  et `scene_for(step: str, clash_n: int, rng=random) -> Scene`.
  `bg_video` est une URL complète ou `None` (fond inchangé). `audio` = URL ou mot-clé
  `"stop-love"`.

Règles portées de `Show.js` (le déclenchement du texte catégorie/fuck et l'`incClashN` sont
gérés par le renderer/scene runner, pas ici — `scene_for` est pur et déterministe hors `rng`).

- [ ] **Step 1 : Écrire le test**

Create `pi/show/tests/test_scenes.py` :
```python
import random
from pi.show import scenes, data

def test_generique():
    s = scenes.scene_for("Generique", 0)
    assert s.bg_video == data.movie_url("01-Intro Clash.mp4")
    assert s.audio is None

def test_welcome():
    s = scenes.scene_for("welcome", 0)
    assert s.is_welcome and s.bg_video is None

def test_category_music_uses_clashn_plus_1():
    s = scenes.scene_for("Category : Hot fires", 2)
    assert s.bg_video == data.movie_url("02-Annonce categorie.mp4")
    assert s.audio == data.music_url("C3.mp3")
    assert s.show_countdown is True

def test_clash_public():
    s = scenes.scene_for("Clash public", 0)
    assert s.audio == data.music_url("suspens.mp3")
    assert s.show_countdown is False

def test_roue_uses_rng(monkeypatch):
    rng = random.Random(0)
    s = scenes.scene_for("Roue", 0, rng=rng)
    assert s.bg_video.startswith(data.movie_url("Roue "))

def test_applaudimetre_random_range(monkeypatch):
    rng = random.Random(0)
    s = scenes.scene_for("Applaudimetre", 0, rng=rng)
    assert "Applaudimetre" in s.bg_video and s.bg_video.endswith(".mp4")

def test_play_love_loops():
    s = scenes.scene_for("play love", 0)
    assert s.audio == data.music_url("love.mp3") and s.audio_loop

def test_stop_and_stop_love():
    assert scenes.scene_for("stop", 0).pause_bg is True
    assert scenes.scene_for("stop love", 0).audio == "stop-love"
```

- [ ] **Step 2 : Lancer le test (échoue)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_scenes.py -v`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `scenes.py`**

```python
"""Mapping currentStepName -> scène (porté de src/pages/Show.js)."""
import random as _random
from dataclasses import dataclass
from pi.show import data

@dataclass
class Scene:
    bg_video: str | None = None
    bg_loop: bool = False
    audio: str | None = None
    audio_loop: bool = False
    pause_bg: bool = False
    show_countdown: bool | None = None  # None = inchangé
    is_welcome: bool = False

def scene_for(step: str, clash_n: int, rng=_random) -> Scene:
    if step == "welcome":
        return Scene(is_welcome=True)
    if step == "Applaudimetre":
        n = rng.randint(1, 30)
        return Scene(bg_video=data.movie_url(f"Applaudimetre{n}.mp4"))
    if step == "Generique":
        return Scene(bg_video=data.movie_url("01-Intro Clash.mp4"))
    if step == "Generique FIN":
        return Scene(bg_video=data.movie_url("05-finclash.mp4"))
    if step == "Roue":
        val = rng.choice(data.ROUE)
        return Scene(bg_video=data.movie_url(f"Roue {val}.mp4"))
    if step.startswith("Category"):
        return Scene(bg_video=data.movie_url("02-Annonce categorie.mp4"),
                     audio=data.music_url(f"C{clash_n + 1}.mp3"), show_countdown=True)
    if step == "Clash public":
        return Scene(bg_video=data.movie_url("02-Annonce categorie.mp4"),
                     audio=data.music_url("suspens.mp3"), show_countdown=False)
    if step == "Alarm":
        return Scene(bg_video=data.movie_url("04-Fin du temps.mp4"), show_countdown=False)
    if step == "show roue":
        return Scene(bg_video=data.movie_url("Roue 80.mp4"))
    if step == "show fuck":
        return Scene(bg_video=data.movie_url("Roue fuck.mp4"))
    if step == "show alarm":
        return Scene(bg_video=data.movie_url("04-Fin du temps.mp4"))
    if step == "play love":
        return Scene(audio=data.music_url("love.mp3"), audio_loop=True)
    if step == "stop love":
        return Scene(audio="stop-love")
    if step == "stop":
        return Scene(pause_bg=True)
    return Scene()
```

- [ ] **Step 4 : Lancer le test (passe)**

Run: `pi/show/venv/bin/python -m pytest pi/show/tests/test_scenes.py -v`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add pi/show/scenes.py pi/show/tests/test_scenes.py
git commit -m "show: scene mapping ported from Show.js (pure, tested)"
```

---

## Task 5 : Client WS (`wsclient.py`)

**Files:**
- Create: `pi/show/wsclient.py` (adapté de `pi/lcd/wsclient.py`)

**Interfaces:**
- Consumes: `ShowState`, `config.WS_URL`.
- Produces: classe `WSClient(url, state, on_change=None)` avec `start()`, `stop()`, `connected` (bool).

- [ ] **Step 1 : Copier/adapter depuis `pi/lcd/wsclient.py`**

Reprendre à l'identique `pi/lcd/wsclient.py` (déjà validé contre le serveur en session).
Il applique `snapshot`/`patch` au `ShowState` et appelle `on_change`. Aucun changement de logique.

- [ ] **Step 2 : Vérifier contre le serveur (le Pi)**

Run (serveur actif) :
```bash
pi/show/venv/bin/python -c "
import time
from pi.show.state import ShowState
from pi.show.wsclient import WSClient
from pi.show import config
s=ShowState(); ws=WSClient(config.WS_URL, s); ws.start()
for _ in range(50):
    if ws.connected and s.get('actors'): break
    time.sleep(0.1)
print('connecté=', ws.connected, 'step=', s.get('currentStepName')); ws.stop()"
```
Expected : `connecté= True step= welcome` (ou l'étape courante).

- [ ] **Step 3 : Commit**

```bash
git add pi/show/wsclient.py
git commit -m "show: websocket client (mirrors server state)"
```

---

## Task 6 : Couche vidéo (`videolayer.py`)

**Files:**
- Create: `pi/show/videolayer.py`

**Interfaces:**
- Consumes: la voie frame→texture décidée en Task 0 ; le contexte moderngl du renderer (Task 8).
- Produces: classe `VideoLayer(ctx)` (ctx = contexte moderngl) avec :
  `set_source(url: str|None, loop: bool)` (change/relance le fichier ; `None` = garde le dernier),
  `pause()`, `resume()`, `texture` (propriété → texture moderngl courante ou `None`),
  `update()` (récupère la dernière frame de l'`appsink` dans la texture ; appelée par la boucle).

- [ ] **Step 1 : Implémenter le pipeline GStreamer + upload texture**

Selon la décision Task 0 : pipeline `souphttpsrc location=<url> ! qtdemux ! h264parse !
v4l2h264dec ! videoconvert ! video/x-raw,format=RGBA ! appsink` (les médias sont servis en HTTP
par le serveur Node ; `souphttpsrc` évite les soucis d'espaces de chemins). `set_source` reconstruit
la branche (ou change l'URI d'un `playbin`/`uridecodebin`). `update()` lit `appsink.emit("pull-sample")`
non bloquant et met à jour une texture moderngl (créée/redimensionnée à la volée). `loop=True` :
sur EOS, seek à 0 (segment loop) pour les avatars — ici Phase 1 n'utilise que le fond (loop utile
plus tard) mais l'API le prévoit.

- [ ] **Step 2 : Vérifier le décodage matériel + rendu (sur le Pi)**

Écrire un petit `pi/show/tests/manual_videolayer.py` qui crée une fenêtre SDL2/moderngl,
un `VideoLayer`, `set_source(movie_url("01-Intro Clash.mp4"), loop=False)`, et affiche la
texture en plein écran pendant 8 s. Lancer (kiosk arrêté) :
```bash
sudo systemctl stop clash-kiosk
pi/show/venv/bin/python pi/show/tests/manual_videolayer.py
sudo fuser /dev/video10   # doit montrer le process -> décodage matériel
```
Expected : intro fluide plein écran ; `/dev/video10` utilisé. **Confirmation visuelle utilisateur.**

- [ ] **Step 3 : Commit**

```bash
git add pi/show/videolayer.py pi/show/tests/manual_videolayer.py
git commit -m "show: GStreamer hardware-decoded video layer to GL texture"
```

---

## Task 7 : Audio (`audio.py`)

**Files:**
- Create: `pi/show/audio.py`

**Interfaces:**
- Consumes: `config.gst_audio_sink()`, `config.AUDIO_SINK`.
- Produces: classe `AudioPlayer()` avec `play(url: str, loop: bool=False)`, `stop()`,
  `set_volume(v: float)`. Un `playbin` réutilisé (change d'`uri`), `audio-sink` = sink configuré,
  bouclage via signal `about-to-finish` si `loop`.

- [ ] **Step 1 : Confirmer les cartes ALSA sur le Pi**

Run: `aplay -l`
Noter les noms réels (ex. `Headphones`, `vc4hdmi0`). Ajuster `config.gst_audio_sink()` si les
noms diffèrent de `hw:Headphones` / `hw:vc4hdmi`.

- [ ] **Step 2 : Implémenter `audio.py`**

`playbin` avec `audio-sink` construit par `Gst.parse_bin_from_description(config.gst_audio_sink(), True)`.
`play(url, loop)` : set `uri`, `volume`, état `PLAYING` ; mémorise `loop` et l'URL pour le bouclage.
`about-to-finish` → re-set `uri` si `loop`. `stop()` → `NULL`. `set_volume` → propriété `volume`.

- [ ] **Step 3 : Vérifier le son (sur le Pi)**

Run:
```bash
CLASH_AUDIO_SINK=jack pi/show/venv/bin/python -c "
import time
from pi.show.audio import AudioPlayer
from pi.show import data
a=AudioPlayer(); a.play(data.music_url('Gong.mp3')); time.sleep(3)"
```
Expected : gong audible sur le jack. **Confirmation utilisateur.** Refaire avec `CLASH_AUDIO_SINK=hdmi`.

- [ ] **Step 4 : Commit**

```bash
git add pi/show/audio.py
git commit -m "show: audio player (playbin, configurable jack/hdmi sink)"
```

---

## Task 8 : Renderer (`renderer.py`) — fond + textes + accueil + compte à rebours

**Files:**
- Create: `pi/show/renderer.py`

**Interfaces:**
- Consumes: `ShowState`, `VideoLayer`, `AudioPlayer`, `scenes.scene_for`, polices
  `public/font/bison.ttf` et `Sarpanch-Black.ttf`.
- Produces: classe `Renderer(state, send)` (`send` = `WSClient.send`, pour émettre `incClashN`)
  avec `run()` (boucle bloquante SDL2/moderngl : init GL, crée `VideoLayer`/`AudioPlayer`,
  boucle vsync). Interne : `_on_step_change(step)` applique la
  scène (change fond, déclenche audio, arme le texte catégorie/fuck) ; `_draw()` compose fond
  (cover) + surcouches texte + accueil + compte à rebours.

- [ ] **Step 1 : Init SDL2/KMSDRM + moderngl + quad plein écran**

`os.environ["SDL_VIDEODRIVER"]="kmsdrm"` ; fenêtre SDL2 OpenGL plein écran ; contexte modergll ;
programme GL : un quad texturé (shader passthrough) réutilisé pour dessiner fond et textes
(chaque surcouche = texture RGBA blit avec alpha). Fond dessiné en mode « cover »
(échelle pour couvrir 16:9 → écran).

- [ ] **Step 2 : Texte pré-rendu en texture**

Helper `text_texture(ctx, text, font, color)` : `pygame.font.Font(path, size).render(...)`
en surface RGBA → texture moderngl. Cache par (texte, taille, police).

- [ ] **Step 3 : Réagir aux changements d'étape**

Boucle : si `state.revision` a changé et `currentStepName` a changé → `scene = scene_for(step, clash_n)`.
Appliquer : `videolayer.set_source(scene.bg_video, scene.bg_loop)` (ou `pause()` si `pause_bg`) ;
audio (`play`/`stop`/loop, `stop-love`→stop) ; `show_countdown` ; armer le texte catégorie (afficher
`step.split(":")[1]` après 3 s) et, pour Category, incrémenter `clashN` côté serveur via une commande
(ou lire `clashN` de l'état — Phase 1 : envoyer la commande `incClashN` comme le faisait `Show.js`).
Pour `Roue` avec valeur `fuck` : après 8 s, lancer l'effet `randomFuck` (texte aléatoire de `data.FUCK`,
zoom simple, ~5 s). Écran d'accueil si `scene.is_welcome` (titre « CLASH » Bison + URL Régie).
Compte à rebours (haut centre, Sarpanch) affiché si `show_countdown` actif, format `MM:SS` depuis
`state.get('countdown')`.

- [ ] **Step 4 : Vérifier le rendu de scènes (sur le Pi, piloté WS)**

Arrêter le kiosk, lancer le renderer, et piloter via un script WS (réutiliser
`scratchpad/restart-show.js` / commandes) : accueil au repos, START → Generique fluide,
NEXT → Category (texte catégorie + musique + compte à rebours qui défile), Clash public (suspens),
Alarm. **Confirmation visuelle + audio utilisateur, comparée au Show web.**

- [ ] **Step 5 : Commit**

```bash
git add pi/show/renderer.py
git commit -m "show: GL renderer (bg video cover, welcome, countdown, category/fuck text)"
```

---

## Task 9 : Assemblage (`main.py`) + requirements

**Files:**
- Create: `pi/show/main.py`, `pi/show/requirements.txt`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: point d'entrée `python -m pi.show.main`.

- [ ] **Step 1 : `main.py`**

```python
"""App Show native — point d'entrée."""
from pi.show.state import ShowState
from pi.show.wsclient import WSClient
from pi.show.renderer import Renderer
from pi.show import config

def main():
    state = ShowState()
    ws = WSClient(config.WS_URL, state)
    ws.start()
    try:
        Renderer(state, send=ws.send).run()  # run() bloque (boucle GL)
    finally:
        ws.stop()

if __name__ == "__main__":
    main()
```
(`Renderer` prend `send` pour émettre `incClashN` ; ajuster la signature en Task 8.)

- [ ] **Step 2 : `requirements.txt`**

```
websocket-client>=1.6.0
# gi (GStreamer), pygame, moderngl, numpy : paquets système (python3-*), venv --system-site-packages
```

- [ ] **Step 3 : Vérifier de bout en bout (sur le Pi)**

```bash
sudo systemctl stop clash-kiosk
pi/show/venv/bin/python -m pi.show.main
```
Puis dérouler un mini-spectacle via le LCD ou des commandes WS. Expected : accueil, puis
enchaînement fluide fond+son+textes. **Confirmation utilisateur.**

- [ ] **Step 4 : Commit**

```bash
git add pi/show/main.py pi/show/requirements.txt
git commit -m "show: app entry point + requirements"
```

---

## Task 10 : Masquer les cartes au démarrage (serveur)

**Files:**
- Modify: `server/showStore.js` (branche start de `toggleStart`)

**Interfaces:**
- Produces: au START, `cardVisible` des 3 acteurs passe à `false` (bénéficie aussi au Show web).

- [ ] **Step 1 : Modifier `toggleStart` (branche start)**

Dans `server/showStore.js`, branche `else` (start) de `toggleStart`, ajouter au `set({...})` :
`cardVisible: { actor1: false, actor2: false, actor3: false }`.

- [ ] **Step 2 : Vérifier**

Run (le Pi, serveur redémarré) : envoyer `toggleStart` via WS, lire l'état → `cardVisible` tous `false`,
`currentStepName` `Generique`.
```bash
node scratchpad/... # ou script WS: cmd toggleStart puis snapshot
```
Expected : `cardVisible = {actor1:false,actor2:false,actor3:false}` au Generique.

- [ ] **Step 3 : Commit**

```bash
git add server/showStore.js
git commit -m "server: hide cards on show start (Generique)"
```

---

## Task 11 : Déploiement (systemd + install)

**Files:**
- Create: `pi/systemd/clash-show.service`
- Modify: `pi/install.sh`

**Interfaces:**
- Produces: service `clash-show` lancé au boot à la place de `clash-kiosk`.

- [ ] **Step 1 : `clash-show.service`**

```ini
[Unit]
Description=Clash - vue spectacle native (GStreamer, sortie HDMI)
After=clash-server.service
Requires=clash-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Clash2
Environment=PYTHONUNBUFFERED=1
Environment=CLASH_WS_URL=ws://localhost:3000
Environment=CLASH_AUDIO_SINK=jack
ExecStartPre=/home/pi/Clash2/pi/wait-for-server.sh
ExecStart=/home/pi/Clash2/pi/show/venv/bin/python -m pi.show.main
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
(Le substituteur user/home de `install.sh` s'applique comme pour les autres units.)

- [ ] **Step 2 : `install.sh` — paquets + venv Show**

Ajouter à l'étape paquets : `python3-gi gir1.2-gstreamer-1.0 gir1.2-gst-plugins-base-1.0
python3-gst-1.0 python3-pygame python3-moderngl python3-numpy python3-opengl`.
Créer le venv `pi/show/venv --system-site-packages` + `pip install -r pi/show/requirements.txt`.
Générer/activer `clash-show.service` (même substitution que les autres) et **désactiver
`clash-kiosk`** (`systemctl disable clash-kiosk`).

- [ ] **Step 3 : Déployer et tester au boot (sur le Pi)**

```bash
cd ~/Clash2 && git pull
bash pi/install.sh   # (ré-exécution : installe show, désactive kiosk)
sudo systemctl disable clash-kiosk && sudo systemctl enable clash-show
sudo reboot
```
Expected : au boot, l'app native affiche l'accueil sur HDMI ; « Lancer » depuis le LCD →
spectacle fluide avec son. **Confirmation utilisateur.**

- [ ] **Step 4 : Commit**

```bash
git add pi/systemd/clash-show.service pi/install.sh
git commit -m "deploy: native show systemd service, replace chromium kiosk"
```

---

## Self-Review (couverture du spec)

- Fond vidéo matériel → Tasks 0, 6. Audio configurable → Tasks 2, 7. Accueil/compte à
  rebours/textes → Task 8. Mapping scènes exact → Task 4. État WS → Tasks 3, 5.
  Cartes masquées au Generique → Task 10. Déploiement/remplacement kiosk → Task 11.
- Hors Phase 1 (plans ultérieurs) : cartes de score (Phase 2), webcam + shader (Phase 3).
- Risque frame→texture explicitement tranché en Task 0 avant le renderer.
- Pas de placeholder de code dans les tâches de logique pure (data/config/state/scenes) ;
  les tâches matérielles (6, 7, 8) fournissent interfaces, pipelines GStreamer concrets et
  commandes de vérification — le code GL/GStreamer se stabilise en itérant sur le Pi (bring-up
  matériel), il n'est volontairement pas figé au pseudo-octet dans le plan.
