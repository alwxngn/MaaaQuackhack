from flask import Flask, jsonify
from flask_cors import CORS

# This is the file the Archmage is working on!
# You can import their function directly.
#
# --- FIX 1: Fixed the typo (archgmage -> archmage) ---
import archmage_cv 

# --- 1. SORCERER'S LEARNING AREA ---
app = Flask(__name__)
CORS(app) # Allow cross-origin requests

# --- 2. SORCERER'S MISSION ---
# --- Global State Variables ---
last_gesture = "NONE"
last_gesture_time = 0

@app.route('/get_command')
def get_command():
    """
    This is the "API" that the JavaScript game calls 60 times a second.
    """
    
    # 1. Get the raw gesture from the Archmage's script
    # This will now call the new, fixed archmage_cv.py function
    current_gesture = archmage_cv.get_current_gesture()

    # --- 3. SORCERER'S LOGIC GOES HERE ---
    
    # --- FIX 2: Matched your spell names to Alan's gestures ---
    command = "NONE"
    if current_gesture == "FIST":
        command = "FIREBALL"

    elif current_gesture == "OPEN_PALM": # Alan's file returns "OPEN_PALM"
        command = "ICE_SHARD"
    
    elif current_gesture == "POINT": # Alan's file returns "POINT"
        command = "LIGHTNING" # Your "LIGHTING" spell
        
    elif current_gesture == "BANDO": # Alan's file returns "BANDO"
        command = "HEAL" # Your "HEAL" spell

    # This is the "API Contract"
    return jsonify({"command": command})


# This makes the server run when you type `python backend/server.py`
if __name__ == '__main__':
    print("--- CV Boss Battle Backend Server ---")
    print("Running on http://localhost:5001") # Kept your working port
    print("Serving gesture commands at /get_command")
    print("Press CTRL+C to stop.")
    app.run(debug=True, port=5001)