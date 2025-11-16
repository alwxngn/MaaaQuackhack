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

# Spell usage tracking
spell_usage = {
    "FIREBALL": 0,
    "ICE_SHARD": 0,
    "LIGHTNING": 0,
    "EXPLOSION_COMBO": 0,
    "HEALING_LIGHT_COMBO": 0,
    "LIGHTNING_STRIKE_COMBO": 0,
    "PUNCH_COMBO": 0
}

ATTACK_COOLDOWN = 0  # seconds (cooldown disabled)
last_attack_time = 0

# Mana system
MAX_MANA = 100
current_mana = 100
last_mana_regen_time = time.time()
MANA_REGEN_RATE = 12  # mana per second when not attacking
MANA_COSTS = {
    "FIREBALL": 20,
    "ICE_SHARD": 15,
    "LIGHTNING": 25,
    "EXPLOSION_COMBO": 35,
    "HEALING_LIGHT_COMBO": 30,
    "LIGHTNING_STRIKE_COMBO": 40,
    "PUNCH_COMBO": 10
}

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

@app.route('/add_mana', methods=['POST'])
def add_mana():
    """Add mana when player hits a mana ball"""
    global current_mana
    data = request.json
    mana_amount = data.get('amount', 30)  # Increased from 20 to 30
    # Don't allow negative mana to go below 0, but allow resetting from tutorial
    if mana_amount < 0 and current_mana >= 999:
        current_mana = MAX_MANA  # Reset to max from tutorial mode
    else:
        current_mana = min(MAX_MANA, max(0, current_mana + mana_amount))
    return jsonify({'status': 'ok', 'mana': current_mana})

@app.route('/set_tutorial_mode', methods=['POST'])
def set_tutorial_mode():
    """Set tutorial mode (unlimited mana)"""
    global current_mana
    current_mana = 999  # 999 = unlimited mana flag
    return jsonify({'status': 'ok', 'mana': current_mana})

@app.route('/reset_combo', methods=['POST'])
def reset_combo():
    """Reset combo counter"""
    global combo_counter
    combo_counter = 0
    return jsonify({'status': 'ok', 'combo': combo_counter})

@app.route('/get_spell_stats', methods=['GET'])
def get_spell_stats():
    """Get spell usage statistics and favorite spell"""
    global spell_usage
    
    # Find the favorite spell (most used)
    favorite_spell = None
    max_usage = 0
    for spell, count in spell_usage.items():
        if count > max_usage:
            max_usage = count
            favorite_spell = spell
    
    # Format spell name for display
    spell_display_names = {
        "FIREBALL": "Fireball",
        "ICE_SHARD": "Ice Shard",
        "LIGHTNING": "Lightning",
        "EXPLOSION_COMBO": "Explosion Combo",
        "HEALING_LIGHT_COMBO": "Healing Light Combo",
        "LIGHTNING_STRIKE_COMBO": "Lightning Strike Combo",
        "PUNCH_COMBO": "Punch Combo"
    }
    
    favorite_display = spell_display_names.get(favorite_spell, "None") if favorite_spell else "None"
    
    return jsonify({
        'spell_usage': spell_usage,
        'favorite_spell': favorite_spell,
        'favorite_spell_display': favorite_display,
        'favorite_spell_count': max_usage
    })

@app.route('/reset_spell_stats', methods=['POST'])
def reset_spell_stats():
    """Reset spell usage statistics"""
    global spell_usage
    spell_usage = {
        "FIREBALL": 0,
        "ICE_SHARD": 0,
        "LIGHTNING": 0,
        "EXPLOSION_COMBO": 0,
        "HEALING_LIGHT_COMBO": 0,
        "LIGHTNING_STRIKE_COMBO": 0,
        "PUNCH_COMBO": 0
    }
    return jsonify({'status': 'ok', 'spell_usage': spell_usage})

@app.route('/get_command')
def get_command():
    """
    This is the "API" that the JavaScript game calls 60 times a second.
    """
    global browser_gesture, current_mana, last_mana_regen_time
    
    # Check if tutorial mode (mana = 999 means unlimited)
    is_tutorial = current_mana >= 999
    
    # Regenerate mana over time (skip in tutorial mode)
    if not is_tutorial:
        current_time = time.time()
        time_since_regen = current_time - last_mana_regen_time
        if time_since_regen >= 0.1:  # Update every 100ms
            mana_regen = MANA_REGEN_RATE * time_since_regen
            current_mana = min(MAX_MANA, current_mana + mana_regen)
            last_mana_regen_time = current_time
    
    # 1. Get the gesture from browser MediaPipe detection
    current_gesture = browser_gesture
    
    # --- 3. Still SPELL LOGIC GOES HERE ---
    
    # --- FIX 2: Matched your spell names to Alan's gestures ---
    global last_gesture, combo_counter, last_attack_time
    global current_event, event_start_time, last_event_end_time
    global challenge_progress, challenge_target, challenge_gesture  
    
    # Check for THUMBS_UP (tutorial completion) - after global declaration
    if current_gesture == "THUMBS_UP":
        command = "THUMBS_UP"
        last_gesture = current_gesture
        return jsonify({
            "command": command,
            "event": "NONE",
            "combo": combo_counter,
            "gesture": current_gesture,
            "cooldown": 0,
            "mana": current_mana,
            "max_mana": MAX_MANA,
            "challenge_progress": 0,
            "challenge_target": 0
        })
    
    # DEBUG: Log what gesture we got
    if current_gesture != "NONE":
        print(f"🖐️  DETECTED: {current_gesture}")
    
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

            # --- COMBO SYSTEM ENABLED ---
            # Check for combos first (more complex, higher priority)
            if current_gesture == "FIST" and last_gesture == "OPEN_PALM":
                command = "EXPLOSION_COMBO"
                combo_counter += 2
            elif current_gesture == "POINT" and last_gesture == "OPEN_PALM":
                command = "HEALING_LIGHT_COMBO"
                combo_counter += 2
            elif current_gesture == "FIST" and last_gesture == "POINT":
                command = "LIGHTNING_STRIKE_COMBO"
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

            # Check if player has enough mana (or unlimited mana for tutorial)
            if command != "NONE":
                mana_cost = MANA_COSTS.get(command, 0)
                # Tutorial mode: if mana is 999, it's unlimited
                is_tutorial_mode = current_mana >= 999
                if is_tutorial_mode or current_mana >= mana_cost:
                    if not is_tutorial_mode:
                        current_mana -= mana_cost
                    # Track spell usage
                    if command in spell_usage:
                        spell_usage[command] += 1
                    last_attack_time = current_time
                    print(f"⚡ COMMAND SENT: {command} (Mana: {current_mana}/{MAX_MANA})")
                else:
                    command = "INSUFFICIENT_MANA"
                    print(f"❌ Not enough mana for {command}! Need {mana_cost}, have {current_mana}")

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
                    "mana": current_mana,
                    "max_mana": MAX_MANA,
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