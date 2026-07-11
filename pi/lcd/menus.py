"""Menus du contrôleur LCD (rendu PIL 240x240, navigation joystick + 3 boutons).

Deux univers :
- Menu Options (hors spectacle) : catégories, noms des comédiens, scores, réseau, lancer.
- Menu Spectacle (en cours) : NEXT + timer + contrôles contextuels selon la phase
  (LOVE si catégorie « Hot fires », scores ± si phase « Roue »).

Événements : up, down, left, right, press, key1, key2, key3.
"""

from PIL import Image, ImageDraw, ImageFont

from state import ACTOR_KEYS, CATEGORIES, HOT_FIRES

W, H = 240, 240
BG = (0, 0, 0)
FG = (255, 255, 255)
DIM = (150, 150, 150)
ACCENT = (76, 175, 80)
RED = (244, 67, 54)


def _load_font(size):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


F_SM = _load_font(16)
F_MD = _load_font(20)
F_LG = _load_font(30)
F_XL = _load_font(52)


def _text_w(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def _center(draw, y, text, font, fill=FG):
    draw.text(((W - _text_w(draw, text, font)) / 2, y), text, font=font, fill=fill)


def _right(draw, y, text, font, fill=FG, margin=12):
    draw.text((W - margin - _text_w(draw, text, font), y), text, font=font, fill=fill)


def _truncate(draw, text, font, max_w):
    if _text_w(draw, text, font) <= max_w:
        return text
    while text and _text_w(draw, text + "…", font) > max_w:
        text = text[:-1]
    return text + "…"


# --------------------------------------------------------------------------
# Écrans
# --------------------------------------------------------------------------
class Screen:
    def __init__(self, ctrl):
        self.ctrl = ctrl

    def handle(self, event):  # retourne True si l'écran a consommé l'événement
        return False

    def render(self, draw, state):
        pass


class ListScreen(Screen):
    """Liste défilante générique. on_select(index) au PRESS. KEY3 = retour."""

    def __init__(self, ctrl, title, items, on_select, back=True):
        super().__init__(ctrl)
        self.title = title
        self.items = items
        self.on_select = on_select
        self.sel = 0
        self.top = 0
        self.back = back
        self.visible = 4

    def set_items(self, items):
        self.items = items
        self.sel = max(0, min(self.sel, len(items) - 1))

    def handle(self, event):
        if event == "up":
            self.sel = (self.sel - 1) % max(1, len(self.items))
        elif event == "down":
            self.sel = (self.sel + 1) % max(1, len(self.items))
        elif event in ("press", "key1"):
            if self.items:
                self.on_select(self.sel)
        elif event == "key3" and self.back:
            self.ctrl.pop()
        else:
            return False
        # ajuste le défilement
        if self.sel < self.top:
            self.top = self.sel
        elif self.sel >= self.top + self.visible:
            self.top = self.sel - self.visible + 1
        return True

    def render(self, draw, state):
        _center(draw, 6, self.title, F_MD, ACCENT)
        draw.line((10, 34, W - 10, 34), fill=(60, 60, 60))
        y = 44
        row_h = 46
        for i in range(self.top, min(len(self.items), self.top + self.visible)):
            selected = i == self.sel
            if selected:
                draw.rounded_rectangle((8, y, W - 8, y + row_h - 6), 6, fill=(30, 30, 30), outline=ACCENT, width=2)
            label = _truncate(draw, str(self.items[i]), F_MD, W - 32)
            draw.text((18, y + 10), label, font=F_MD, fill=FG if selected else DIM)
            y += row_h


class OptionsMenu(ListScreen):
    ENTRIES = ["> Lancer le spectacle", "Comédiens", "Catégories", "Scores", "Réseau"]

    def __init__(self, ctrl):
        super().__init__(ctrl, "OPTIONS", self.ENTRIES, self._select, back=False)

    def _select(self, i):
        if i == 0:
            self.ctrl.send("toggleStart")  # démarre -> bascule auto sur ShowScreen
        elif i == 1:
            self.ctrl.push(ActorsScreen(self.ctrl))
        elif i == 2:
            self.ctrl.push(CategoriesScreen(self.ctrl))
        elif i == 3:
            self.ctrl.push(ScoresScreen(self.ctrl))
        elif i == 4:
            self.ctrl.push(NetworkScreen(self.ctrl))


class ActorsScreen(ListScreen):
    def __init__(self, ctrl):
        super().__init__(ctrl, "COMÉDIENS", self._labels(ctrl), self._select)

    def _labels(self, ctrl):
        actors = ctrl.state.get("actors", {})
        return [actors.get(k, "") for k in ACTOR_KEYS]

    def render(self, draw, state):
        self.set_items(self._labels(self.ctrl))
        super().render(draw, state)

    def _select(self, i):
        self.ctrl.push(NameEditor(self.ctrl, ACTOR_KEYS[i]))


class NameEditor(Screen):
    """Éditeur de nom : UP/DOWN change le caractère, LEFT/RIGHT déplace le curseur,
    KEY1 valide (setActor), KEY3 annule."""

    ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'"

    def __init__(self, ctrl, actor):
        super().__init__(ctrl)
        self.actor = actor
        name = ctrl.state.get("actors", {}).get(actor, "").upper()
        self.chars = list(name) if name else [" "]
        self.pos = len(self.chars) - 1

    def _cur_index(self):
        c = self.chars[self.pos]
        return self.ALPHABET.find(c) if c in self.ALPHABET else 0

    def handle(self, event):
        if event == "up":
            self.chars[self.pos] = self.ALPHABET[(self._cur_index() + 1) % len(self.ALPHABET)]
        elif event == "down":
            self.chars[self.pos] = self.ALPHABET[(self._cur_index() - 1) % len(self.ALPHABET)]
        elif event == "left":
            self.pos = max(0, self.pos - 1)
        elif event == "right":
            self.pos += 1
            if self.pos >= len(self.chars):
                self.chars.append(" ")
        elif event == "key1":
            name = "".join(self.chars).strip()
            self.ctrl.send("setActor", {"actor": self.actor, "value": name})
            self.ctrl.pop()
        elif event == "key3":
            self.ctrl.pop()
        else:
            return False
        return True

    def render(self, draw, state):
        _center(draw, 10, "ÉDITER LE NOM", F_MD, ACCENT)
        text = "".join(self.chars)
        _center(draw, 90, text, F_LG)
        # souligne le caractère courant
        char_w = _text_w(draw, "W", F_LG)
        start_x = (W - _text_w(draw, text, F_LG)) / 2
        cx = start_x + char_w * self.pos
        draw.line((cx, 128, cx + char_w, 128), fill=ACCENT, width=3)
        _center(draw, 180, "KEY1 = valider", F_SM, DIM)
        _center(draw, 205, "KEY3 = annuler", F_SM, DIM)


class CategoriesScreen(ListScreen):
    """Liste des étapes (numDropdowns). KEY1 ajoute une étape. PRESS édite la catégorie."""

    def __init__(self, ctrl):
        super().__init__(ctrl, "CATÉGORIES", self._labels(ctrl), self._select)

    def _labels(self, ctrl):
        n = ctrl.state.get("numDropdowns", 0)
        cats = ctrl.state.get("selectedCategories", {})
        rows = []
        for i in range(n):
            val = cats.get(str(i)) or cats.get(i) or "—"
            rows.append(f"{i + 1}. {val}")
        rows.append("+ Ajouter une étape")
        return rows

    def render(self, draw, state):
        self.set_items(self._labels(self.ctrl))
        super().render(draw, state)

    def _select(self, i):
        n = self.ctrl.state.get("numDropdowns", 0)
        if i >= n:  # dernière entrée = ajouter
            self.ctrl.send("addCategory")
        else:
            self.ctrl.push(CategoryPicker(self.ctrl, i))


class CategoryPicker(ListScreen):
    def __init__(self, ctrl, index):
        self.index = index
        items = [c if c else "(vide)" for c in CATEGORIES]
        super().__init__(ctrl, f"ÉTAPE {index + 1}", items, self._select)

    def _select(self, i):
        self.ctrl.send("setSelectedCategory", {"index": self.index, "category": CATEGORIES[i]})
        self.ctrl.pop()


class ScoresScreen(Screen):
    """3 comédiens : UP/DOWN sélectionne, LEFT = -10, RIGHT = +10. KEY3 retour."""

    def __init__(self, ctrl):
        super().__init__(ctrl)
        self.sel = 0

    def handle(self, event):
        if event == "up":
            self.sel = (self.sel - 1) % 3
        elif event == "down":
            self.sel = (self.sel + 1) % 3
        elif event == "left":
            self.ctrl.send("updateScore", {"actor": ACTOR_KEYS[self.sel], "value": -10})
        elif event == "right":
            self.ctrl.send("updateScore", {"actor": ACTOR_KEYS[self.sel], "value": 10})
        elif event == "key3":
            self.ctrl.pop()
        else:
            return False
        return True

    def render(self, draw, state):
        _center(draw, 6, "SCORES", F_MD, ACCENT)
        actors = state.get("actors", {})
        scores = state.get("scores", {})
        y = 44
        for i, k in enumerate(ACTOR_KEYS):
            selected = i == self.sel
            if selected:
                draw.rounded_rectangle((8, y, W - 8, y + 54), 6, fill=(30, 30, 30), outline=ACCENT, width=2)
            draw.text((18, y + 6), _truncate(draw, actors.get(k, ""), F_SM, 150), font=F_SM, fill=FG if selected else DIM)
            draw.text((18, y + 26), str(scores.get(k, 0)), font=F_MD, fill=FG)
            if selected:
                draw.text((W - 60, y + 14), "- +", font=F_MD, fill=ACCENT)
            y += 62


class NetworkScreen(Screen):
    def __init__(self, ctrl):
        super().__init__(ctrl)

    def handle(self, event):
        if event == "key3":
            self.ctrl.pop()
            return True
        return False

    def render(self, draw, state):
        _center(draw, 20, "RÉSEAU", F_MD, ACCENT)
        _center(draw, 70, "Régie WiFi :", F_SM, DIM)
        _center(draw, 100, self.ctrl.regie_url, F_MD)
        status = "serveur OK" if self.ctrl.is_connected() else "serveur…"
        _center(draw, 150, status, F_SM, ACCENT if self.ctrl.is_connected() else RED)
        _center(draw, 205, "KEY3 = retour", F_SM, DIM)


class ShowScreen(Screen):
    """Menu spectacle : NEXT (KEY1), timer, contrôles contextuels, STOP (KEY3)."""

    def __init__(self, ctrl):
        super().__init__(ctrl)
        self.score_sel = 0  # comédien sélectionné en phase Roue

    def _step(self, state):
        return state.get("currentStepName", "")

    def _is_hot_fires(self, state):
        return HOT_FIRES.lower() in self._step(state).lower()

    def _is_roue(self, state):
        return self._step(state) == "Roue"

    def handle(self, event):
        state = self.ctrl.state
        if event == "key1":
            self.ctrl.send("next")
        elif event == "key3":
            self.ctrl.send("toggleStart")  # STOP -> bascule auto sur Options
        elif self._is_roue(state) and event in ("up", "down"):
            self.score_sel = (self.score_sel + (1 if event == "down" else -1)) % 3
        elif self._is_roue(state) and event in ("left", "right"):
            self.ctrl.send("updateScore", {"actor": ACTOR_KEYS[self.score_sel], "value": 10 if event == "right" else -10})
        elif self._is_hot_fires(state) and event == "key2":
            self.ctrl.send("toggleLove")
        elif event == "key2":
            self.ctrl.send("setCurrentStepName", {"name": "show roue"})
        else:
            return False
        return True

    def render(self, draw, state):
        step = self._step(state)
        # timer
        cd = int(state.get("countdown", 0))
        timer = f"{cd // 60:02d}:{cd % 60:02d}"
        _center(draw, 8, timer, F_XL, ACCENT)
        # nom de l'étape
        _center(draw, 78, _truncate(draw, step or "—", F_MD, W - 16), F_MD)
        draw.line((10, 108, W - 10, 108), fill=(60, 60, 60))

        # zone contextuelle
        if self._is_roue(state):
            actors = state.get("actors", {})
            scores = state.get("scores", {})
            y = 116
            for i, k in enumerate(ACTOR_KEYS):
                selected = i == self.score_sel
                col = FG if selected else DIM
                marker = "> " if selected else "  "
                draw.text((14, y), marker + _truncate(draw, actors.get(k, ""), F_SM, 120), font=F_SM, fill=col)
                draw.text((W - 50, y), str(scores.get(k, 0)), font=F_SM, fill=col)
                y += 24
            _center(draw, 196, "< -10    +10 >", F_SM, ACCENT)
        elif self._is_hot_fires(state):
            running = state.get("isLoveRunning", False)
            _center(draw, 130, "Catégorie : Hot fires", F_SM, DIM)
            _center(draw, 165, "STOP LOVE" if running else "PLAY LOVE", F_MD, RED if running else ACCENT)
            _center(draw, 200, "KEY2 = LOVE", F_SM, DIM)
        else:
            _center(draw, 150, "KEY2 = ROUE", F_SM, DIM)

        # barre de boutons
        draw.text((12, 220), "KEY1: NEXT", font=F_SM, fill=ACCENT)
        _right(draw, 220, "STOP :KEY3", F_SM, RED)


# --------------------------------------------------------------------------
# Contrôleur : pile d'écrans + synchro run-state
# --------------------------------------------------------------------------
class MenuController:
    def __init__(self, state, send, regie_url="", is_connected=lambda: False):
        self.state = state
        self.send = send
        self.regie_url = regie_url
        self.is_connected = is_connected
        self.stack = [OptionsMenu(self)]
        self._was_running = False

    def top(self):
        return self.stack[-1]

    def push(self, screen):
        self.stack.append(screen)

    def pop(self):
        if len(self.stack) > 1:
            self.stack.pop()

    def reset_to(self, screen):
        self.stack = [screen]

    def handle(self, event):
        self.top().handle(event)

    def sync_run_state(self):
        """Bascule automatiquement entre Options et Spectacle selon isRunning
        (le show peut être lancé/arrêté depuis la Regie web ou le LCD)."""
        running = bool(self.state.get("isRunning", False))
        if running and not self._was_running:
            self.reset_to(ShowScreen(self))
        elif not running and self._was_running:
            self.reset_to(OptionsMenu(self))
        self._was_running = running

    def render(self):
        img = Image.new("RGB", (W, H), BG)
        draw = ImageDraw.Draw(img)
        self.top().render(draw, self.state)
        return img
