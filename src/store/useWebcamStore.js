import { create } from 'zustand';

const useWebcamStore = create((set) => ({
  webcamStream: null,
  setWebcamStream: (stream) => {
    console.log('Setting webcam stream in store:', stream);
    set({ webcamStream: stream });
  },
}));

export default useWebcamStore; 