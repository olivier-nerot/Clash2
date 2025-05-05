import { create } from "zustand";
import { persist } from "zustand/middleware";

const useCardStore = create(
	//subscribeWithSelector(
	persist(
		(set) => ({
			numDropdowns: 0,
			addCategory: () =>
				set((state) => ({ numDropdowns: state.numDropdowns + 1 })),
			viewWebcam: false,
			toggleViewWebcam: () =>
				set((state) => ({ viewWebcam: !state.viewWebcam })),
			countdown: 59 * 60 + 27,
			setCountdown: (n) => set({ countdown: n }),
			decCountdown: () =>
				set((state) => ({
					countdown: state.countdown > 0 ? state.countdown - 1 : 0,
				})),
			volume: 1,
			setVolume: (volume) => set({ volume }),
			clashN: 0,
			setClashN: (n) => set({ clashN: n }),
			incClashN: () => set((state) => ({ clashN: state.clashN + 1 })),
			actors: {
				actor1: "OLIVIER",
				actor2: "NICOLAS",
				actor3: "EDOUARD",
			},
			setActor: (actor, value) =>
				set((state) => ({
					actors: {
						...state.actors,
						[actor]: value,
					},
				})),
			scores: {
				actor1: 0,
				actor2: 0,
				actor3: 0,
			},
			updateScore: (actor, value) =>
				set((state) => ({
					scores: {
						...state.scores,
						[actor]: state.scores[actor] + value,
					},
				})),
			invited: {
				actor1: false,
				actor2: false,
				actor3: false,
			},
			setInvited: (actor, value) =>
				set((state) => ({
					invited: {
						...state.invited,
						[actor]: value,
					},
				})),
			cardVisible: {
				actor1: true,
				actor2: true,
				actor3: true,
			},
			setCardVisible: (actor, value) =>
				set((state) => {
					console.log("cardVisible:", {
						...state.cardVisible,
						[actor]: value,
					});
					return {
						cardVisible: {
							...state.cardVisible,
							[actor]: value,
						},
					};
				}),
			catChecked: {
				actor1: false,
				actor2: false,
				actor3: false,
			},
			setCatChecked: (actor, checked) =>
				set((state) => ({
					catChecked: {
						...state.catChecked,
						[actor]: checked,
					},
				})),
			selectedCategories: {},
			setSelectedCategory: (index, category) =>
				set((state) => ({
					selectedCategories: {
						...state.selectedCategories,
						[index]: category,
					},
				})),
			currentStepName: "Generique",
			setCurrentStepName: (name) => set({ currentStepName: name }),
		}),
		{
			name: "clash",
			onRehydrateStorage: () => (state) => {
				if (typeof window !== "undefined") {
					window.addEventListener("storage", (e) => {
						if (e.key === "clash") {
							if (!e.newValue) return;
							const newState = JSON.parse(e.newValue);
							useCardStore.setState({
								...newState.state,
								// scores: newState.state.scores,
								// selectedCategories: newState.state.selectedCategories,
							});
						}
					});
				}
			},
		},
	),
	// )
);

export default useCardStore;
