// Client-side game logic with Socket.io
let socket;
let gameState = null;
let currentPlayer = null;
let roomId = null;

// Initialize connection
function initSocket() {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.host;
    socket = io(`${protocol}//${host}`);

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('room_created', (data) => {
        roomId = data.roomId;
        gameState = data.gameState;
        currentPlayer = 'player1';
        showWaitingScreen();
    });

    socket.on('player_joined', (data) => {
        gameState = data.gameState;
        showGameScreen();
        updateDisplay();
    });

    socket.on('bet_placed', (data) => {
        gameState = data.gameState;
        updateDisplay();
    });

    socket.on('round_played', (data) => {
        gameState = data.gameState;
        displayCards();
        showRoundResult(data.winner);
    });

    socket.on('bets_reset', (data) => {
        gameState = data.gameState;
        resetBetUI();
        updateDisplay();
    });

    socket.on('round_reset', (data) => {
        gameState = data.gameState;
        resetRoundUI();
        updateDisplay();
    });

    socket.on('game_over', (data) => {
        gameState = data.finalState;
        showGameOver(data.winner, data.stats);
    });

    socket.on('player_disconnected', (data) => {
        gameState = data.gameState;
        updateDisplay();
        showError('Opponent has disconnected');
    });

    socket.on('error', (data) => {
        showError(data.message);
    });
}

// Create room
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const startingChips = parseInt(document.getElementById('startingChips').value);

    if (!playerName || startingChips < 1) {
        alert('Please fill in all fields');
        return;
    }

    if (!socket) {
        initSocket();
    }

    socket.emit('create_room', {
        playerName,
        startingChips,
    });
}

// Join room
function joinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const startingChips = parseInt(document.getElementById('startingChips').value);
    const roomId = document.getElementById('roomIdInput').value.trim();

    if (!playerName || startingChips < 1 || !roomId) {
        alert('Please fill in all fields');
        return;
    }

    if (!socket) {
        initSocket();
    }

    socket.emit('join_room', {
        roomId,
        playerName,
        startingChips,
    });
}

// Place bet
function placeBet() {
    const betAmount = parseInt(document.getElementById('betAmount').value);

    if (isNaN(betAmount) || betAmount < 1) {
        alert('Please enter a valid bet amount');
        return;
    }

    const currentChips = currentPlayer === 'player1' 
        ? gameState.players.player1.chips 
        : gameState.players.player2.chips;

    if (betAmount > currentChips) {
        alert(`You only have ${currentChips} chips`);
        return;
    }

    socket.emit('place_bet', { betAmount });
    document.getElementById('betAmount').value = '';
}

// Reset bets
function resetBet() {
    socket.emit('reset_bets');
}

// Play round
function playRound() {
    // Both players must have bet - round plays automatically
}

// Next round
function nextRound() {
    socket.emit('next_round');
}

// End game
function endGame() {
    if (confirm('Are you sure you want to end the game?')) {
        socket.emit('end_game');
    }
}

// Display screens
function showMenuScreen() {
    document.getElementById('menuScreen').style.display = 'block';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'none';
}

function showWaitingScreen() {
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'none';
    document.getElementById('roomIdDisplay').textContent = `Room ID: ${roomId}`;
}

function showGameScreen() {
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'none';
    updateDisplay();
}

function showGameOver(winner, stats) {
    const resultDiv = document.getElementById('gameOverResult');
    const p1Chips = gameState.players.player1.chips;
    const p2Chips = gameState.players.player2.chips;
    const p1Name = gameState.players.player1.name;
    const p2Name = gameState.players.player2.name;

    let resultHTML = `<p><strong>${winner} wins!</strong></p>`;
    resultHTML += `<div class="winner">${p1Name}: ${p1Chips} 💰</div>`;
    resultHTML += `<div class="winner">${p2Name}: ${p2Chips} 💰</div>`;
    resultHTML += `<p style="margin-top: 20px;">Record: ${p1Name} ${stats.player1Wins} - ${stats.player2Wins} ${p2Name}</p>`;

    resultDiv.innerHTML = resultHTML;

    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('errorScreen').style.display = 'none';
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'block';
}

