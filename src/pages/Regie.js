import React, { useState, useEffect, useRef } from "react";
import useCardStore from "../store/useCardStore";
import { categories } from "../setup/categories";

let timerInterval;

const Regie = () => {
	const {
		viewWebcam,
		volume,
		toggleViewWebcam,
		setVolume,
		actors,
		scores,
		setActor,
		updateScore,
		setCurrentStepName,
		selectedCategories,
		setSelectedCategory,
		cardVisible,
		setCardVisible,
		clashN,
		setClashN,
		countdown,
		setCountdown,
		decCountdown,
		numDropdowns,
		addCategory,
		catChecked,
		setCatChecked,
	} = useCardStore();
	const videoRef = useRef(null);
	const [isRunning, setIsRunning] = useState(false);
	const [nextStep, setNextStep] = useState(-1);
	const [isLoveRunning, setIsLoveRunning] = useState(false);

	const handleActorChange = (e, actor) => {
		setActor(actor, e.target.value);
	};

	const handleCategoryChange = (e, index) => {
		setSelectedCategory(index, e.target.value);
	};

	const toggleAllCards = () => {
		setTimeout(
			() => setCardVisible("actor1", !cardVisible.actor1),
			Math.floor(Math.random() * 2000),
		);
		setTimeout(
			() => setCardVisible("actor2", !cardVisible.actor2),
			Math.floor(Math.random() * 2000),
		);
		setTimeout(
			() => setCardVisible("actor3", !cardVisible.actor3),
			Math.floor(Math.random() * 2000),
		);
	};

	const handleNextCategory = () => {
		setVolume(1);

		setCardVisible("actor1", false);
		setCardVisible("actor2", false);
		setCardVisible("actor3", false);

		const index = nextStep;

		if (index === numDropdowns * 3 + 2) {
			setClashN(0);
			setIsRunning(false);
			return;
		}

		const nextIndex = index + 1;
		if (nextIndex === 0) {
			setCurrentStepName("Generique");
		} else if (nextIndex === numDropdowns * 3 + 1) {
			setCurrentStepName("Clash public");
		} else if (nextIndex === numDropdowns * 3 + 2) {
			setCurrentStepName("Generique FIN");
		} else if (nextIndex % 3 === 1) {
			setCurrentStepName(
				`Category : ${selectedCategories[Math.floor(nextIndex / 3)]}`,
			);
		} else if (nextIndex % 3 === 2) {
			setCurrentStepName("Applaudimetre");
			setTimeout(() => setCardVisible("actor3", true), 3000);
			setTimeout(() => setCardVisible("actor3", false), 9000);
			setTimeout(() => setCardVisible("actor2", true), 8000);
			setTimeout(() => setCardVisible("actor2", false), 15000);
			setTimeout(() => setCardVisible("actor1", true), 14000);
			setTimeout(() => setCardVisible("actor1", false), 19000);
		} else if (nextIndex % 3 === 0) {
			setCurrentStepName("Roue");
		}

		// start countdown
		if (nextIndex === 1) {
			timerInterval = setInterval(() => {
				decCountdown();
			}, 1000);
		}

		setNextStep(nextIndex);
	};

	const startClash = () => {
		// will stop
		if (isRunning) {
			setNextStep(-1);
			setCountdown(59 * 60 + 27);
			if (timerInterval) {
				clearInterval(timerInterval);
			}
			setCurrentStepName("stop");
		}

		// will start
		if (!isRunning) {
			updateScore("actor1", -scores.actor1);
			updateScore("actor2", -scores.actor2);
			updateScore("actor3", -scores.actor3);
			setClashN(1);
			setNextStep(0);
			setCountdown(59 * 60 + 27);
			setCurrentStepName("Generique");
		}

		setIsRunning(!isRunning);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (countdown === 0) {
			console.log("endClash");
			clearInterval(timerInterval);
			// go before clash public
			setNextStep(numDropdowns * 3);
			setCurrentStepName("Alarm");
		}
	}, [countdown]);

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

				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					try {
						await videoRef.current.play();
					} catch (playError) {
						console.error("Error playing webcam stream:", playError);
						if (playError.name === "NotAllowedError") {
							const playOnInteraction = () => {
								videoRef.current
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
			startWebcam();
		}

		return () => {
			if (stream) {
				for (const track of stream.getTracks()) track.stop();
			}
		};
	}, [viewWebcam]);

	return (
		<div
			style={{
				width: "100vw",
				height: "100vh",
				display: "flex",
				flexDirection: "row",
				color: "#fff",
				fontFamily: "Verdana",
			}}
		>
			<div
				style={{
					width: "30%",
					height: "80%",
					margin: "4px",
					border: "1px solid #444",
					borderRadius: "10px",
					padding: "10px",
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "20px",
						width: "300px",
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "15px",
							width: "100%",
						}}
					>
						{[1, 2, 3].map((num) => (
							<div
								key={`actor-${num}`}
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "5px",
									paddingBottom: "10px",
									borderBottom: "1px solid #444",
								}}
							>
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
								<div
									onClick={() =>
										setCardVisible(`actor${num}`, !cardVisible[`actor${num}`])
									}
									style={{
										padding: "8px 16px",
										backgroundColor: "#333",
										color: "white",
										borderWidth: "2px",
										borderStyle: "solid",
										borderColor: cardVisible[`actor${num}`]
											? "#4CAF50"
											: "#000000",
										borderRadius: "4px",
										cursor: "pointer",
										fontSize: "14px",
										fontWeight: "bold",
										transition: "all 0.3s ease",
										minWidth: "60px",
										":hover": {
											backgroundColor: "#444",
										},
									}}
								>
									<h2>{actors[`actor${num}`]}</h2>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "10px",
									}}
								>
									<input
										type="checkbox"
										id={`cat-checkbox-${num}`}
										checked={catChecked[`actor${num}`] || false}
										onChange={(e) =>
											setCatChecked(`actor${num}`, e.target.checked)
										}
										style={{
											width: "20px",
											height: "20px",
											cursor: "pointer",
											accentColor: "#4CAF50",
										}}
									/>
									<label
										htmlFor={`cat-checkbox-${num}`}
										style={{
											color: "#aaa",
											fontSize: "14px",
											flex: 1,
										}}
									>
										CAT
									</label>
									<div
										style={{
											display: "flex",
											gap: "10px",
											alignItems: "center",
										}}
									>
										<button
											type="button"
											onClick={() => updateScore(`actor${num}`, -10)}
											style={{
												padding: "8px 16px",
												backgroundColor: "#f44336",
												color: "white",
												border: "none",
												borderRadius: "4px",
												cursor: "pointer",
												fontSize: "14px",
												fontWeight: "bold",
												transition: "all 0.3s ease",
												boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
												":hover": {
													backgroundColor: "#d32f2f",
												},
											}}
										>
											-10
										</button>
										<button
											type="button"
											style={{
												padding: "8px 16px",
												backgroundColor: "#333",
												color: "white",
												border: "none",
												borderRadius: "4px",
												fontSize: "14px",
												fontWeight: "bold",
												minWidth: "60px",
											}}
										>
											{scores[`actor${num}`]}
										</button>
										<button
											type="button"
											onClick={() => updateScore(`actor${num}`, 10)}
											style={{
												padding: "8px 16px",
												backgroundColor: "#4CAF50",
												color: "white",
												border: "none",
												borderRadius: "4px",
												cursor: "pointer",
												fontSize: "14px",
												fontWeight: "bold",
												transition: "all 0.3s ease",
												boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
												":hover": {
													backgroundColor: "#388E3C",
												},
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
										padding: "8px 12px",
										borderRadius: "4px",
										border: "1px solid #333",
										backgroundColor: "#1e1e1e",
										color: "#fff",
										fontSize: "14px",
										outline: "none",
										transition: "border-color 0.3s ease",
										":focus": {
											borderColor: "#4CAF50",
										},
									}}
								/>
							</div>
						))}
					</div>

					<button
						type="button"
						onClick={toggleAllCards}
						style={{
							padding: "8px 16px",
							backgroundColor: "#4CAF50",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "14px",
							fontWeight: "bold",
							transition: "all 0.3s ease",
							boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
							marginTop: "20px",
							":hover": {
								backgroundColor: "#388E3C",
							},
						}}
					>
						Toggle All Cards
					</button>
				</div>
			</div>
			<div
				style={{
					width: "40%",
					height: "80%",
					margin: "4px",
					display: "flex",
					flexDirection: "column",
					border: "1px solid #444",
					borderRadius: "10px",
					padding: "10px",
					overflowY: "auto",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						gap: "20px",
						marginBottom: "20px",
					}}
				>
					<button
						type="button"
						onClick={() => startClash()}
						style={{
							padding: "12px 24px",
							backgroundColor: isRunning ? "#f44336" : "#4CAF50",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "24px",
							fontWeight: "bold",
							transition: "all 0.3s ease",
							boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
							fontFamily: "Verdana",
							":hover": {
								transform: "scale(1.05)",
							},
						}}
					>
						{isRunning ? "STOP" : "START"}
					</button>
					<div
						style={{
							fontSize: "36px",
							fontWeight: "bold",
							color: "#4CAF50",
							textShadow: "0 0 10px rgba(76, 175, 80, 0.5)",
							minWidth: "120px",
							textAlign: "center",
						}}
					>
						{clashN}-{Math.floor(countdown / 60)}:{countdown % 60}
					</div>
					<button
						type="button"
						onClick={handleNextCategory}
						disabled={!isRunning}
						style={{
							padding: "12px 24px",
							backgroundColor: isRunning ? "#4CAF50" : "#333",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "24px",
							fontWeight: "bold",
							transition: "all 0.3s ease",
							boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
							fontFamily: "Verdana",
							":hover": {
								backgroundColor: "#388E3C",
								transform: "scale(1.05)",
							},
						}}
					>
						→
					</button>
				</div>
				<div style={{ flex: 1 }}>
					{Array.from({ length: numDropdowns * 3 + 3 }).map((_, index) => {
						// First item is always Generique
						if (index === 0) {
							return (
								<div
									key="generique-start"
									style={{
										display: "flex",
										gap: "10px",
										marginBottom: "10px",
										alignItems: "center",
									}}
								>
									<div
										style={{
											width: "30px",
											textAlign: "center",
											color: "#4CAF50",
											fontWeight: "bold",
										}}
									>
										{index + 1}
									</div>
									<div
										style={{
											flex: 1,
											padding: "8px 12px",
											backgroundColor: "#1e1e1e",
											color: "#fff",
											border:
												index === nextStep
													? "2px solid #4CAF50"
													: "1px solid #333",
											borderRadius: "4px",
											fontSize: "14px",
											outline: "none",
											cursor: "pointer",
											transition: "all 0.3s ease",
											boxShadow:
												index === nextStep
													? "0 0 10px rgba(76, 175, 80, 0.5)"
													: "none",
											textAlign: "left",
											fontFamily: "Verdana",
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
								<div
									key="clash-public-final"
									style={{
										display: "flex",
										gap: "10px",
										marginBottom: "10px",
										alignItems: "center",
									}}
								>
									<div
										style={{
											width: "30px",
											textAlign: "center",
											color: "#4CAF50",
											fontWeight: "bold",
										}}
									>
										{index + 1}
									</div>
									<div
										style={{
											flex: 1,
											padding: "8px 12px",
											backgroundColor: "#1e1e1e",
											color: "#fff",
											border:
												index === nextStep
													? "2px solid #4CAF50"
													: "1px solid #333",
											borderRadius: "4px",
											fontSize: "14px",
											outline: "none",
											cursor: "pointer",
											transition: "all 0.3s ease",
											boxShadow:
												index === nextStep
													? "0 0 10px rgba(76, 175, 80, 0.5)"
													: "none",
											textAlign: "left",
											fontFamily: "Verdana",
										}}
									>
										Clash public
									</div>
								</div>
							);
						}
						if (index === numDropdowns * 3 + 2) {
							return (
								<div
									key="generique-end"
									style={{
										display: "flex",
										gap: "10px",
										marginBottom: "10px",
										alignItems: "center",
									}}
								>
									<div
										style={{
											width: "30px",
											textAlign: "center",
											color: "#4CAF50",
											fontWeight: "bold",
										}}
									>
										{index + 1}
									</div>
									<div
										style={{
											flex: 1,
											padding: "8px 12px",
											backgroundColor: "#1e1e1e",
											color: "#fff",
											border:
												index === nextStep
													? "2px solid #4CAF50"
													: "1px solid #333",
											borderRadius: "4px",
											fontSize: "14px",
											outline: "none",
											cursor: "pointer",
											transition: "all 0.3s ease",
											boxShadow:
												index === nextStep
													? "0 0 10px rgba(76, 175, 80, 0.5)"
													: "none",
											textAlign: "left",
											fontFamily: "Verdana",
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
							const isCurrentCategory = index === nextStep;
							return (
								<div
									key={`dropdown-step-${dropdownIndex}`}
									style={{
										display: "flex",
										gap: "10px",
										marginBottom: "10px",
										alignItems: "center",
									}}
								>
									<div
										style={{
											width: "30px",
											textAlign: "center",
											color: "#4CAF50",
											fontWeight: "bold",
										}}
									>
										{index + 1}
									</div>
									<select
										value={selectedCategories[dropdownIndex] || ""}
										onChange={(e) => handleCategoryChange(e, dropdownIndex)}
										style={{
											width: "100%",
											padding: "8px",
											backgroundColor: "#1e1e1e",
											color: "#0C0",
											border: `2px solid ${isCurrentCategory ? "#4CAF50" : "#333"}`,
											borderRadius: "4px",
											fontSize: "16px",
											outline: "none",
											boxShadow: isCurrentCategory
												? "0 0 10px rgba(76, 175, 80, 0.5)"
												: "none",
											transition: "all 0.3s ease",
										}}
									>
										<option value="" style={{ color: "#fff" }}>
											Select a category
										</option>
										{categories.map((category) => (
											<option
												key={category.name}
												value={category.name}
												style={{
													color: "#4CAF50",
													backgroundColor: "#1e1e1e",
													padding: "8px",
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
								<div
									key={`applaudimetre-step-${Math.floor(index / 3)}`}
									style={{
										display: "flex",
										gap: "10px",
										marginBottom: "10px",
										alignItems: "center",
									}}
								>
									<div
										style={{
											width: "30px",
											textAlign: "center",
											color: "#4CAF50",
											fontWeight: "bold",
										}}
									>
										{index + 1}
									</div>
									<div
										style={{
											flex: 1,
											padding: "8px 12px",
											backgroundColor: "#1e1e1e",
											color: "#fff",
											border:
												index === nextStep
													? "2px solid #4CAF50"
													: "1px solid #333",
											borderRadius: "4px",
											fontSize: "14px",
											outline: "none",
											cursor: "pointer",
											transition: "all 0.3s ease",
											boxShadow:
												index === nextStep
													? "0 0 10px rgba(76, 175, 80, 0.5)"
													: "none",
											textAlign: "left",
											fontFamily: "Verdana",
										}}
									>
										Applaudimetre
									</div>
								</div>
							);
						}
						// If index is 0 mod 3 (and not 0), render the roue
						return (
							<div
								key={`roue-step-${Math.floor(index / 3)}`}
								style={{
									display: "flex",
									gap: "10px",
									marginBottom: "10px",
									alignItems: "center",
								}}
							>
								<div
									style={{
										width: "30px",
										textAlign: "center",
										color: "#4CAF50",
										fontWeight: "bold",
									}}
								>
									{index + 1}
								</div>
								<div
									style={{
										flex: 1,
										padding: "8px 12px",
										backgroundColor: "#1e1e1e",
										color: "#fff",
										border:
											index === nextStep
												? "2px solid #4CAF50"
												: "1px solid #333",
										borderRadius: "4px",
										fontSize: "14px",
										outline: "none",
										cursor: "pointer",
										transition: "all 0.3s ease",
										boxShadow:
											index === nextStep
												? "0 0 10px rgba(76, 175, 80, 0.5)"
												: "none",
										textAlign: "left",
										fontFamily: "Verdana",
									}}
								>
									Roue
								</div>
							</div>
						);
					})}
				</div>
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						marginTop: "20px",
					}}
				>
					<button
						onClick={addCategory}
						type="button"
						style={{
							padding: "8px 16px",
							backgroundColor: "#4CAF50",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "14px",
							fontWeight: "bold",
							transition: "all 0.3s ease",
							boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
							fontFamily: "Verdana",
							":hover": {
								backgroundColor: "#388E3C",
							},
						}}
					>
						+
					</button>
				</div>
			</div>
			<div
				style={{
					width: "30%",
					height: "80%",
					margin: "4px",
					border: "1px solid #444",
					borderRadius: "10px",
					padding: "10px",
				}}
			>
				<div
					style={{
						marginTop: "20px",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "20px",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "10px",
							marginBottom: "10px",
						}}
					>
						<span
							style={{
								color: "#fff",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							Webcam: {viewWebcam ? "Show" : "Hide"}
						</span>
						<div
							onClick={toggleViewWebcam}
							onKeyDown={() => {}}
							style={{
								width: "60px",
								height: "30px",
								backgroundColor: viewWebcam ? "#4CAF50" : "#333",
								borderRadius: "15px",
								position: "relative",
								cursor: "pointer",
								transition: "background-color 0.3s ease",
								border: "1px solid #444",
							}}
						>
							<div
								style={{
									width: "26px",
									height: "26px",
									backgroundColor: "#fff",
									borderRadius: "50%",
									position: "absolute",
									top: "1px",
									left: viewWebcam ? "31px" : "1px",
									transition: "left 0.3s ease",
									boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
								}}
							/>
						</div>
					</div>
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						style={{
							width: "100%",
							maxWidth: "300px",
							borderRadius: "8px",
							opacity: viewWebcam ? "0.8" : "0",
							border: "2px solid #4CAF50",
							boxShadow: "0 0 10px rgba(76, 175, 80, 0.5)",
						}}
					/>
					<div
						style={{
							width: "100%",
							maxWidth: "300px",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "10px",
						}}
					>
						<label
							htmlFor="volume-control"
							style={{
								color: "#fff",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							Volume: {Math.round(volume * 100)}%
						</label>
						<input
							id="volume-control"
							type="range"
							min="0"
							max="1"
							step="0.1"
							value={volume}
							onChange={(e) => {
								const newVolume = Number.parseFloat(e.target.value);
								setVolume(newVolume);
							}}
							style={{
								width: "100%",
								height: "8px",
								borderRadius: "4px",
								background: "#333",
								outline: "none",
								WebkitAppearance: "none",
							}}
						/>
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "10px",
							marginTop: "20px",
						}}
					>
						<button
							type="button"
							onClick={() => {
								setCurrentStepName("show roue");
							}}
							style={{
								width: "200px",
								padding: "8px 16px",
								backgroundColor: "#4CAF50",
								color: "white",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							ROUE
						</button>
						<button
							type="button"
							onClick={() => {
								setCurrentStepName("show fuck");
							}}
							style={{
								width: "200px",
								padding: "8px 16px",
								backgroundColor: "#4CAF50",
								color: "white",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							FUCK
						</button>
						<button
							type="button"
							onClick={() => {
								setCurrentStepName("show alarm");
							}}
							style={{
								width: "200px",
								padding: "8px 16px",
								backgroundColor: "#4CAF50",
								color: "white",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							ALARM
						</button>
						<button
							type="button"
							onClick={() => {
								setCurrentStepName(isLoveRunning ? "stop love" : "play love");
								setIsLoveRunning(!isLoveRunning);
							}}
							style={{
								width: "200px",
								padding: "8px 16px",
								backgroundColor: isLoveRunning ? "#f44336" : "#4CAF50",
								color: "white",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						>
							{isLoveRunning ? "STOP LOVE" : "PLAY LOVE"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Regie;
