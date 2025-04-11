import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

const useCardStore = create(
  subscribeWithSelector(
    persist(
      (set) => ({
        allCardsVisible: false,
        viewWebcam: false,
        volume: 1,
        toggleAllCards: () => set((state) => ({ allCardsVisible: !state.allCardsVisible })),
        toggleViewWebcam: () => set((state) => ({ viewWebcam: !state.viewWebcam })),
        setVolume: (volume) => set({ volume }),
        actors: {
          actor1: 'OLIVIER',
          actor2: 'NICOLAS',
          actor3: 'EDOUARD'
        },
        scores: {
          actor1: 0,
          actor2: 0,
          actor3: 0
        },
        selectedCategories: {},
        setSelectedCategory: (index, category) => set((state) => ({
          selectedCategories: {
            ...state.selectedCategories,
            [index]: category
          }
        })),
        currentStepName: 'Generique',
        setCurrentStepName: (name) => set({ currentStepName: name }),
        setActor: (actor, value) => set((state) => ({
          actors: {
            ...state.actors,
            [actor]: value
          }
        })),
        updateScore: (actor, value) => set((state) => ({
          scores: {
            ...state.scores,
            [actor]: state.scores[actor] + value
          }
        })),
        selectActor: (actor) => set((state) => ({
          selectedActor: actor
        }))
      }),
      {
        name: 'card-storage',
        onRehydrateStorage: () => {
          if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
              if (e.key === 'card-storage') {
                const newState = JSON.parse(e.newValue);
                useCardStore.setState({
                  allCardsVisible: newState.state.allCardsVisible,
                  viewWebcam: newState.state.viewWebcam,
                  volume: newState.state.volume,
                  actors: newState.state.actors,
                  scores: newState.state.scores,
                  selectedCategories: newState.state.selectedCategories,
                  currentStepName: newState.state.currentStepName
                });
              }
            });
          }
        },
      }
    )
  )
);

// Subscribe to store changes
if (typeof window !== 'undefined') {
  useCardStore.subscribe(
    (state) => state.actors,
    (actors) => {
      // Force update all components using the store
      useCardStore.setState({ actors });
    }
  );
  useCardStore.subscribe(
    (state) => state.scores,
    (scores) => {
      useCardStore.setState({ scores });
    }
  );
  useCardStore.subscribe(
    (state) => state.selectedCategories,
    (selectedCategories) => {
      useCardStore.setState({ selectedCategories });
    }
  );
  useCardStore.subscribe(
    (state) => state.currentStepName,
    (currentStepName) => {
      useCardStore.setState({ currentStepName });
    }
  );
}

export default useCardStore; 