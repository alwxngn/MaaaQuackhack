# ComboCraft - Gesture-Controlled CV Battle Game

[demo link](https://www.youtube.com/watch?v=xNuD9hViZFQ)

A real-time boss battle game controlled entirely through hand gestures using MediaPipe computer vision. Cast spells, execute combos, and defeat the demon boss using only your hands!

## 🎯 Features

-  **Real-time hand gesture recognition** - Using MediaPipe Hands for accurate gesture detection
-  **3 unique spells** - Fireball, Ice Shard, and Lightning
-  **Combo system** - Chain gestures together for devastating combo attacks
-  **Animated boss** - Multiple animation states (idle, hit, cleave, death)
-  **Mana system** - Strategic resource management with mana costs and regeneration
-  **Dynamic events** - Boss becomes weak to certain elements, creating tactical opportunities
-  **Visual feedback** - Real-time gesture detection feedback and damage numbers
-  **Sound effects & music** - Immersive audio for spells and background music
-  **Victory/Defeat screens** - Complete game experience with stats and replay

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- Webcam
- Modern web browser (Chrome, Firefox, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MaaaQuackhack
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Start the backend server**
   ```bash
   cd backend
   python server.py
   ```
   The server will start on `http://localhost:5001`

4. **Open the game**
   - Open `frontend/index.html` in your web browser
   - Or use a local server (recommended):
     ```bash
     # Using Python
     python -m http.server 8000
     # Then navigate to http://localhost:8000/frontend/
     ```

5. **Allow camera permissions** when prompted

6. **Start playing!**
   - Make gestures with your hand in front of the camera
   - See your spells cast in real-time

## 🎮 How to Play

### Gestures
- **FIST** (All fingers curled) → Fireball 🔥
- **OPEN_PALM** (All fingers extended) → Ice Shard ❄️
- **POINT** (Only index finger extended) → Lightning ⚡

### Combos
Chain gestures together for powerful combo attacks:
- **OPEN_PALM → FIST** = Explosion Combo (25+ damage)
- **OPEN_PALM → POINT** = Healing Light Combo (Damage + Heal)
- **POINT → FIST** = Lightning Strike Combo (35 damage)

### Strategy
- Manage your mana wisely - each spell costs mana
- Collect mana balls that spawn during battle
- Watch for events - boss becomes weak to certain elements
- Execute combos for massive damage
- Time your attacks carefully - boss has cleave attacks!

## 🛠️ Tech Stack

### Frontend
- **HTML5, CSS3, JavaScript** - Core web technologies
- **MediaPipe Hands** - Real-time hand gesture recognition
- **MediaPipe Selfie Segmentation** - Background removal
- **Canvas API** - Game rendering

### Backend
- **Flask** - Python web framework
- **Flask-CORS** - Cross-origin resource sharing
- **MediaPipe** - Computer vision processing
- **OpenCV** - Camera handling (optional)

### Architecture
```
Browser (MediaPipe) 
    ↓
Frontend (JavaScript)
    ↓
Flask Backend (Python)
    ↓
Game Logic & State Management
```

## 📁 Project Structure

```
MaaaQuackhack/
├── backend/
│   ├── server.py              # Flask backend server
│   ├── archmage_cv.py         # Computer vision module
│   ├── requirements.txt       # Python dependencies
│   └── ...
├── frontend/
│   ├── index.html             # Entry page
│   ├── start-page.html        # Start screen
│   ├── game-page.html         # Main game page
│   ├── game-page.js           # Game logic
│   ├── game-page.css          # Game styles
│   └── ...
├── assets/
│   ├── sounds/                # Audio files
│   ├── demon_*/               # Boss animations
│   ├── fireball/              # Spell animations
│   └── ...
└── README.md
```

## 🎯 Key Features Explained

### Gesture Recognition
Uses MediaPipe Hands to detect 21 hand landmarks in real-time. Gestures are classified based on finger extension states:
- Detects when fingers are extended or curled
- Recognizes FIST, OPEN_PALM, POINT, and other gestures
- Runs at 60 FPS in the browser for low latency

### Combo System
Advanced combo detection that recognizes gesture sequences:
- Tracks gesture transitions
- Rewards players for executing combos with bonus damage
- Visual feedback with combo messages

### Mana Management
Strategic resource system:
- Each spell has a mana cost
- Mana regenerates over time
- Mana balls spawn periodically for collection
- Prevents spam casting

### Boss AI
Dynamic boss encounters:
- Multiple animation states
- Random attack patterns
- Phase-based difficulty
- Weakness events for tactical gameplay

## 📸 Screenshots

<!-- Add screenshots here -->
- *Screenshot 1: Title Screen*
   <img width="1710" height="980" alt="Screenshot 2025-11-16 at 9 58 58 AM" src="https://github.com/user-attachments/assets/f0af6b36-a2aa-4c19-87fa-1727a9e2dff9" />
- *Screenshot 2: Gameplay with gesture detection*
  <img width="1710" height="880" alt="Screenshot 2025-11-16 at 9 58 15 AM" src="https://github.com/user-attachments/assets/8b4894c1-a0b4-433d-9d93-00c18a406be9" />
- *Screenshot 3: Controls*
  <img width="1710" height="982" alt="Screenshot 2025-11-16 at 9 59 12 AM" src="https://github.com/user-attachments/assets/fe0ff8ee-4ea2-4d23-8b13-b9c8079737f8" />
- *Screenshot 4: Bosses*
  <img width="1710" height="982" alt="Screenshot 2025-11-16 at 9 59 05 AM" src="https://github.com/user-attachments/assets/bf0420f4-c1cf-4e9b-9907-7fd41410ca2d" />



## 🎥 Demo Video

<!-- Add link to demo video here -->
[Watch Demo Video](https://www.youtube.com/watch?v=xNuD9hViZFQ)



## 🔮 Future Improvements

- [ ] Multiplayer support (2+ players)
- [ ] More spell types and gestures
- [ ] Custom ML models for improved gesture recognition
- [ ] Leaderboard system
- [ ] Difficulty levels
- [ ] More boss types
- [ ] Achievement system
- [ ] Mobile support

## 🤝 Contributing

This is a hackathon project. Contributions and feedback are welcome!

## 📝 License

This project was created for a hackathon event.

## 👥 Team

Created by the ComboCraft team.
- Ally Chen
- Alan Nguyen
- Alex Chen
- Mehul Munankarmim

## 🙏 Acknowledgments

- **MediaPipe** - For amazing computer vision tools
- **OpenGameArt** - For game assets
- **Flask** - For the backend framework
- All open-source contributors whose libraries made this possible
- Cursor AI for speeding up repetitive animation boilerplate and formatting
(core game logic and CV pipeline are written by hand)
