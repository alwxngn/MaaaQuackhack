from flask import Flask, jsonify
from flask_cors import CORS
import random

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


@app.route('/get_command')
def get_command():
    """
    This is the "API" that the JavaScript game calls 60 times a second.
    """
    
    # 1. Get the raw gesture from the Archmage's script
    # This will now call the new, fixed archmage_cv.py function
    final_gesture = archmage_cv.get_gesture()

    # --- 3. Still SPELL LOGIC GOES HERE ---
    
    # --- FIX 2: Matched your spell names to Alan's gestures ---
    global last_gesture
    global combo_counter
    command = "NONE"
    # combos!!



    if final_gesture != "NONE" and final_gesture != last_gesture:
        
        # --- All your spell/combo logic now goes INSIDE this "if" ---
        
        # combos!!
        if final_gesture == "FIST" and last_gesture == "OPEN_PALM":
            command = "EXPLOSION_COMBO"
            combo_counter += 2

        elif final_gesture == "BANDO" and last_gesture == "POINT":
            command = "HEALING_LIGHT_COMBO"
            combo_counter += 2
        
        # Single spells
        elif final_gesture == "FIST":
            command = "FIREBALL"
            combo_counter += 1

        elif final_gesture == "OPEN_PALM": 
            command = "ICE_SHARD"
            combo_counter += 1
        
        elif final_gesture == "POINT": 
            command = "LIGHTNING"
            combo_counter += 1
            
        elif final_gesture == "BANDO": 
            command = "HEAL" 
        
        elif final_gesture == "PUNCH": # We need to add PUNCH!
             command = "PUNCH_COMBO"
             combo_counter += 3

    # --- 4. THE "RESET" FIX ---
    #
    # We update the last_gesture AT THE END, outside the "if" block.
    # This means when you put your hand down ("NONE"), 
    # last_gesture will be updated to "NONE",
    # which "resets" the system for your next spell!
    #
    last_gesture = final_gesture

    event_list = ["WEAKFIRE", "WEAKICE", "NONE", "NONE"]
    current_event = random.choice(event_list)



    


    # This is the "API Contract"
    return jsonify({"command": command, "event": current_event, "combo": combo_counter, "gesture": final_gesture})


# This makes the server run when you type `python backend/server.py`
if __name__ == '__main__':
    print("--- CV Boss Battle Backend Server ---")
    print("Running on http://localhost:5001") # Kept your working port
    print("Serving gesture commands at /get_command")
    print("Press CTRL+C to stop.")
    app.run(debug=True, port=5001)