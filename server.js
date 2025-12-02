const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

const PORT = process.env.PORT || 3000;

// Game state management
const games = new Map();
const playerToGame = new Map();

class GameRoom {
    constructor(roomId, player1) {
        this.roomId = roomId;
        this.players = new Map();
        this.players.set('player1', {
            socketId: player1.socketId,
            name: player1.name,
            chips: player1.chips,
            currentBet: 0,
            card: null,
            ready: false,
            connected: true,
            joinedAt: Date.now(),
        });
        this.pot = 0;
        this.deck = this.createDeck();
        this.roundActive = false;
        this.bettingPhase = true;
        this.playerCount = 1;
        this.maxPlayers = 5;
        this.stats = {
            roundsPlayed: 0,
            handCounts: {},
        };
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = [
            { rank: 'A', value: 14 },
            { rank: 'K', value: 13 },
            { rank: 'Q', value: 12 },
            { rank: 'J', value: 11 },
            { rank: '10', value: 10 },
            { rank: '9', value: 9 },
            { rank: '8', value: 8 },
            { rank: '7', value: 7 },
            { rank: '6', value: 6 },
            { rank: '5', value: 5 },
            { rank: '4', value: 4 },
            { rank: '3', value: 3 },
            { rank: '2', value: 2 },
        ];

        const deck = [];
        for (const suit of suits) {
            for (const { rank, value } of ranks) {
                deck.push({ rank, value, suit });
            }
        }
        return this.shuffleDeck(deck);
    }

    shuffleDeck(deck) {
        const newDeck = [...deck];
        for (let i = newDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
        }
        return newDeck;
    }

    addPlayer(player) {
        if (this.playerCount >= this.maxPlayers) {
            return { success: false, error: 'Room is full (max 5 players)' };
        }
        const playerKey = `player${this.playerCount + 1}`;
        this.players.set(playerKey, {
            socketId: player.socketId,
            name: player.name,
            chips: player.chips,
            currentBet: 0,
            card: null,
            ready: false,
            connected: true,
            joinedAt: Date.now(),
        });
        this.playerCount++;
        return { success: true, playerKey };
    }

    isFull() {
        return this.playerCount >= this.maxPlayers;
    }

    hasRoom() {
        return this.playerCount < this.maxPlayers;
    }

    placeBet(playerKey, betAmount) {
        const player = this.players.get(playerKey);
        if (!player) return { success: false, error: 'Player not found' };
        if (betAmount > player.chips) {
            return { success: false, error: 'Insufficient chips' };
        }
        player.currentBet = betAmount;
        player.chips -= betAmount;
        this.pot += betAmount;
        player.ready = true;
        return { success: true };
    }

    resetBets() {
        this.players.forEach(player => {
            player.chips += player.currentBet;
            this.pot -= player.currentBet;
            player.currentBet = 0;
            player.ready = false;
        });
    }

    allPlayersBetted() {
        let activePlayers = 0;
        let readyPlayers = 0;
        this.players.forEach(player => {
            if (player.connected) {
                activePlayers++;
                if (player.ready && player.currentBet > 0) {
                    readyPlayers++;
                }
            }
        });
        return activePlayers > 0 && activePlayers === readyPlayers;
    }

    playRound() {
        if (this.deck.length < this.playerCount) {
            this.deck = this.createDeck();
        }
        
        const cards = [];
        this.players.forEach((player, key) => {
            player.card = this.deck.pop();
            cards.push({ player: key, name: player.name, card: player.card });
        });
        
        this.roundActive = true;
        const result = this.determineWinner();
        this.stats.roundsPlayed++;
        return result;
    }

    determineWinner() {
        const hands = [];
        this.players.forEach((player, key) => {
            if (player.card) {
                hands.push({
                    key,
                    name: player.name,
                    value: player.card.value,
                    card: player.card,
                });
            }
        });

        hands.sort((a, b) => b.value - a.value);
        const highestValue = hands[0].value;
        const winners = hands.filter(h => h.value === highestValue);

        if (winners.length === 1) {
            const winner = this.players.get(winners[0].key);
            winner.chips += this.pot;
            this.pot = 0;
            this.roundActive = false;
            return { type: 'win', winners: [winners[0]] };
        } else {
            const splitPot = Math.floor(this.pot / winners.length);
            const remainder = this.pot % winners.length;
            
            winners.forEach((w, idx) => {
                const player = this.players.get(w.key);
                player.chips += splitPot + (idx === 0 ? remainder : 0);
            });
            
            this.pot = 0;
            this.roundActive = false;
            return { type: 'tie', winners };
        }
    }

    nextRound() {
        this.players.forEach(player => {
            player.card = null;
            player.currentBet = 0;
            player.ready = false;
        });
        this.bettingPhase = true;
    }

    getGameState() {
        const playersArray = [];
        this.players.forEach((player, key) => {
            playersArray.push({
                key,
                name: player.name,
                chips: player.chips,
                currentBet: player.currentBet,
                card: player.card,
                connected: player.connected,
                ready: player.ready,
            });
        });

        return {
            roomId: this.roomId,
            players: playersArray,
            playerCount: this.playerCount,
            pot: this.pot,
            roundActive: this.roundActive,
            bettingPhase: this.bettingPhase,
            stats: this.stats,
        };
    }

