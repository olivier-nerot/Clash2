import React, { useEffect, useState, useRef } from 'react';
import useCardStore from '../store/useCardStore';
import '../styles/animations.css';

const Show = () => {
  const { actors, scores, currentStepName } = useCardStore();
  const [isVisible, setIsVisible] = useState(false);
  const [bgVideo, setBgVideo] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const wsRef = useRef(null);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = useCardStore.subscribe(
      (state) => state.allCardsVisible,
      (newState) => {
        setIsVisible(newState);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = useCardStore.subscribe(
      (state) => state.currentStepName,
      (newState) => {
        console.log('Step changed to:', newState);
        if (newState === 'Applaudimetre') {
          setBgVideo('/assets/movies/Applaudimetre1.mp4');
        } else if (newState === 'Generique') {
          setBgVideo('/assets/movies/01-Intro Clash.mp4');
        } else if (newState === 'Generique FIN') {
          setBgVideo('/assets/movies/05-finclash.mp4');
        } else if (newState === 'Roue') {
          setBgVideo('/assets/movies/Roue 20.mp4');
        } else if (newState === 'Category') {
          setBgVideo('/assets/movies/02-Annonce categorie.MP4');
        } else {
          setBgVideo('');
        }
        setVideoError(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Set volume to maximum when video changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 1.0;
      videoRef.current.load(); // Force reload the video
      videoRef.current.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }, [bgVideo]);

  useEffect(() => {
    let pc = null;
    let ws = null;

    const setupWebRTC = async () => {
      try {
        // Get the current host's IP address
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        const wsPort = '8080'; // Your WebSocket server port
        const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
        
        console.log('Connecting to WebSocket at:', wsUrl);
        
        // Connect to signaling server
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to signaling server');
          setConnectionStatus('connecting');
          // Register as the answerer
          ws.send(JSON.stringify({
            type: 'register',
            clientId: 'show'
          }));
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed');
          setConnectionStatus('disconnected');
        };

        ws.onmessage = async (event) => {
          console.log('Received message:', event.data);
          const message = JSON.parse(event.data);
          if (message.type === 'signal') {
            const data = message.data;
            if (data.type === 'offer') {
              console.log('Received offer');
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log('Sending answer');
              ws.send(JSON.stringify({
                type: 'signal',
                targetId: 'regie',
                data: {
                  type: 'answer',
                  sdp: pc.localDescription
                }
              }));
            } else if (data.type === 'ice-candidate') {
              console.log('Received ICE candidate');
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          }
        };

        // Initialize WebRTC connection
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        });

        // Handle incoming tracks
        pc.ontrack = (event) => {
          console.log('Received track:', event.track.kind);
          if (event.track.kind === 'video') {
            console.log('Video track received, setting up video element');
            if (videoRef.current) {
              // Clear any existing srcObject first
              videoRef.current.srcObject = null;
              // Set the new stream
              videoRef.current.srcObject = event.streams[0];
              
              // Wait for metadata to load before attempting to play
              const playVideo = async () => {
                try {
                  console.log('Attempting to play video');
                  await videoRef.current.play();
                  console.log('Video playing successfully');
                } catch (error) {
                  console.error('Error playing video:', error);
                  // If the error is due to user interaction requirement, try again
                  if (error.name === 'NotAllowedError') {
                    console.log('Waiting for user interaction to play video');
                    // Add a click handler to play when user interacts
                    const playOnInteraction = () => {
                      videoRef.current.play()
                        .then(() => {
                          console.log('Video started after user interaction');
                          document.removeEventListener('click', playOnInteraction);
                        })
                        .catch(err => console.error('Error playing after interaction:', err));
                    };
                    document.addEventListener('click', playOnInteraction);
                  }
                }
              };

              // Only set up the loadedmetadata handler once
              if (!videoRef.current.onloadedmetadata) {
                videoRef.current.onloadedmetadata = () => {
                  console.log('Video metadata loaded');
                  playVideo();
                };
              } else {
                // If metadata is already loaded, try to play immediately
                playVideo();
              }
            }
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Sending ICE candidate');
            ws.send(JSON.stringify({
              type: 'signal',
              targetId: 'regie',
              data: {
                type: 'ice-candidate',
                candidate: event.candidate
              }
            }));
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('Connection state changed:', pc.connectionState);
          setConnectionStatus(pc.connectionState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state changed:', pc.iceConnectionState);
        };

        peerConnectionRef.current = pc;

        return () => {
          if (pc) {
            pc.close();
          }
          if (ws) {
            ws.close();
          }
        };
      } catch (error) {
        console.error('Error setting up WebRTC:', error);
        setConnectionStatus('error');
      }
    };

    setupWebRTC();
  }, []);

  // Canvas effect rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const video = videoRef.current;

    if (!canvas || !ctx || !video) return;

    const drawFrame = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Apply effects
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Example effect: Invert colors
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];     // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef.current, canvasRef.current]);

  const handleVideoError = () => {
    console.error('Error loading video:', bgVideo);
    setVideoError(true);
  };

  return (
    <div style={{ 
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'Verdana',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {bgVideo && !videoError && (
        <video
          key={bgVideo}
          autoPlay
          playsInline
          onError={handleVideoError}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            minWidth: '100%',
            minHeight: '100%',
            width: 'auto',
            height: 'auto',
            transform: 'translate(-50%, -50%)',
            zIndex: 0
          }}
        >
          <source src={bgVideo} type="video/mp4" />
        </video>
      )}
      
      {/* Webcam stream with canvas effects */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '320px',
        height: '240px',
        zIndex: 2
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ 
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            border: '2px solid #4CAF50',
            boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
            backgroundColor: '#000'
          }}
        />
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '5px 10px',
          backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : '#f44336',
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {connectionStatus}
        </div>
      </div>

      <div style={{ 
        position: 'absolute',
        top: '20px',
        fontSize: '24px',
        fontWeight: 'bold',
        textShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
        zIndex: 1
      }}>
        {currentStepName}
      </div>
      <div style={{ 
        display: 'flex',
        gap: '20px',
        zIndex: 1
      }}>
        {[1, 2, 3].map((num) => (
          <div
            key={num}
            className={`card ${isVisible ? 'card-exit' : 'card-enter'}`}
            style={{
              width: '300px',
              height: '400px',
              backgroundColor: '#1e1e1e',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ flex: 1 }}>
              <h2 style={{ 
                color: '#fff',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Card {num}
              </h2>
              <div style={{ 
                color: '#aaa',
                textAlign: 'center'
              }}>
                Content for card {num}
              </div>
            </div>
            <div style={{ 
              textAlign: 'center',
              paddingTop: '20px',
              borderTop: '1px solid #333'
            }}>
              <p style={{ 
                color: '#fff',
                fontSize: '18px',
                marginBottom: '10px'
              }}>
                {actors[`actor${num}`]}
              </p>
              <p style={{ 
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold',
                textShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
              }}>
                {scores[`actor${num}`]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Show; 