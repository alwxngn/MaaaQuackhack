from flask import Flask, jsonify
from flask_cors import CORS
import random
import time

# This is the file the Archmage is working on!
# You can import their function directly.
#
# ---  ---
import archmage_cv 

# --- 1. SORCERER'S LEARNING AREA ---
app = Flask(__name__)
CORS(app) # Allow cross-origin requests

# --- 2. SORCERER'S MISSION ---
# --- Global State Variables ---
last_gesture = "NONE"
last_gesture_time = 0
combo_counter = 0

last_event_time = 0
EVENT_UPDATE_INTERVAL = 5  # seconds

ATTACK_COOLDOWN = .1  # seconds
last_attack_time = 0


@app.route('/get_command')
def get_command():
    """
    This is the "API" that the JavaScript game calls 60 times a second.
    """
    
    # 1. Get the raw gesture from the Archmage's script
    # This will now call the new, fixed archmage_cv.py function
    current_gesture = archmage_cv.get_gesture()

    # --- 3. Still SPELL LOGIC GOES HERE ---
    
    # --- FIX 2: Matched your spell names to Alan's gestures ---
    global last_gesture
    global combo_counter
    global last_attack_time
    command = "NONE"
    # combos!!



    # if current_gesture != "NONE" and current_gesture != last_gesture:
        
        # --- All your spell/combo logic now goes INSIDE this "if" ---
        
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

            if current_gesture == "FIST" and last_gesture == "OPEN_PALM":
                command = "EXPLOSION_COMBO"
                combo_counter += 2

            elif current_gesture == "BANDO" and last_gesture == "POINT":
                command = "HEALING_LIGHT_COMBO"
                combo_counter += 2
                
                # Single spells
            elif current_gesture == "FIST":
                command = "FIREBALL"
                combo_counter += 1

            elif current_gesture == "OPEN_PALM": 
                command = "ICE_SHARD"
                combo_counter += 1
                
            elif current_gesture == "POINT": 
                command = "LIGHTNING"
                combo_counter += 1
                    
            elif current_gesture == "BANDO": 
                command = "HEAL" 
                
            elif current_gesture == "PUNCH": # We need to add PUNCH!
                command = "PUNCH_COMBO"
                combo_counter += 3

            if command != "NONE":
                last_attack_time = current_time

        else:
            print("Spell on cooldown...")
            command = "COOLDOWN"


    # --- 4. THE "RESET" FIX ---
    #
    # We update the last_gesture AT THE END, outside the "if" block.
    # This means when you put your hand down ("NONE"), 
    # last_gesture will be updated to "NONE",
    # which "resets" the system for your next spell!
    #
    last_gesture = current_gesture

    event_list = ["WEAKFIRE", "WEAKICE", "NONE", "NONE","NONE","NONE","NONE","NONE","NONE","NONE"]
    current_event = random.choice(event_list)



    

    current_time = time.time()
    cooldown_time = max(0, ATTACK_COOLDOWN - (current_time - last_attack_time))
    # This is the "API Contract"
    return jsonify({"command": command, 
                    "event": current_event, 
                    "combo": combo_counter, 
                    "gesture": current_gesture
                    , "cooldown": cooldown_time
                    })


# This makes the server run when you type `python backend/server.py`
if __name__ == '__main__':
    print("--- CV Boss Battle Backend Server ---")
    print("Running on http://localhost:5001") # Kept your working port
    print("Serving gesture commands at /get_command")
    print("Press CTRL+C to stop.")
    app.run(debug=True, port=5001)