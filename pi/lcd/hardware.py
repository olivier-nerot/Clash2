"""Abstraction matérielle du HAT Waveshare 1.3" (ST7789 240x240 + joystick + 3 boutons).

Deux backends, auto-détectés :
- RealBackend  : sur le Pi, pilotage direct ST7789 via `spidev` + `lgpio`.
                 (La lib PyPI `st7789` a un contrôle GPIO cassé sur Pi3/Trixie —
                 backlight et DC/RST non pilotés — d'où un driver maison ici.)
- MockBackend  : ailleurs (rend les frames en PNG, lit le clavier) pour tester
                 la logique des menus sans matériel.

Événements normalisés : up, down, left, right, press, key1, key2, key3.
"""

import os
import sys
import threading
import time

WIDTH = 240
HEIGHT = 240

# Brochage BCM du HAT Waveshare 1.3inch LCD.
PIN_DC = 25
PIN_RST = 27
PIN_BL = 24
SPI_BUS = 0
SPI_DEV = 0  # CE0 / GPIO8
SPI_HZ = 32_000_000
GPIOCHIP = 0
# Rotation de l'affichage (degrés horaires) : 0, 90, 180 ou 270.
DISPLAY_ROTATE_CW = 90
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
# Backend réel (Raspberry Pi) — driver ST7789 direct spidev + lgpio
# --------------------------------------------------------------------------
class RealBackend:
    def __init__(self, on_event):
        import lgpio
        import numpy as np
        import spidev

        self._lgpio = lgpio
        self._np = np
        self._h = lgpio.gpiochip_open(GPIOCHIP)
        for pin in (PIN_DC, PIN_RST, PIN_BL):
            lgpio.gpio_claim_output(self._h, pin, 0)
        lgpio.gpio_write(self._h, PIN_BL, 1)  # rétroéclairage ON

        self._spi = spidev.SpiDev()
        self._spi.open(SPI_BUS, SPI_DEV)
        self._spi.mode = 0
        self._spi.max_speed_hz = SPI_HZ

        self._init_display()

        # Boutons : lgpio en interruption (front descendant), pull-up interne.
        self._cbs = []
        for name, pin in BUTTONS.items():
            lgpio.gpio_claim_alert(self._h, pin, lgpio.FALLING_EDGE, lgpio.SET_PULL_UP)
            lgpio.gpio_set_debounce_micros(self._h, pin, 30_000)
            cb = lgpio.callback(
                self._h, pin, lgpio.FALLING_EDGE,
                (lambda chip, gpio, level, tick, n=name: on_event(n)),
            )
            self._cbs.append(cb)

    # --- SPI bas niveau ---
    def _cmd(self, c):
        self._lgpio.gpio_write(self._h, PIN_DC, 0)
        self._spi.writebytes([c])

    def _data(self, vals):
        self._lgpio.gpio_write(self._h, PIN_DC, 1)
        if isinstance(vals, int):
            vals = [vals]
        self._spi.writebytes2(bytes(vals))

    def _init_display(self):
        lg, h = self._lgpio, self._h
        lg.gpio_write(h, PIN_RST, 1); time.sleep(0.05)
        lg.gpio_write(h, PIN_RST, 0); time.sleep(0.05)
        lg.gpio_write(h, PIN_RST, 1); time.sleep(0.15)
        self._cmd(0x11); time.sleep(0.12)  # SLPOUT
        self._cmd(0x3A); self._data(0x55)  # COLMOD 16 bits
        self._cmd(0x36); self._data(0x00)  # MADCTL
        self._cmd(0x21)                    # INVON (ST7789)
        self._cmd(0x13)                    # NORON
        self._cmd(0x29); time.sleep(0.05)  # DISPON

    def show(self, image):
        np = self._np
        from PIL import Image as _Image
        _ROT = {
            90: _Image.ROTATE_270,   # 90° horaire
            180: _Image.ROTATE_180,
            270: _Image.ROTATE_90,
        }
        if DISPLAY_ROTATE_CW in _ROT:
            image = image.transpose(_ROT[DISPLAY_ROTATE_CW])
        if image.size != (WIDTH, HEIGHT):
            image = image.resize((WIDTH, HEIGHT))
        arr = np.asarray(image.convert("RGB"), dtype=np.uint16)
        r = arr[:, :, 0] >> 3
        g = arr[:, :, 1] >> 2
        b = arr[:, :, 2] >> 3
        buf = (((r << 11) | (g << 5) | b).byteswap()).tobytes()  # RGB565 big-endian
        self._cmd(0x2A); self._data([0, 0, 0, WIDTH - 1])   # CASET
        self._cmd(0x2B); self._data([0, 0, 0, HEIGHT - 1])  # RASET
        self._cmd(0x2C)                                      # RAMWR
        self._lgpio.gpio_write(self._h, PIN_DC, 1)
        for i in range(0, len(buf), 4096):
            self._spi.writebytes2(buf[i:i + 4096])


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
