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
        this.players = {
            player1: {
                socketId: player1.socketId,
                name: player1.name,
                chips: player1.chips,
                currentBet: 0,
                card: null,
                ready: false,
                connected: true,
            },
            player2: null,
        };
        this.pot = 0;
        this.deck = this.createDeck();
        this.roundActive = false;
        this.bettingPhase = true;
        this.stats = {
            player1Wins: 0,
            player2Wins: 0,
            ties: 0,
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

    addPlayer2(player2) {
        this.players.player2 = {
            socketId: player2.socketId,
            name: player2.name,
            chips: player2.chips,
            currentBet: 0,
            card: null,
            ready: false,
            connected: true,
        };
    }

    isFull() {
        return this.players.player2 !== null;
    }

    placeBet(playerKey, betAmount) {
        const player = this.players[playerKey];
        if (betAmount > player.chips) {
            return { success: false, error: 'Insufficient chips' };
        }
        player.currentBet = betAmount;
        player.chips -= betAmount;
        this.pot += betAmount;
        return { success: true };
    }

    resetBets() {
        this.players.player1.chips += this.players.player1.currentBet;
        this.players.player2.chips += this.players.player2.currentBet;
        this.pot -= this.players.player1.currentBet + this.players.player2.currentBet;
        this.players.player1.currentBet = 0;
        this.players.player2.currentBet = 0;
    }

    playRound() {
        if (this.deck.length < 2) {
            this.deck = this.createDeck();
        }
        this.players.player1.card = this.deck.pop();
        this.players.player2.card = this.deck.pop();
        this.roundActive = true;

        const result = this.determineWinner();
        return result;
    }

    determineWinner() {
        const p1Value = this.players.player1.card.value;
        const p2Value = this.players.player2.card.value;
        let winner = null;

        if (p1Value > p2Value) {
            this.players.player1.chips += this.pot;
            this.stats.player1Wins++;
            winner = 'player1';
        } else if (p2Value > p1Value) {
            this.players.player2.chips += this.pot;
            this.stats.player2Wins++;
            winner = 'player2';
        } else {
            const tieChips = Math.floor(this.pot / 2);
            this.players.player1.chips += tieChips;
            this.players.player2.chips += this.pot - tieChips;
            this.stats.ties++;
            winner = 'tie';
        }

        this.pot = 0;
        this.roundActive = false;
        return winner;
    }

    nextRound() {
        this.players.player1.card = null;
        this.players.player2.card = null;
        this.players.player1.currentBet = 0;
        this.players.player2.currentBet = 0;
        this.players.player1.ready = false;
        this.players.player2.ready = false;
        this.bettingPhase = true;
    }

    getGameState() {
        return {
            roomId: this.roomId,
            players: {
                player1: {
                    name: this.players.player1.name,
                    chips: this.players.player1.chips,
                    currentBet: this.players.player1.currentBet,
                    card: this.players.player1.card,
                    connected: this.players.player1.connected,
                },
                player2: this.players.player2 ? {
                    name: this.players.player2.name,
                    chips: this.players.player2.chips,
                    currentBet: this.players.player2.currentBet,
                    card: this.players.player2.card,
                    connected: this.players.player2.connected,
                } : null,
            },
            pot: this.pot,
            roundActive: this.roundActive,
            bettingPhase: this.bettingPhase,
            stats: this.stats,
        };
    }

    anyPlayerOutOfChips() {
        return this.players.player1.chips <= 0 || (this.players.player2 && this.players.player2.chips <= 0);
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

        if (gameRoom.isFull()) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        gameRoom.addPlayer2({
            socketId: socket.id,
            name: playerName,
            chips: startingChips,
        });

        playerToGame.set(socket.id, roomId);
        socket.join(roomId);

        io.to(roomId).emit('player_joined', {
            gameState: gameRoom.getGameState(),
        });

        console.log(`${playerName} joined room ${roomId}`);
    });

    socket.on('place_bet', (data) => {
        const roomId = playerToGame.get(socket.id);
        const gameRoom = games.get(roomId);

        if (!gameRoom) return;

        const playerKey = gameRoom.players.player1.socketId === socket.id ? 'player1' : 'player2';
        const result = gameRoom.placeBet(playerKey, data.betAmount);

        if (!result.success) {
            socket.emit('error', { message: result.error });
            return;
        }

        gameRoom.players[playerKey].ready = true;

        io.to(roomId).emit('bet_placed', {
            gameState: gameRoom.getGameState(),
        });

        // Auto-play round if both players have bet
        if (gameRoom.players.player1.ready && gameRoom.players.player2.ready) {
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
                const playerKey = gameRoom.players.player1.socketId === socket.id ? 'player1' : 'player2';
                gameRoom.players[playerKey].connected = false;

                io.to(roomId).emit('player_disconnected', {
                    gameState: gameRoom.getGameState(),
                });

                // Clean up empty rooms
                setTimeout(() => {
                    if (!gameRoom.players.player1.connected && !gameRoom.players.player2?.connected) {
                        games.delete(roomId);
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

        let winner;
        if (gameRoom.players.player1.chips > gameRoom.players.player2.chips) {
            winner = gameRoom.players.player1.name;
        } else if (gameRoom.players.player2.chips > gameRoom.players.player1.chips) {
            winner = gameRoom.players.player2.name;
        } else {
            winner = 'tie';
        }

        io.to(roomId).emit('game_over', {
            winner,
            stats: gameRoom.stats,
            finalState: gameRoom.getGameState(),
        });
    });
});

server.listen(PORT, () => {
    console.log(`Game server running on http://localhost:${PORT}`);
});
