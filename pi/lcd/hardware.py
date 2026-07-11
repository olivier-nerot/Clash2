"""Abstraction matérielle du HAT Waveshare 1.3" (ST7789 240x240 + joystick + 3 boutons).

Deux backends, auto-détectés :
- RealBackend  : sur le Pi (paquets `st7789` + `gpiozero`).
- MockBackend  : ailleurs (rend les frames en PNG, lit le clavier) pour tester
                 la logique des menus sans matériel.

Événements normalisés : up, down, left, right, press, key1, key2, key3.
"""

import os
import sys
import threading

WIDTH = 240
HEIGHT = 240

# Brochage BCM du HAT Waveshare 1.3inch LCD (à confirmer selon la révision).
PIN_DC = 25
PIN_RST = 27
PIN_BL = 24
PIN_CS = 8  # CE0
BUTTONS = {
    "up": 6,
    "down": 19,
    "left": 5,
    "right": 26,
    "press": 13,
    "key1": 21,
    "key2": 20,
    "key3": 16,
}


# --------------------------------------------------------------------------
# Backend réel (Raspberry Pi)
# --------------------------------------------------------------------------
class RealBackend:
    def __init__(self, on_event):
        import st7789  # type: ignore
        from gpiozero import Button  # type: ignore

        self._disp = st7789.ST7789(
            port=0,
            cs=0,  # CE0 / GPIO8
            dc=PIN_DC,
            backlight=PIN_BL,
            rst=PIN_RST,
            width=WIDTH,
            height=HEIGHT,
            rotation=0,
            spi_speed_hz=40_000_000,
        )
        self._disp.begin()

        self._buttons = []
        for name, pin in BUTTONS.items():
            btn = Button(pin, pull_up=True, bounce_time=0.05)
            btn.when_pressed = (lambda n=name: on_event(n))
            self._buttons.append(btn)

    def show(self, image):
        self._disp.display(image)


# --------------------------------------------------------------------------
# Backend mock (dev headless)
# --------------------------------------------------------------------------
class MockBackend:
    """Rend les frames en PNG et (si TTY) lit le clavier.

    Mapping clavier : w/s/a/d = up/down/left/right, espace = press,
    1/2/3 = key1/key2/key3, q = quitter.
    """

    KEYMAP = {
        "w": "up",
        "s": "down",
        "a": "left",
        "d": "right",
        " ": "press",
        "\r": "press",
        "\n": "press",
        "1": "key1",
        "2": "key2",
        "3": "key3",
    }

    def __init__(self, on_event):
        self._on_event = on_event
        self._frame_path = os.environ.get("CLASH_LCD_FRAME", "/tmp/clash_lcd.png")
        print(f"[hardware] MockBackend — frames -> {self._frame_path}")
        if sys.stdin.isatty():
            t = threading.Thread(target=self._read_keys, daemon=True)
            t.start()

    def show(self, image):
        try:
            image.save(self._frame_path)
        except Exception as e:  # pragma: no cover
            print("[hardware] save frame:", e)

    # Permet aux tests d'injecter des événements sans clavier.
    def feed(self, event):
        self._on_event(event)

    def _read_keys(self):  # pragma: no cover - interactif
        import termios
        import tty

        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            while True:
                ch = sys.stdin.read(1)
                if ch == "q":
                    os._exit(0)
                event = self.KEYMAP.get(ch)
                if event:
                    self._on_event(event)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)


def create_backend(on_event):
    """Retourne le backend approprié. Force le mock via CLASH_LCD_MOCK=1."""
    if os.environ.get("CLASH_LCD_MOCK") == "1":
        return MockBackend(on_event)
    try:
        return RealBackend(on_event)
    except Exception as e:
        print(f"[hardware] backend réel indisponible ({e}) -> mock")
        return MockBackend(on_event)
