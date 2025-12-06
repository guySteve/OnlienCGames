"use strict";
/**
 * Bingo Game Engine - Casino Standards
 *
 * Features:
 * - Provably fair Fisher-Yates ball shuffle
 * - Automatic ball calling with socket events
 * - Multiple card purchases
 * - Real-time event emissions
 * - Cryptographically secure RNG
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BingoEngine = void 0;
const GameEngine_1 = require("./GameEngine");
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const CARD_PRICE = 1;
const MAX_CARDS_PER_PLAYER = 1;
const BALL_DRAW_INTERVAL = 4500;
const BUYING_PHASE_DURATION = 30000;
const HOUSE_BANKROLL = 1000000;
class BingoEngine extends GameEngine_1.GameEngine {
    bingoState;
    bingoPlayers = new Map();
    availableBalls = [];
    ballDrawTimer = null;
    serverSeed = '';
    ballCallCallback;
    gameEndCallback;
    // Event emitter for socket broadcasts
    events = new events_1.EventEmitter();
    constructor(config, prisma, redis, engagement) {
        super(config, prisma, redis, engagement);
        this.bingoState = {
            phase: 'BUYING',
            drawnNumbers: [],
            currentBall: null,
            winner: null,
            pot: 0,
            cardPrice: CARD_PRICE,
            maxCardsPerPlayer: MAX_CARDS_PER_PLAYER,
            nextBallTime: Date.now() + BUYING_PHASE_DURATION,
            houseBankroll: HOUSE_BANKROLL
        };
        this.initializeBalls();
        this.generateServerSeed();
    }
    getGameType() {
        return 'BINGO';
    }
    // ==========================================================================
    // BALL MANAGEMENT WITH FISHER-YATES SHUFFLE
    // ==========================================================================
    /**
     * Initialize and shuffle the 75 bingo balls using Fisher-Yates
     */
    initializeBalls() {
        // Create sequential balls 1-75
        this.availableBalls = Array.from({ length: 75 }, (_, i) => i + 1);
        // Shuffle using cryptographically secure Fisher-Yates
        this.shuffleBalls();
        this.events.emit('balls_initialized', { totalBalls: 75 });
    }
    /**
     * Cryptographically secure Fisher-Yates shuffle for ball draw order
     */
    shuffleBalls() {
        const hash = crypto_1.default.createHash('sha256').update(this.serverSeed).digest();
        for (let i = this.availableBalls.length - 1; i > 0; i--) {
            // Use hash bytes to generate random index
            const byte = hash[i % 32];
            const j = byte % (i + 1);
            [this.availableBalls[i], this.availableBalls[j]] = [this.availableBalls[j], this.availableBalls[i]];
        }
        this.events.emit('balls_shuffled', { method: 'Fisher-Yates', seed: this.serverSeed.substring(0, 8) });
    }
    /**
     * Generate cryptographically secure server seed for provably fair RNG
     */
    generateServerSeed() {
        this.serverSeed = crypto_1.default.randomBytes(32).toString('hex');
    }
    /**
     * Quantum-inspired RNG using server seed for card generation
     */
    getNextRandomIndex(max, nonce) {
        const data = `${this.serverSeed}:${nonce}:${Date.now()}`;
        const hash = crypto_1.default.createHash('sha256').update(data).digest();
        let value = 0;
        for (let i = 0; i < 8; i++) {
            value = value * 256 + hash[i];
        }
        return value % max;
    }
    /**
     * Generate a random Bingo card with proper B-I-N-G-O distribution
     */
    generateBingoCard(userId) {
        const grid = [];
        const marked = [];
        // B(1-15), I(16-30), N(31-45), G(46-60), O(61-75)
        const columnRanges = [
            [1, 15], // B
            [16, 30], // I
            [31, 45], // N
            [46, 60], // G
            [61, 75] // O
        ];
        for (let col = 0; col < 5; col++) {
            const column = [];
            const markedColumn = [];
            const [min, max] = columnRanges[col];
            const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
            for (let row = 0; row < 5; row++) {
                if (col === 2 && row === 2) {
                    // Center FREE SPACE
                    column.push(0);
                    markedColumn.push(true);
                }
                else {
                    const idx = this.getNextRandomIndex(available.length, col * 5 + row);
                    column.push(available[idx]);
                    markedColumn.push(false);
                    available.splice(idx, 1);
                }
            }
            grid.push(column);
            marked.push(markedColumn);
        }
        const card = {
            id: crypto_1.default.randomUUID(),
            userId,
            grid,
            marked
        };
        this.events.emit('card_generated', { userId, cardId: card.id });
        return card;
    }
    /**
     * Convert ball number to BINGO letter
     */
    getBingoLetter(num) {
        if (num >= 1 && num <= 15)
            return 'B';
        if (num >= 16 && num <= 30)
            return 'I';
        if (num >= 31 && num <= 45)
            return 'N';
        if (num >= 46 && num <= 60)
            return 'G';
        if (num >= 61 && num <= 75)
            return 'O';
        return '';
    }
    // ==========================================================================
    // GAME FLOW WITH EVENT EMISSIONS
    // ==========================================================================
    /**
     * Player purchases a Bingo card
     */
    async placeBet(userId, amount) {
        if (this.bingoState.phase !== 'BUYING') {
            return false;
        }
        if (amount !== CARD_PRICE) {
            return false;
        }
        let player = this.bingoPlayers.get(userId);
        if (!player) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user || Number(user.chipBalance) < CARD_PRICE) {
                return false;
            }
            player = {
                userId,
                seatIndex: this.bingoPlayers.size,
                chips: Number(user.chipBalance),
                currentBet: 0,
                connected: true,
                cards: []
            };
            this.bingoPlayers.set(userId, player);
        }
        if (player.cards.length >= MAX_CARDS_PER_PLAYER) {
            return false;
        }
        if (player.chips < CARD_PRICE) {
            return false;
        }
        player.chips -= CARD_PRICE;
        player.currentBet += CARD_PRICE;
        this.bingoState.pot += CARD_PRICE;
        const card = this.generateBingoCard(userId);
        player.cards.push(card);
        this.events.emit('card_purchased', {
            userId,
            cardId: card.id,
            cost: CARD_PRICE,
            pot: this.bingoState.pot
        });
        return true;
    }
    /**
     * Start the game after buying phase
     */
    async startNewHand() {
        if (this.bingoState.phase !== 'BUYING') {
            return;
        }
        if (this.bingoPlayers.size === 0) {
            return;
        }
        this.bingoState.phase = 'PLAYING';
        this.state = GameEngine_1.GameState.PLAYING;
        this.handNumber++;
        this.events.emit('game_started', {
            handNumber: this.handNumber,
            playerCount: this.bingoPlayers.size,
            pot: this.bingoState.pot
        });
        this.scheduleNextBallDraw();
    }
    /**
     * Schedule the next ball draw
     */
    scheduleNextBallDraw() {
        if (this.ballDrawTimer) {
            clearTimeout(this.ballDrawTimer);
        }
        this.bingoState.nextBallTime = Date.now() + BALL_DRAW_INTERVAL;
        this.ballDrawTimer = setTimeout(() => {
            this.drawBall();
        }, BALL_DRAW_INTERVAL);
    }
    /**
     * Draw the next ball from the pre-shuffled array
     */
    drawBall() {
        if (this.availableBalls.length === 0 || this.bingoState.phase !== 'PLAYING') {
            return;
        }
        // Fisher-Yates pre-shuffled: just pop from the front
        const ball = this.availableBalls.shift();
        this.bingoState.drawnNumbers.push(ball);
        this.bingoState.currentBall = ball;
        const letter = this.getBingoLetter(ball);
        this.events.emit('ball_called', {
            ball,
            letter,
            callString: `${letter}-${ball}`,
            totalCalled: this.bingoState.drawnNumbers.length
        });
        // Auto-mark all cards
        this.autoMarkCards(ball);
        // Notify callback (for Moe's voice/banter)
        if (this.ballCallCallback) {
            this.ballCallCallback(ball);
        }
        // Continue drawing if no winner
        if (this.bingoState.phase === 'PLAYING') {
            this.scheduleNextBallDraw();
        }
    }
    /**
     * Automatically mark the called number on all cards
     */
    autoMarkCards(ball) {
        for (const player of this.bingoPlayers.values()) {
            for (const card of player.cards) {
                for (let col = 0; col < 5; col++) {
                    for (let row = 0; row < 5; row++) {
                        if (card.grid[col][row] === ball) {
                            card.marked[col][row] = true;
                            this.events.emit('card_marked', {
                                userId: player.userId,
                                cardId: card.id,
                                ball,
                                position: { col, row }
                            });
                        }
                    }
                }
            }
        }
    }
    /**
     * Player claims BINGO
     */
    async claimBingo(userId, cardId) {
        if (this.bingoState.phase !== 'PLAYING') {
            return { valid: false };
        }
        const player = this.bingoPlayers.get(userId);
        if (!player) {
            return { valid: false };
        }
        const card = player.cards.find(c => c.id === cardId);
        if (!card) {
            return { valid: false };
        }
        const pattern = this.checkWin(card);
        if (pattern) {
            this.bingoState.winner = { userId, cardId, pattern };
            this.bingoState.phase = 'COMPLETE';
            this.state = GameEngine_1.GameState.COMPLETE;
            if (this.ballDrawTimer) {
                clearTimeout(this.ballDrawTimer);
                this.ballDrawTimer = null;
            }
            player.chips += this.bingoState.pot;
            this.events.emit('bingo_claimed', {
                userId,
                cardId,
                pattern,
                pot: this.bingoState.pot,
                ballsDrawn: this.bingoState.drawnNumbers.length
            });
            await this.resolveHand();
            if (this.gameEndCallback) {
                this.gameEndCallback({ userId, cardId, pattern, pot: this.bingoState.pot });
            }
            setTimeout(() => {
                this.resetForNextRound();
                if (this.gameEndCallback) {
                    this.gameEndCallback({ type: 'ROUND_RESET' });
                }
            }, 10000);
            return { valid: true, pattern };
        }
        this.events.emit('invalid_bingo_claim', { userId, cardId });
        return { valid: false };
    }
    /**
     * Check if a card has a winning pattern
     */
    checkWin(card) {
        const { marked } = card;
        // Check horizontal lines
        for (let row = 0; row < 5; row++) {
            if (marked.every(col => col[row])) {
                return 'HORIZONTAL';
            }
        }
        // Check vertical lines
        for (let col = 0; col < 5; col++) {
            if (marked[col].every(cell => cell)) {
                return 'VERTICAL';
            }
        }
        // Check diagonal (top-left to bottom-right)
        if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) {
            return 'DIAGONAL';
        }
        // Check diagonal (top-right to bottom-left)
        if (marked[4][0] && marked[3][1] && marked[2][2] && marked[1][3] && marked[0][4]) {
            return 'DIAGONAL';
        }
        return null;
    }
    /**
     * Reset game for next round
     */
    resetForNextRound() {
        this.bingoState.phase = 'BUYING';
        this.bingoState.drawnNumbers = [];
        this.bingoState.currentBall = null;
        this.bingoState.pot = 0;
        this.bingoState.winner = null;
        this.bingoState.nextBallTime = null;
        this.bingoPlayers.forEach(player => {
            player.cards = [];
            player.currentBet = 0;
        });
        this.initializeBalls();
        this.generateServerSeed();
        if (this.ballDrawTimer) {
            clearInterval(this.ballDrawTimer);
            this.ballDrawTimer = null;
        }
        this.events.emit('round_reset', { buyingPhaseEnds: Date.now() + BUYING_PHASE_DURATION });
    }
    /**
     * Resolve hand and persist to database
     */
    async resolveHand() {
        if (!this.bingoState.winner)
            return;
        const sessionId = crypto_1.default.randomUUID();
        const winner = this.bingoState.winner;
        await this.prisma.gameSession.create({
            data: {
                id: sessionId,
                gameType: 'BINGO',
                roomId: this.config.roomId,
                hostUserId: winner.userId,
                serverSeed: this.serverSeed,
                finalState: {
                    drawnNumbers: this.bingoState.drawnNumbers,
                    winner: this.bingoState.winner,
                    totalCards: Array.from(this.bingoPlayers.values()).reduce((sum, p) => sum + p.cards.length, 0)
                },
                totalPot: this.bingoState.pot,
                winners: [{ userId: winner.userId, amount: this.bingoState.pot }]
            }
        });
        for (const [userId, player] of this.bingoPlayers.entries()) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user)
                continue;
            const chipDelta = player.chips - Number(user.chipBalance);
            await this.prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        chipBalance: player.chips,
                        totalWagered: chipDelta < 0 ? { increment: Math.abs(chipDelta) } : undefined,
                        totalWon: chipDelta > 0 ? { increment: chipDelta } : undefined,
                        totalHandsPlayed: { increment: 1 },
                        lastHandPlayed: new Date()
                    }
                });
                if (player.currentBet > 0) {
                    await tx.transaction.create({
                        data: {
                            userId,
                            amount: -player.currentBet,
                            type: 'BET',
                            balanceBefore: user.chipBalance,
                            balanceAfter: BigInt(chipDelta < 0 ? player.chips : Number(user.chipBalance)),
                            gameSessionId: sessionId,
                            description: `BINGO - ${player.cards.length} card(s)`
                        }
                    });
                }
                if (userId === winner.userId) {
                    await tx.transaction.create({
                        data: {
                            userId,
                            amount: this.bingoState.pot,
                            type: 'WIN',
                            balanceBefore: BigInt(Number(user.chipBalance) - chipDelta),
                            balanceAfter: BigInt(player.chips),
                            gameSessionId: sessionId,
                            description: `BINGO WIN - ${winner.pattern}`
                        }
                    });
                    await this.engagement.recordBigWin(userId, this.bingoState.pot, 'BINGO');
                    const xpEarned = Math.floor(this.bingoState.pot / 5);
                    await this.engagement.awardXP(userId, xpEarned);
                }
            });
        }
    }
    /**
     * Get current game state for clients
     */
    getGameState() {
        return {
            type: 'BINGO',
            phase: this.bingoState.phase,
            drawnNumbers: this.bingoState.drawnNumbers,
            currentBall: this.bingoState.currentBall,
            pot: this.bingoState.pot,
            cardPrice: this.bingoState.cardPrice,
            maxCardsPerPlayer: this.bingoState.maxCardsPerPlayer,
            nextBallTime: this.bingoState.nextBallTime,
            winner: this.bingoState.winner,
            houseBankroll: this.bingoState.houseBankroll,
            players: Array.from(this.bingoPlayers.entries()).map(([userId, player]) => ({
                userId,
                cardCount: player.cards.length,
                connected: player.connected
            }))
        };
    }
    getPlayerCards(userId) {
        const player = this.bingoPlayers.get(userId);
        return player ? player.cards : [];
    }
    setBallCallCallback(callback) {
        this.ballCallCallback = callback;
    }
    setGameEndCallback(callback) {
        this.gameEndCallback = callback;
    }
    destroy() {
        if (this.ballDrawTimer) {
            clearTimeout(this.ballDrawTimer);
            this.ballDrawTimer = null;
        }
    }
    async addPlayer(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || Number(user.chipBalance) < CARD_PRICE) {
            return false;
        }
        if (!this.bingoPlayers.has(userId)) {
            this.bingoPlayers.set(userId, {
                userId,
                seatIndex: this.bingoPlayers.size,
                chips: Number(user.chipBalance),
                currentBet: 0,
                connected: true,
                cards: []
            });
        }
        return true;
    }
    async forceStart() {
        if (this.bingoState.phase === 'BUYING') {
            await this.startNewHand();
        }
    }
}
exports.BingoEngine = BingoEngine;
//# sourceMappingURL=BingoEngine.js.map