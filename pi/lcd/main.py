"""Contrôleur LCD Clash — point d'entrée.

Relie : miroir d'état <- client WS <- serveur Node, entrées joystick/boutons,
et rendu des menus sur l'écran ST7789 (ou mock headless).

Variables d'environnement :
  CLASH_WS_URL     URL WebSocket du serveur (défaut ws://localhost:3000)
  CLASH_REGIE_URL  URL affichée pour la Regie WiFi (défaut 192.168.4.1:3000/regie)
  CLASH_LCD_MOCK=1 force le backend mock (rend les frames en PNG)
  CLASH_LCD_FRAME  chemin du PNG en mode mock (défaut /tmp/clash_lcd.png)
"""

import os
import threading
import time

from hardware import create_backend
from menus import MenuController
from state import ShowState
from wsclient import WSClient

WS_URL = os.environ.get("CLASH_WS_URL", "ws://localhost:3000")
REGIE_URL = os.environ.get("CLASH_REGIE_URL", "192.168.4.1:3000/regie")
RENDER_TICK = 0.4  # rafraîchit au moins toutes les 0.4 s (timer)


def main():
    state = ShowState()
    dirty = threading.Event()
    dirty.set()

    ws = WSClient(WS_URL, state, on_change=dirty.set)
    ctrl = MenuController(
        state,
        send=ws.send,
        regie_url=REGIE_URL,
        is_connected=lambda: ws.connected,
    )

    def on_event(event):
        ctrl.handle(event)
        dirty.set()

    backend = create_backend(on_event)
    ws.start()

    try:
        while True:
            ctrl.sync_run_state()
            img = ctrl.render()
            backend.show(img)
            # attend un changement (input/WS) ou le tick timer
            dirty.wait(timeout=RENDER_TICK)
            dirty.clear()
    except KeyboardInterrupt:
        pass
    finally:
        ws.stop()


if __name__ == "__main__":
    main()
