// Tutorial Page - Simplified version of game-page.js
// Tutorial progress tracking
let tutorialProgress = {
    fireball: false,
    iceShard: false,
    lightning: false
};

let lastCommand = "NONE";
let lastHandPosition = null;

// Sound effects system
const sounds = {
    fireball: new Audio('../assets/sounds/fireball.mp3'),
    iceShard: new Audio('../assets/sounds/ice_shard.wav'),
    thunder: new Audio('../assets/sounds/thunder.wav')
};

Object.values(sounds).forEach(sound => {
    sound.volume = 0.5;
});

// Browser-based gesture detection (same as game-page.js)
function detectGesture(landmarks) {
    function isFingerExtended(landmarks, fingerTip, fingerPip) {
        const tip = landmarks[fingerTip];
        const pip = landmarks[fingerPip];
        const wrist = landmarks[0];
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
    
    // Check for thumbs up first (thumb extended, others curled)
    // Thumb extended but other fingers not extended = thumbs up
    if (thumb && !index && !middle && !ring && !pinky) {
        return 'THUMBS_UP';
    }
    
    // FIST: No fingers extended (including thumb)
    if (extendedCount === 0) {
        return 'FIST';
    }
    // POINT: Only index finger extended
    if (index && !middle && !ring && !pinky && !thumb) {
        return 'POINT';
    }
    // OPEN_PALM: All fingers extended (4 or more, thumb optional)
    if (extendedCount >= 4) {
        return 'OPEN_PALM';
    }
    return 'NONE';
}

// Send gesture to backend
let lastSentGesture = 'NONE';
async function sendGestureToBackend(gesture) {
    if (gesture !== lastSentGesture) {
        lastSentGesture = gesture;
        try {
            await fetch('http://localhost:5001/set_gesture', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ gesture: gesture })
            });
        } catch (error) {
            console.error('Error sending gesture:', error);
        }
    }
}

// Start webcam
function startWebcam() {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output-canvas');
    const canvasCtx = canvasElement.getContext('2d');

    let segmentationMask = null;

    const selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
    });

    selfieSegmentation.setOptions({
        modelSelection: 1,
    });

    selfieSegmentation.onResults((results) => {
        segmentationMask = results.segmentationMask;
    });

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
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (segmentationMask) {
            canvasCtx.globalCompositeOperation = 'copy';
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasElement.width;
            tempCanvas.height = canvasElement.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.drawImage(tempCanvas, 0, 0);
        } else {
            canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        }

        canvasCtx.globalCompositeOperation = 'source-over';

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                    {color: '#00FF00', lineWidth: 3});
                drawLandmarks(canvasCtx, landmarks, 
                    {color: '#FF0000', lineWidth: 1, radius: 3});
                
                const wrist = landmarks[0];
                lastHandPosition = {
                    x: wrist.x * canvasElement.width,
                    y: wrist.y * canvasElement.height
                };
                
                const gesture = detectGesture(landmarks);
                sendGestureToBackend(gesture);
            }
        } else {
            sendGestureToBackend('NONE');
        }
        canvasCtx.restore();
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await selfieSegmentation.send({image: videoElement});
            await hands.send({image: videoElement});
        },
        width: 600,
        height: 700
    });
    
    camera.start().then(() => {
        console.log('📹 Webcam started for tutorial!');
    }).catch((error) => {
        console.error('Error accessing webcam:', error);
        alert('Could not access webcam. Please allow camera permissions.');
    });
}

// Update tutorial UI
function updateTutorialUI() {
    const instruction = document.getElementById('tutorial-instruction');
    const hint = document.getElementById('tutorial-hint');
    
    if (!tutorialProgress.fireball) {
        instruction.textContent = 'Cast FIREBALL (Make a FIST)';
        hint.textContent = 'Make a FIST gesture to cast Fireball';
    } else if (!tutorialProgress.iceShard) {
        instruction.textContent = 'Cast ICE SHARD (OPEN PALM)';
        hint.textContent = 'Open your PALM to cast Ice Shard';
    } else if (!tutorialProgress.lightning) {
        instruction.textContent = 'Cast LIGHTNING (POINT)';
        hint.textContent = 'POINT your index finger to cast Lightning';
    } else {
        instruction.textContent = 'Great! Give a THUMBS UP to start!';
        hint.textContent = 'Extend your thumb up to begin the battle!';
    }
    
    // Update progress indicators
    const fireballItem = document.getElementById('progress-fireball');
    const iceItem = document.getElementById('progress-ice');
    const lightningItem = document.getElementById('progress-lightning');
    
    if (tutorialProgress.fireball) fireballItem.classList.add('completed');
    if (tutorialProgress.iceShard) iceItem.classList.add('completed');
    if (tutorialProgress.lightning) lightningItem.classList.add('completed');
}

