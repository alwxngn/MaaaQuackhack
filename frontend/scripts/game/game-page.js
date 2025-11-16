// Initialize health values
let playerHealth = 250;
const MAX_PLAYER_HEALTH = 250;
let bossHealth = 200;
const MAX_BOSS_HEALTH = 200;
let gameRunning = false;
let comboCount = 0;
let highestCombo = 0; // Track highest combo achieved
let comboJustReset = false; // Flag to prevent backend from overwriting reset

// Finisher system
let finisherMode = false;
let finisherIceShardCount = 0; // Track ice shards cast during finisher (need 2)
let finisherTimeout = null;
const FINISHER_TIME_LIMIT = 10000; // 10 seconds to perform finisher

// Sound effects system
const sounds = {
    fireball: new Audio('../../../assets/sounds/fireball.mp3'),
    iceShard: new Audio('../../../assets/sounds/ice_shard.wav'),
    thunder: new Audio('../../../assets/sounds/thunder.wav'),
    backgroundMusic: new Audio('../../../assets/sounds/background_music.wav')
};

// Initialize sounds with volume
Object.values(sounds).forEach(sound => {
    sound.volume = 0.5;
});

sounds.backgroundMusic.volume = 0.5;
sounds.backgroundMusic.loop = true;

// Mana system
let currentMana = 100;
let maxMana = 100;
let manaBalls = []; // Array to track active mana balls
let lastManaBallSpawn = 0;
const MANA_BALL_SPAWN_INTERVAL = 4000; // Spawn every 4 seconds (faster regen)

// Heal orb system
let healOrbs = []; // Array to track active heal orbs
let lastHealOrbSpawn = 0;
const HEAL_ORB_SPAWN_INTERVAL = 6000; // Spawn every 6 seconds
const HEAL_ORB_HEAL_AMOUNT = 25; // Health restored per orb 

// Animation variables
let activeAnimations = [];
let lastHandPosition = null;
let demonAnimationState = 'idle'; // 'idle', 'hit', 'cleave', 'walk', 'enraged'
let demonIdleInterval = null;
let demonHitInterval = null; // Track hit animation interval
let demonCleaveInterval = null; // Track cleave animation interval
let lastBossAttackCheck = 0; // Track last boss attack check time
const BOSS_ATTACK_CHECK_INTERVAL = 1500; // Check every 1500ms (1.5 seconds)

// Boss phase system
let currentBossPhase = 1; // 1 = Normal (66-100%), 2 = Enraged (33-66%), 3 = Final Form (0-33%)
let lastPhaseCheck = 0;

// Game start time tracking
let gameStartTime = Date.now();

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Game loaded!");
    resetHealth();
    gameStartTime = Date.now();
    startWebcam(); // <-- Start the webcam
    startDemonIdleAnimation(); // <-- Start demon idle animation
    gameRunning = true; // <-- START THE GAME!
    
    // Start background music
    if (sounds.backgroundMusic) {
        sounds.backgroundMusic.play().catch(err => {
            console.log("Background music autoplay blocked:", err);
        });
    }
    
    gameLoop();         // <-- START THE LOOP!
});

// Browser-based gesture detection
function detectGesture(landmarks) {
    // Calculate finger states (extended or curled)
    function isFingerExtended(landmarks, fingerTip, fingerPip) {
        const tip = landmarks[fingerTip];
        const pip = landmarks[fingerPip];
        const wrist = landmarks[0];
        
        // Finger is extended if tip is farther from wrist than pip
        const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
        
        return tipDist > pipDist * 1.1;
    }
    
    const thumb = isFingerExtended(landmarks, 4, 3);
    const index = isFingerExtended(landmarks, 8, 6);
    const middle = isFingerExtended(landmarks, 12, 10);
    const ring = isFingerExtended(landmarks, 16, 14);
    const pinky = isFingerExtended(landmarks, 20, 18);
    
    const extendedCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;
    
    // FIST: No fingers extended
    if (extendedCount === 0) {
        return 'FIST';
    }
    
    // POINT: Only index finger extended
    if (index && !middle && !ring && !pinky) {
        return 'POINT';
    }
    
    // OPEN_PALM: All fingers extended (4 or more)
    if (extendedCount >= 4) {
        return 'OPEN_PALM';
    }
    
    return 'NONE';
}

// Send gesture to backend
let lastSentGesture = 'NONE';
async function sendGestureToBackend(gesture) {
    // Only send if gesture changed to reduce network traffic
    if (gesture !== lastSentGesture) {
        lastSentGesture = gesture;
        // Show visual feedback for gesture detection
        if (gesture !== 'NONE') {
            showGestureFeedback(gesture);
        }
        try {
            await fetch('http://localhost:5001/set_gesture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gesture: gesture })
            });
        } catch (error) {
            console.error('Error sending gesture:', error);
        }
    }
}

// Function to start webcam with hand tracking and background removal
function startWebcam() {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output-canvas');
    const canvasCtx = canvasElement.getContext('2d');

    let segmentationMask = null;

    // Initialize MediaPipe Selfie Segmentation
    const selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
    });

    selfieSegmentation.setOptions({
        modelSelection: 1, // 0 for general, 1 for landscape (better quality)
    });

    selfieSegmentation.onResults((results) => {
        segmentationMask = results.segmentationMask;
    });

    // Initialize MediaPipe Hands
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0, // Reduced from 1 to 0 for better performance
        minDetectionConfidence: 0.5, // Reduced from 0.7 for faster detection
        minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
        // Set canvas size to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Apply background removal if mask is available
        if (segmentationMask) {
            // Draw only the person (where mask is white)
            canvasCtx.globalCompositeOperation = 'copy';
            canvasCtx.filter = 'none';
            
            // Create a temporary canvas for the masked person
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasElement.width;
            tempCanvas.height = canvasElement.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the video frame
            tempCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            
            // Apply the mask
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
            
            // Draw the masked person onto the main canvas
            canvasCtx.drawImage(tempCanvas, 0, 0);
        } else {
            // Fallback: draw video frame without segmentation
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        }

        canvasCtx.globalCompositeOperation = 'source-over';

        // Draw hand landmarks and track hand position
        if (results.multiHandLandmarks) {
            // Process BOTH hands independently for dual casting
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                
                // Detect gesture first to determine spell circle style
                const gesture = detectGesture(landmarks);
                
                // Draw spell circles on hands based on gesture
                drawSpellCircle(canvasCtx, landmarks, gesture, canvasElement.width, canvasElement.height);
                
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                    {color: '#00FF00', lineWidth: 3});
                drawLandmarks(canvasCtx, landmarks, 
                    {color: '#FF0000', lineWidth: 1, radius: 3});
                
                // Store the wrist position (landmark 0) for fireball origin
                const wrist = landmarks[0];
                lastHandPosition = {
                    x: wrist.x * canvasElement.width,
                    y: wrist.y * canvasElement.height
                };
                
                // Send gesture for EACH hand independently
                sendGestureToBackend(gesture);
            }
        } else {
            // No hand detected, send NONE
            sendGestureToBackend('NONE');
        }
        canvasCtx.restore();
    });

    // Start camera
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await selfieSegmentation.send({image: videoElement});
            await hands.send({image: videoElement});
        },
        width: 600,
        height: 700
    });
    
    camera.start().then(() => {
        console.log('📹 Webcam with hand tracking and background removal started!');
    }).catch((error) => {
        console.error('Error accessing webcam:', error);
        alert('Could not access webcam. Please allow camera permissions.');
    });
}

// --- ⭐️ REPLACED THIS FUNCTION ⭐️ ---
// Function to update the event display with challenge progress
function updateEventDisplay(event, progress = 0, target = 0) {
    const eventDisplay = document.getElementById('event-display');
    if (!eventDisplay) return; // Safety check

    if (event === "EXPLOSION_CHALLENGE") {
        eventDisplay.textContent = "Event: Perform the EXPLOSION COMBO!";
    } else if (event === "HEAL_LIGHT_CHALLENGE") {
        eventDisplay.textContent = "Event: Perform the HEALING LIGHT COMBO!";
    } else if (event === "WEAKFIRE") {
        eventDisplay.textContent = "Event: Boss is weak to FIRE!";
    } else if (event === "WEAKICE") {
        eventDisplay.textContent = "Event: Boss is weak to ICE!";
    } else if (event === "NONE") {
        eventDisplay.textContent = "Event: ---";
    } else {
        eventDisplay.textContent = `Event: ${event}`;
    }
}

// Function to update the cooldown display
function updateCooldownDisplay(cooldown) {
    const cooldownDisplay = document.getElementById('cooldown-display');
    if (cooldownDisplay) {
        cooldownDisplay.textContent = `Cooldown: ${cooldown ? `${cooldown.toFixed(1)}s` : 'Ready'}`;
    }
}

// Function to update combo display
function updateComboDisplay() {
    const comboDisplay = document.getElementById('combo-display');
    if (comboDisplay) {
        if (comboCount > 0) {
            comboDisplay.textContent = `COMBO: ${comboCount}x`;
            comboDisplay.style.opacity = '1';
        } else {
            comboDisplay.style.opacity = '0';
        }
    }
    
    // Update highest combo
    if (comboCount > highestCombo) {
        highestCombo = comboCount;
    }
}
// --- ⭐️ END OF REPLACED FUNCTION ⭐️ ---


// Function to update player health
function updatePlayerHealth(newHealth) {
    const oldHealth = playerHealth;
    playerHealth = Math.max(0, Math.min(MAX_PLAYER_HEALTH, newHealth));
    const playerHealthBar = document.getElementById('player-hp-fill');
    
    if (playerHealthBar) {
        const healthPercentage = (playerHealth / MAX_PLAYER_HEALTH) * 100;
        playerHealthBar.style.width = healthPercentage + '%';
    }
    
    // Reset combo if player took damage
    if (newHealth < oldHealth && comboCount > 0) {
        comboCount = 0;
        comboJustReset = true; // Flag to prevent backend from overwriting
        // Reset combo in backend too
        fetch('http://localhost:5001/reset_combo', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        }).catch(err => console.error('Error resetting combo:', err));
        updateComboDisplay();
    }
    
    console.log('Player health:', playerHealth + '/' + MAX_PLAYER_HEALTH);
    checkGameEnd();
}

