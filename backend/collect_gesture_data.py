"""
Gesture Data Collection Tool
=============================
This tool helps you collect training data for custom gesture recognition.

How to use:
1. Run this script: python3 collect_gesture_data.py
2. Position your hand in front of the camera
3. Press the key for the gesture you're performing:
   - F: FIST (Fireball)
   - O: OPEN_PALM (Ice Shard)
   - P: POINT (Lightning)
   - B: BANDO (Heal)
   - U: PUNCH (Punch Combo)
4. Collect 50-100 examples of each gesture
5. Press 'Q' to quit and save data

The data will be saved to 'gesture_training_data.csv'
"""

import cv2
import mediapipe as mp
import csv
import time
import os

class GestureDataCollector:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7
        )
        
        self.gesture_counts = {
            'FIST': 0,
            'OPEN_PALM': 0,
            'POINT': 0,
            'BANDO': 0,
            'PUNCH': 0
        }
        
        self.data_file = 'gesture_training_data.csv'
        self.init_csv()
        
    def init_csv(self):
        """Initialize CSV file with headers"""
        # Check if file exists to avoid overwriting
        if not os.path.exists(self.data_file):
            with open(self.data_file, 'w', newline='') as f:
                writer = csv.writer(f)
                # Header: 21 landmarks x 3 coordinates (x, y, z) + gesture label
                header = []
                for i in range(21):
                    header.extend([f'x{i}', f'y{i}', f'z{i}'])
                header.append('gesture')
                writer.writerow(header)
    
    def extract_landmarks(self, hand_landmarks):
        """Extract landmark coordinates as a flat list"""
        landmarks = []
        for landmark in hand_landmarks.landmark:
            landmarks.extend([landmark.x, landmark.y, landmark.z])
        return landmarks
    
    def save_sample(self, landmarks, gesture_label):
        """Save a single training sample"""
        with open(self.data_file, 'a', newline='') as f:
            writer = csv.writer(f)
            row = landmarks + [gesture_label]
            writer.writerow(row)
        
        self.gesture_counts[gesture_label] += 1
        print(f"✓ Saved {gesture_label} sample #{self.gesture_counts[gesture_label]}")
    
    def run(self):
        """Main collection loop"""
        cap = cv2.VideoCapture(0)
        
        print("\n" + "="*60)
        print("GESTURE DATA COLLECTION TOOL")
        print("="*60)
        print("\nControls:")
        print("  F - Save as FIST (Fireball)")
        print("  O - Save as OPEN_PALM (Ice Shard)")
        print("  P - Save as POINT (Lightning)")
        print("  B - Save as BANDO (Heal)")
        print("  U - Save as PUNCH (Punch Combo)")
        print("  Q - Quit and save")
        print("\nGoal: Collect 50-100 samples of each gesture")
        print("="*60 + "\n")
        
        last_save_time = 0
        cooldown = 0.3  # 300ms cooldown between saves
        
        # Give camera time to initialize and clear any buffered keypresses
        time.sleep(1)
        cv2.waitKey(1)  # Clear any buffered keys
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.hands.process(rgb_frame)
            
            # Display gesture counts
            y_offset = 30
            for gesture, count in self.gesture_counts.items():
                color = (0, 255, 0) if count >= 50 else (0, 165, 255)
                cv2.putText(frame, f"{gesture}: {count}", (10, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                y_offset += 30
            
            # Draw hand landmarks
            if results.multi_hand_landmarks:
                hand_landmarks = results.multi_hand_landmarks[0]
                self.mp_drawing.draw_landmarks(
                    frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)
                
                # Extract landmarks for saving
                landmarks = self.extract_landmarks(hand_landmarks)
                
                # Check for key presses
                key = cv2.waitKey(1) & 0xFF
                current_time = time.time()
                
                if current_time - last_save_time > cooldown:
                    if key == ord('f'):
                        self.save_sample(landmarks, 'FIST')
                        last_save_time = current_time
                    elif key == ord('o'):
                        self.save_sample(landmarks, 'OPEN_PALM')
                        last_save_time = current_time
                    elif key == ord('p'):
                        self.save_sample(landmarks, 'POINT')
                        last_save_time = current_time
                    elif key == ord('b'):
                        self.save_sample(landmarks, 'BANDO')
                        last_save_time = current_time
                    elif key == ord('u'):
                        self.save_sample(landmarks, 'PUNCH')
                        last_save_time = current_time
                
                if key == ord('q'):
                    break
            else:
                # No hand detected
                cv2.putText(frame, "No hand detected!", (10, frame.shape[0] - 20),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                key = cv2.waitKey(1)
                if key == ord('q'):
                    break
            
            cv2.imshow('Gesture Data Collection', frame)
        
        cap.release()
        cv2.destroyAllWindows()
        
        print("\n" + "="*60)
        print("COLLECTION COMPLETE!")
        print("="*60)
        print("\nFinal counts:")
        for gesture, count in self.gesture_counts.items():
            status = "✓" if count >= 50 else "✗"
            print(f"  {status} {gesture}: {count}")
        print(f"\nData saved to: {self.data_file}")
        print("\nNext step: Run train_gesture_model.py to train your classifier")
        print("="*60 + "\n")


if __name__ == '__main__':
    collector = GestureDataCollector()
    collector.run()
