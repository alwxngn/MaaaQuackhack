// Initialize health values
let playerHealth = 100;
let bossHealth = 100;
let gameRunning = false;
let comboCount = 0; // <-- FIX 2.1: Declared comboCount here

// Animation variables
let activeAnimations = [];
let lastHandPosition = null;

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Game loaded!");
    resetHealth();
    startWebcam(); // <-- Start the webcam
    startDemonIdleAnimation(); // <-- Start demon idle animation
    gameRunning = true; // <-- START THE GAME!
    gameLoop();         // <-- START THE LOOP!
});

// Function to start webcam with hand tracking
function startWebcam() {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output-canvas');
    const canvasCtx = canvasElement.getContext('2d');

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

        // Clear and draw the video frame
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

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
            await hands.send({image: videoElement});
        },
        width: 600,
        height: 700
    });
    
    camera.start().then(() => {
        console.log('📹 Webcam with hand tracking started!');
    }).catch((error) => {
        console.error('Error accessing webcam:', error);
        alert('Could not access webcam. Please allow camera permissions.');
    });
}
// ADDED THESE
function updateEventDisplay(event) {
    const eventDisplay = document.getElementById('event-display');
    if (eventDisplay) {
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

// ADDED THESE

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

// Fireball animation
function playFireballAnimation() {
    const playerBox = document.querySelector('.player-box');
    const bossBox = document.querySelector('.boss-box');
    const boxContainer = document.querySelector('.box-container');
    const fireballFrames = ['FB001.png', 'FB002.png', 'FB003.png', 'FB004.png', 'FB005.png'];
    
    // Get hand position or default to center of player box
    let startX = 300; // center of 600px box
    let startY = 350; // middle height
    
    if (lastHandPosition) {
        // Mirror the x-coordinate since canvas is mirrored
        startX = 600 - lastHandPosition.x;
        startY = lastHandPosition.y;
    }
    
    // Get the actual position of player box relative to container
    const playerRect = playerBox.getBoundingClientRect();
    const containerRect = boxContainer.getBoundingClientRect();
    const offsetX = playerRect.left - containerRect.left;
    
    // Create fireball sprite element in the container (not player box)
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
    const targetX = offsetX + 600 + 300; // Travel across gap to boss box center
    const frameInterval = 50; // ms per frame
    const speed = 20; // pixels per frame
    const growthRate = 3; // pixels per frame
    
    const animationInterval = setInterval(() => {
        // Update frame
        currentFrame = (currentFrame + 1) % fireballFrames.length;
        fireball.src = `../assets/fireball/${fireballFrames[currentFrame]}`;
        
        // Move fireball to the right and grow
        currentX += speed;
        currentSize += growthRate;
        fireball.style.left = currentX + 'px';
        fireball.style.width = currentSize + 'px';
        fireball.style.height = currentSize + 'px';
        
        // Remove when it reaches the boss box
        if (currentX > targetX) {
            clearInterval(animationInterval);
            fireball.remove();
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
    
    setInterval(() => {
        currentFrame = (currentFrame + 1) % idleFrames.length;
        demonSprite.src = `../assets/demon idle/${idleFrames[currentFrame]}`;
    }, 150); // 150ms per frame for smooth idle animation
}

// ALEXES CONNECTOR TO SORCERER

async function gameLoop(){
    if (!gameRunning) return;
        
    let command = "NONE";
    let event = "NONE";

    let cooldown = 0; // For future use


    try {
        // my 5001 port // getting all the commands from the flask
        const response = await fetch('http://localhost:5001/get_command');
        const data = await response.json();

        command = data.command
        event = data.event || "NONE"; // (FOR the qte)

        cooldown = data.cooldown || 0; // (FOR the cooldown display)
        
        // --- FIX 2.2: Moved this line INSIDE the 'try' block ---
        comboCount = data.combo; 
        
    } catch (error) {
        console.error("Backend server is down!");
        requestAnimationFrame(gameLoop);
        return;
    }

    // --- ADDED THIS ---
    updateCooldownDisplay(cooldown);
    updateEventDisplay(event);

    // --- This is the "Hand-off" ---
    // It calls Ally's functions based on your commands.
    // This logic is 100% correct!
    if (command === "FIREBALL") {
        let damage = 10
        playFireballAnimation();
        updateBossHealth(bossHealth - damage);
    }

    else if (command === "ICE_SHARD") {
        let damage = 8
        updateBossHealth(bossHealth - damage);
    }

    else if (command === "HEAL") {
        let hp = 12
        updatePlayerHealth(playerHealth + hp);
        
    }

    else if (command === "EXPLOSION_COMBO") {
        let damage = 20
        updateBossHealth(bossHealth - damage);
    }

    else if (command === "HEALING_LIGHT_COMBO") {
        let damage = 12
        let hp = 5
        updateBossHealth(bossHealth - damage);
        updatePlayerHealth(playerHealth + hp);
    }

    if (Math.random() < 0.01) { 
        let bossDamage = 15; // The boss hits for 15 damage
        console.log('Boss attacks for', bossDamage, 'damage!');
        
        // --- HERE IT IS! ---
        // We call Ally's function to hurt the player!
        updatePlayerHealth(playerHealth - bossDamage);
    }
    
    // --- FIX 1: Changed 'data.event' to 'event' ---
    if (event !== "NONE") {
        console.log(`EVENT: Server wants us to do ${event}!`);
        // TODO: Show this on the UI
        
        // --- FIX 1.2: Also fixed it here ---
        if (event === "WEAKFIRE" && command === "FIREBALL") {
            console.log("WEAK POINT HIT! +10 DAMAGE!");
            updateBossHealth(bossHealth - 10);
        }
    }
    
    // (The line `comboCount = data.combo;` was here, but we moved it up)
    
    requestAnimationFrame(gameLoop);
}

// (We can delete the old DOMContentLoaded listener, as we have a new one)