// Function to update boss health
function updateBossHealth(newHealth) {
    bossHealth = Math.max(0, Math.min(MAX_BOSS_HEALTH, newHealth));
    const bossHealthBar = document.getElementById('boss-hp-fill');
    
    if (bossHealthBar) {
        const healthPercentage = (bossHealth / MAX_BOSS_HEALTH) * 100;
        bossHealthBar.style.width = healthPercentage + '%';
    }
    
    // Check for phase transitions
    checkBossPhase();
    
    console.log('Boss health:', bossHealth + '/' + MAX_BOSS_HEALTH);
    checkGameEnd();
}

// Check and update boss phase based on health
function checkBossPhase() {
    const healthPercent = (bossHealth / MAX_BOSS_HEALTH) * 100;
    let newPhase = currentBossPhase;
    
    if (healthPercent > 66) {
        newPhase = 1; // Phase 1: Normal
    } else if (healthPercent > 33) {
        newPhase = 2; // Phase 2: Enraged
    } else {
        newPhase = 3; // Phase 3: Final Form
    }
    
    // Phase transition detected
    if (newPhase !== currentBossPhase) {
        currentBossPhase = newPhase;
        onBossPhaseChange(newPhase);
    }
}

// Handle boss phase transitions with visual effects
function onBossPhaseChange(phase) {
    const demonSprite = document.getElementById('demon-sprite');
    const bossBox = document.querySelector('.boss-box');
    const eventDisplay = document.getElementById('event-display');
    
    if (!demonSprite || !bossBox) return;
    
    // Remove any existing phase effects
    demonSprite.style.filter = '';
    demonSprite.style.transition = 'all 0.5s ease-in-out';
    
    // Restart idle animation with new speed for the phase
    if (demonIdleInterval) {
        clearInterval(demonIdleInterval);
    }
    
    switch(phase) {
        case 2: // Enraged
            console.log('🔥 BOSS PHASE 2: ENRAGED!');
            demonSprite.style.filter = 'brightness(1.2) saturate(1.5) hue-rotate(350deg)';
            demonSprite.style.boxShadow = 'none';
            if (eventDisplay) {
                eventDisplay.textContent = 'BOSS ENRAGED!';
                eventDisplay.style.animation = 'none';
                setTimeout(() => {
                    eventDisplay.style.animation = 'eventPulse 1s ease-in-out infinite';
                }, 10);
            }
            showPhaseTransitionMessage('ENRAGED', '#FF4500');
            startDemonIdleAnimation(); // Restart with faster speed
            break;
            
        case 3: // Final Form - Dark, crazy colors, moves back and forth (away from player)
            console.log('💀 BOSS PHASE 3: FINAL FORM!');
            // Very dark with crazy color cycling
            demonSprite.style.filter = 'brightness(0.7) saturate(2.5) hue-rotate(0deg) contrast(1.5)';
            demonSprite.style.boxShadow = 'none';
            
            // Back and forth movement - moves backward (away) then returns to original
            const randomSpeed = 1.5 + Math.random() * 1.5; // Random speed between 1.5s and 3s
            bossBox.style.animation = `bossMoveBackAway ${randomSpeed}s ease-in-out infinite`;
            
            // Add color cycling effect
            if (!document.getElementById('boss-final-form-color-cycle')) {
                const colorCycle = setInterval(() => {
                    // Color cycling disabled - no box shadow
                }, 50);
                
                // Store interval so we can clear it later
                window.bossColorCycle = colorCycle;
            }
            
            if (eventDisplay) {
                eventDisplay.textContent = 'FINAL FORM ACTIVATED!';
                eventDisplay.style.animation = 'none';
                setTimeout(() => {
                    eventDisplay.style.animation = 'eventPulse 0.5s ease-in-out infinite';
                }, 10);
            }
            showPhaseTransitionMessage('FINAL FORM', '#8B0000');
            startDemonIdleAnimation(); // Restart with faster speed
            
            // Add pulsing and backward movement animations
            if (!document.getElementById('boss-final-form-style')) {
                const style = document.createElement('style');
                style.id = 'boss-final-form-style';
                style.textContent = `
                    @keyframes bossFinalFormPulse {
                        0%, 100% {
                            filter: brightness(0.7);
                        }
                        50% {
                            filter: brightness(0.9);
                        }
                    }
                    @keyframes bossMoveBackAway {
                        0%, 100% {
                            transform: translateX(0) translateY(0);
                        }
                        50% {
                            transform: translateX(-400px) translateY(-20px);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            break;
    }
}

// Show phase transition message
function showPhaseTransitionMessage(text, color) {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const message = document.createElement('div');
    message.textContent = text;
    message.style.position = 'absolute';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.fontSize = '64px';
    message.style.fontWeight = '900';
    message.style.color = color;
    message.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}, 2px 2px 4px rgba(0,0,0,0.9)`;
    message.style.zIndex = '2000';
    message.style.pointerEvents = 'none';
    message.style.fontFamily = '"Press Start 2P", cursive';
    message.style.letterSpacing = '8px';
    message.style.textTransform = 'uppercase';
    message.style.opacity = '0';
    message.style.transition = 'all 0.5s ease-out';
    
    boxContainer.appendChild(message);
    
    // Animate in
    setTimeout(() => {
        message.style.opacity = '1';
        message.style.transform = 'translate(-50%, -50%) scale(1.2)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => message.remove(), 500);
    }, 2000);
}

// Function to update mana
function updateMana(newMana, newMaxMana) {
    currentMana = Math.max(0, Math.min(newMaxMana, newMana));
    maxMana = newMaxMana;
    const manaBar = document.getElementById('mana-fill');
    
    if (manaBar) {
        const manaPercentage = (currentMana / maxMana) * 100;
        manaBar.style.width = manaPercentage + '%';
    }
}

// Spawn a mana ball
function spawnManaBall() {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const containerRect = boxContainer.getBoundingClientRect();
    // Spawn at random Y position, X position in middle-right area
    const x = containerRect.width * 0.6 + Math.random() * containerRect.width * 0.3;
    const y = 100 + Math.random() * (containerRect.height - 200);
    
    const manaBall = document.createElement('div');
    manaBall.className = 'mana-ball';
    manaBall.style.left = x + 'px';
    manaBall.style.top = y + 'px';
    manaBall.id = 'mana-ball-' + Date.now();
    
    boxContainer.appendChild(manaBall);
    
    const ballData = {
        element: manaBall,
        x: x,
        y: y,
        width: 40,
        height: 40,
        id: manaBall.id
    };
    
    manaBalls.push(ballData);
    
    // Remove after 10 seconds if not collected
    setTimeout(() => {
        const index = manaBalls.findIndex(b => b.id === ballData.id);
        if (index !== -1) {
            manaBalls.splice(index, 1);
            manaBall.remove();
        }
    }, 10000);
}

// Spawn a heal orb
function spawnHealOrb() {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const containerRect = boxContainer.getBoundingClientRect();
    // Spawn at random Y position, X position in middle area
    const x = containerRect.width * 0.3 + Math.random() * containerRect.width * 0.4;
    const y = 100 + Math.random() * (containerRect.height - 200);
    
    const healOrb = document.createElement('div');
    healOrb.className = 'heal-orb';
    healOrb.style.left = x + 'px';
    healOrb.style.top = y + 'px';
    healOrb.id = 'heal-orb-' + Date.now();
    
    boxContainer.appendChild(healOrb);
    
    const orbData = {
        element: healOrb,
        x: x,
        y: y,
        width: 45,
        height: 45,
        id: healOrb.id
    };
    
    healOrbs.push(orbData);
    
    // Remove after 12 seconds if not collected
    setTimeout(() => {
        const index = healOrbs.findIndex(o => o.id === orbData.id);
        if (index !== -1) {
            healOrbs.splice(index, 1);
            healOrb.remove();
        }
    }, 12000);
}

// Check collision between projectile and heal orbs
function checkHealOrbCollision(projectileX, projectileY, projectileSize) {
    for (let i = healOrbs.length - 1; i >= 0; i--) {
        const orb = healOrbs[i];
        const orbCenterX = orb.x + 22.5;
        const orbCenterY = orb.y + 22.5;
        
        // Simple circle collision detection
        const distance = Math.sqrt(
            Math.pow(projectileX - orbCenterX, 2) + 
            Math.pow(projectileY - orbCenterY, 2)
        );
        
        if (distance < (projectileSize / 2 + 22.5)) {
            // Hit! Remove orb and heal player
            orb.element.remove();
            healOrbs.splice(i, 1);
            
            // Show heal feedback
            const boxContainer = document.querySelector('.box-container');
            if (boxContainer) {
                const orbRect = orb.element.getBoundingClientRect();
                const containerRect = boxContainer.getBoundingClientRect();
                const x = orbRect.left - containerRect.left + 22.5;
                const y = orbRect.top - containerRect.top + 22.5;
                showHealFeedback(HEAL_ORB_HEAL_AMOUNT, x, y);
            }
            
            // Heal player
            updatePlayerHealth(playerHealth + HEAL_ORB_HEAL_AMOUNT);
            
            return true;
        }
    }
    return false;
}

// Check collision between projectile and mana balls
function checkManaBallCollision(projectileX, projectileY, projectileSize) {
    for (let i = manaBalls.length - 1; i >= 0; i--) {
        const ball = manaBalls[i];
        const ballCenterX = ball.x + 20;
        const ballCenterY = ball.y + 20;
        
        // Simple circle collision detection
        const distance = Math.sqrt(
            Math.pow(projectileX - ballCenterX, 2) + 
            Math.pow(projectileY - ballCenterY, 2)
        );
        
        if (distance < (projectileSize / 2 + 20)) {
            // Hit! Remove ball and add mana
            const manaAmount = 20;
            ball.element.remove();
            manaBalls.splice(i, 1);
            
            // Show mana gain feedback
            const boxContainer = document.querySelector('.box-container');
            if (boxContainer) {
                const ballRect = ball.element.getBoundingClientRect();
                const containerRect = boxContainer.getBoundingClientRect();
                const x = ballRect.left - containerRect.left + 20;
                const y = ballRect.top - containerRect.top + 20;
                showManaGainFeedback(manaAmount, x, y);
            }
            
            // Add mana via backend
            fetch('http://localhost:5001/add_mana', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amount: manaAmount})
            }).catch(err => console.error('Error adding mana:', err));
            
            return true;
        }
    }
    return false;
}