    anyPlayerOutOfChips() {
        let hasPlayerWithChips = false;
        this.players.forEach(player => {
            if (player.connected && player.chips > 0) {
                hasPlayerWithChips = true;
            }
        });
        return !hasPlayerWithChips;
    }
}

// Socket events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', (data) => {
        const roomId = Math.random().toString(36).substr(2, 9);
        const gameRoom = new GameRoom(roomId, {
            socketId: socket.id,
            name: data.playerName,
            chips: data.startingChips,
        });

        games.set(roomId, gameRoom);
        playerToGame.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit('room_created', {
            roomId,
            gameState: gameRoom.getGameState(),
        });

        console.log(`Room created: ${roomId} by ${data.playerName}`);
    });

    socket.on('join_room', (data) => {
        const { roomId, playerName, startingChips } = data;
        const gameRoom = games.get(roomId);

        if (!gameRoom) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (!gameRoom.hasRoom()) {
            socket.emit('error', { message: 'Room is full (max 5 players)' });
            return;
        }

        const result = gameRoom.addPlayer({
            socketId: socket.id,
            name: playerName,
            chips: startingChips,
        });

        if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
        }

        playerToGame.set(socket.id, roomId);
        socket.join(roomId);

        io.to(roomId).emit('player_joined', {
            gameState: gameRoom.getGameState(),
        });

        console.log(`${playerName} joined room ${roomId} (${gameRoom.playerCount} players)`);
    });

    socket.on('place_bet', (data) => {
        const roomId = playerToGame.get(socket.id);
        const gameRoom = games.get(roomId);

        if (!gameRoom) return;

        let playerKey = null;
        gameRoom.players.forEach((player, key) => {
            if (player.socketId === socket.id) {
                playerKey = key;
            }
        });

        if (!playerKey) return;

        const result = gameRoom.placeBet(playerKey, data.betAmount);

        if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
        }

        io.to(roomId).emit('bet_placed', {
            gameState: gameRoom.getGameState(),
        });

        if (gameRoom.allPlayersBetted()) {
            const winner = gameRoom.playRound();
            io.to(roomId).emit('round_played', {
                gameState: gameRoom.getGameState(),
                winner,
            });
        }
    });

    socket.on('reset_bets', () => {
        const roomId = playerToGame.get(socket.id);
        const gameRoom = games.get(roomId);

        if (!gameRoom) return;

        gameRoom.resetBets();
        gameRoom.players.player1.ready = false;
        gameRoom.players.player2.ready = false;

        io.to(roomId).emit('bets_reset', {
            gameState: gameRoom.getGameState(),
        });
    });

    socket.on('next_round', () => {
        const roomId = playerToGame.get(socket.id);
        const gameRoom = games.get(roomId);

        if (!gameRoom) return;

        if (gameRoom.anyPlayerOutOfChips()) {
            let winner;
            if (gameRoom.players.player1.chips <= 0) {
                winner = gameRoom.players.player2.name;
            } else {
                winner = gameRoom.players.player1.name;
            }

            io.to(roomId).emit('game_over', {
                winner,
                stats: gameRoom.stats,
                finalState: gameRoom.getGameState(),
            });
            return;
        }

        gameRoom.nextRound();
        io.to(roomId).emit('round_reset', {
            gameState: gameRoom.getGameState(),
        });
    });

    socket.on('disconnect', () => {
        const roomId = playerToGame.get(socket.id);
        if (roomId) {
            const gameRoom = games.get(roomId);
            if (gameRoom) {
                let playerKey = null;
                gameRoom.players.forEach((player, key) => {
                    if (player.socketId === socket.id) {
                        playerKey = key;
                    }
                });
                
                if (playerKey) {
                    const player = gameRoom.players.get(playerKey);
                    player.connected = false;

                    io.to(roomId).emit('player_disconnected', {
                        gameState: gameRoom.getGameState(),
                    });
                }

                // Clean up empty rooms after 30 seconds
                setTimeout(() => {
                    let anyConnected = false;
                    gameRoom.players.forEach(p => {
                        if (p.connected) anyConnected = true;
                    });
                    if (!anyConnected) {
                        games.delete(roomId);
                        console.log(`Room ${roomId} cleaned up`);
                    }
                }, 30000);
            }
            playerToGame.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });

    socket.on('end_game', () => {
        const roomId = playerToGame.get(socket.id);
        const gameRoom = games.get(roomId);

        if (!gameRoom) return;

        let winners = [];
        let maxChips = 0;
        
        gameRoom.players.forEach((player, key) => {
            if (player.chips > maxChips) {
                maxChips = player.chips;
                winners = [{ key, name: player.name, chips: player.chips }];
            } else if (player.chips === maxChips) {
                winners.push({ key, name: player.name, chips: player.chips });
            }
        });

        io.to(roomId).emit('game_over', {
            winners,
            stats: gameRoom.stats,
            finalState: gameRoom.getGameState(),
        });
    });
});

server.listen(PORT, () => {
    console.log(`Game server running on http://localhost:${PORT}`);
});
