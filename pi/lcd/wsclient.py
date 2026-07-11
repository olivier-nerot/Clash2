"""Client WebSocket vers le serveur Node (même protocole que la Regie web).

Reçoit snapshot/patch -> met à jour le ShowState.
Envoie des commandes {type:'command', name, args}.
Reconnexion automatique (le serveur peut ne pas être prêt au boot).
"""

import json
import threading
import time

try:
    import websocket  # paquet "websocket-client"
except ImportError:  # pragma: no cover - dépendance présente sur le Pi
    websocket = None


class WSClient:
    def __init__(self, url, state, on_change=None):
        self.url = url
        self.state = state
        self.on_change = on_change  # callback () appelé après snapshot/patch
        self._ws = None
        self._lock = threading.Lock()
        self._stop = False

    # --- API publique ---
    def start(self):
        t = threading.Thread(target=self._run_forever, daemon=True)
        t.start()

    def stop(self):
        self._stop = True
        with self._lock:
            if self._ws:
                try:
                    self._ws.close()
                except Exception:
                    pass

    def send(self, name, args=None):
        msg = json.dumps({"type": "command", "name": name, "args": args or {}})
        with self._lock:
            ws = self._ws
        if ws is not None:
            try:
                ws.send(msg)
            except Exception:
                pass  # perdu si déconnecté ; l'état revient au prochain snapshot

    @property
    def connected(self):
        with self._lock:
            return self._ws is not None

    # --- Interne ---
    def _run_forever(self):
        if websocket is None:
            print("[wsclient] paquet websocket-client manquant")
            return
        while not self._stop:
            try:
                app = websocket.WebSocketApp(
                    self.url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_close=self._on_close,
                    on_error=self._on_error,
                )
                app.run_forever(ping_interval=20, ping_timeout=10)
            except Exception as e:
                print("[wsclient] erreur:", e)
            if not self._stop:
                time.sleep(1)  # backoff avant reconnexion

    def _on_open(self, ws):
        with self._lock:
            self._ws = ws
        print("[wsclient] connecté")

    def _on_close(self, ws, *args):
        with self._lock:
            self._ws = None
        print("[wsclient] déconnecté")

    def _on_error(self, ws, error):
        print("[wsclient] on_error:", error)

    def _on_message(self, ws, raw):
        try:
            msg = json.loads(raw)
        except Exception:
            return
        if msg.get("type") == "snapshot":
            self.state.apply_snapshot(msg.get("state", {}))
        elif msg.get("type") == "patch":
            self.state.apply_patch(msg.get("patch", {}))
        else:
            return
        if self.on_change:
            self.on_change()