function resetHealth() {
    updatePlayerHealth(MAX_PLAYER_HEALTH);
    updateBossHealth(MAX_BOSS_HEALTH);
    updateMana(100, 100);
    // Clear all mana balls
    manaBalls.forEach(ball => ball.element.remove());
    manaBalls = [];
    lastManaBallSpawn = Date.now();
    
    // Clear all heal orbs
    healOrbs.forEach(orb => orb.element.remove());
    healOrbs = [];
    lastHealOrbSpawn = Date.now();
    
    // Reset boss phase
    currentBossPhase = 1;
    const demonSprite = document.getElementById('demon-sprite');
    const bossBox = document.querySelector('.boss-box');
    if (demonSprite) {
        demonSprite.style.filter = '';
        demonSprite.style.boxShadow = '';
        demonSprite.style.transition = '';
        demonSprite.style.opacity = '1';
        demonSprite.style.transform = '';
    }
    if (bossBox) {
        bossBox.style.animation = '';
    }
    
    // Clear color cycling if active
    if (window.bossColorCycle) {
        clearInterval(window.bossColorCycle);
        window.bossColorCycle = null;
    }
    
    console.log('Health and mana reset!');
    
}

function checkGameEnd() {
    if (playerHealth <= 0 && gameRunning) {
        console.log('Player defeated! Boss wins!');
        gameRunning = false;
        finisherMode = false; // Cancel finisher if player dies
        if (finisherTimeout) {
            clearTimeout(finisherTimeout);
            finisherTimeout = null;
        }
        // Small delay to ensure game state is updated
        setTimeout(() => {
            showGameOverScreen(false); // false = defeat
        }, 100);
    } else if (bossHealth <= 0 && gameRunning && !finisherMode) {
        console.log('Boss defeated! FINISHER MODE ACTIVATED!');
        finisherMode = true;
        finisherIceShardCount = 0;
        
        // Pause everything and show dramatic message
        showFinisherMessage();
        
        // Set timeout - if player doesn't perform finisher in time, auto-finish
        finisherTimeout = setTimeout(() => {
            console.log('Finisher timeout - auto-finishing');
            performFinisherAnimation();
        }, FINISHER_TIME_LIMIT);
    }
}

