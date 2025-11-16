"""
ML-Based Gesture Recognition
=============================
This replaces the heuristic-based detection with a trained machine learning model.

This file is a drop-in replacement for the gesture detection in archmage_cv.py
After training your model, update archmage_cv.py to use this approach.
"""

import cv2
import mediapipe as mp
import pickle
import numpy as np
import os

class MLGestureRecognizer:
    def __init__(self, max_hands=2, min_detect_conf=0.7):
        # MediaPipe Setup
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(
            max_num_hands=max_hands,
            min_detection_confidence=min_detect_conf
        )
        
        # Load trained model
        self.model = None
        self.labels = None
        self.load_model()
        
        # State variables for punch detection
        self.last_area = 0
        self.last_gesture = "NONE"
        
    def load_model(self):
        """Load the trained gesture classification model"""
        model_file = 'gesture_model.pkl'
        labels_file = 'gesture_labels.pkl'
        
        if os.path.exists(model_file) and os.path.exists(labels_file):
            with open(model_file, 'rb') as f:
                self.model = pickle.load(f)
            with open(labels_file, 'rb') as f:
                self.labels = pickle.load(f)
            print(f"✅ Loaded trained model with gestures: {self.labels}")
        else:
            print(f"⚠️  Trained model not found. Please run train_gesture_model.py first.")
            print(f"   Falling back to basic detection.")
    
    def extract_landmarks(self, hand_landmarks):
        """Extract landmark coordinates as a flat array"""
        landmarks = []
        for landmark in hand_landmarks.landmark:
            landmarks.extend([landmark.x, landmark.y, landmark.z])
        return np.array(landmarks).reshape(1, -1)
    
    def _get_hand_area(self, hand_landmarks):
        """Calculate bounding box area for punch detection"""
        landmarks = hand_landmarks.landmark
        min_x, max_x = 1.0, 0.0
        min_y, max_y = 1.0, 0.0
        
        for lm in landmarks:
            if lm.x < min_x: min_x = lm.x
            if lm.x > max_x: max_x = lm.x
            if lm.y < min_y: min_y = lm.y
            if lm.y > max_y: max_y = lm.y
        
        return (max_x - min_x) * (max_y - min_y)
    
    def _get_static_gesture(self, hand_landmarks):
        """Use ML model to predict static gesture"""
        if self.model is None:
            # Fallback to basic heuristic
            return self._fallback_detection(hand_landmarks)
        
        # Extract landmarks and predict
        features = self.extract_landmarks(hand_landmarks)
        prediction = self.model.predict(features)[0]
        
        # Get confidence (probability)
        probabilities = self.model.predict_proba(features)[0]
        confidence = max(probabilities)
        
        # Only return prediction if confidence is high enough
        # Lowered from 0.6 to 0.4 to make POINT gesture trigger more easily
        if confidence > 0.4:
            return prediction
        else:
            return "NONE"
    
    def _fallback_detection(self, hand_landmarks):
        """Fallback heuristic detection if model not available"""
        landmarks = hand_landmarks.landmark
        
        index_curled = landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_TIP].y > landmarks[self.mp_hands.HandLandmark.INDEX_FINGER_MCP].y
        middle_curled = landmarks[self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP].y > landmarks[self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP].y
        ring_curled = landmarks[self.mp_hands.HandLandmark.RING_FINGER_TIP].y > landmarks[self.mp_hands.HandLandmark.RING_FINGER_MCP].y
        pinky_curled = landmarks[self.mp_hands.HandLandmark.PINKY_TIP].y > landmarks[self.mp_hands.HandLandmark.PINKY_MCP].y
        
        if index_curled and middle_curled and ring_curled and pinky_curled:
            return "FIST"
        if not index_curled and not middle_curled and not ring_curled and not pinky_curled:
            return "OPEN_PALM"
        if not index_curled and middle_curled and ring_curled and pinky_curled:
            return "POINT"
        if ring_curled and middle_curled:
            return "BANDO"
        return "NONE"
    
    def process_frame(self, frame):
        """Process a single frame and return detected gesture"""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)
        
        final_gesture = "NONE"
        
        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            
            # Get static gesture using ML model
            static_gesture = self._get_static_gesture(hand_landmarks)
            current_area = self._get_hand_area(hand_landmarks)
            
            final_gesture = static_gesture
            
            # Punch detection (dynamic gesture)
            AREA_THRESHOLD_MULTIPLIER = 1.5
            if (static_gesture == "FIST" and 
                self.last_area > 0 and
                current_area > (self.last_area * AREA_THRESHOLD_MULTIPLIER) and
                self.last_gesture != "PUNCH"):
                
                final_gesture = "PUNCH"
            
            # Update state
            if final_gesture != "PUNCH":
                self.last_area = current_area
            
            self.last_gesture = final_gesture
        else:
            self.last_area = 0
            self.last_gesture = "NONE"
        
        return final_gesture


# Library API for server integration
_cap = cv2.VideoCapture(0)
_recognizer = MLGestureRecognizer()

def get_gesture():
    """Main function called by server.py"""
    ret, frame = _cap.read()
    if not ret:
        print("⚠️  WARNING: Camera failed to read frame!")
        return "NONE"
    
    frame = cv2.flip(frame, 1)
    gesture = _recognizer.process_frame(frame)
    
    if gesture != "NONE":
        print(f"👁️  Camera detected gesture: {gesture}")
    
    return gesture


# Test mode
if __name__ == '__main__':
    print("--- ML Gesture Recognition Test ---")
    print("Press 'q' to quit")
    
    test_recognizer = MLGestureRecognizer()
    test_cap = cv2.VideoCapture(0)
    
    while True:
        ret, frame = test_cap.read()
        if not ret:
            break
        
        display_frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
        results = test_recognizer.hands.process(rgb_frame)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                gesture = test_recognizer._get_static_gesture(hand_landmarks)
                
                wrist_coords = hand_landmarks.landmark[test_recognizer.mp_hands.HandLandmark.WRIST]
                text_x = int(wrist_coords.x * display_frame.shape[1] - 50)
                text_y = int(wrist_coords.y * display_frame.shape[0] + 50)
                
                cv2.putText(display_frame, gesture, (text_x, text_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
                
                test_recognizer.mp_drawing.draw_landmarks(
                    display_frame, hand_landmarks, test_recognizer.mp_hands.HAND_CONNECTIONS)
        
        cv2.imshow('ML Gesture Test', display_frame)
        
        if cv2.waitKey(1) == ord('q'):
            break
    
    test_cap.release()
    cv2.destroyAllWindows()
