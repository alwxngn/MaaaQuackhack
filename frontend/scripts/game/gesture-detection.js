// Gesture Detection Module - MediaPipe setup, gesture detection, and spell circles

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
        if (gesture !== 'NONE' && window.VisualEffects && window.VisualEffects.showGestureFeedback) {
            window.VisualEffects.showGestureFeedback(gesture);
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
                if (window.VisualEffects && window.VisualEffects.drawSpellCircle) {
                    window.VisualEffects.drawSpellCircle(canvasCtx, landmarks, gesture, canvasElement.width, canvasElement.height);
                }
                
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                    {color: '#00FF00', lineWidth: 3});
                drawLandmarks(canvasCtx, landmarks, 
                    {color: '#FF0000', lineWidth: 1, radius: 3});
                
                // Store the wrist position (landmark 0) for fireball origin
                const wrist = landmarks[0];
                if (window.GameState) {
                    window.GameState.setLastHandPosition({
                        x: wrist.x * canvasElement.width,
                        y: wrist.y * canvasElement.height
                    });
                }
                
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

// Export functions
window.GestureDetection = {
    detectGesture,
    sendGestureToBackend,
    startWebcam
};

