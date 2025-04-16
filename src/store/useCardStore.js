import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

const useCardStore = create(
  subscribeWithSelector(
    persist(
      (set) => ({
        allCardsVisible: false,
        setAllCardsVisible: (visible) => set({ allCardsVisible: visible }),
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
        invited: {
          actor1: false,
          actor2: false,
          actor3: false
        },
        cardVisible: {
          actor1: false,
          actor2: false,
          actor3: false
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
        setInvited: (actor, value) => set((state) => ({
          invited: {
            ...state.invited,
            [actor]: value
          }
        })),
        updateScore: (actor, value) => set((state) => ({
          scores: {
            ...state.scores,
            [actor]: state.scores[actor] + value
          }
        })),
        // selectedActor: 'toto',
        setCardVisible: (actor, value) => set((state) => ({
          cardVisible: {
            ...state.cardVisible,
            [actor]: value
          }
        })),
      }),
      {
        name: 'card-storage',
        onRehydrateStorage: () => (state) => {
          if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
              if (e.key === 'card-storage') {
                const newState = JSON.parse(e.newValue);
                useCardStore.setState({
                  ...newState.state,
                  scores: newState.state.scores,
                  selectedCategories: newState.state.selectedCategories,
                  currentStepName: newState.state.currentStepName,
                  selectedActor: newState.state.selectedActor || 'toto'
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
  useCardStore.subscribe(
    (state) => state.selectedActor,
    (selectedActor) => {
      useCardStore.setState({ selectedActor });
    }
  );
}

export default useCardStore; 