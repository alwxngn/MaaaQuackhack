// Initialize health values
let playerHealth = 250;
const MAX_PLAYER_HEALTH = 250;
let bossHealth = 100;
const MAX_BOSS_HEALTH = 300;
let gameRunning = false;
let comboCount = 0; 

// Animation variables
let activeAnimations = [];
let lastHandPosition = null;
let demonAnimationState = 'idle'; // 'idle' or 'hit'
let demonIdleInterval = null;

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Game loaded!");
    resetHealth();
    startWebcam(); // <-- Start the webcam
    startDemonIdleAnimation(); // <-- Start demon idle animation
    gameRunning = true; // <-- START THE GAME!
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
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
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
            for (const landmarks of results.multiHandLandmarks) {
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
                
                // Detect gesture from hand landmarks
                const gesture = detectGesture(landmarks);
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
// --- ⭐️ END OF REPLACED FUNCTION ⭐️ ---


// Function to update player health
function updatePlayerHealth(newHealth) {
    playerHealth = Math.max(0, Math.min(MAX_PLAYER_HEALTH, newHealth));
    const playerHealthBar = document.getElementById('player-hp-fill');
    
    if (playerHealthBar) {
        const healthPercentage = (playerHealth / MAX_PLAYER_HEALTH) * 100;
        playerHealthBar.style.width = healthPercentage + '%';
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
    
    console.log('Boss health:', bossHealth + '/' + MAX_BOSS_HEALTH);
    checkGameEnd();
}

function resetHealth() {
    updatePlayerHealth(MAX_PLAYER_HEALTH);
    updateBossHealth(MAX_BOSS_HEALTH);
    console.log('Health reset!');
    
}

function checkGameEnd() {
    if (playerHealth <= 0) {
        console.log('💀 Player defeated! Boss wins!');
        gameRunning = false;
    } else if (bossHealth <= 0) {
        console.log('🏆 Boss defeated! Player wins!');
        gameRunning = false;
        showGameOver();
    }
}

function showGameOver() {
    // Create game over overlay
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'VICTORY!';
    title.style.cssText = `
        color: #FFD700;
        font-size: 72px;
        margin-bottom: 30px;
        text-shadow: 0 0 20px #FFD700;
    `;
    
    const replayButton = document.createElement('button');
    replayButton.textContent = 'Play Again';
    replayButton.style.cssText = `
        padding: 20px 40px;
        font-size: 24px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    replayButton.onclick = replayGame;
    
    overlay.appendChild(title);
    overlay.appendChild(replayButton);
    document.body.appendChild(overlay);
}

function replayGame() {
    // Remove game over overlay
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Reset game state
    resetHealth();
    gameRunning = true;
}

// --- ⭐️ MODIFIED THIS FUNCTION ⭐️ ---
// Fireball animation (now accepts damage)
function playFireballAnimation(damage = 10) { // Default damage is 10
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
    fireball.src = `../assets/fireball/${fireballFrames[0]}`;
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
    const frameInterval = 50;
    const speed = 20;
    const growthRate = 3;
    
    const animationInterval = setInterval(() => {
        // ... (animation/movement logic) ...
        currentFrame = (currentFrame + 1) % fireballFrames.length;
        fireball.src = `../assets/fireball/${fireballFrames[currentFrame]}`;
        currentX += speed;
        currentSize += growthRate;
        fireball.style.left = currentX + 'px';
        fireball.style.width = currentSize + 'px';
        fireball.style.height = currentSize + 'px';

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
    iceShard.src = `../assets/ice shards/${iceShardFrames[0]}`;
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
    const frameInterval = 50; // ms per frame
    const speed = 22; // pixels per frame (slightly faster than fireball)
    const growthRate = 2.5; // pixels per frame
    
    const animationInterval = setInterval(() => {
        // Update frame
        currentFrame = (currentFrame + 1) % iceShardFrames.length;
        iceShard.src = `../assets/ice shards/${iceShardFrames[currentFrame]}`;
        
        // Move ice shard to the right and grow
        currentX += speed;
        currentSize += growthRate;
        iceShard.style.left = currentX + 'px';
        iceShard.style.width = currentSize + 'px';
        iceShard.style.height = currentSize + 'px';
        
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
    lightning.src = `../assets/lighting/${lightningFrames[0]}`;
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
    const frameInterval = 60; // ms per frame
    
    const animationInterval = setInterval(() => {
        // Update frame
        currentFrame = (currentFrame + 1) % lightningFrames.length;
        lightning.src = `../assets/lighting/${lightningFrames[currentFrame]}`;
        
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
            demonSprite.src = `../assets/demon idle/${idleFrames[currentFrame]}`;
        }
    }, 150);
}

// Demon take hit animation
function playDemonHitAnimation(damage = 0) {
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
    
    const hitInterval = setInterval(() => {
        if (currentFrame < hitFrames.length) {
            demonSprite.src = `../assets/demon_take_hit/${hitFrames[currentFrame]}`;
            currentFrame++;
        } else {
            clearInterval(hitInterval);
            demonAnimationState = 'idle'; // Return to idle
            
            // Apply damage after hit animation completes
            if (damage > 0) {
                updateBossHealth(bossHealth - damage);
            }
        }
    }, 100);
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
        comboCount = data.combo; 
        
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

    // --- ⭐️ NEW COMMAND & EVENT LOGIC ⭐️ ---
    
    // 1. Check for the big reward first
    if (command === "CHALLENGE_SUCCESS") {
        console.log("CHALLENGE COMPLETE! Massive damage!");
        
        // --- ✨ HERE IS THE FIX ---
        showChallengeSuccessMessage(); // <-- We call the function
        
        let rewardDamage = 30; // Big bonus damage!
        playDemonHitAnimation(rewardDamage);
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

    // HEAL DISABLED - No gesture mapped
    // else if (command === "HEAL") {
    //     let hp = 12
    //     updatePlayerHealth(playerHealth + hp);
    // }

    // COMBO DISABLED
    // else if (command === "EXPLOSION_COMBO") {
    //     // Play both fireball and ice shard for combo
    //     playFireballAnimation();
    //     playIceShardAnimation();
    //     // Damage will be applied by animations
    // }

    // COMBO DISABLED
    // else if (command === "HEALING_LIGHT_COMBO") {
    //     let damage = 12
    //     let hp = 5
    //     updateBossHealth(bossHealth - damage);
    //     updatePlayerHealth(playerHealth + hp);
    // }

    // Boss's random attack (unchanged)
    if (Math.random() < 0.01) { 
        let bossDamage = 15;
        console.log('Boss attacks for', bossDamage, 'damage!');
        updatePlayerHealth(playerHealth - bossDamage);
    }
    
    // (The old, separate event-checking block is gone, as it's
    // now handled inside the command logic above)
    
    requestAnimationFrame(gameLoop);
}ask;