function goToMenu() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    gameState = null;
    currentPlayer = null;
    roomId = null;
    document.getElementById('playerName').value = '';
    document.getElementById('roomIdInput').value = '';
    showMenuScreen();
}

// Update game display
function updateDisplay() {
    if (!gameState) return;

    const p1 = gameState.players.player1;
    const p2 = gameState.players.player2;

    document.getElementById('player1NameDisplay').textContent = p1.name;
    document.getElementById('player2NameDisplay').textContent = p2 ? p2.name : 'Waiting...';

    document.getElementById('player1Chips').textContent = `💰 ${p1.chips}`;
    document.getElementById('player2Chips').textContent = p2 ? `💰 ${p2.chips}` : '-';

    document.getElementById('player1Status').textContent = p1.connected ? '🟢 Online' : '🔴 Disconnected';
    document.getElementById('player2Status').textContent = p2 ? (p2.connected ? '🟢 Online' : '🔴 Disconnected') : '⏳ Waiting';

    document.getElementById('potAmount').textContent = gameState.pot;
    document.getElementById('player1BetDisplay').textContent = `${p1.name}: $${p1.currentBet}`;
    document.getElementById('player2BetDisplay').textContent = p2 ? `${p2.name}: $${p2.currentBet}` : '-';

    // Show/hide betting and play buttons based on game state
    const bothBetted = p1.currentBet > 0 && p2 && p2.currentBet > 0;
    const roundPlayed = gameState.roundActive === false && p1.card !== null;

    if (gameState.bettingPhase && !bothBetted) {
        document.getElementById('betBtn').style.display = 'inline-block';
        document.getElementById('resetBetBtn').style.display = p1.currentBet > 0 ? 'inline-block' : 'none';
        document.getElementById('playBtn').style.display = 'none';
        document.getElementById('nextBtn').style.display = 'none';
    } else if (bothBetted && !gameState.roundActive) {
        document.getElementById('betBtn').style.display = 'none';
        document.getElementById('resetBetBtn').style.display = 'none';
        document.getElementById('playBtn').style.display = 'none';
        document.getElementById('nextBtn').style.display = 'inline-block';
    } else if (roundPlayed) {
        document.getElementById('betBtn').style.display = 'none';
        document.getElementById('resetBetBtn').style.display = 'none';
        document.getElementById('playBtn').style.display = 'none';
        document.getElementById('nextBtn').style.display = 'inline-block';
    }
}

function displayCards() {
    const p1Card = gameState.players.player1.card;
    const p2Card = gameState.players.player2.card;

    if (p1Card) {
        document.getElementById('player1Card').innerHTML = `<div>${p1Card.rank}${p1Card.suit}</div>`;
    }
    if (p2Card) {
        document.getElementById('player2Card').innerHTML = `<div>${p2Card.rank}${p2Card.suit}</div>`;
    }
}

function showRoundResult(winner) {
    const resultDiv = document.getElementById('roundResult');
    resultDiv.style.display = 'block';

    if (winner === 'player1') {
        resultDiv.textContent = `${gameState.players.player1.name} Wins!`;
        resultDiv.className = 'round-result win';
    } else if (winner === 'player2') {
        resultDiv.textContent = `${gameState.players.player2.name} Wins!`;
        resultDiv.className = 'round-result lose';
    } else {
        resultDiv.textContent = "It's a Tie!";
        resultDiv.className = 'round-result tie';
    }
}

function resetBetUI() {
    document.getElementById('betAmount').value = '';
    document.getElementById('roundResult').style.display = 'none';
    document.getElementById('player1Card').innerHTML = '<div class="card-back"></div>';
    document.getElementById('player2Card').innerHTML = '<div class="card-back"></div>';
}

function resetRoundUI() {
    document.getElementById('betAmount').value = '';
    document.getElementById('roundResult').style.display = 'none';
    document.getElementById('player1Card').innerHTML = '<div class="card-back"></div>';
    document.getElementById('player2Card').innerHTML = '<div class="card-back"></div>';
}

// Initialize on page load
window.addEventListener('load', () => {
    showMenuScreen();
});
