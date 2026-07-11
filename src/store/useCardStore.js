import { create } from "zustand";

// Transport temps réel : le store client est un miroir de l'état serveur.
// Les actions n'écrivent plus localement — elles envoient une commande au
// serveur, qui applique et diffuse un patch reçu ici. Flux unidirectionnel :
// action -> WS command -> serveur -> broadcast snapshot/patch -> setState.

// Par défaut : même hôte:port que la page (le serveur Express sert HTTP + WS
// sur le même port). Surchargeable via REACT_APP_WS_URL (ex. en dev CRA).
const WS_URL =
	process.env.REACT_APP_WS_URL ||
	`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

let socket = null;
let queue = [];
let reconnectTimer = null;

function connect(onMessage) {
	if (typeof window === "undefined") return;
	socket = new WebSocket(WS_URL);

	socket.onopen = () => {
		for (const m of queue) socket.send(m);
		queue = [];
	};
	socket.onmessage = (e) => {
		try {
			onMessage(JSON.parse(e.data));
		} catch {
			/* message ignoré */
		}
	};
	socket.onclose = () => {
		socket = null;
		if (!reconnectTimer) {
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				connect(onMessage);
			}, 1000);
		}
	};
	socket.onerror = () => {
		try {
			socket.close();
		} catch {
			/* ignore */
		}
	};
}

function send(name, args) {
	const msg = JSON.stringify({ type: "command", name, args });
	if (socket && socket.readyState === 1) socket.send(msg);
	else queue.push(msg);
}

const useCardStore = create(() => ({
	// --- État miroir (défauts avant réception du snapshot) ---
	numDropdowns: 0,
	viewWebcam: false,
	countdown: 59 * 60 + 27,
	volume: 1,
	clashN: 0,
	actors: { actor1: "OLIVIER", actor2: "NICOLAS", actor3: "EDOUARD" },
	scores: { actor1: 0, actor2: 0, actor3: 0 },
	invited: { actor1: false, actor2: false, actor3: false },
	cardVisible: { actor1: true, actor2: true, actor3: true },
	catChecked: { actor1: false, actor2: false, actor3: false },
	selectedCategories: {},
	currentStepName: "Generique",
	isRunning: false,
	nextStep: -1,
	isLoveRunning: false,

	// --- Actions -> commandes serveur ---
	addCategory: () => send("addCategory"),
	toggleViewWebcam: () => send("toggleViewWebcam"),
	setCountdown: (n) => send("setCountdown", { n }),
	setVolume: (volume) => send("setVolume", { volume }),
	setClashN: (n) => send("setClashN", { n }),
	incClashN: () => send("incClashN"),
	setActor: (actor, value) => send("setActor", { actor, value }),
	updateScore: (actor, value) => send("updateScore", { actor, value }),
	setInvited: (actor, value) => send("setInvited", { actor, value }),
	setCardVisible: (actor, value) => send("setCardVisible", { actor, value }),
	setCatChecked: (actor, checked) => send("setCatChecked", { actor, checked }),
	setSelectedCategory: (index, category) =>
		send("setSelectedCategory", { index, category }),
	setCurrentStepName: (name) => send("setCurrentStepName", { name }),

	// Séquenceur (auparavant logique locale de Regie.js) + effets
	toggleStart: () => send("toggleStart"),
	next: () => send("next"),
	toggleLove: () => send("toggleLove"),
	toggleAllCards: () => send("toggleAllCards"),
}));

// Applique les messages serveur au miroir local.
connect((msg) => {
	if (msg.type === "snapshot") {
		useCardStore.setState(msg.state);
	} else if (msg.type === "patch") {
		useCardStore.setState(msg.patch);
	}
});

export default useCardStore;
