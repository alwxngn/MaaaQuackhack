// Initialize health values
let playerHealth = 100;
let bossHealth = 100;
let gameRunning = false;

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log("Game loaded!");
    resetHealth();
});

// Function to update player health
function updatePlayerHealth(newHealth) {
    playerHealth = Math.max(0, Math.min(100, newHealth));
    const playerHealthBar = document.getElementById('player-hp-fill');
    const slider = document.getElementById('playerSlider');
    
    if (playerHealthBar) {
        playerHealthBar.style.width = playerHealth + '%';
    }
    if (slider) {
        slider.value = playerHealth;
    }
    
    console.log('Player health:', playerHealth + '%');
    checkGameEnd();
}

// Function to update boss health
function updateBossHealth(newHealth) {
    bossHealth = Math.max(0, Math.min(100, newHealth));
    const bossHealthBar = document.getElementById('boss-hp-fill');
    const slider = document.getElementById('bossSlider');
    
    if (bossHealthBar) {
        bossHealthBar.style.width = bossHealth + '%';
    }
    if (slider) {
        slider.value = bossHealth;
    }
    
    console.log('Boss health:', bossHealth + '%');
    checkGameEnd();
}

// TEST FUNCTIONS
function simulatePlayerAttack() {
    const damage = Math.floor(Math.random() * 20) + 10; // 10-30 damage
    updateBossHealth(bossHealth - damage);
    console.log('Player attacks for', damage, 'damage!');
}

function simulateBossAttack() {
    const damage = Math.floor(Math.random() * 15) + 8; // 8-23 damage
    updatePlayerHealth(playerHealth - damage);
    console.log('Boss attacks for', damage, 'damage!');
}

function resetHealth() {
    updatePlayerHealth(100);
    updateBossHealth(100);
    console.log('Health reset!');
}

function simulateGameLoop() {
    if (gameRunning) {
        gameRunning = false;
        console.log('Auto battle stopped');
        return;
    }
    
    gameRunning = true;
    console.log('Auto battle started!');
    
    const battleInterval = setInterval(() => {
        if (!gameRunning || playerHealth <= 0 || bossHealth <= 0) {
            clearInterval(battleInterval);
            gameRunning = false;
            return;
        }
        
        // Alternate attacks
        if (Math.random() > 0.5) {
            simulatePlayerAttack();
        } else {
            simulateBossAttack();
        }
    }, 1000); // Attack every second
}

function checkGameEnd() {
    if (playerHealth <= 0) {
        console.log('💀 Player defeated! Boss wins!');
        gameRunning = false;
    } else if (bossHealth <= 0) {
        console.log('🏆 Boss defeated! Player wins!');
        gameRunning = false;
    }
}

// Keyboard shortcuts for testing
document.addEventListener('keydown', function(event) {
    switch(event.key) {
        case '1': simulatePlayerAttack(); break;
        case '2': simulateBossAttack(); break;
        case 'r': resetHealth(); break;
        case 'a': simulateGameLoop(); break;
    }
});