// Enhanced Game Over/Victory Screen
function showGameOverScreen(isVictory) {
    // Stop background music
    if (sounds.backgroundMusic) {
        sounds.backgroundMusic.pause();
    }
    
    // Remove any existing overlay
    const existingOverlay = document.getElementById('game-over-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create game over overlay with fire effects for victory
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    
    if (isVictory) {
        // Clean victory background
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, rgba(40, 20, 15, 0.95) 0%, rgba(10, 5, 5, 0.98) 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            animation: fadeIn 0.5s ease-in;
            overflow: hidden;
        `;
    } else {
        // Clean defeat background
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, rgba(20, 5, 5, 0.95) 0%, rgba(5, 0, 0, 0.98) 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            animation: fadeIn 0.5s ease-in;
            overflow: hidden;
        `;
    }
    
    // Add animations and styles
    const style = document.createElement('style');
    style.id = 'victory-screen-styles';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes flicker {
            0%, 100% { 
                transform: translateY(0) scaleY(1) scaleX(1);
                opacity: 0.8;
            }
            25% { 
                transform: translateY(-10px) scaleY(1.1) scaleX(0.95);
                opacity: 1;
            }
            50% { 
                transform: translateY(-20px) scaleY(0.9) scaleX(1.05);
                opacity: 0.9;
            }
            75% { 
                transform: translateY(-15px) scaleY(1.05) scaleX(0.98);
                opacity: 1;
            }
        }
        @keyframes burn {
            0%, 100% {
                text-shadow: 
                    0 0 8px rgba(200, 100, 60, 0.6),
                    0 0 15px rgba(180, 80, 50, 0.4),
                    1px 1px 3px rgba(0, 0, 0, 0.8);
            }
            50% {
                text-shadow: 
                    0 0 12px rgba(200, 100, 60, 0.8),
                    0 0 20px rgba(180, 80, 50, 0.6),
                    1px 1px 3px rgba(0, 0, 0, 0.8);
            }
        }
        @keyframes glow {
            0%, 100% {
                filter: drop-shadow(0 0 10px currentColor);
            }
            50% {
                filter: drop-shadow(0 0 20px currentColor) drop-shadow(0 0 30px currentColor);
            }
        }
        @keyframes defeatPulse {
            0%, 100% {
                text-shadow: 
                    0 0 8px rgba(120, 40, 40, 0.6),
                    0 0 15px rgba(100, 30, 30, 0.4),
                    1px 1px 3px rgba(0, 0, 0, 0.8);
            }
            50% {
                text-shadow: 
                    0 0 12px rgba(120, 40, 40, 0.8),
                    0 0 20px rgba(100, 30, 30, 0.6),
                    1px 1px 3px rgba(0, 0, 0, 0.8);
            }
        }
        @keyframes bossMoveBackForth {
            0%, 100% {
                transform: translateX(0) scale(1);
            }
            25% {
                transform: translateX(-80px) scale(0.95);
            }
            50% {
                transform: translateX(-120px) scale(0.92);
            }
            75% {
                transform: translateX(-80px) scale(0.95);
            }
        }
    `;
    document.head.appendChild(style);
    
    const title = document.createElement('h1');
    title.textContent = isVictory ? 'VICTORY' : 'DEFEAT';
    title.style.cssText = `
        color: ${isVictory ? '#d4a060' : '#b08080'};
        font-size: 80px;
        font-weight: 800;
        margin-bottom: 30px;
        letter-spacing: 6px;
        text-transform: uppercase;
        animation: ${isVictory ? 'burn 3s ease-in-out infinite, slideUp 0.8s ease-out' : 'defeatPulse 3s ease-in-out infinite, slideUp 0.8s ease-out'};
        font-family: "Press Start 2P", cursive;
        position: relative;
        z-index: 10;
        text-shadow: ${isVictory ? `
            0 0 8px rgba(200, 100, 60, 0.6),
            0 0 15px rgba(180, 80, 50, 0.4),
            1px 1px 3px rgba(0,0,0,0.8)
        ` : `
            0 0 8px rgba(120, 40, 40, 0.6),
            0 0 15px rgba(100, 30, 30, 0.4),
            1px 1px 3px rgba(0,0,0,0.8)
        `};
    `;
    
    // Add stats
    const stats = document.createElement('div');
    stats.style.cssText = `
        color: ${isVictory ? '#d4b860' : '#c4c4c4'};
        font-size: 24px;
        margin-bottom: 40px;
        text-align: center;
        animation: slideUp 0.5s ease-out 0.3s both;
        font-family: "Press Start 2P", cursive;
        font-weight: 600;
        position: relative;
        z-index: 10;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    const gameTime = typeof gameStartTime !== 'undefined' ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
    
    // Fetch favorite spell from backend
    fetch('http://localhost:5001/get_spell_stats')
        .then(response => response.json())
        .then(data => {
            const favoriteSpell = data.favorite_spell_display || "None";
            const favoriteCount = data.favorite_spell_count || 0;
            stats.innerHTML = `
                <div style="margin-bottom: 15px;">Highest Combo: ${highestCombo}x</div>
                <div style="margin-bottom: 15px;">Time: ${gameTime}s</div>
                <div style="margin-bottom: 15px;">Favorite Spell: ${favoriteSpell} (${favoriteCount}x)</div>
                <div>Final Boss HP: ${Math.max(0, bossHealth)}/${MAX_BOSS_HEALTH}</div>
            `;
        })
        .catch(err => {
            console.error('Error fetching spell stats:', err);
            // Fallback if fetch fails
            stats.innerHTML = `
                <div style="margin-bottom: 15px;">Highest Combo: ${highestCombo}x</div>
                <div style="margin-bottom: 15px;">Time: ${gameTime}s</div>
                <div style="margin-bottom: 15px;">Favorite Spell: N/A</div>
                <div>Final Boss HP: ${Math.max(0, bossHealth)}/${MAX_BOSS_HEALTH}</div>
            `;
        });
    
    const replayButton = document.createElement('button');
    replayButton.textContent = 'PLAY AGAIN';
    replayButton.style.cssText = `
        padding: 18px 45px;
        font-size: 22px;
        font-weight: 700;
        background: ${isVictory ? 'linear-gradient(135deg, #b46040, #c47858)' : 'linear-gradient(135deg, #804040, #603030)'};
        color: #e8e8e8;
        border: 2px solid ${isVictory ? 'rgba(200, 140, 100, 0.6)' : 'rgba(140, 100, 100, 0.6)'};
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s;
        animation: slideUp 0.5s ease-out 0.5s both;
        font-family: "Press Start 2P", cursive;
        letter-spacing: 1px;
        text-transform: uppercase;
        position: relative;
        z-index: 10;
    `;
    replayButton.onmouseover = function() {
        if (isVictory) {
            this.style.background = 'linear-gradient(135deg, #c47858, #b46040)';
        } else {
            this.style.background = 'linear-gradient(135deg, #603030, #804040)';
        }
        this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        this.style.transform = 'scale(1.05) translateY(-2px)';
    };
    replayButton.onmouseout = function() {
        if (isVictory) {
            this.style.background = 'linear-gradient(135deg, #b46040, #c47858)';
        } else {
            this.style.background = 'linear-gradient(135deg, #804040, #603030)';
        }
        this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        this.style.transform = 'scale(1) translateY(0)';
    };
    replayButton.onclick = function() {
        overlay.remove();
        replayGame();
    };
    
    // Create Return Home button
    const homeButton = document.createElement('a');
    homeButton.href = 'start-page.html';
    homeButton.textContent = 'RETURN HOME';
    homeButton.style.cssText = `
        padding: 18px 45px;
        font-size: 22px;
        font-weight: 700;
        background: linear-gradient(135deg, #505050, #303030);
        color: #e8e8e8;
        border: 2px solid rgba(120, 120, 120, 0.6);
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s;
        animation: slideUp 0.5s ease-out 0.7s both;
        font-family: "Press Start 2P", cursive;
        letter-spacing: 1px;
        text-transform: uppercase;
        position: relative;
        z-index: 10;
        text-decoration: none;
        display: inline-block;
    `;
    homeButton.onmouseover = function() {
        this.style.background = 'linear-gradient(135deg, #606060, #404040)';
        this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        this.style.transform = 'scale(1.05) translateY(-2px)';
    };
    homeButton.onmouseout = function() {
        this.style.background = 'linear-gradient(135deg, #505050, #303030)';
        this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        this.style.transform = 'scale(1) translateY(0)';
    };
    
    // Create button container to arrange buttons side by side
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        width: 100%;
        animation: slideUp 0.5s ease-out 0.5s both;
    `;
    buttonContainer.appendChild(replayButton);
    buttonContainer.appendChild(homeButton);
    
    overlay.appendChild(title);
    overlay.appendChild(stats);
    overlay.appendChild(buttonContainer);
    document.body.appendChild(overlay);
}

// Helper function to show combo messages
function showComboMessage(text, color = 0xFFD700) {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const message = document.createElement('div');
    message.textContent = text;
    message.style.position = 'absolute';
    message.style.top = '20%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.fontSize = '48px';
    message.style.fontWeight = 'bold';
    message.style.color = `#${color.toString(16).padStart(6, '0')}`;
    message.style.textShadow = '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.5)';
    message.style.zIndex = '1000';
    message.style.pointerEvents = 'none';
    message.style.animation = 'comboPulse 0.5s ease-out';
    
    // Add animation
    if (!document.getElementById('combo-animation-style')) {
        const style = document.createElement('style');
        style.id = 'combo-animation-style';
        style.textContent = `
            @keyframes comboPulse {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            }
        `;
        document.head.appendChild(style);
    }
    
    boxContainer.appendChild(message);
    
    setTimeout(() => {
        message.style.transition = 'all 0.5s ease-out';
        message.style.opacity = '0';
        message.style.transform = 'translate(-50%, -100%) scale(0.5)';
        setTimeout(() => message.remove(), 500);
    }, 2000);
}

// Helper function to show damage numbers
function showDamageNumber(damage, x, y, color = '#FF4444', isHealing = false) {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const damageText = document.createElement('div');
    damageText.textContent = isHealing ? `+${damage}` : `-${damage}`;
    damageText.style.position = 'absolute';
    damageText.style.left = x + 'px';
    damageText.style.top = y + 'px';
    damageText.style.fontSize = '36px';
    damageText.style.fontWeight = 'bold';
    damageText.style.color = color;
    damageText.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    damageText.style.zIndex = '1001';
    damageText.style.pointerEvents = 'none';
    damageText.style.userSelect = 'none';
    
    boxContainer.appendChild(damageText);
    
    // Animate damage number
    let startY = y;
    let opacity = 1;
    let scale = 1;
    const animate = () => {
        startY -= 2;
        opacity -= 0.02;
        scale += 0.02;
        damageText.style.top = startY + 'px';
        damageText.style.opacity = opacity;
        damageText.style.transform = `scale(${scale})`;
        
        if (opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            damageText.remove();
        }
    };
    requestAnimationFrame(animate);
}

// Visual feedback for gesture detection
let lastDetectedGesture = 'NONE';
function showGestureFeedback(gesture) {
    if (gesture === 'NONE' || gesture === lastDetectedGesture) return;
    
    lastDetectedGesture = gesture;
    
    const canvas = document.getElementById('output-canvas');
    if (!canvas) return;
    
    // Flash effect on canvas
    canvas.style.transition = 'filter 0.1s';
    canvas.style.filter = 'brightness(1.3) saturate(1.5)';
    
    setTimeout(() => {
        canvas.style.filter = 'brightness(1) saturate(1)';
    }, 100);
}

// Draw spell circles on hands based on gesture
function drawSpellCircle(ctx, landmarks, gesture, canvasWidth, canvasHeight) {
    if (gesture === 'NONE') return;
    
    // Get middle finger knuckle (landmark 9) for circle positioning
    const middleFingerKnuckle = landmarks[9];
    const centerX = middleFingerKnuckle.x * canvasWidth;
    const centerY = middleFingerKnuckle.y * canvasHeight;
    
    // Gesture-specific circle styles
    let circleConfig = {
        outerColor: '#FF4500',
        innerColor: '#FF6347',
        runeColor: '#FFD700',
        size: 80,
        rotation: 0
    };
    
    const time = Date.now() / 1000;
    const rotationSpeed = 0.5;
    
    switch(gesture) {
        case 'FIST':
            // Fireball - Red/Orange circles with fire runes
            circleConfig = {
                outerColor: '#FF4500',
                innerColor: '#FF6347',
                runeColor: '#FFD700',
                size: 180,
                rotation: time * rotationSpeed
            };
            break;
        case 'OPEN_PALM':
            // Ice Shard - Blue/Cyan circles with ice runes
            circleConfig = {
                outerColor: '#4169E1',
                innerColor: '#64B5F6',
                runeColor: '#B0E0E6',
                size: 200,
                rotation: -time * rotationSpeed
            };
            break;
        case 'POINT':
            // Lightning - Purple/White circles with lightning runes
            circleConfig = {
                outerColor: '#9370DB',
                innerColor: '#BA55D3',
                runeColor: '#FFFFFF',
                size: 170,
                rotation: time * rotationSpeed * 1.5
            };
            break;
        default:
            return;
    }
    
    ctx.save();
    
    // Draw outer glowing circle - toned down
    const gradient1 = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, circleConfig.size);
    gradient1.addColorStop(0, circleConfig.innerColor + '40');
    gradient1.addColorStop(0.5, circleConfig.outerColor + '20');
    gradient1.addColorStop(1, circleConfig.outerColor + '00');
    
    ctx.fillStyle = gradient1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleConfig.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw main circle ring - toned down
    ctx.strokeStyle = circleConfig.outerColor;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = circleConfig.outerColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleConfig.size * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw inner circle - toned down
    ctx.strokeStyle = circleConfig.innerColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = circleConfig.innerColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleConfig.size * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw rotating runes/symbols
    ctx.translate(centerX, centerY);
    ctx.rotate(circleConfig.rotation);
    
    ctx.strokeStyle = circleConfig.runeColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = circleConfig.runeColor;
    
    // Draw runic symbols (simplified - triangles and lines)
    const runeCount = gesture === 'OPEN_PALM' ? 6 : 8;
    const runeRadius = circleConfig.size * 0.5;
    
    for (let i = 0; i < runeCount; i++) {
        const angle = (Math.PI * 2 * i) / runeCount;
        const x = Math.cos(angle) * runeRadius;
        const y = Math.sin(angle) * runeRadius;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2);
        
        // Draw rune based on gesture
        if (gesture === 'FIST') {
            // Fire rune - triangle pointing outward
            ctx.beginPath();
            ctx.moveTo(0, -16);
            ctx.lineTo(-12, 16);
            ctx.lineTo(12, 16);
            ctx.closePath();
            ctx.stroke();
        } else if (gesture === 'OPEN_PALM') {
            // Ice rune - snowflake-like
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(0, 20);
            ctx.moveTo(-16, -16);
            ctx.lineTo(16, 16);
            ctx.moveTo(-16, 16);
            ctx.lineTo(16, -16);
            ctx.stroke();
        } else if (gesture === 'POINT') {
            // Lightning rune - zigzag
            ctx.beginPath();
            ctx.moveTo(-12, -20);
            ctx.lineTo(0, 0);
            ctx.lineTo(-8, 0);
            ctx.lineTo(12, 20);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // Draw center symbol
    ctx.strokeStyle = circleConfig.runeColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (gesture === 'FIST') {
        // Fire symbol - small circle with point
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = circleConfig.runeColor + '40';
        ctx.fill();
    } else if (gesture === 'OPEN_PALM') {
        // Ice symbol - hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const x = Math.cos(angle) * 16;
            const y = Math.sin(angle) * 16;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    } else if (gesture === 'POINT') {
        // Lightning symbol - star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const radius = i % 2 === 0 ? 20 : 10;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    
    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.restore();
    
    // Draw pulsing particles - reduced
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + time * 1.5;
        const dist = circleConfig.size * 0.7 + Math.sin(time * 2 + i) * 8;
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;
        
        ctx.fillStyle = circleConfig.runeColor + '50';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Show mana gain feedback
function showManaGainFeedback(amount, x, y) {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const manaText = document.createElement('div');
    manaText.textContent = `+${amount} Mana`;
    manaText.style.position = 'absolute';
    manaText.style.left = x + 'px';
    manaText.style.top = y + 'px';
    manaText.style.fontSize = '28px';
    manaText.style.fontWeight = 'bold';
    manaText.style.color = '#4A9EFF';
    manaText.style.textShadow = '0 0 6px rgba(74, 158, 255, 0.6), 0 0 12px rgba(74, 158, 255, 0.4), 1px 1px 2px rgba(0,0,0,0.8)';
    manaText.style.zIndex = '1002';
    manaText.style.pointerEvents = 'none';
    manaText.style.userSelect = 'none';
    manaText.style.fontFamily = '"Press Start 2P", cursive';
    
    boxContainer.appendChild(manaText);
    
    // Animate mana text
    let startY = y;
    let opacity = 1;
    let scale = 0.8;
    const animate = () => {
        startY -= 3;
        opacity -= 0.015;
        scale += 0.02;
        manaText.style.top = startY + 'px';
        manaText.style.opacity = opacity;
        manaText.style.transform = `scale(${scale})`;
        
        if (opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            manaText.remove();
        }
    };
    requestAnimationFrame(animate);
}

// Show heal feedback
function showHealFeedback(amount, x, y) {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return;
    
    const healText = document.createElement('div');
    healText.textContent = `+${amount} HP`;
    healText.style.position = 'absolute';
    healText.style.left = x + 'px';
    healText.style.top = y + 'px';
    healText.style.fontSize = '28px';
    healText.style.fontWeight = 'bold';
    healText.style.color = '#00FF88';
    healText.style.textShadow = '0 0 6px rgba(0, 255, 136, 0.6), 0 0 12px rgba(0, 255, 136, 0.4), 1px 1px 2px rgba(0,0,0,0.8)';
    healText.style.zIndex = '1002';
    healText.style.pointerEvents = 'none';
    healText.style.userSelect = 'none';
    healText.style.fontFamily = '"Press Start 2P", cursive';
    
    boxContainer.appendChild(healText);
    
    // Animate heal text
    let startY = y;
    let opacity = 1;
    let scale = 0.8;
    const animate = () => {
        startY -= 3;
        opacity -= 0.015;
        scale += 0.02;
        healText.style.top = startY + 'px';
        healText.style.opacity = opacity;
        healText.style.transform = `scale(${scale})`;
        
        if (opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            healText.remove();
        }
    };
    requestAnimationFrame(animate);
}

function replayGame() {
    // Remove game over overlay
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.remove();
    
    // Reset game state
    gameStartTime = Date.now();
    resetHealth();
    comboCount = 0;
    highestCombo = 0;
    comboJustReset = true; // Flag to prevent backend from overwriting
    finisherMode = false; // Reset finisher mode
    finisherIceShardCount = 0;
    if (finisherTimeout) {
        clearTimeout(finisherTimeout);
        finisherTimeout = null;
    }
    lastDetectedGesture = 'NONE';
    gameRunning = true;
    
    // Reset combo and spell stats in backend
    fetch('http://localhost:5001/reset_combo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    }).catch(err => console.error('Error resetting combo:', err));
    
    fetch('http://localhost:5001/reset_spell_stats', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    }).catch(err => console.error('Error resetting spell stats:', err));
    
    updateComboDisplay();
    
    // Restart background music
    if (sounds.backgroundMusic) {
        sounds.backgroundMusic.currentTime = 0;
        sounds.backgroundMusic.play().catch(err => {
            console.log("Background music autoplay blocked:", err);
        });
    }
    
    gameLoop();
}

// --- ⭐️ MODIFIED THIS FUNCTION ⭐️ ---
// Fireball animation (now accepts damage)
function playFireballAnimation(damage = 10) { // Default damage is 10
    // Play sound effect
    if (sounds.fireball) {
        const sound = sounds.fireball.cloneNode();
        sound.volume = 0.6;
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
    const playerBox = document.querySelector('.player-box');
    const bossBox = document.querySelector('.boss-box');
    const boxContainer = document.querySelector('.box-container');
    const fireballFrames = ['FB001.png', 'FB002.png', 'FB003.png', 'FB004.png', 'FB005.png'];
    
    // ... (rest of function is the same: get hand position, create sprite) ...
    let startX = 300; 
    let startY = 350;
    
    if (lastHandPosition) {
        startX = 600 - lastHandPosition.x;
        startY = lastHandPosition.y;
    }
    
    const playerRect = playerBox.getBoundingClientRect();
    const containerRect = boxContainer.getBoundingClientRect();
    const offsetX = playerRect.left - containerRect.left;
    
    const fireball = document.createElement('img');
    fireball.className = 'fireball-sprite';
    fireball.src = `../../assets/fireball/${fireballFrames[0]}`;
    fireball.style.position = 'absolute';
    fireball.style.left = (offsetX + startX) + 'px';
    fireball.style.top = startY + 'px';
    fireball.style.width = '100px';
    fireball.style.height = '100px';
    fireball.style.transform = 'translate(-50%, -50%)';
    fireball.style.zIndex = '10';
    
    boxContainer.appendChild(fireball);
    
    let currentFrame = 0;
    let currentX = offsetX + startX;
    let currentSize = 100;
    const targetX = offsetX + 600 + 300;
    const frameInterval = 30; // Faster: 50 -> 30ms
    const speed = 30; // Faster: 20 -> 30 pixels per frame
    const growthRate = 3;
    
    const animationInterval = setInterval(() => {
        // ... (animation/movement logic) ...
        currentFrame = (currentFrame + 1) % fireballFrames.length;
        fireball.src = `../../assets/fireball/${fireballFrames[currentFrame]}`;
        currentX += speed;
        currentSize += growthRate;
        fireball.style.left = currentX + 'px';
        fireball.style.width = currentSize + 'px';
        fireball.style.height = currentSize + 'px';
        
        // Check for mana ball collision
        const fireballCenterY = startY;
        if (checkManaBallCollision(currentX, fireballCenterY, currentSize)) {
            // Hit a mana ball, continue flying but don't damage boss
        }
        
        // Check for heal orb collision
        if (checkHealOrbCollision(currentX, fireballCenterY, currentSize)) {
            // Hit a heal orb, continue flying but don't damage boss
        }

        // Remove when it reaches the boss box
        if (currentX > targetX) {
            clearInterval(animationInterval);
            fireball.remove();
            
            // --- ⭐️ USE THE DAMAGE PARAMETER ⭐️ ---
            playDemonHitAnimation(damage); // Use the damage we passed in
        }
    }, frameInterval);
}
// --- ⭐️ END OF MODIFIED FUNCTION ⭐️ ---


// Ice shard animation
function playIceShardAnimation() {
    // Play sound effect
    if (sounds.iceShard) {
        const sound = sounds.iceShard.cloneNode();
        sound.volume = 0.9;
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
    const boxContainer = document.querySelector('.box-container');
    
    const iceShardFrames = [
        'VFX 1 Repeatable1.png',
        'VFX 1 Repeatable2.png',
        'VFX 1 Repeatable3.png',
        'VFX 1 Repeatable4.png',
        'VFX 1 Repeatable5.png',
        'VFX 1 Repeatable6.png',
        'VFX 1 Repeatable7.png',
        'VFX 1 Repeatable8.png',
        'VFX 1 Repeatable9.png',
        'VFX 1 Repeatable10.png'
    ];
    
    // Get hand position or default to left side
    let startX = 200; // Left side of screen
    let startY = 350; // middle height
    
    if (lastHandPosition) {
        // Use hand position directly (canvas is already in viewport coordinates)
        startX = lastHandPosition.x;
        startY = lastHandPosition.y;
    }
    
    // Create ice shard sprite element in the container
    const iceShard = document.createElement('img');
    iceShard.className = 'ice-shard-sprite';
    iceShard.src = `../../assets/ice shards/${iceShardFrames[0]}`;
    iceShard.style.position = 'absolute';
    iceShard.style.left = startX + 'px';
    iceShard.style.top = startY + 'px';
    iceShard.style.width = '120px';
    iceShard.style.height = '120px';
    iceShard.style.transform = 'translate(-50%, -50%)';
    iceShard.style.zIndex = '10';
    
    boxContainer.appendChild(iceShard);
    
    let currentFrame = 0;
    let currentX = startX;
    let currentSize = 120;
    const containerRect = boxContainer.getBoundingClientRect();
    const targetX = containerRect.width - 300; // Boss box center
    const frameInterval = 30; // Faster: 50 -> 30ms
    const speed = 32; // Faster: 22 -> 32 pixels per frame
    const growthRate = 2.5; // pixels per frame
    
    const animationInterval = setInterval(() => {
        // Update frame
        currentFrame = (currentFrame + 1) % iceShardFrames.length;
        iceShard.src = `../../assets/ice shards/${iceShardFrames[currentFrame]}`;
        
        // Move ice shard to the right and grow
        currentX += speed;
        currentSize += growthRate;
        iceShard.style.left = currentX + 'px';
        iceShard.style.width = currentSize + 'px';
        iceShard.style.height = currentSize + 'px';
        
        // Check for mana ball collision
        if (checkManaBallCollision(currentX, startY, currentSize)) {
            // Hit a mana ball, continue flying but don't damage boss
        }
        
        // Check for heal orb collision
        if (checkHealOrbCollision(currentX, startY, currentSize)) {
            // Hit a heal orb, continue flying but don't damage boss
        }
        
        // Remove when it reaches the boss box
        if (currentX > targetX) {
            clearInterval(animationInterval);
            iceShard.remove();
            playDemonHitAnimation(8); // Trigger hit animation with 8 damage
        }
    }, frameInterval);
}

// Lightning animation
function playLightningAnimation() {
    // Play sound effect
    if (sounds.thunder) {
        const sound = sounds.thunder.cloneNode();
        sound.volume = 0.7;
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
    const bossBox = document.querySelector('.boss-box');
    const demonSprite = document.getElementById('demon-sprite');
    
    const lightningFrames = [
        'lightning_line1b8.png',
        'lightning_line1b9.png',
        'lightning_line1b11.png',
        'lightning_line1b12.png'
    ];
    
    // Create lightning sprite element above the boss
    const lightning = document.createElement('img');
    lightning.className = 'lightning-sprite';
    lightning.src = `../../assets/lighting/${lightningFrames[0]}`;
    lightning.style.position = 'absolute';
    lightning.style.left = '50%';
    lightning.style.top = '0';
    lightning.style.width = '300px';
    lightning.style.height = '700px';
    lightning.style.transform = 'translateX(-50%)';
    lightning.style.zIndex = '15';
    lightning.style.opacity = '0.9';
    
    bossBox.appendChild(lightning);
    
    let currentFrame = 0;
    let flashCount = 0;
    const maxFlashes = 3;
    const frameInterval = 40; // Faster: 60 -> 40ms per frame
    
    const animationInterval = setInterval(() => {
        // Update frame
        currentFrame = (currentFrame + 1) % lightningFrames.length;
        lightning.src = `../../assets/lighting/${lightningFrames[currentFrame]}`;
        
        // Flash effect
        if (currentFrame === 0) {
            flashCount++;
        }
        
        // Remove after flashes complete
        if (flashCount >= maxFlashes) {
            clearInterval(animationInterval);
            lightning.remove();
            playDemonHitAnimation(12); // Trigger hit animation with 12 damage
        }
    }, frameInterval);
}

// Demon idle animation loop
function startDemonIdleAnimation() {
    const demonSprite = document.getElementById('demon-sprite');
    const idleFrames = [
        'demon_idle_1.png',
        'demon_idle_2.png',
        'demon_idle_3.png',
        'demon_idle_4.png',
        'demon_idle_5.png',
        'demon_idle_6.png'
    ];
    
    let currentFrame = 0;
    
    demonIdleInterval = setInterval(() => {
        if (demonAnimationState === 'idle') {
            currentFrame = (currentFrame + 1) % idleFrames.length;
            demonSprite.src = `../../assets/demon idle/${idleFrames[currentFrame]}`;
            
            // Phase 2+ idle animation is faster and more aggressive
            // Animation speed is handled by interval timing
        }
    }, currentBossPhase >= 2 ? 120 : 150); // Faster idle in later phases
}

// Demon take hit animation
function playDemonHitAnimation(damage = 0) {
    // Don't interrupt cleave animation - it's more important
    if (demonAnimationState === 'cleave') {
        // Reduce damage when demon is attacking (50% damage reduction)
        const reducedDamage = Math.floor(damage * 0.5);
        // Queue the damage to apply after cleave finishes
        setTimeout(() => {
            if (reducedDamage > 0) {
                // Show damage number for reduced damage
                const bossBox = document.querySelector('.boss-box');
                if (bossBox) {
                    const boxRect = bossBox.getBoundingClientRect();
                    const containerRect = document.querySelector('.box-container').getBoundingClientRect();
                    const x = boxRect.left - containerRect.left + boxRect.width / 2;
                    const y = boxRect.top - containerRect.top + boxRect.height / 2;
                    showDamageNumber(reducedDamage, x, y, '#FFAA00'); // Orange for reduced damage
                }
                updateBossHealth(bossHealth - reducedDamage);
            }
        }, 1200); // Wait for cleave to finish (15 frames * 80ms = 1200ms)
        return;
    }
    
    // Clear any existing hit animation
    if (demonHitInterval) {
        clearInterval(demonHitInterval);
    }
    
    const demonSprite = document.getElementById('demon-sprite');
    const hitFrames = [
        'demon_take_hit_1.png',
        'demon_take_hit_2.png',
        'demon_take_hit_3.png',
        'demon_take_hit_4.png',
        'demon_take_hit_5.png'
    ];
    
    demonAnimationState = 'hit';
    let currentFrame = 0;
    
    demonHitInterval = setInterval(() => {
        if (currentFrame < hitFrames.length) {
            demonSprite.src = `../../assets/demon_take_hit/${hitFrames[currentFrame]}`;
            currentFrame++;
        } else {
            clearInterval(demonHitInterval);
            demonHitInterval = null;
            demonAnimationState = 'idle'; // Return to idle
            
            // Apply damage after hit animation completes
            if (damage > 0) {
                // Show damage number
                const bossBox = document.querySelector('.boss-box');
                if (bossBox) {
                    const boxRect = bossBox.getBoundingClientRect();
                    const containerRect = document.querySelector('.box-container').getBoundingClientRect();
                    const x = boxRect.left - containerRect.left + boxRect.width / 2;
                    const y = boxRect.top - containerRect.top + boxRect.height / 2;
                    showDamageNumber(damage, x, y, '#FF4444');
                }
                updateBossHealth(bossHealth - damage);
            }
        }
    }, 100);
}

// Demon cleave attack animation
function playDemonCleaveAnimation(damage = 0) {
    // Don't start if already cleaving or walking
    if (demonAnimationState === 'cleave' || demonAnimationState === 'walk') {
        return;
    }
    
    // Clear any existing hit animation - cleave has priority
    if (demonHitInterval) {
        clearInterval(demonHitInterval);
        demonHitInterval = null;
    }
    
    const demonSprite = document.getElementById('demon-sprite');
    const cleaveFrames = [
        'demon_cleave_1.png',
        'demon_cleave_2.png',
        'demon_cleave_3.png',
        'demon_cleave_4.png',
        'demon_cleave_5.png',
        'demon_cleave_6.png',
        'demon_cleave_7.png',
        'demon_cleave_8.png',
        'demon_cleave_9.png',
        'demon_cleave_10.png',
        'demon_cleave_11.png',
        'demon_cleave_12.png',
        'demon_cleave_13.png',
        'demon_cleave_14.png',
        'demon_cleave_15.png'
    ];
    
    demonAnimationState = 'cleave';
    let currentFrame = 0;
    
    // Phase 2+ uses faster animation
    const frameSpeed = currentBossPhase >= 2 ? 65 : 80;
    
    demonCleaveInterval = setInterval(() => {
        if (currentFrame < cleaveFrames.length) {
            demonSprite.src = `../../assets/demon_cleave/${cleaveFrames[currentFrame]}`;
            currentFrame++;
        } else {
            clearInterval(demonCleaveInterval);
            demonCleaveInterval = null;
            demonAnimationState = 'idle'; // Return to idle
            
            // Apply damage after cleave animation completes
            if (damage > 0) {
                updatePlayerHealth(playerHealth - damage);
            }
        }
    }, frameSpeed);
}

// Demon walk attack animation (phase 2+)
function playDemonWalkAttack(damage = 0) {
    // Don't start if already attacking
    if (demonAnimationState === 'cleave' || demonAnimationState === 'walk') {
        return;
    }
    
    // Clear any existing hit animation
    if (demonHitInterval) {
        clearInterval(demonHitInterval);
        demonHitInterval = null;
    }
    
    const demonSprite = document.getElementById('demon-sprite');
    const walkFrames = [
        'demon_walk_1.png',
        'demon_walk_2.png',
        'demon_walk_3.png',
        'demon_walk_4.png',
        'demon_walk_5.png',
        'demon_walk_6.png',
        'demon_walk_7.png',
        'demon_walk_8.png',
        'demon_walk_9.png',
        'demon_walk_10.png',
        'demon_walk_11.png',
        'demon_walk_12.png'
    ];
    
    demonAnimationState = 'walk';
    let currentFrame = 0;
    const totalFrames = walkFrames.length * 2; // Loop through twice for attack
    
    // Faster in phase 3
    const frameSpeed = currentBossPhase === 3 ? 50 : 70;
    
    const walkInterval = setInterval(() => {
        if (currentFrame < totalFrames) {
            const frameIndex = currentFrame % walkFrames.length;
            demonSprite.src = `../../assets/demon walk/${walkFrames[frameIndex]}`;
            currentFrame++;
        } else {
            clearInterval(walkInterval);
            demonAnimationState = 'idle'; // Return to idle
            
            // Apply damage after walk attack completes
            if (damage > 0) {
                updatePlayerHealth(playerHealth - damage);
            }
        }
    }, frameSpeed);
}

// Show dramatic finisher message overlay
function showFinisherMessage() {
    // Stop boss movement animation
    const bossBox = document.querySelector('.boss-box');
    if (bossBox) {
        bossBox.style.animation = ''; // Stop all animations
        bossBox.style.transform = ''; // Reset transform
    }
    
    // Remove any existing finisher message
    const existingMessage = document.getElementById('finisher-message-overlay');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'finisher-message-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease-in;
    `;
    
    // Create message text
    const message = document.createElement('div');
    message.textContent = 'UNLEASH 2 OPEN PALMS!';
    message.style.cssText = `
        font-size: 72px;
        font-weight: 900;
        color: #00BFFF;
        text-shadow: 
            0 0 20px rgba(0, 191, 255, 0.8),
            0 0 40px rgba(0, 191, 255, 0.6),
            0 0 60px rgba(0, 191, 255, 0.4),
            0 0 80px rgba(0, 191, 255, 0.2),
            2px 2px 4px rgba(0, 0, 0, 0.8);
        font-family: 'Orbitron', sans-serif;
        letter-spacing: 8px;
        text-transform: uppercase;
        text-align: center;
        animation: pulse 1.5s ease-in-out infinite, slideDown 0.5s ease-out;
        line-height: 1.2;
        margin-bottom: 40px;
    `;
    
    // Create palm counter
    const counter = document.createElement('div');
    counter.id = 'finisher-counter';
    counter.textContent = '0/2';
    counter.style.cssText = `
        font-size: 48px;
        font-weight: 700;
        color: #FFFFFF;
        text-shadow: 
            0 0 15px rgba(255, 255, 255, 0.8),
            0 0 30px rgba(0, 191, 255, 0.6),
            2px 2px 4px rgba(0, 0, 0, 0.8);
        font-family: 'Orbitron', sans-serif;
        text-align: center;
        animation: slideDown 0.5s ease-out 0.2s both;
    `;
    
    // Add pulsing animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                opacity: 1;
            }
            50% {
                transform: scale(1.05);
                opacity: 0.9;
            }
        }
        @keyframes slideDown {
            from {
                transform: translateY(-50px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
        @keyframes counterPulse {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.2);
            }
            100% {
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(message);
    overlay.appendChild(counter);
    document.body.appendChild(overlay);
    
    // Auto-hide after 3 seconds, or when player starts performing finisher
    // The message will be removed when finisher animation starts
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 500);
        }
    }, 3000);
}

// Update finisher counter display
function updateFinisherCounter() {
    const counter = document.getElementById('finisher-counter');
    if (counter) {
        counter.textContent = `${finisherIceShardCount}/2`;
        
        // Add pulse effect when counter updates
        counter.style.animation = 'none';
        setTimeout(() => {
            counter.style.animation = 'counterPulse 0.3s ease-out';
        }, 10);
    }
}

// Epic Finisher Animation - Two open palms (ice shards)
function performFinisherAnimation() {
    // Remove finisher message overlay if still visible
    const finisherMessage = document.getElementById('finisher-message-overlay');
    if (finisherMessage) {
        finisherMessage.remove();
    }
    console.log('EPIC FINISHER ANIMATION!');
    finisherMode = false; // Exit finisher mode
    
    // Stop all boss animations
    if (demonIdleInterval) {
        clearInterval(demonIdleInterval);
        demonIdleInterval = null;
    }
    if (demonHitInterval) {
        clearInterval(demonHitInterval);
        demonHitInterval = null;
    }
    if (demonCleaveInterval) {
        clearInterval(demonCleaveInterval);
        demonCleaveInterval = null;
    }
    
    const boxContainer = document.querySelector('.box-container');
    const bossBox = document.querySelector('.boss-box');
    if (!boxContainer || !bossBox) return;
    
    const bossRect = bossBox.getBoundingClientRect();
    const containerRect = boxContainer.getBoundingClientRect();
    const centerX = bossRect.left - containerRect.left + bossRect.width / 2;
    const centerY = bossRect.top - containerRect.top + bossRect.height / 2;
    
    // Play ice shard sound effect (double for epic effect)
    if (sounds.iceShard) {
        const iceSound1 = sounds.iceShard.cloneNode();
        iceSound1.volume = 1.0;
        iceSound1.play().catch(err => console.log("Sound play failed:", err));
        
        // Second ice shard sound slightly delayed for epic effect
        setTimeout(() => {
            const iceSound2 = sounds.iceShard.cloneNode();
            iceSound2.volume = 1.0;
            iceSound2.play().catch(err => console.log("Sound play failed:", err));
        }, 200);
    }
    
    // Show epic finisher message
    showComboMessage("EPIC FINISHER!", 0x00BFFF);
    
    // Create massive explosion effect at boss center
    const explosion = document.createElement('div');
    explosion.style.position = 'absolute';
    explosion.style.left = centerX + 'px';
    explosion.style.top = centerY + 'px';
    explosion.style.width = '0px';
    explosion.style.height = '0px';
    explosion.style.transform = 'translate(-50%, -50%)';
    explosion.style.zIndex = '25';
    explosion.style.pointerEvents = 'none';
    boxContainer.appendChild(explosion);
    
    // Create massive flash (ice-themed)
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = '0px';
    flash.style.top = '0px';
    flash.style.width = '400px';
    flash.style.height = '400px';
    flash.style.transform = 'translate(-50%, -50%)';
    flash.style.borderRadius = '50%';
    flash.style.background = 'radial-gradient(circle, rgba(255,255,255,1), rgba(173,216,230,0.9), rgba(135,206,250,0.7), rgba(70,130,180,0.5))';
    flash.style.opacity = '1';
    flash.style.zIndex = '26';
    explosion.appendChild(flash);
    
    // Create ice shard particles (white/blue/cyan)
    const iceParticles = [];
    for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        const angle = (Math.PI * 2 * i) / 40;
        const size = Math.random() * 10 + 5;
        
        particle.style.position = 'absolute';
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.borderRadius = '50%';
        particle.style.background = `radial-gradient(circle, rgba(255,255,255,1), rgba(173,216,230,0.9), rgba(135,206,250,0.7))`;
        particle.style.boxShadow = `0 0 ${size}px rgba(173,216,230,0.8), 0 0 ${size * 2}px rgba(135,206,250,0.6)`;
        particle.style.left = '0px';
        particle.style.top = '0px';
        particle.style.transform = 'translate(-50%, -50%)';
        particle.style.opacity = '1';
        explosion.appendChild(particle);
        
        iceParticles.push({
            element: particle,
            angle: angle,
            distance: 0,
            speed: Math.random() * 10 + 5
        });
    }
    
    // Create additional crystalline shards (elongated ice crystals)
    const crystalParticles = [];
    for (let i = 0; i < 25; i++) {
        const particle = document.createElement('div');
        const angle = (Math.PI * 2 * i) / 25;
        const size = Math.random() * 8 + 4;
        
        particle.style.position = 'absolute';
        particle.style.width = size + 'px';
        particle.style.height = size * 2.5 + 'px'; // Elongated like ice crystals
        particle.style.borderRadius = '2px';
        particle.style.background = `linear-gradient(to bottom, rgba(255,255,255,1), rgba(200,230,255,0.9), rgba(135,206,250,0.7))`;
        particle.style.boxShadow = `0 0 ${size}px rgba(255,255,255,0.8)`;
        particle.style.left = '0px';
        particle.style.top = '0px';
        particle.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
        particle.style.opacity = '1';
        explosion.appendChild(particle);
        
        crystalParticles.push({
            element: particle,
            angle: angle,
            distance: 0,
            speed: Math.random() * 8 + 4
        });
    }
    
    // Screen shake effect
    let shakeOffset = 0;
    const shakeInterval = setInterval(() => {
        shakeOffset = (Math.random() - 0.5) * 10;
        boxContainer.style.transform = `translate(${shakeOffset}px, ${shakeOffset}px)`;
    }, 50);
    
    // Screen flash overlay
    const screenFlash = document.createElement('div');
    screenFlash.style.position = 'fixed';
    screenFlash.style.top = '0';
    screenFlash.style.left = '0';
    screenFlash.style.width = '100%';
    screenFlash.style.height = '100%';
    screenFlash.style.background = 'rgba(255,255,255,0.3)';
    screenFlash.style.zIndex = '9998';
    screenFlash.style.pointerEvents = 'none';
    screenFlash.style.opacity = '0';
    document.body.appendChild(screenFlash);
    
    let frame = 0;
    const maxFrames = 60; // ~1 second at 60fps
    
    const animationInterval = setInterval(() => {
        frame++;
        
        // Expand flash
        if (frame < 10) {
            const size = 400 + frame * 30;
            flash.style.width = size + 'px';
            flash.style.height = size + 'px';
            screenFlash.style.opacity = Math.min(0.5, frame / 20);
        } else if (frame < 30) {
            flash.style.opacity = Math.max(0, 1 - ((frame - 10) / 20));
            screenFlash.style.opacity = Math.max(0, 0.5 - ((frame - 10) / 40));
        }
        
        // Expand ice particles
        iceParticles.forEach(particle => {
            particle.distance += particle.speed;
            const x = Math.cos(particle.angle) * particle.distance;
            const y = Math.sin(particle.angle) * particle.distance;
            particle.element.style.left = x + 'px';
            particle.element.style.top = y + 'px';
            particle.element.style.opacity = Math.max(0, 1 - (frame / maxFrames));
        });
        
        // Expand crystal particles
        crystalParticles.forEach(particle => {
            particle.distance += particle.speed;
            const x = Math.cos(particle.angle) * particle.distance;
            const y = Math.sin(particle.angle) * particle.distance;
            particle.element.style.left = x + 'px';
            particle.element.style.top = y + 'px';
            particle.element.style.opacity = Math.max(0, 1 - (frame / maxFrames));
        });
        
        // Remove after animation
        if (frame >= maxFrames) {
            clearInterval(animationInterval);
            clearInterval(shakeInterval);
            boxContainer.style.transform = '';
            explosion.remove();
            screenFlash.remove();
            
            // Now play the death animation
            playDemonDeathAnimation(() => {
                showGameOverScreen(true); // true = victory
            });
        }
    }, 16); // ~60fps
}

// Demon death animation
function playDemonDeathAnimation(callback) {
    // Stop all other animations
    if (demonIdleInterval) {
        clearInterval(demonIdleInterval);
        demonIdleInterval = null;
    }
    if (demonHitInterval) {
        clearInterval(demonHitInterval);
        demonHitInterval = null;
    }
    if (demonCleaveInterval) {
        clearInterval(demonCleaveInterval);
        demonCleaveInterval = null;
    }
    
    // Stop color cycling if active
    if (window.bossColorCycle) {
        clearInterval(window.bossColorCycle);
        window.bossColorCycle = null;
    }
    
    // Stop boss movement
    const bossBox = document.querySelector('.boss-box');
    if (bossBox) {
        bossBox.style.animation = '';
    }
    
    const demonSprite = document.getElementById('demon-sprite');
    if (!demonSprite) {
        if (callback) callback();
        return;
    }
    
    const deathFrames = [
        'demon_death_1.png',
        'demon_death_2.png',
        'demon_death_3.png',
        'demon_death_4.png',
        'demon_death_5.png',
        'demon_death_6.png',
        'demon_death_7.png',
        'demon_death_8.png',
        'demon_death_9.png',
        'demon_death_10.png',
        'demon_death_11.png',
        'demon_death_12.png',
        'demon_death_13.png',
        'demon_death_14.png',
        'demon_death_15.png',
        'demon_death_16.png',
        'demon_death_17.png',
        'demon_death_18.png',
        'demon_death_19.png',
        'demon_death_20.png',
        'demon_death_21.png',
        'demon_death_22.png'
    ];
    
    demonAnimationState = 'death';
    let currentFrame = 0;
    
    // Fade out effect
    demonSprite.style.transition = 'opacity 3s ease-out, transform 3s ease-out';
    
    const deathInterval = setInterval(() => {
        if (currentFrame < deathFrames.length) {
            demonSprite.src = `../../assets/demon_death/${deathFrames[currentFrame]}`;
            
            // Start fading and shrinking near the end
            if (currentFrame > deathFrames.length * 0.7) {
                const fadeProgress = (currentFrame - deathFrames.length * 0.7) / (deathFrames.length * 0.3);
                demonSprite.style.opacity = (1 - fadeProgress).toString();
                demonSprite.style.transform = `scale(${1 - fadeProgress * 0.3})`;
            }
            
            currentFrame++;
        } else {
            clearInterval(deathInterval);
            
            // Final fade out
            setTimeout(() => {
                demonSprite.style.opacity = '0';
                demonSprite.style.transform = 'scale(0.5)';
                
                // Call callback after animation completes
                setTimeout(() => {
                    if (callback) callback();
                }, 500);
            }, 200);
        }
    }, 100); // Slower for dramatic death
}

// Function to show a temporary "Challenge Complete!" message
function showChallengeSuccessMessage() {
    const boxContainer = document.querySelector('.box-container');
    if (!boxContainer) return; // Safety check

    // 1. Create the message element
    const messageElement = document.createElement('div');
    messageElement.textContent = 'CHALLENGE COMPLETE!';
    
    // 2. Style it so it's big, centered, and gold
    messageElement.style.position = 'absolute';
    messageElement.style.top = '50%';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.fontSize = '48px';
    messageElement.style.fontWeight = 'bold';
    messageElement.style.color = '#FFD700'; // A nice gold color
    messageElement.style.textShadow = '2px 2px 4px #000000'; // Black shadow for readability
    messageElement.style.zIndex = '100'; // Make sure it's on top of other things
    messageElement.style.pointerEvents = 'none'; // Lets mouse clicks go "through" it

    // 3. Add it to the game area
    boxContainer.appendChild(messageElement);

    // 4. Remove it after 2.5 seconds
    setTimeout(() => {
        messageElement.remove();
    }, 2500); // 2.5 seconds
}


// --- ⭐️ REPLACED THIS FUNCTION ⭐️ ---
// --- ⭐️ REPLACED THIS FUNCTION ⭐️ ---
async function gameLoop(){
    if (!gameRunning) return;
        
    let command = "NONE";
    let event = "NONE";
    let cooldown = 0;
    
    // --- ⭐️ NEW variables for challenge ⭐️ ---
    let challengeProgress = 0;
    let challengeTarget = 0;

    try {
        const response = await fetch('http://localhost:5001/get_command');
        const data = await response.json();

        command = data.command
        event = data.event || "NONE";
        cooldown = data.cooldown || 0;
        
        // Only update combo from backend if we didn't just reset it
        if (!comboJustReset) {
            comboCount = data.combo;
        } else {
            // Clear the reset flag after one frame
            comboJustReset = false;
        }
        
        // Update combo display
        updateComboDisplay();
        
        // Update mana from backend
        if (data.mana !== undefined && data.max_mana !== undefined) {
            updateMana(data.mana, data.max_mana);
        }
        
        // Debug logging - MORE DETAILED (moved inside try block where data is available)
        console.log("Server response - Command:", command, "Gesture:", data.gesture, "Event:", event);
        
    } catch (error) {
        console.error("Backend server is down!");
        requestAnimationFrame(gameLoop);
        return;
    }

    updateCooldownDisplay(cooldown);
    // --- ⭐️ Pass new data to the display function ⭐️ ---
    updateEventDisplay(event, challengeProgress, challengeTarget);
    
    // Spawn mana balls periodically
    const now = Date.now();
    if (now - lastManaBallSpawn >= MANA_BALL_SPAWN_INTERVAL) {
        spawnManaBall();
        lastManaBallSpawn = now;
    }
    
    // Spawn heal orbs periodically
    if (now - lastHealOrbSpawn >= HEAL_ORB_SPAWN_INTERVAL) {
        spawnHealOrb();
        lastHealOrbSpawn = now;
    }

    // --- ⭐️ NEW COMMAND & EVENT LOGIC ⭐️ ---
    
    // 0. Check for insufficient mana
    if (command === "INSUFFICIENT_MANA") {
        console.log("Not enough mana!");
        // Could show a message here if desired
    }
    
    // 1. Check for the big reward first
    else if (command === "CHALLENGE_SUCCESS") {
        console.log("CHALLENGE COMPLETE! Massive damage!");
        
        // --- ✨ HERE IS THE FIX ---
        showChallengeSuccessMessage(); // <-- We call the function
        
        let rewardDamage = 30; // Big bonus damage!
        playDemonHitAnimation(rewardDamage);
    }
    
    // Check for finisher combo first
    if (finisherMode) {
        if (command === "ICE_SHARD") {
            // Remove message overlay when player starts performing finisher (but keep counter)
            const finisherMessage = document.getElementById('finisher-message-overlay');
            if (finisherMessage) {
                const messageText = finisherMessage.querySelector('div:first-child');
                if (messageText && messageText.textContent === 'UNLEASH 2 OPEN PALMS!') {
                    messageText.style.animation = 'fadeOut 0.3s ease-out';
                    setTimeout(() => {
                        if (messageText.parentNode) {
                            messageText.remove();
                        }
                    }, 300);
                }
            }
            
            finisherIceShardCount++;
            console.log(`Finisher progress: ${finisherIceShardCount}/2 open palms`);
            updateFinisherCounter(); // Update the counter display
            
            // Check if two ice shards have been cast
            if (finisherIceShardCount >= 2) {
                console.log('FINISHER COMBO COMPLETE! Two open palms unleashed!');
                if (finisherTimeout) {
                    clearTimeout(finisherTimeout);
                    finisherTimeout = null;
                }
                performFinisherAnimation();
                return; // Don't process the spell normally during finisher
            }
        }
    }
    
    // 2. Check for single spells (and apply event bonuses)
    else if (command === "FIREBALL") {
        let damage = 10; // Base damage
        if (event === "WEAKFIRE") {
            console.log("WEAK POINT HIT! Fireball is stronger!");
            damage += 10; // Add bonus damage
        }
        playFireballAnimation(damage); // Pass final damage to animation
    }

    else if (command === "ICE_SHARD") {
        playIceShardAnimation();
        // Damage will be applied after hit animation completes
    }

    else if (command === "LIGHTNING") {
        playLightningAnimation();
        // Damage will be applied after animation completes
    }

    // --- COMBO SYSTEM ENABLED ---
    else if (command === "EXPLOSION_COMBO") {
        // Play both fireball and ice shard for combo with bonus damage
        let damage = 25; // Massive combo damage
        if (event === "WEAKFIRE") {
            damage += 15; // Even more damage if boss is weak to fire
        }
        showComboMessage("EXPLOSION COMBO!", 0xFF4500);
        playFireballAnimation(damage);
        setTimeout(() => playIceShardAnimation(), 200);
    }
    else if (command === "HEALING_LIGHT_COMBO") {
        let damage = 20;
        let hp = 15; // Heal player
        showComboMessage("HEALING LIGHT!", 0x00FF00);
        playLightningAnimation();
        // Show damage number for boss
        const bossBox = document.querySelector('.boss-box');
        if (bossBox) {
            const boxRect = bossBox.getBoundingClientRect();
            const containerRect = document.querySelector('.box-container').getBoundingClientRect();
            const x = boxRect.left - containerRect.left + boxRect.width / 2;
            const y = boxRect.top - containerRect.top + boxRect.height / 2;
            showDamageNumber(damage, x, y, '#FF4444');
        }
        // Show heal number for player
        const playerBox = document.querySelector('.player-box');
        if (playerBox) {
            const boxRect = playerBox.getBoundingClientRect();
            const containerRect = document.querySelector('.box-container').getBoundingClientRect();
            const x = boxRect.left - containerRect.left + boxRect.width / 2;
            const y = boxRect.top - containerRect.top + boxRect.height / 2;
            showDamageNumber(hp, x, y, '#00FF00', true); // Green for healing (true = isHealing)
        }
        updateBossHealth(bossHealth - damage);
        updatePlayerHealth(Math.min(MAX_PLAYER_HEALTH, playerHealth + hp));
    }
    else if (command === "LIGHTNING_STRIKE_COMBO") {
        let damage = 35; // Very high damage
        showComboMessage("LIGHTNING STRIKE!", 0xFFD700);
        playLightningAnimation();
        setTimeout(() => {
            playDemonHitAnimation(damage);
        }, 500);
    }

    // Boss's phase-specific attack system (skip during finisher mode)
    if (!finisherMode) {
        const currentTime = Date.now();
        if (currentTime - lastBossAttackCheck >= BOSS_ATTACK_CHECK_INTERVAL) {
            lastBossAttackCheck = currentTime;
            
            // Phase-specific attack patterns
            let attackChance = 0;
            let bossDamage = 0;
            let attackType = 'cleave';
            
            switch(currentBossPhase) {
                case 1: // Phase 1: Normal - Standard attacks
                    attackChance = 0.5; // 50% chance every 1.5s
                    bossDamage = Math.floor(Math.random() * 11) + 15; // 15-25 damage
                    attackType = 'cleave';
                    break;
                    
                case 2: // Phase 2: Enraged - Faster, stronger attacks
                    attackChance = 0.65; // 65% chance every 1.5s
                    bossDamage = Math.floor(Math.random() * 11) + 15; // 15-25 damage
                    attackType = Math.random() < 0.7 ? 'cleave' : 'walk'; // 70% cleave, 30% walk
                    break;
                    
                case 3: // Phase 3: Final Form - Multiple attack types
                    attackChance = 0.75; // 75% chance every 1.5s
                    bossDamage = Math.floor(Math.random() * 11) + 15; // 15-25 damage
                    const rand = Math.random();
                    if (rand < 0.6) {
                        attackType = 'cleave';
                    } else if (rand < 0.85) {
                        attackType = 'walk';
                    } else {
                        attackType = 'double'; // 15% chance for double attack
                    }
                    break;
            }
            
            if (Math.random() < attackChance) {
                console.log(`Boss ${attackType} attack for ${bossDamage} damage! (Phase ${currentBossPhase})`);
                
                if (attackType === 'cleave') {
                    playDemonCleaveAnimation(bossDamage);
                } else if (attackType === 'walk') {
                    playDemonWalkAttack(bossDamage);
                } else if (attackType === 'double') {
                    // Double attack - two attacks in quick succession
                    playDemonCleaveAnimation(Math.floor(bossDamage * 0.6));
                    setTimeout(() => {
                        playDemonCleaveAnimation(Math.floor(bossDamage * 0.6));
                    }, 800);
                }
            }
        }
    }
    
    // (The old, separate event-checking block is gone, as it's
    // now handled inside the command logic above)
    
    requestAnimationFrame(gameLoop);
}
