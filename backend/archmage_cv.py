import cv2
import mediapipe as mp
import time

# --- NEW PUNCH THRESHOLD ---
# How much bigger the hand has to get to count as a punch.
# 1.5 = 50% bigger. 2.0 = 100% bigger.
# Start with 1.5 and see how it "feels".
AREA_THRESHOLD_MULTIPLIER = 1.5

class GestureRecognizer:
    def __init__(self, max_hands = 2, min_detect_conf=0.7):
        # --- MediaPipe Setup ---
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(
            max_num_hands=max_hands,
            min_detection_confidence=min_detect_conf
        )
        
        # --- State (Memory) Variables ---
        self.last_area = 0 # Replaces last_wrist_z
        self.last_gesture = "NONE"

    def _get_static_gesture(self, hand_landmarks):
        # (This helper function is unchanged)
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

    def _get_hand_area(self, hand_landmarks):
        """Helper to calculate the bounding box area of the hand."""
        landmarks = hand_landmarks.landmark
        min_x, max_x = 1.0, 0.0
        min_y, max_y = 1.0, 0.0
        
        for lm in landmarks:
            if lm.x < min_x: min_x = lm.x
            if lm.x > max_x: max_x = lm.x
            if lm.y < min_y: min_y = lm.y
            if lm.y > max_y: max_y = lm.y
            
        width = max_x - min_x
        height = max_y - min_y
        
        # We use image coordinates, so area is just width * height
        # (z is ignored for simplicity)
        return width * height

    def process(self, frame):
        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        final_gesture = "NONE"
        hand_landmarks_for_drawing = None

        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            hand_landmarks_for_drawing = hand_landmarks
            
            # --- 1. Get STATIC Gesture ---
            static_gesture = self._get_static_gesture(hand_landmarks)
            
            # --- 2. Get DYNAMIC "Punch" Gesture (NEW AREA LOGIC) ---
            current_area = self._get_hand_area(hand_landmarks)
            
            final_gesture = static_gesture # Default to the static pose
            
            # Check for punch:
            # 1. Is it a FIST?
            # 2. Is the last_area valid (not 0)?
            # 3. Is the new area 50% (or more) larger than the last?
            # 4. Was the last gesture NOT a punch (the cooldown)?
            if (static_gesture == "FIST" and 
                self.last_area > 0 and
                current_area > (self.last_area * AREA_THRESHOLD_MULTIPLIER) and
                self.last_gesture != "PUNCH"):
                
                final_gesture = "PUNCH"
            
            # --- 3. Update State for Next Frame ---
            # IMPORTANT: We only update last_area if it's NOT a punch
            # This prevents "PUNCH PUNCH PUNCH" as the hand moves
            # Only update the "resting" area
            if final_gesture != "PUNCH":
                self.last_area = current_area
            
            self.last_gesture = final_gesture
            
        else:
            # No hand detected, reset state
            self.last_area = 0
            self.last_gesture = "NONE"

        return final_gesture, hand_landmarks_for_drawing, frame


# --- 3. ALAN'S TEST BLOCK (FOR HIM TO RUN) ---
# (This section is unchanged and will work with the new class)
# --- 3. ALAN'S TEST BLOCK (FOR HIM TO RUN) ---
# (This section is unchanged and will work with the new class)
if __name__ == '__main__':
    print("--- Archmage Test View (Area Punch) ---")
    print("Running this file directly shows the CV debug window.")
    print("Press 'q' to quit.")
    
    recognizer = GestureRecognizer()
    cap = cv2.VideoCapture(1) # Using camera 1

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Can't receive frame. Exiting ...")
            break
        
        # --- TEST BLOCK LOGIC ---
        # We do our own processing here to see ALL hands.
        
        display_frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB)
        results = recognizer.hands.process(rgb_frame)

        if results.multi_hand_landmarks:
            # --- LOOPING! This is the fix. ---
            for hand_landmarks in results.multi_hand_landmarks:
                
                # We can't use the "punch" logic easily in this test view
                # without more code, so we'll just get the static gesture.
                gesture = recognizer._get_static_gesture(hand_landmarks)
                
                # Draw the gesture text
                wrist_coords = hand_landmarks.landmark[recognizer.mp_hands.HandLandmark.WRIST]
                text_x = int(wrist_coords.x * display_frame.shape[1] - 50)
                text_y = int(wrist_coords.y * display_frame.shape[0] + 50)
                
                cv2.putText(display_frame, gesture, (text_x, text_y), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
                
                # Draw the skeleton
                recognizer.mp_drawing.draw_landmarks(
                    display_frame, 
                    hand_landmarks, 
                    recognizer.mp_hands.HAND_CONNECTIONS)

        # Show the frame
        cv2.imshow('Archmage View (Test Mode)', display_frame)
        
        if cv2.waitKey(1) == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()