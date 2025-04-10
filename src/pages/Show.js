import React, { useEffect, useState, useRef } from 'react';
import useCardStore from '../store/useCardStore';
import '../styles/animations.css';

const Show = () => {
  const { actors, scores, currentStepName } = useCardStore();
  const [isVisible, setIsVisible] = useState(false);
  const [bgVideo, setBgVideo] = useState("");
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

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
          ref={videoRef}
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