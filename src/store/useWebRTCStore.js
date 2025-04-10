import { create } from 'zustand';

const useWebRTCStore = create((set) => ({
  peerConnection: null,
  dataChannel: null,
  remoteStream: null,
  isConnected: false,
  
  initializePeerConnection: () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    set({ peerConnection: pc });
    return pc;
  },
  
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setIsConnected: (status) => set({ isConnected: status }),
  setDataChannel: (channel) => set({ dataChannel: channel }),
  
  cleanup: () => {
    const state = useWebRTCStore.getState();
    if (state.peerConnection) {
      state.peerConnection.close();
    }
    if (state.dataChannel) {
      state.dataChannel.close();
    }
    set({ 
      peerConnection: null, 
      dataChannel: null, 
      remoteStream: null,
      isConnected: false 
    });
  }
}));

export default useWebRTCStore; 