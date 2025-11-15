from flask import Flask, jsonify
from flask_cors import CORS

# This is the file the Archmage is working on!
# You can import their function directly.
import archmage_cv

# --- 1. SORCERER'S LEARNING AREA ---
# To get started: `pip install -r requirements.txt`
# Then run: `python backend/server.py`
#
# This file is a "Flask Server".
# @app.route defines a "page" or "endpoint"
# `CORS(app)` is VITAL. It lets the JavaScript `fetch` from this server.

app = Flask(__name__)
CORS(app) # Allow cross-origin requests

# --- 2. SORCERER'S MISSION ---
# Your job is to manage the "state" of the game.
# The Archmage gives you "FIST". What does that mean?
# This is where you implement combo logic.

# --- Global State Variables ---
# (You'll use these for combo logic)
last_gesture = "NONE"
last_gesture_time = 0

@app.route('/get_command')
def get_command():
    """
    This is the "API" that the JavaScript game calls 60 times a second.
    """
    
    # 1. Get the raw gesture from the Archmage's script
    # This will be "FIST", "OPEN_PALM", "NONE", etc.
    # Thanks to the placeholder, this works *even if the Archmage isn't done*.
    current_gesture = archmage_cv.get_current_gesture()

    # --- 3. SORCERER'S LOGIC GOES HERE ---
    # This is where you turn a "gesture" into a "command"
    #
    # Right now, we just pass it through.
    #
    # LATER, you will add combo logic:
    #
    # global last_gesture
    # command = "NONE"
    #
    # if current_gesture == "FIST" and last_gesture == "OPEN_PALM":
    #     command = "FIRE_ICE_COMBO"
    # elif current_gesture == "FIST":
    #     command = "FIREBALL"
    # elif current_gesture == "OPEN_PALM":
    #     command = "SHIELD"
    #
    # last_gesture = current_gesture
    # return jsonify({"command": command})
    #
    # --- End of Combo Logic ---


    # --- Placeholder Logic (Delete later) ---
    # For now, just map gestures directly to commands
    command = "NONE"
    if current_gesture == "FIST":
        command = "FIREBALL"
    elif current_gesture == "OPEN_PALM":
        command = "ICE_SHARD"
    elif current_gesture == "VICTORY":
        command = "HEAL"
    
    # This is the "API Contract"
    # Always return a JSON with a "command" key.
    return jsonify({"command": command})


# This makes the server run when you type `python backend/server.py`
if __name__ == '__main__':
    print("--- CV Boss Battle Backend Server ---")
    print("Running on http://localhost:5001")
    print("Serving gesture commands at /get_command")
    print("Press CTRL+C to stop.")
    app.run(debug=True, port=5001)