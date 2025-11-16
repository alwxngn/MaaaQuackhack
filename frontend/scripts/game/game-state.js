// Game State Module - All game state variables and constants

// Health values
let playerHealth = 250;
const MAX_PLAYER_HEALTH = 250;
let bossHealth = 200;
const MAX_BOSS_HEALTH = 200;
let gameRunning = false;

// Combo system
let comboCount = 0;
let highestCombo = 0;
let comboJustReset = false;

// Mana system
let currentMana = 100;
let maxMana = 100;
let manaBalls = [];
let lastManaBallSpawn = 0;
const MANA_BALL_SPAWN_INTERVAL = 4000;

// Heal orb system
let healOrbs = [];
let lastHealOrbSpawn = 0;
const HEAL_ORB_SPAWN_INTERVAL = 6000;
const HEAL_ORB_HEAL_AMOUNT = 25;

// Animation variables
let activeAnimations = [];
let lastHandPosition = null;
let demonAnimationState = 'idle';
let demonIdleInterval = null;
let demonHitInterval = null;
let demonCleaveInterval = null;
let lastBossAttackCheck = 0;
const BOSS_ATTACK_CHECK_INTERVAL = 1500;

// Boss phase system
let currentBossPhase = 1;
let lastPhaseCheck = 0;

// Game start time tracking
let gameStartTime = Date.now();

// Export state getters/setters
window.GameState = {
    // Health
    getPlayerHealth: () => playerHealth,
    setPlayerHealth: (value) => { playerHealth = value; },
    getMaxPlayerHealth: () => MAX_PLAYER_HEALTH,
    getBossHealth: () => bossHealth,
    setBossHealth: (value) => { bossHealth = value; },
    getMaxBossHealth: () => MAX_BOSS_HEALTH,
    
    // Game running
    isGameRunning: () => gameRunning,
    setGameRunning: (value) => { gameRunning = value; },
    
    // Combos
    getComboCount: () => comboCount,
    setComboCount: (value) => { comboCount = value; },
    getHighestCombo: () => highestCombo,
    setHighestCombo: (value) => { highestCombo = value; },
    getComboJustReset: () => comboJustReset,
    setComboJustReset: (value) => { comboJustReset = value; },
    
    // Mana
    getCurrentMana: () => currentMana,
    setCurrentMana: (value) => { currentMana = value; },
    getMaxMana: () => maxMana,
    setMaxMana: (value) => { maxMana = value; },
    getManaBalls: () => manaBalls,
    getLastManaBallSpawn: () => lastManaBallSpawn,
    setLastManaBallSpawn: (value) => { lastManaBallSpawn = value; },
    MANA_BALL_SPAWN_INTERVAL,
    
    // Heal orbs
    getHealOrbs: () => healOrbs,
    getLastHealOrbSpawn: () => lastHealOrbSpawn,
    setLastHealOrbSpawn: (value) => { lastHealOrbSpawn = value; },
    HEAL_ORB_SPAWN_INTERVAL,
    HEAL_ORB_HEAL_AMOUNT,
    
    // Animations
    getActiveAnimations: () => activeAnimations,
    getLastHandPosition: () => lastHandPosition,
    setLastHandPosition: (value) => { lastHandPosition = value; },
    getDemonAnimationState: () => demonAnimationState,
    setDemonAnimationState: (value) => { demonAnimationState = value; },
    getDemonIdleInterval: () => demonIdleInterval,
    setDemonIdleInterval: (value) => { demonIdleInterval = value; },
    getDemonHitInterval: () => demonHitInterval,
    setDemonHitInterval: (value) => { demonHitInterval = value; },
    getDemonCleaveInterval: () => demonCleaveInterval,
    setDemonCleaveInterval: (value) => { demonCleaveInterval = value; },
    getLastBossAttackCheck: () => lastBossAttackCheck,
    setLastBossAttackCheck: (value) => { lastBossAttackCheck = value; },
    BOSS_ATTACK_CHECK_INTERVAL,
    
    // Boss phase
    getCurrentBossPhase: () => currentBossPhase,
    setCurrentBossPhase: (value) => { currentBossPhase = value; },
    getLastPhaseCheck: () => lastPhaseCheck,
    setLastPhaseCheck: (value) => { lastPhaseCheck = value; },
    
    // Game time
    getGameStartTime: () => gameStartTime,
    setGameStartTime: (value) => { gameStartTime = value; },
    
    // Constants
    MAX_PLAYER_HEALTH,
    MAX_BOSS_HEALTH
};

