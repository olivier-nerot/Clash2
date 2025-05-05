import React, { useEffect, useState, useRef } from "react";
import useCardStore from "../store/useCardStore";
import "../styles/animations.css";
import { roue } from "../setup/roue";
import { fuck } from "../setup/fuck";

// Define fonts
const style = document.createElement("style");
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

let audio;
let loveaudio;

const Show = () => {
	const {
		actors,
		scores,
		currentStepName,
		volume,
		viewWebcam,
		cardVisible,
		clashN,
		incClashN,
		countdown,
		catChecked,
	} = useCardStore();
	const webcamRef = useRef(null);
	const canvasRef = useRef(null);
	const animationFrameRef = useRef(null);
	const bgVideoRef = useRef(null);
	const [clashName, setClashName] = useState(null);
	const [fucked, setFucked] = useState(null);
	const [showCountdown, setShowCountdown] = useState(false);

	useEffect(() => {
		if (bgVideoRef.current) {
			bgVideoRef.current.volume = volume;
		}
		if (webcamRef.current) {
			webcamRef.current.volume = volume;
		}
		if (audio) {
			audio.volume = volume;
		}
	}, [volume]);

	const randomFuck = async () => {
		for (let i = 0; i < 200; i += Math.random() * 10) {
			const rf = Math.floor(Math.random() * fuck.length);
			await new Promise((resolve) => {
				setTimeout(() => {
					setFucked(fuck[rf]);
					resolve();
				}, i);
			});
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}

		setClashName(null);
		setFucked(null);
		let videoPath = null;

		if (currentStepName === "Applaudimetre") {
			videoPath = `/movies/Applaudimetre${Math.floor(Math.random() * 30) + 1}.mp4`;
		} else if (currentStepName === "Generique") {
			videoPath = "/movies/01-Intro Clash.mp4";
		} else if (currentStepName === "Generique FIN") {
			videoPath = "/movies/05-finclash.mp4";
		} else if (currentStepName === "Roue") {
			const randomValue = roue[Math.floor(Math.random() * roue.length)];
			videoPath = `/movies/Roue ${randomValue}.mp4`;
			if (randomValue === "fuck") {
				setTimeout(async () => await randomFuck(), 8000);
			}
		} else if (currentStepName.includes("Category")) {
			const category = currentStepName.split(":")[1];
			setClashName("");
			setTimeout(() => setClashName(category), 3000);
			videoPath = "/movies/02-Annonce categorie.mp4";

			setShowCountdown(true);

			audio = new Audio(`/music/C${clashN + 1}.mp3`);
			audio.volume = volume;
			audio.play();

			incClashN();
		} else if (currentStepName === "Clash public") {
			setShowCountdown(false);
			videoPath = "/movies/02-Annonce categorie.mp4";
			setTimeout(() => setClashName("CLASH PUBLIC !!!!"), 3000);

			audio = new Audio("/music/suspens.mp3");
			audio.volume = volume;
			audio.play();
		} else if (currentStepName === "Alarm") {
			setShowCountdown(false);
			videoPath = "/movies/04-Fin du temps.mp4";
			setClashName("");
		} else if (currentStepName === "show roue") {
			videoPath = "/movies/Roue 80.mp4";
		} else if (currentStepName === "show fuck") {
			videoPath = "/movies/Roue fuck.mp4";
		} else if (currentStepName === "show alarm") {
			videoPath = "/movies/04-Fin du temps.mp4";
		} else if (currentStepName === "play love") {
			if (!loveaudio) {
				loveaudio = new Audio("/music/love.mp3");
				loveaudio.loop = true;
			}
			loveaudio.play();
		} else if (currentStepName === "stop love") {
			if (loveaudio) {
				console.log("stop love");
				loveaudio.pause();
			}
		} else if (currentStepName === "stop") {
			bgVideoRef.current.pause();
		}

		if (!videoPath) {
			return;
		}

		bgVideoRef.current.src = videoPath;
		bgVideoRef.current.load();
		bgVideoRef.current.oncanplay = () => {
			bgVideoRef.current.play().catch((error) => {
				console.error("Error playing video:", error);
			});
		};
	}, [currentStepName]);

	// Handle webcam stream
	useEffect(() => {
		let stream = null;

		const startWebcam = async () => {
			try {
				if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
					throw new Error("Webcam access is not supported in this browser");
				}

				stream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: "user",
					},
					audio: true,
				});

				if (webcamRef.current) {
					webcamRef.current.srcObject = stream;
					try {
						await webcamRef.current.play();
					} catch (playError) {
						console.error("Error playing webcam stream:", playError);
						if (playError.name === "NotAllowedError") {
							const playOnInteraction = () => {
								webcamRef.current
									.play()
									.then(() => {
										document.removeEventListener("click", playOnInteraction);
									})
									.catch((err) =>
										console.error("Error playing after interaction:", err),
									);
							};
							document.addEventListener("click", playOnInteraction);
						}
					}
				}
			} catch (error) {
				console.error("Error accessing webcam:", error);
			}
		};

		if (viewWebcam) {
			audio = new Audio("/music/Gong.mp3");
			audio.volume = volume;
			audio.play();

			startWebcam();
		}

		return () => {
			if (stream) {
				for (const track of stream.getTracks()) {
					track.stop();
				}
			}
		};
	}, [viewWebcam]);

	// Canvas effect rendering
	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		const video = webcamRef.current;

		if (!canvas || !ctx || !video) {
			return;
		}

		// Utilitaires HSV <-> RGB
		function rgbToHsv(r, g, b) {
			const rNorm = r / 255;
			const gNorm = g / 255;
			const bNorm = b / 255;
			const max = Math.max(rNorm, gNorm, bNorm);
			const min = Math.min(rNorm, gNorm, bNorm);
			let h;
			let s;
			const v = max;
			const d = max - min;
			s = max === 0 ? 0 : d / max;
			if (max === min) {
				h = 0;
			} else {
				switch (max) {
					case rNorm:
						h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
						break;
					case gNorm:
						h = (bNorm - rNorm) / d + 2;
						break;
					case bNorm:
						h = (rNorm - gNorm) / d + 4;
						break;
				}
				h = h / 6;
			}
			return [h, s, v];
		}
		function hsvToRgb(h, s, v) {
			let r;
			let g;
			let b;
			const i = Math.floor(h * 6);
			const f = h * 6 - i;
			const p = v * (1 - s);
			const q = v * (1 - f * s);
			const t = v * (1 - (1 - f) * s);
			switch (i % 6) {
				case 0:
					r = v;
					g = t;
					b = p;
					break;
				case 1:
					r = q;
					g = v;
					b = p;
					break;
				case 2:
					r = p;
					g = v;
					b = t;
					break;
				case 3:
					r = p;
					g = q;
					b = v;
					break;
				case 4:
					r = t;
					g = p;
					b = v;
					break;
				case 5:
					r = v;
					g = p;
					b = q;
					break;
			}
			return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
		}

		const drawFrame = () => {
			if (video.videoWidth && video.videoHeight) {
				if (
					canvas.width !== video.videoWidth ||
					canvas.height !== video.videoHeight
				) {
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
				}

				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const data = imageData.data;

				// Posterization: 12 saturated colors (rainbow palette)
				for (let i = 0; i < data.length; i += 4) {
					const r = data[i];
					const g = data[i + 1];
					const b = data[i + 2];
					const hsv = rgbToHsv(r, g, b);
					let h = hsv[0];
					let s = hsv[1];
					let v = hsv[2];
					// Quantize hue to 12 steps
					h = Math.round(h * 12) / 12;
					s = hsv[1] ** 0.1;
					v = hsv[2] ** 0.3;
					const rgb = hsvToRgb(h, s, v);
					data[i] = rgb[0];
					data[i + 1] = rgb[1];
					data[i + 2] = rgb[2];
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
		<div
			style={{
				width: "100vw",
				height: "100vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "#000",
				color: "#fff",
				fontFamily: "Verdana",
				position: "relative",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					backgroundColor: "#000",
					zIndex: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
				<video
					ref={bgVideoRef}
					playsInline
					preload="none"
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						display: "block",
						opacity: 1,
						backgroundColor: "#000",
						position: "absolute",
						top: 0,
						left: 0,
						zIndex: 1,
						visibility: "visible",
					}}
				/>
			</div>
			{/* Webcam stream with canvas effects */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					width: "800px",
					height: "800px",
					opacity: viewWebcam ? "1" : "0",
					transition: "opacity 2s ease",
					transform: "translate(-50%, -50%)",
					zIndex: 1,
					borderRadius: "50%",
					overflow: "hidden",
					border: "4px solid #F00",
					boxShadow: "0 0 100px rgba(0, 0, 0, 1)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<video
					ref={webcamRef}
					autoPlay
					playsInline
					muted={!viewWebcam}
					style={{
						width: "auto",
						height: "100%",
						display: "none",
						minWidth: "100%",
						objectFit: "cover",
						position: "absolute",
					}}
				/>
				<canvas
					ref={canvasRef}
					style={{
						position: "absolute",
						width: "auto",
						height: "100%",
						minWidth: "100%",
						backgroundColor: "#000",
					}}
				/>
			</div>
			<div
				style={{
					position: "absolute",
					color: "#eee",
					bottom: "20px",
					left: "20px",
					fontSize: "84px",
					fontFamily: "Bison",
					fontWeight: "bold",
					textShadow: "0 0 20px rgba(0, 0, 0, 2)",
					zIndex: 2,
					animation: clashName ? "clashNameAnimation 1s ease-out" : "none",
					display: clashName ? "block" : "none",
				}}
			>
				{clashName}
			</div>
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "400px",
				}}
			>
				<div
					style={{
						overflow: "wrap",
						color: "#f80010",
						textAlign: "center",
						fontSize: "84px",
						fontFamily: "Bison",
						fontWeight: "bold",
						textShadow: "0 0 20px rgba(0, 0, 0, 2)",
						zIndex: 2,
						animation: "zoomInOut 2s ease-in-out infinite",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						minHeight: "100px",
						transformOrigin: "center center",
					}}
				>
					{fucked}
				</div>
			</div>
			<div
				style={{
					display: "flex",
					gap: "20px",
					zIndex: 2,
				}}
			>
				{[1, 2, 3].map((num) => (
					<div
						key={num}
						id={`card-${num}`}
						className={`card ${cardVisible[`actor${num}`] ? "card-enter" : "card-exit"}`}
						style={{
							height: "520px",
							backgroundColor: "#1e1e1e",
							borderRadius: "10px",
							padding: "0",
							position: "relative",
							overflow: "hidden",
							boxShadow: "0 0 40px rgba(255,255,255,0.8)",
							display: cardVisible[`actor${num}`] ? "block" : "hidden",
							width: cardVisible[`actor${num}`] ? "260px" : "0px",
						}}
					>
						<video
							loop
							src={
								catChecked[`actor${num}`]
									? "/movies/avatar-CAT.mp4"
									: `/movies/avatar-${num}.mp4`
							}
							preload="auto"
							autoPlay
							muted
							playsInline
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								position: "absolute",
								top: 0,
								left: 0,
							}}
						/>
						<div
							style={{
								position: "absolute",
								top: -50,
								left: 0,
								right: 0,
								zIndex: 1,
								textAlign: "center",
							}}
						>
							<p
								style={{
									color: "#fff",
									fontSize: "50px",
									fontFamily: "Bison",
									textShadow: "0 0 10px rgba(161, 31, 31, 0.8)",
								}}
							>
								{actors[`actor${num}`]}
							</p>
						</div>
						<div
							style={{
								position: "absolute",
								height: `${100 + scores[`actor${num}`]}px`,
								bottom: 0,
								left: 0,
								right: 0,
								zIndex: 1,
								backgroundColor: "rgba(200,0,0,0.5)",
								textAlign: "center",
								transition: "height 0.1s ease",
							}}
						>
							<figure
								style={{
									position: "absolute",
									top: -100,
									left: 0,
									right: 0,
									bottom: 0,
								}}
							>
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
			{showCountdown && (
				<div
					style={{
						position: "absolute",
						width: "300px",
						textAlign: "center",
						top: "0px",
						left: "50%",
						transform: "translateX(-50%)",
						color: "#000",
						textShadow: "0 0 4px rgba(200,200,200, 1)",
						fontSize: "68px",
						fontFamily: "Sarpanch",
						fontWeight: "bold",
						zIndex: 1,
					}}
				>
					{new Date(countdown * 1000).toISOString().substr(14, 5)}
				</div>
			)}
			TOTO
		</div>
	);
};

export default Show;
