import React, { useEffect, useState, useRef } from 'react';
import useCardStore from '../store/useCardStore';
import '../styles/animations.css';
import { roue } from '../assets/roue';
const Show = () => {
  const { actors, scores, currentStepName, volume } = useCardStore();
  const [isVisible, setIsVisible] = useState(false);
  const [viewWebcam, setViewWebcam] = useState(false);
  // const [volume, setVolume] = useState(1);
  const [bgVideo, setBgVideo] = useState("");
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const wsRef = useRef(null);
  const avatarVideoRef = useRef(null);
  const bgVideoRef = useRef(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(null);

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
      (state) => state.viewWebcam,
      (newState) => {
        setViewWebcam(newState);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // const unsubscribe = useCardStore.subscribe(
    //   (state) => state.volume,
    //   (newState) => {
    //     setVolume(newState);
        if (bgVideoRef.current) {
          bgVideoRef.current.volume = volume;
        }
    //   }
    // );

    // return () => unsubscribe();
  }, [volume]);

  useEffect(() => {
    const unsubscribe = useCardStore.subscribe(
      (state) => state.currentStepName,
      (newState) => {
        console.log('Step changed to:', newState);
        // if (bgVideoRef.current) {
        //   bgVideoRef.current.pause();
        // }
        
        let videoPath = '';
        if (newState === 'Applaudimetre') {
          videoPath = '/assets/movies/Applaudimetre1.mp4';
        } else if (newState === 'Generique') {
          videoPath = '/assets/movies/01-Intro Clash.mp4';
        } else if (newState === 'Generique FIN') {
          videoPath = '/assets/movies/05-finclash.mp4';
        } else if (newState === 'Roue') {
          const randomValue = roue[Math.floor(Math.random() * roue.length)];
          videoPath = `/assets/movies/Roue ${randomValue}.mp4`;
        } else if (newState.includes('Category')) {
          const category = newState.split(':')[1];
          videoPath = '/assets/movies/02-Annonce categorie.mp4';

          const audio = new Audio('/assets/music/C1.mp3');
          audio.volume = volume;
          audio.play().catch(error => {
            console.error('Error playing audio:', error);
          });
        } else {
          setBgVideo('');
        }
        
        console.log('Setting video path:', videoPath);
        setBgVideo(videoPath);
        bgVideoRef.current.src = videoPath;
        bgVideoRef.current.play();
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle bgVideo changes
  // useEffect(() => {
  //   if (bgVideoRef.current && bgVideo) {
  //     setIsVideoLoading(true);
  //     setVideoError(null);
      
  //     const playVideo = async () => {
  //       try {
  //         // Ensure the video is properly configured
  //         // bgVideoRef.current.autoplay = true;
  //         // bgVideoRef.current.muted = true;
  //         // bgVideoRef.current.volume = volume;
  //         // bgVideoRef.current.loop = false;
  //         // bgVideoRef.current.preload = 'auto';
          
  //         // // Set the source directly
  //         // bgVideoRef.current.src = bgVideo;
          
  //         // // Make sure the video is visible
  //         // bgVideoRef.current.style.opacity = '1';
  //         // bgVideoRef.current.style.visibility = 'visible';
          
  //         // Wait for the video to be ready to play
  //         await new Promise((resolve) => {
  //           if (bgVideoRef.current.readyState >= 3) {
  //             resolve();
  //           } else {
  //             bgVideoRef.current.addEventListener('canplaythrough', resolve, { once: true });
  //           }
  //         });
          
  //         await bgVideoRef.current.play();
  //         setIsVideoLoading(false);
  //       } catch (error) {
  //         console.error('Error playing video:', error);
  //         setVideoError(`Playback error: ${error.message}`);
  //         setIsVideoLoading(false);
  //       }
  //     };

  //     // Set up event listeners for video loading
  //     const handleLoadedMetadata = () => {
  //       setIsVideoLoading(false);
  //     };

  //     const handleError = (error) => {
  //       console.error('Error loading video:', error);
  //       setVideoError(`Loading error: ${bgVideoRef.current.error?.message || 'Unknown error'}`);
  //       setIsVideoLoading(false);
  //     };

  //     // Remove any existing listeners first
  //     bgVideoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
  //     bgVideoRef.current.removeEventListener('error', handleError);

  //     // Add new listeners
  //     bgVideoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
  //     bgVideoRef.current.addEventListener('error', handleError);

  //     // Try to play immediately if metadata is already loaded
  //     if (bgVideoRef.current.readyState >= 3) {
  //       playVideo();
  //     }

  //     // Cleanup
  //     return () => {
  //       if (bgVideoRef.current) {
  //         bgVideoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
  //         bgVideoRef.current.removeEventListener('error', handleError);
  //       }
  //     };
  //   }
  // }, [bgVideo]);

  useEffect(() => {
    let pc = null;
    let ws = null;

    const setupWebRTC = async () => {
      try {
        // Connect to signaling server
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        const wsPort = '4321'; // Use the correct port
        const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;
        
        console.log('Connecting to WebSocket at:', wsUrl);
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
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'registered') {
              console.log('Registration confirmed:', message.clientId);
              setConnectionStatus('connected');
            } else if (message.type === 'signal') {
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
          } catch (error) {
            console.error('Error handling message:', error);
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
            if (webcamRef.current) {
              // Clear any existing srcObject first
              webcamRef.current.srcObject = null;
              // Set the new stream
              webcamRef.current.srcObject = event.streams[0];
              
              // Wait for metadata to load before attempting to play
              const playVideo = async () => {
                try {
                  console.log('Attempting to play video');
                  await webcamRef.current.play();
                  console.log('Video playing successfully');
                } catch (error) {
                  console.error('Error playing video:', error);
                  // If the error is due to user interaction requirement, try again
                  if (error.name === 'NotAllowedError') {
                    console.log('Waiting for user interaction to play video');
                    // Add a click handler to play when user interacts
                    const playOnInteraction = () => {
                      webcamRef.current.play()
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
              if (!webcamRef.current.onloadedmetadata) {
                webcamRef.current.onloadedmetadata = () => {
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
    const video = webcamRef.current;

    console.log('Canvas effect setup:', { canvas, ctx, video });

    if (!canvas || !ctx || !video) {
      console.error('Missing required elements:', { canvas, ctx, video });
      return;
    }

    const drawFrame = () => {
      if (video.videoWidth && video.videoHeight) {
        // Set canvas size to match video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          console.log('Canvas size updated:', { width: canvas.width, height: canvas.height });
        }
        
        // Draw the video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get the image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Number of posterization levels
        const levels = 4;
        
        // Process each pixel
        for (let i = 0; i < data.length; i += 4) {
          // Posterize each color channel
          for (let j = 0; j < 3; j++) {
            const value = data[i + j];
            const level = Math.floor(value / (255 / levels)) * (255 / levels);
            data[i + j] = level;
          }
          
          // Increase saturation
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Convert to HSL
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;
          
          if (max === min) {
            h = s = 0;
          } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }
          
          // Increase saturation
          s = Math.min(1, s * 1.5);
          
          // Convert back to RGB
          if (s === 0) {
            data[i] = data[i + 1] = data[i + 2] = l * 255;
          } else {
            const hue2rgb = (p, q, t) => {
              if (t < 0) t += 1;
              if (t > 1) t -= 1;
              if (t < 1/6) return p + (q - p) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            data[i] = hue2rgb(p, q, h + 1/3) * 255;
            data[i + 1] = hue2rgb(p, q, h) * 255;
            data[i + 2] = hue2rgb(p, q, h - 1/3) * 255;
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    // Start the animation loop
    drawFrame();
    console.log('Animation loop started');

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        console.log('Animation loop stopped');
      }
    };
  }, []);

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
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        zIndex: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isVideoLoading && (
          <div style={{
            color: '#fff',
            fontSize: '24px',
            textAlign: 'center',
            zIndex: 2
          }}>
            Loading video...
          </div>
        )}
        {videoError && (
          <div style={{
            color: '#f44336',
            fontSize: '24px',
            textAlign: 'center',
            padding: '20px',
            zIndex: 2
          }}>
            Error: {videoError}
          </div>
        )}
        <video
          ref={bgVideoRef}

          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: 1,
            backgroundColor: '#000',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            visibility: 'visible'
          }}
        />
      </div>

      
      {/* Webcam stream with canvas effects */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        minWidth: '80%',
        minHeight: '80%',
        width: 'auto',
        height: 'auto',
        opacity: viewWebcam ? '0.8' : '0',
        transition: 'opacity 2s ease',
        transform: 'translate(-50%, -50%)',
        zIndex: 2
      }}>
        <video
          ref={webcamRef}
          autoPlay
          playsInline
          style={{ 
            width: '100%',
            height: '100%',
            display: 'none' // Hide the original video
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            border: '2px solid #F00',
            boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
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
        bottom: '20px',
        left: '20px',
        fontSize: '24px',
        fontWeight: 'bold',
        textShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
        zIndex: 1
      }}>
        {currentStepName}{volume}
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
                <video
                  ref={avatarVideoRef}
                  loop
                  src={`/assets/movies/avatar-${num}.mp4`}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
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