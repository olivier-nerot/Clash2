import React, { useState, useEffect, useRef } from 'react';
import useCardStore from '../store/useCardStore';
import { categories } from '../assets/categories';

// Import Srpanch font
import '../assets/font/bison.css';

const Regie = () => {
  const { 
    allCardsVisible, 
    toggleAllCards, 
    actors, 
    scores, 
    setActor, 
    updateScore, 
    selectActor, 
    setCurrentStepName,
    selectedCategories,
    setSelectedCategory
  } = useCardStore();
  const [numDropdowns, setNumDropdowns] = useState(0);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);

  const handleActorChange = (e, actor) => {
    setActor(actor, e.target.value);
  };

  const handleCategoryChange = (e, index) => {
    setSelectedCategory(index, e.target.value);
  };

  const addDropdown = () => {
    setNumDropdowns(prev => prev + 1);
  };

  const handleNextCategory = () => {
    setCurrentCategoryIndex(prev => {
      const nextIndex = prev === (numDropdowns * 3 + 1) ? 0 : prev + 1;
      
      // Set the current step name based on the index
      if (nextIndex === 0) {
        setCurrentStepName('Generique');
      } else if (nextIndex === numDropdowns * 3+ 1) {
        setCurrentStepName('Generique FIN');
      } else if (nextIndex % 3 === 1) {
        setCurrentStepName('Category');
      } else if (nextIndex % 3 === 2) {
        setCurrentStepName('Applaudimetre');
      } else {
        setCurrentStepName('Roue');
      }
      
      return nextIndex;
    });
  };

  useEffect(() => {
    let stream = null;
    let pc = null;
    let ws = null;

    const startWebcam = async () => {
      try {
        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Webcam access is not supported in this browser or environment');
        }

        // Request webcam access
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          },
          audio: true 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
            console.log('Webcam started successfully');
          } catch (playError) {
            console.error('Error playing webcam stream:', playError);
            // If autoplay is blocked, wait for user interaction
            if (playError.name === 'NotAllowedError') {
              const playOnInteraction = () => {
                videoRef.current.play()
                  .then(() => {
                    console.log('Webcam started after user interaction');
                    document.removeEventListener('click', playOnInteraction);
                  })
                  .catch(err => console.error('Error playing after interaction:', err));
              };
              document.addEventListener('click', playOnInteraction);
            }
          }
        }

        // Connect to signaling server
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname;
        const wsPort = '8080';
        const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
        
        console.log('Connecting to WebSocket at:', wsUrl);
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to signaling server');
          setConnectionStatus('connecting');
          // Register as the offerer
          ws.send(JSON.stringify({
            type: 'register',
            clientId: 'regie'
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
            if (data.type === 'answer') {
              console.log('Received answer');
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
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

        // Add webcam tracks to the connection
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Sending ICE candidate');
            ws.send(JSON.stringify({
              type: 'signal',
              targetId: 'show',
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

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('Sending offer');
        ws.send(JSON.stringify({
          type: 'signal',
          targetId: 'show',
          data: {
            type: 'offer',
            sdp: pc.localDescription
          }
        }));

        peerConnectionRef.current = pc;

      } catch (error) {
        console.error('Error accessing webcam:', error);
        setConnectionStatus('error');
        // Show user-friendly error message
        alert(`Webcam access error: ${error.message}\n\nPlease make sure:\n1. You have granted camera permissions\n2. You are using HTTPS or localhost\n3. Your camera is properly connected`);
      }
    };

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (pc) {
        pc.close();
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return (
    <div style={{ 
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'row',
      color: '#fff',
      fontFamily: 'Verdana'
    }}>
      <div style={{ width: '30%',height: '80%',margin: '4px', border: '1px solid #444',borderRadius: '10px',padding: '10px'}}>
        <h1 style={{ color: '#fff', marginBottom: '30px', fontFamily: 'Verdana' }}>Acteurs</h1>
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          width: '300px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            width: '100%'
          }}>
            {[1, 2, 3].map((num) => (
              <div key={num} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <input
                    type="checkbox"
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: '#4CAF50'
                    }}
                  />
                  <label style={{
                    color: '#aaa',
                    fontSize: '14px',
                    flex: 1
                  }}>
                    Officiel
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => updateScore(`actor${num}`, -10)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        ':hover': {
                          backgroundColor: '#d32f2f'
                        }
                      }}
                    >
                      -10
                    </button>
                    <button
                      onClick={() => selectActor(`actor${num}`)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#333',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        minWidth: '60px',
                        ':hover': {
                          backgroundColor: '#444'
                        }
                      }}
                    >
                      {scores[`actor${num}`]}
                    </button>
                    <button
                      onClick={() => updateScore(`actor${num}`, 10)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        ':hover': {
                          backgroundColor: '#388E3C'
                        }
                      }}
                    >
                      +10
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={actors[`actor${num}`]}
                  onChange={(e) => handleActorChange(e, `actor${num}`)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #333',
                    backgroundColor: '#1e1e1e',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.3s ease',
                    ':focus': {
                      borderColor: '#4CAF50'
                    }
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            marginTop: '20px'
          }}>
            <div
              onClick={toggleAllCards}
              style={{
                width: '60px',
                height: '30px',
                backgroundColor: allCardsVisible ? '#4CAF50' : '#333',
                borderRadius: '15px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
                border: '1px solid #444'
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '1px',
                  left: allCardsVisible ? '31px' : '1px',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              />
            </div>
            <p style={{ 
              color: '#aaa',
              fontSize: '14px',
              margin: 0
            }}>
              All cards are {allCardsVisible ? 'visible' : 'hidden'}
            </p>
          </div>
        </div>
      </div>
      <div style={{ 
        width: '40%',
        height: '80%',
        margin: '4px', 
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #444',
        borderRadius: '10px',
        padding: '10px',
        overflowY: 'auto'
      }}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <button
            onClick={handleNextCategory}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '24px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontFamily: 'Verdana',
              ':hover': {
                backgroundColor: '#388E3C',
                transform: 'scale(1.05)'
              }
            }}
          >
            →
          </button>
        </div>
        <div style={{ flex: 1 }}>
          {Array.from({ length: numDropdowns * 3 + 2 }).map((_, index) => {
            // First item is always Generique
            if (index === 0) {
              return (
                <div key="generique" style={{ 
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '10px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '30px',
                    textAlign: 'center',
                    color: '#4CAF50',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#1e1e1e',
                      color: '#fff',
                      border: index === currentCategoryIndex ? '2px solid #4CAF50' : '1px solid #333',
                      borderRadius: '4px',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: index === currentCategoryIndex ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
                      textAlign: 'left',
                      fontFamily: 'Verdana'
                    }}
                  >
                    Generique
                  </div>
                </div>
              );
            }
            // Last item is always Generique FIN
            if (index === numDropdowns * 3 + 1) {
              return (
                <div key="generique-fin" style={{ 
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '10px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '30px',
                    textAlign: 'center',
                    color: '#4CAF50',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#1e1e1e',
                      color: '#fff',
                      border: index === currentCategoryIndex ? '2px solid #4CAF50' : '1px solid #333',
                      borderRadius: '4px',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: index === currentCategoryIndex ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
                      textAlign: 'left',
                      fontFamily: 'Verdana'
                    }}
                  >
                    Generique FIN
                  </div>
                </div>
              );
            }
            // If index is 1 mod 3, render a dropdown
            if (index % 3 === 1) {
              const dropdownIndex = Math.floor((index - 1) / 3);
              const isCurrentCategory = index === currentCategoryIndex;
              return (
                <div key={`dropdown-${dropdownIndex}`} style={{ 
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '10px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '30px',
                    textAlign: 'center',
                    color: '#4CAF50',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                  <select
                    value={selectedCategories[dropdownIndex] || ''}
                    onChange={(e) => handleCategoryChange(e, dropdownIndex)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#1e1e1e',
                      color: '#0C0',
                      border: `2px solid ${isCurrentCategory ? '#4CAF50' : '#333'}`,
                      borderRadius: '4px',
                      fontSize: '16px',
                      outline: 'none',
                      boxShadow: isCurrentCategory ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <option value="" style={{ color: '#fff' }}>Select a category</option>
                    {categories.map((category) => (
                      <option 
                        key={category.name} 
                        value={category.name}
                        style={{ 
                          color: '#4CAF50',
                          backgroundColor: '#1e1e1e',
                          padding: '8px'
                        }}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            // If index is 2 mod 3, render the applaudimetre
            if (index % 3 === 2) {
              return (
                <div key={`applaudimetre-${index}`} style={{ 
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '10px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '30px',
                    textAlign: 'center',
                    color: '#4CAF50',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#1e1e1e',
                      color: '#fff',
                      border: index === currentCategoryIndex ? '2px solid #4CAF50' : '1px solid #333',
                      borderRadius: '4px',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: index === currentCategoryIndex ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
                      textAlign: 'left',
                      fontFamily: 'Verdana'
                    }}
                  >
                    Applaudimetre
                  </div>
                </div>
              );
            }
            // If index is 0 mod 3 (and not 0), render the roue
            return (
              <div key={`roue-${index}`} style={{ 
                display: 'flex',
                gap: '10px',
                marginBottom: '10px',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '30px',
                  textAlign: 'center',
                  color: '#4CAF50',
                  fontWeight: 'bold'
                }}>
                  {index + 1}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#1e1e1e',
                    color: '#fff',
                    border: index === currentCategoryIndex ? '2px solid #4CAF50' : '1px solid #333',
                    borderRadius: '4px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: index === currentCategoryIndex ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none',
                    textAlign: 'left',
                    fontFamily: 'Verdana'
                  }}
                >
                  Roue
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px'
        }}>
          <button
            onClick={addDropdown}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontFamily: 'Verdana',
              ':hover': {
                backgroundColor: '#388E3C'
              }
            }}
          >
            +
          </button>
        </div>
      </div>
      <div style={{ width: '30%',height: '80%',margin: '4px', border: '1px solid #444',borderRadius: '10px',padding: '10px'}}>
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px'
        }}>
          <button
            style={{
              padding: '12px 24px',
              backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              fontFamily: 'Verdana',
              ':hover': {
                transform: 'scale(1.05)'
              }
            }}
          >
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </button>
        </div>
        <div style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              maxWidth: '300px',
              borderRadius: '8px',
              border: '2px solid #4CAF50',
              boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Regie; 