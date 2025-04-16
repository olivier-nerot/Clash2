import React, { useEffect, useState, useRef } from 'react';
import useCardStore from '../store/useCardStore';
import '../styles/animations.css';
import { roue } from '../setup/roue';
import { fuck } from '../setup/fuck';

console.log(fuck);
// Define fonts
const style = document.createElement('style');
style.textContent = `
  @font-face {
    font-family: 'Bison';
    src: url('/font/bison.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Sarpanch';
    src: url('/font/Sarpanch-Black.ttf') format('truetype');
    font-weight: 900;
    font-style: normal;
    font-display: swap;
  }
`;
document.head.appendChild(style);

const Show = () => {
  const {
    actors,
    scores,
    currentStepName,
    volume,
    viewWebcam,
    setAllCardsVisible,
    selectedActor,
    setCardVisible,
    cardVisible,
    } = useCardStore();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const bgVideoRef = useRef(null);
  const [clashName, setClashName] = useState(null);
  const [fucked, setFucked] = useState(null);
  useEffect(() => {
    if (bgVideoRef.current) {
      bgVideoRef.current.volume = volume;
    }
    if (webcamRef.current) {
      webcamRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => { 
    //if (!selectedActor) {
      // setAllCardsVisible(false);
    //}
  const cardElements = document.querySelectorAll('.card');
  cardElements.forEach(card => {
    card.className = 'card card-exit';
  });

  if (selectedActor) {
    const cardElement = document.getElementById(`card-${selectedActor}`);
    if (cardElement) {
      cardElement.className = 'card card-enter';
    }
  }
  }, [selectedActor]);

  const randomFuck = async () => {
    for (let i = 0; i < 200; i += Math.random()*10) {
      const rf = Math.floor(Math.random() * fuck.length);
      await new Promise(resolve => {
        setTimeout(() => {
          setFucked(fuck[rf]);
          resolve();
        }, i);
      });
    }
  }

  useEffect(() => {
    setAllCardsVisible(false);
    setClashName(null);
    setFucked(null);
    let videoPath = '';
    if (currentStepName === 'Applaudimetre') {
      videoPath = `/movies/Applaudimetre${Math.floor(Math.random() * 30) + 1}.mp4`;
      setTimeout(() => setCardVisible('actor3', true), 3000);
      setTimeout(() => setCardVisible('actor2', true), 8000);
      setTimeout(() => setCardVisible('actor3', false), 9000);
      setTimeout(() => setCardVisible('actor1', true), 14000);
      setTimeout(() => setCardVisible('actor2', false), 15000);
      setTimeout(() => setCardVisible('actor1', false), 19000);
    } else if (currentStepName === 'Generique') {
      videoPath = '/movies/01-Intro Clash.mp4';
    } else if (currentStepName === 'Generique FIN') {
      videoPath = '/movies/05-finclash.mp4';
    } else if (currentStepName === 'Roue') {
      const randomValue = roue[Math.floor(Math.random() * roue.length)];
      videoPath = `/movies/Roue ${randomValue}.mp4`;
      if (randomValue === 'fuck') {
        setTimeout(async () => await randomFuck(),8000);
      }
      // test  
    } else if (currentStepName.includes('Category')) {
      const category = currentStepName.split(':')[1];
      setClashName(category);
      videoPath = '/movies/02-Annonce categorie.mp4';

      const audio = new Audio('/music/C1.mp3');
      audio.volume = volume;

    } else {
      videoPath = '';
      return;
    }

    // console.log('Setting video path:', videoPath);
    // if (bgVideoRef.current) {
    //   bgVideoRef.current.pause();
    //   bgVideoRef.current.currentTime = 0;
    // }

    bgVideoRef.current.src = videoPath;
    bgVideoRef.current.play();
  }, [currentStepName]);

  // Handle webcam stream
  useEffect(() => {
    let stream = null;

    const startWebcam = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Webcam access is not supported in this browser');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          },
          audio: true
        });

        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          try {
            await webcamRef.current.play();
          } catch (playError) {
            console.error('Error playing webcam stream:', playError);
            if (playError.name === 'NotAllowedError') {
              const playOnInteraction = () => {
                webcamRef.current.play()
                  .then(() => {
                    document.removeEventListener('click', playOnInteraction);
                  })
                  .catch(err => console.error('Error playing after interaction:', err));
              };
              document.addEventListener('click', playOnInteraction);
            }
          }
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
      }
    };

    if (viewWebcam) {
      startWebcam();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [viewWebcam]);

  // Canvas effect rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const video = webcamRef.current;

    if (!canvas || !ctx || !video) {
      return;
    }

    const drawFrame = () => {
      if (video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const levels = 4;

        for (let i = 0; i < data.length; i += 4) {
          for (let j = 0; j < 3; j++) {
            const value = data[i + j];
            const level = Math.floor(value / (255 / levels)) * (255 / levels);
            data[i + j] = level;
          }

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

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
              default: break;
            }
            h /= 6;
          }

          s = Math.min(1, s * 1.5);

          if (s === 0) {
            data[i] = data[i + 1] = data[i + 2] = l * 255;
          } else {
            const hue2rgb = (p, q, t) => {
              if (t < 0) t += 1;
              if (t > 1) t -= 1;
              if (t < 1 / 6) return p + (q - p) * 6 * t;
              if (t < 1 / 2) return q;
              if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
              return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            data[i] = hue2rgb(p, q, h + 1 / 3) * 255;
            data[i + 1] = hue2rgb(p, q, h) * 255;
            data[i + 2] = hue2rgb(p, q, h - 1 / 3) * 255;
          }
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
        <video
          ref={bgVideoRef}
          playsInline
          preload="none"
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
          muted={viewWebcam ? false : true}
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
      </div>

      <div 

        style={{
          position: 'absolute',
          color: '#eee',
          bottom: '20px',
          left: '20px',
          fontSize: '84px',
          fontFamily: 'Bison',
          fontWeight: 'bold',
          textShadow: '0 0 20px rgba(0, 0, 0, 2)',
          zIndex: 1,
          animation: clashName ? 'clashNameAnimation 1s ease-out' : 'none',
          display: clashName ? 'block' : 'none'
        }}
      >
        {clashName}
      </div>
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
        }}
      >
        <div style={{
          overflow: 'wrap',
          color: '#f80010',
          textAlign: 'center',
          fontSize: '84px',
          fontFamily: 'Bison',
          fontWeight: 'bold',
          textShadow: '0 0 20px rgba(0, 0, 0, 2)',
          zIndex: 1,
          animation: 'zoomInOut 2s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px',
          transformOrigin: 'center center'
        }}
      >
        {fucked}
        </div>
      </div>
      <div style={{
        display: 'flex',
        gap: '20px',
        zIndex: 1
      }}>
        {[1, 2, 3].map((num) => (
          <div
            key={num}
            id={`card-${num}`}
            className={`card ${cardVisible[`actor${num}`] ? 'card-enter' : 'card-exit'}`}
            style={{
              height: '520px',
              backgroundColor: '#1e1e1e',
              borderRadius: '10px',
              padding: '0',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(255,255,255,0.8)',
              display: cardVisible[`actor${num}`] ? 'block' : 'hidden',
              width: cardVisible[`actor${num}`] ? '260px' : '0px'
            }}
          >
            <video
              loop
              src={`/movies/avatar-${num}.mp4`}
              preload="auto"
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0
              }}
            />
            <div style={{
              position: 'absolute',
              top: -50,
              left: 0,
              right: 0,
              zIndex: 1,
              textAlign: 'center'
            }}>
              <p style={{
                color: '#fff',
                fontSize: '50px',
                fontFamily: 'Bison',
                textShadow: '0 0 10px rgba(161, 31, 31, 0.8)'
              }}>
                {actors[`actor${num}`]}
              </p>
            </div>
            <div style={{
              position: 'absolute',
              height: `${100 + scores[`actor${num}`]}px`,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              backgroundColor: 'rgba(200,0,0,0.5)',
              textAlign: 'center',
              transition: 'height 0.1s ease'
            }}>
              <figure style={{
                position: 'absolute',
                top: -60,
                left: 0,
                right: 0,
                bottom: 0,
              }}>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
                <h1>{scores[`actor${num}`]}</h1>
              </figure>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Show; 