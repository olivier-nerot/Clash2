"""État partagé du contrôleur LCD + données statiques (miroir du front)."""

import threading

# Miroir de src/setup/categories.js
CATEGORIES = [
    "",
    "Hot potatoe",
    "In the shit",
    "Again in the shit",
    "Again in the shit again",
    "Again in the shit again and again",
    "Again and again in the shit again and again",
    "We are all gonna die",
    "Super Heroes",
    "What Where Word",
    "Wolf Garou",
    "Old job / New Job",
    "Guilty",
    "You are talking to me ?",
    "Security check",
    "Teleshopping",
    "All the truth in my head",
    "Thanks god you are here",
    "Two lines vocabulary",
    "If you know what I mean",
    "Shit friday",
    "Who's the motherfucker",
    "What's in the bag",
    "Three monkeys",
    "Say my name",
    "Bachelor",
    "My arm is a tree",
    "Can you feel it",
    "You fucked me up",
    "You are not alone",
    "Touch me I'm famous",
    "SAV",
    "What the fuck with this shit ?",
    "Hot fires",
    "He says / She says",
    "Good Cop Bap Cop",
    "Monkeys",
    "Oops ! I did it again",
    "Fucking Resolution",
]

# Catégorie déclenchant le contrôle LOVE dans le menu spectacle
HOT_FIRES = "Hot fires"

ACTOR_KEYS = ["actor1", "actor2", "actor3"]


class ShowState:
    """Miroir thread-safe de l'état serveur, alimenté par le client WS."""

    def __init__(self):
        self._lock = threading.Lock()
        self._data = {
            "actors": {"actor1": "OLIVIER", "actor2": "NICOLAS", "actor3": "EDOUARD"},
            "scores": {"actor1": 0, "actor2": 0, "actor3": 0},
            "selectedCategories": {},
            "numDropdowns": 0,
            "currentStepName": "Generique",
            "countdown": 59 * 60 + 27,
            "isRunning": False,
            "nextStep": -1,
            "isLoveRunning": False,
            "clashN": 0,
            "volume": 1,
        }
        # incrémenté à chaque changement : la boucle de rendu redessine si besoin
        self.revision = 0

    def apply_snapshot(self, state):
        with self._lock:
            self._data.update(state)
            self.revision += 1

    def apply_patch(self, patch):
        with self._lock:
            self._data.update(patch)
            self.revision += 1

    def get(self, key, default=None):
        with self._lock:
            return self._data.get(key, default)

    def snapshot(self):
        with self._lock:
            return dict(self._data)