// Simplified fireball animation (no boss damage)
function playTutorialFireball() {
    if (sounds.fireball) {
        const sound = sounds.fireball.cloneNode();
        sound.volume = 0.6;
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
    const boxContainer = document.querySelector('.box-container');
    const fireballFrames = ['FB001.png', 'FB002.png', 'FB003.png', 'FB004.png', 'FB005.png'];
    
    let startX = 300;
    let startY = 350;
    if (lastHandPosition) {
        startX = 600 - lastHandPosition.x;
        startY = lastHandPosition.y;
    }
    
    const fireball = document.createElement('img');
    fireball.className = 'fireball-sprite';
    fireball.src = `../assets/fireball/${fireballFrames[0]}`;
    fireball.style.position = 'absolute';
    fireball.style.left = startX + 'px';
    fireball.style.top = startY + 'px';
    fireball.style.width = '100px';
    fireball.style.height = '100px';
    fireball.style.transform = 'translate(-50%, -50%)';
    fireball.style.zIndex = '10';
    
    boxContainer.appendChild(fireball);
    
    let currentFrame = 0;
    let currentX = startX;
    let currentSize = 100;
    const targetX = boxContainer.offsetWidth;
    
    const animationInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % fireballFrames.length;
        fireball.src = `../assets/fireball/${fireballFrames[currentFrame]}`;
        currentX += 30;
        currentSize += 3;
        fireball.style.left = currentX + 'px';
        fireball.style.width = currentSize + 'px';
        fireball.style.height = currentSize + 'px';
        
        if (currentX > targetX) {
            clearInterval(animationInterval);
            fireball.remove();
        }
    }, 30);
}

// Simplified ice shard animation
function playTutorialIceShard() {
    if (sounds.iceShard) {
        const sound = sounds.iceShard.cloneNode();
        sound.volume = 0.9;
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
    const boxContainer = document.querySelector('.box-container');
    const iceShardFrames = [
        'VFX 1 Repeatable1.png', 'VFX 1 Repeatable2.png', 'VFX 1 Repeatable3.png',
        'VFX 1 Repeatable4.png', 'VFX 1 Repeatable5.png', 'VFX 1 Repeatable6.png',
        'VFX 1 Repeatable7.png', 'VFX 1 Repeatable8.png', 'VFX 1 Repeatable9.png',
        'VFX 1 Repeatable10.png'
    ];
    
    let startX = 200;
    let startY = 350;
    if (lastHandPosition) {
        startX = lastHandPosition.x;
        startY = lastHandPosition.y;
    }
    
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
    const targetX = boxContainer.offsetWidth;
    
    const animationInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % iceShardFrames.length;
        iceShard.src = `../assets/ice shards/${iceShardFrames[currentFrame]}`;
        currentX += 32;
        currentSize += 2.5;
        iceShard.style.left = currentX + 'px';
        iceShard.style.width = currentSize + 'px';
        iceShard.style.height = currentSize + 'px';
        
        if (currentX > targetX) {
            clearInterval(animationInterval);
            iceShard.remove();
        }
    }, 30);
}

// Simplified lightning animation
function playTutorialLightning() {
    if (sounds.thunder) {
        const sound = sounds.thunder.cloneNode();
        sound.volume = 0.7;
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
    const boxContainer = document.querySelector('.box-container');
    const lightningFrames = [
        'lightning_line1b8.png', 'lightning_line1b9.png',
        'lightning_line1b11.png', 'lightning_line1b12.png'
    ];
    
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
    
    boxContainer.appendChild(lightning);
    
    let currentFrame = 0;
    let flashCount = 0;
    const maxFlashes = 3;
    
    const animationInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % lightningFrames.length;
        lightning.src = `../assets/lighting/${lightningFrames[currentFrame]}`;
        
        if (currentFrame === 0) {
            flashCount++;
        }
        
        if (flashCount >= maxFlashes) {
            clearInterval(animationInterval);
            lightning.remove();
        }
    }, 60);
}

// Tutorial game loop
async function tutorialLoop() {
    let command = "NONE";
    
    try {
        const response = await fetch('http://localhost:5001/get_command');
        const data = await response.json();
        command = data.command;
    } catch (error) {
        console.error("Backend server is down!");
        requestAnimationFrame(tutorialLoop);
        return;
    }
    
    // Check for spells and mark as complete
    const isNewCommand = command !== "NONE" && command !== "COOLDOWN" && command !== lastCommand;
    
    if (isNewCommand) {
        if (command === "FIREBALL" && !tutorialProgress.fireball) {
            tutorialProgress.fireball = true;
            playTutorialFireball();
            updateTutorialUI();
            console.log("✓ Fireball learned!");
        } else if (command === "ICE_SHARD" && !tutorialProgress.iceShard) {
            tutorialProgress.iceShard = true;
            playTutorialIceShard();
            updateTutorialUI();
            console.log("✓ Ice Shard learned!");
        } else if (command === "LIGHTNING" && !tutorialProgress.lightning) {
            tutorialProgress.lightning = true;
            playTutorialLightning();
            updateTutorialUI();
            console.log("✓ Lightning learned!");
        }
        
        lastCommand = command;
    }
    
    // Check for thumbs up after all spells are learned
    if (tutorialProgress.fireball && tutorialProgress.iceShard && tutorialProgress.lightning) {
        if (command === "THUMBS_UP" || lastSentGesture === "THUMBS_UP") {
            console.log("Thumbs up detected! Starting battle...");
            // Reset mana to normal before redirecting
            fetch('http://localhost:5001/add_mana', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amount: -899}) // Reset from 999 to 100
            }).catch(() => {});
            // Small delay then redirect
            setTimeout(() => {
                window.location.href = 'game-page.html';
            }, 500);
            return;
        }
    }
    
    // Reset lastCommand when command becomes NONE
    if (command === "NONE" || command === "COOLDOWN") {
        lastCommand = "NONE";
    }
    
    requestAnimationFrame(tutorialLoop);
}

// Initialize tutorial
document.addEventListener('DOMContentLoaded', function() {
    console.log("Tutorial loaded!");
    
    // Set tutorial mode (unlimited mana) in backend
    fetch('http://localhost:5001/set_tutorial_mode', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    }).catch(err => console.error('Error setting tutorial mode:', err));
    
    startWebcam();
    updateTutorialUI();
    tutorialLoop();
});

