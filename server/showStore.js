// État autoritatif du show + machine à états (séquenceur).
// Porté depuis src/pages/Regie.js et src/store/useCardStore.js.
// Point unique de vérité : les clients (Show HDMI, Regie WiFi, LCD Python)
// envoient des commandes, le store applique et diffuse des patches.

const INITIAL_COUNTDOWN = 59 * 60 + 27;

const createInitialState = () => ({
	numDropdowns: 0,
	viewWebcam: false,
	countdown: INITIAL_COUNTDOWN,
	volume: 1,
	clashN: 0,
	actors: { actor1: "OLIVIER", actor2: "NICOLAS", actor3: "EDOUARD" },
	scores: { actor1: 0, actor2: 0, actor3: 0 },
	invited: { actor1: false, actor2: false, actor3: false },
	cardVisible: { actor1: true, actor2: true, actor3: true },
	catChecked: { actor1: false, actor2: false, actor3: false },
	selectedCategories: {},
	currentStepName: "Generique",
	// séquenceur (auparavant état local de Regie.js)
	isRunning: false,
	nextStep: -1,
	isLoveRunning: false,
});

/**
 * Crée le store serveur.
 * @param {(patch: object) => void} onChange  diffuse un patch (clés top-level) à tous les clients
 * @param {object} [persisted]  état restauré depuis le disque
 */
function createShowStore(onChange, persisted) {
	let state = { ...createInitialState(), ...(persisted || {}) };
	// Au démarrage, on ne restaure jamais un timer en cours : on repart propre.
	let countdownTimer = null;
	const pendingTimeouts = new Set();

	// Applique un patch (merge top-level) et diffuse.
	const set = (patch) => {
		state = { ...state, ...patch };
		onChange(patch);
	};

	const clearPendingTimeouts = () => {
		for (const t of pendingTimeouts) clearTimeout(t);
		pendingTimeouts.clear();
	};

	// setTimeout traqué (annulable sur stop/reset).
	const later = (fn, ms) => {
		const t = setTimeout(() => {
			pendingTimeouts.delete(t);
			fn();
		}, ms);
		pendingTimeouts.add(t);
	};

	const stopCountdown = () => {
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
	};

	const startCountdown = () => {
		stopCountdown();
		countdownTimer = setInterval(() => {
			const next = state.countdown > 0 ? state.countdown - 1 : 0;
			set({ countdown: next });
			if (next === 0) {
				// Fin du temps (Regie.js:134-142)
				stopCountdown();
				set({
					nextStep: state.numDropdowns * 3,
					currentStepName: "Alarm",
				});
			}
		}, 1000);
	};

	// --- Reducers simples (portés du store Zustand) ---
	const reducers = {
		addCategory: () => set({ numDropdowns: state.numDropdowns + 1 }),
		toggleViewWebcam: () => set({ viewWebcam: !state.viewWebcam }),
		setCountdown: ({ n }) => set({ countdown: n }),
		setVolume: ({ volume }) => set({ volume }),
		setClashN: ({ n }) => set({ clashN: n }),
		incClashN: () => set({ clashN: state.clashN + 1 }),
		setActor: ({ actor, value }) =>
			set({ actors: { ...state.actors, [actor]: value } }),
		updateScore: ({ actor, value }) =>
			set({ scores: { ...state.scores, [actor]: state.scores[actor] + value } }),
		setInvited: ({ actor, value }) =>
			set({ invited: { ...state.invited, [actor]: value } }),
		setCardVisible: ({ actor, value }) =>
			set({ cardVisible: { ...state.cardVisible, [actor]: value } }),
		setCatChecked: ({ actor, checked }) =>
			set({ catChecked: { ...state.catChecked, [actor]: checked } }),
		setSelectedCategory: ({ index, category }) =>
			set({
				selectedCategories: { ...state.selectedCategories, [index]: category },
			}),
		setCurrentStepName: ({ name }) => set({ currentStepName: name }),

		// Bascule échelonnée des 3 cartes (Regie.js:45-58)
		toggleAllCards: () => {
			for (const num of [1, 2, 3]) {
				const actor = `actor${num}`;
				later(
					() => set({ cardVisible: { ...state.cardVisible, [actor]: !state.cardVisible[actor] } }),
					Math.floor(Math.random() * 2000),
				);
			}
		},

		// PLAY/STOP LOVE (Regie.js:1029-1034)
		toggleLove: () => {
			const running = !state.isLoveRunning;
			set({
				isLoveRunning: running,
				currentStepName: running ? "play love" : "stop love",
			});
		},
	};

	// --- Séquenceur (porté de startClash / handleNextCategory) ---

	// START/STOP (Regie.js:108-131)
	const toggleStart = () => {
		if (state.isRunning) {
			// stop
			clearPendingTimeouts();
			stopCountdown();
			set({
				nextStep: -1,
				countdown: INITIAL_COUNTDOWN,
				currentStepName: "stop",
				isRunning: false,
			});
		} else {
			// start
			clearPendingTimeouts();
			set({
				scores: { actor1: 0, actor2: 0, actor3: 0 },
				clashN: 1,
				nextStep: 0,
				countdown: INITIAL_COUNTDOWN,
				currentStepName: "Generique",
				isRunning: true,
			});
		}
	};

	// NEXT (Regie.js:60-106)
	const next = () => {
		set({ volume: 1 });
		set({ cardVisible: { actor1: false, actor2: false, actor3: false } });

		const index = state.nextStep;

		if (index === state.numDropdowns * 3 + 2) {
			set({ clashN: 0, isRunning: false });
			return;
		}

		const nextIndex = index + 1;
		let currentStepName = state.currentStepName;

		if (nextIndex === 0) {
			currentStepName = "Generique";
		} else if (nextIndex === state.numDropdowns * 3 + 1) {
			currentStepName = "Clash public";
		} else if (nextIndex === state.numDropdowns * 3 + 2) {
			currentStepName = "Generique FIN";
		} else if (nextIndex % 3 === 1) {
			currentStepName = `Category : ${state.selectedCategories[Math.floor(nextIndex / 3)]}`;
		} else if (nextIndex % 3 === 2) {
			currentStepName = "Applaudimetre";
			// chorégraphie des cartes (Regie.js:88-93)
			later(() => set({ cardVisible: { ...state.cardVisible, actor3: true } }), 3000);
			later(() => set({ cardVisible: { ...state.cardVisible, actor3: false } }), 9000);
			later(() => set({ cardVisible: { ...state.cardVisible, actor2: true } }), 8000);
			later(() => set({ cardVisible: { ...state.cardVisible, actor2: false } }), 15000);
			later(() => set({ cardVisible: { ...state.cardVisible, actor1: true } }), 14000);
			later(() => set({ cardVisible: { ...state.cardVisible, actor1: false } }), 19000);
		} else if (nextIndex % 3 === 0) {
			currentStepName = "Roue";
		}

		if (nextIndex === 1) {
			startCountdown();
		}

		set({ currentStepName, nextStep: nextIndex });
	};

	// Table de dispatch des commandes.
	const commands = {
		...reducers,
		toggleStart,
		next,
	};

	return {
		getState: () => state,
		hasCommand: (name) => typeof commands[name] === "function",
		dispatch: (name, args) => {
			const cmd = commands[name];
			if (typeof cmd === "function") cmd(args || {});
		},
		dispose: () => {
			stopCountdown();
			clearPendingTimeouts();
		},
	};
}

module.exports = { createShowStore, createInitialState, INITIAL_COUNTDOWN };
