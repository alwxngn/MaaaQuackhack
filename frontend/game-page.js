// /// Initialize health values
let playerHealth = 100;
let bossHealth = 100;
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
            }
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

    if (event === "PUNCH_CHALLENGE") {
        eventDisplay.textContent = `Event: PUNCH! (${progress}/${target})`;
    } else if (event === "EXPLOSION_CHALLENGE") {
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
    playerHealth = Math.max(0, Math.min(100, newHealth));
    const playerHealthBar = document.getElementById('player-hp-fill');
    
    if (playerHealthBar) {
        playerHealthBar.style.width = playerHealth + '%';
    }
    
    console.log('Player health:', playerHealth + '%');
    checkGameEnd();
}

// Function to update boss health
function updateBossHealth(newHealth) {
    bossHealth = Math.max(0, Math.min(100, newHealth));
    const bossHealthBar = document.getElementById('boss-hp-fill');
    
    if (bossHealthBar) {
        bossHealthBar.style.width = bossHealth + '%';
    }
    
    console.log('Boss health:', bossHealth + '%');
    checkGameEnd();
}

function resetHealth() {
    updatePlayerHealth(100);
    updateBossHealth(100);
    console.log('Health reset!');
    
}

function checkGameEnd() {
    if (playerHealth <= 0) {
        console.log('💀 Player defeated! Boss wins!');
        gameRunning = false;
    } else if (bossHealth <= 0) {
        console.log('🏆 Boss defeated! Player wins!');
        gameRunning = false;
    }
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
        
        // --- ⭐️ Get challenge data from server ⭐️ ---
        challengeProgress = data.challenge_progress || 0;
        challengeTarget = data.challenge_target || 0;
        
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
        let damage = 8; // Base damage
        if (event === "WEAKICE") {
            console.log("WEAK POINT HIT! Ice Shard is stronger!");
            damage += 10; // Add bonus damage
        }
        playDemonHitAnimation(damage); // Use hit animation directly
    }

    else if (command === "HEAL") {
        let hp = 12
        updatePlayerHealth(playerHealth + hp);
    }

    // 3. Check for regular combos (these are their *normal* effects)
    else if (command === "EXPLOSION_COMBO") {
        let damage = 20; // Normal combo damage
        playDemonHitAnimation(damage);
    }

    else if (command === "HEALING_LIGHT_COMBO") {
        let damage = 12;
        let hp = 5;
        playDemonHitAnimation(damage);
        updatePlayerHealth(playerHealth + hp);
    }
    
    else if (command === "PUNCH_COMBO") {
        let damage = 5; // Normal punch damage
        playDemonHitAnimation(damage);
    }
    
    // (We don't need to check for COOLDOWN or NONE)

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
