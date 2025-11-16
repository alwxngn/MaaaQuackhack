from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time

# This is the file the Archmage is working on!
# You can import their function directly.
#
# ---  ---
# REMOVED: import archmage_cv - using browser-based detection instead

# --- 1. SORCERER'S LEARNING AREA ---
app = Flask(__name__)
CORS(app) # Allow cross-origin requests

# --- 2. SORCERER'S MISSION ---
# --- Global State Variables ---
last_gesture = "NONE"
last_gesture_time = 0
combo_counter = 0
browser_gesture = "NONE"  # Gesture received from browser

ATTACK_COOLDOWN = 0  # seconds (cooldown disabled)
last_attack_time = 0

# event logic

current_event = "NONE"
event_start_time = 0
EVENT_DURATION = 7  # seconds
EVENT_COOLDOWN = 10  # seconds
last_event_end_time = 0

# possible events
POSSIBLE_EVENTS = ["WEAKFIRE", "WEAKICE",
    "EXPLOSION_CHALLENGE", "HEAL_LIGHT_CHALLENGE"]

# State for tracking challenge progress
challenge_progress = 0
challenge_target = 0
challenge_gesture = "NONE"






@app.route('/set_gesture', methods=['POST'])
def set_gesture():
    """Receive gesture data from browser"""
    global browser_gesture
    data = request.json
    browser_gesture = data.get('gesture', 'NONE')
    return jsonify({'status': 'ok'})

@app.route('/get_command')
def get_command():
    """
    This is the "API" that the JavaScript game calls 60 times a second.
    """
    global browser_gesture
    
    # 1. Get the gesture from browser MediaPipe detection
    current_gesture = browser_gesture
    
    # DEBUG: Log what gesture we got
    if current_gesture != "NONE":
        print(f"🖐️  DETECTED: {current_gesture}")

    # --- 3. Still SPELL LOGIC GOES HERE ---
    
    # --- FIX 2: Matched your spell names to Alan's gestures ---
    global last_gesture, combo_counter, last_attack_time
    global current_event, event_start_time, last_event_end_time
    global challenge_progress, challenge_target, challenge_gesture  
    command = "NONE"
    # combos!!




    # --- 1. "ANTI-SPAM" CHECK ---
    # Is this a *new* gesture? (Not "NONE" and not the same as last frame)
    if current_gesture != "NONE" and current_gesture != last_gesture:
        
        # --- 2. "COOLDOWN" CHECK ---
        # Is our 2-second timer over?
        current_time = time.time()
        if (current_time - last_attack_time) > ATTACK_COOLDOWN:
            
            # --- 3. SPELL LOGIC ---
            # Both checks passed! We can now cast a spell.

            # COMBO DISABLED
            # if current_gesture == "FIST" and last_gesture == "OPEN_PALM":
            #     command = "EXPLOSION_COMBO"
            #     combo_counter += 2
                
            # Single spells
            if current_gesture == "FIST":
                command = "FIREBALL"
                combo_counter += 1

            elif current_gesture == "OPEN_PALM": 
                command = "ICE_SHARD"
                combo_counter += 1
                
            elif current_gesture == "POINT": 
                command = "LIGHTNING"
                combo_counter += 1

            if command != "NONE":
                last_attack_time = current_time
                print(f"⚡ COMMAND SENT: {command}")

        else:
            print("Spell on cooldown...")
            command = "COOLDOWN"


    current_time = time.time()

    # 1. Check if an active event is running
    if current_event != "NONE":
        # Check for event expiration
        if (current_time - event_start_time) > EVENT_DURATION:
            print(f"Event {current_event} has EXPIRED.")
            current_event = "NONE"
            last_event_end_time = current_time
            # Reset challenge state on failure
            challenge_progress = 0
            challenge_target = 0
            challenge_gesture = "NONE"
        
      

        # --- COMBO_CHALLENGE checks ---
        elif current_event == "EXPLOSION_CHALLENGE":
            # Check if the *command* (calculated above) is the one we want
            if command == "EXPLOSION_COMBO":
                print("COMBO CHALLENGE COMPLETE!")
                command = "CHALLENGE_SUCCESS" # Overwrite/upgrade the command!
                # Reset event state
                current_event = "NONE"
                last_event_end_time = current_time
        
        elif current_event == "HEAL_LIGHT_CHALLENGE":
            if command == "HEALING_LIGHT_COMBO":
                print("COMBO CHALLENGE COMPLETE!")
                command = "CHALLENGE_SUCCESS" # Overwrite/upgrade the command!
                # Reset event state
                current_event = "NONE"
                last_event_end_time = current_time

    # 2. Else, check if the "calm" period is over and start a new event
    elif (current_time - last_event_end_time) > EVENT_COOLDOWN:
        current_event = random.choice(POSSIBLE_EVENTS)
        event_start_time = current_time
        print(f"Event {current_event} has STARTED!")
        
   
        challenge_progress = 0
        challenge_target = 0
        challenge_gesture = "NONE"


    # --- 4. THE "RESET" FIX ---
    #
    # We update the last_gesture AT THE END, outside the "if" block.
    # This means when you put your hand down ("NONE"), 
    # last_gesture will be updated to "NONE",
    # which "resets" the system for your next spell!
    #
    last_gesture = current_gesture

  



    

    current_time = time.time()
    cooldown_time = max(0, ATTACK_COOLDOWN - (current_time - last_attack_time))
    # This is the "API Contract"
    return jsonify({"command": command, 
                    "event": current_event, 
                    "combo": combo_counter, 
                    "gesture": current_gesture,
                    "cooldown": cooldown_time,

                    "challenge_progress": challenge_progress,
                    "challenge_target": challenge_target   


                    })


# This makes the server run when you type `python backend/server.py`
if __name__ == '__main__':
    print("--- CV Boss Battle Backend Server ---")
    print("Running on http://localhost:5001") # Kept your working port
    print("Serving gesture commands at /get_command")
    print("Press CTRL+C to stop.")
    app.run(debug=True, port=5001)