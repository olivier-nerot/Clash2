const express = require("express");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const { WebSocketServer } = require("ws");
const { createShowStore } = require("./server/showStore");

const app = express();
const port = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, "server", "state.json");

// --- Persistance disque (résilience reboot) ---
function loadPersisted() {
	try {
		const raw = fs.readFileSync(STATE_FILE, "utf8");
		const data = JSON.parse(raw);
		// On ne restaure jamais un séquenceur "en cours" : pas de timer actif au boot.
		// Au démarrage, on affiche toujours l'écran d'accueil (pas l'étape résiduelle).
		return { ...data, isRunning: false, nextStep: -1, currentStepName: "welcome" };
	} catch {
		return undefined;
	}
}

let saveTimer = null;
function schedulePersist(getState) {
	if (saveTimer) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		fs.writeFile(STATE_FILE, JSON.stringify(getState()), (err) => {
			if (err) console.error("Persist error:", err.message);
		});
	}, 500);
}

// --- Serveur HTTP + WebSocket ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const broadcast = (message) => {
	const data = JSON.stringify(message);
	for (const client of wss.clients) {
		if (client.readyState === 1) client.send(data);
	}
};

const store = createShowStore((patch) => {
	broadcast({ type: "patch", patch });
	schedulePersist(store.getState);
}, loadPersisted());

wss.on("connection", (ws) => {
	// Snapshot complet à la connexion.
	ws.send(JSON.stringify({ type: "snapshot", state: store.getState() }));

	ws.on("message", (raw) => {
		let msg;
		try {
			msg = JSON.parse(raw.toString());
		} catch {
			return;
		}
		if (msg && msg.type === "command" && store.hasCommand(msg.name)) {
			store.dispatch(msg.name, msg.args);
		}
	});
});

// --- Fichiers statiques du build React ---
app.use(express.static(path.join(__dirname, "build")));
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "build", "index.html"));
});

server.listen(port, () => {
	console.log(`Clash server (HTTP + WS) running on port ${port}`);
});
