const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
const APP_VERSION = '1.3.0';

const app = express();
app.set('trust proxy', 1);

// Sessions
const sessionMiddleware = session({
  store: new MemoryStore({ checkPeriod: 86400000 }),
  name: 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: NODE_ENV === 'production',
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'
  }
});
app.use(sessionMiddleware);

// Passport: Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    id: profile.id,
    displayName: profile.displayName,
    photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null
  };
  return done(null, user);
}));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
app.use(passport.initialize());
app.use(passport.session());

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/', successRedirect: '/' }));
app.post('/logout', (req, res) => {
  req.logout(() => { req.session.destroy(() => res.clearCookie('sid').status(200).json({ ok: true })); });
});
app.get('/me', (req, res) => {
  if (!req.user) return res.status(200).json({ authenticated: false });
  res.json({ authenticated: true, user: req.user });
});

// Game / Lobby state
const serverHttp = http.createServer(app);
const io = socketIo(serverHttp, { cors: { origin: '*', methods: ['GET', 'POST'] } });
io.engine.use(sessionMiddleware);

const games = new Map(); // roomId -> GameRoom
const playerToGame = new Map(); // socketId -> roomId

const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANKS = [
  { rank: 'A', value: 14 }, { rank: 'K', value: 13 }, { rank: 'Q', value: 12 }, { rank: 'J', value: 11 },
  { rank: '10', value: 10 }, { rank: '9', value: 9 }, { rank: '8', value: 8 }, { rank: '7', value: 7 },
  { rank: '6', value: 6 }, { rank: '5', value: 5 }, { rank: '4', value: 4 }, { rank: '3', value: 3 }, { rank: '2', value: 2 }
];

function cryptoShuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r.rank, value: r.value, suit: s });
  return cryptoShuffle(deck);
}
function getMinBet() {
  const hour = new Date().getHours();
  return hour >= 20 ? 50 : 10; // High Stakes Night after 8 PM
}

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // 'p1' | 'p2'
    this.pot = 0;
    this.deck = createDeck();
    this.roundActive = false;
    this.bettingPhase = true;
    this.minBet = getMinBet();
  }
  get playerCount() { return this.players.size; }
  hasRoom() { return this.playerCount < 2; }
  addPlayer({ socketId, name, chips, photo }) {
    if (!this.hasRoom()) return { success: false, error: 'Room full' };
    const key = this.players.has('p1') ? 'p2' : 'p1';
    this.players.set(key, { socketId, name, photo: photo || null, chips, currentBet: 0, card: null, ready: false, connected: true });
    return { success: true, key };
  }
  ensureDeck() { if (this.deck.length < this.playerCount) this.deck = createDeck(); }
  placeBet(key, amount) {
    const min = this.minBet;
    const p = this.players.get(key);
    if (!p) return { success: false, error: 'Player not found' };
    if (amount < min) return { success: false, error: `Minimum bet is ${min}` };
    if (amount > p.chips) return { success: false, error: 'Insufficient chips' };
    if (p.ready) return { success: false, error: 'Bet already placed' };
    p.currentBet = amount; p.chips -= amount; this.pot += amount; p.ready = true; return { success: true };
  }
  allReady() {
    if (this.playerCount < 2) return false;
    for (const p of this.players.values()) {
      if (!(p.connected && p.ready && p.currentBet > 0)) return false;
    }
    return true;
  }
  dealCards() {
    this.ensureDeck();
    for (const p of this.players.values()) p.card = this.deck.pop();
    this.roundActive = true;
  }
  determine() {
    const hands = [];
    for (const [k, p] of this.players.entries()) if (p.card) hands.push({ key: k, name: p.name, photo: p.photo, value: p.card.value, card: p.card });
    hands.sort((a, b) => b.value - a.value);
    const top = hands[0].value;
    const winners = hands.filter(h => h.value === top);
    if (winners.length === 1) {
      this.players.get(winners[0].key).chips += this.pot;
      const result = { type: 'win', winners, pot: this.pot };
      this.pot = 0; this.roundActive = false; return result;
    }
    const split = Math.floor(this.pot / winners.length); const rem = this.pot % winners.length;
    winners.forEach((w, i) => { const p = this.players.get(w.key); p.chips += split + (i === 0 ? rem : 0); });
    const result = { type: 'tie', winners, pot: this.pot };
    this.pot = 0; this.roundActive = false; return result;
  }
  resetForNext() {
    for (const p of this.players.values()) { p.card = null; p.currentBet = 0; p.ready = false; }
    this.bettingPhase = true; this.minBet = getMinBet();
  }
  getState() {
    const players = [];
    for (const [key, p] of this.players.entries()) players.push({ key, name: p.name, photo: p.photo, chips: p.chips, currentBet: p.currentBet, card: p.card, connected: p.connected, ready: p.ready });
    return { roomId: this.roomId, players, playerCount: this.playerCount, pot: this.pot, roundActive: this.roundActive, bettingPhase: this.bettingPhase, minBet: this.minBet };
  }
}

function getRoomsSummary() {
  return Array.from(games.values()).map(g => ({ roomId: g.roomId, playerCount: g.playerCount, hasRoom: g.hasRoom() }));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function runAutoRound(game) {
  if (!game.allReady()) return;
  const roomId = game.roomId;
  io.to(roomId).emit('bets_locked', { gameState: game.getState() });
  await sleep(800);
  game.dealCards();
  io.to(roomId).emit('cards_dealt', { gameState: game.getState() });
  await sleep(1000);
  const result = game.determine();
  io.to(roomId).emit('round_result', { gameState: game.getState(), result });
  await sleep(800);
  if ([...game.players.values()].some(p => p.chips <= 0)) {
    const standings = [...game.players.entries()].map(([k, p]) => ({ key: k, name: p.name, chips: p.chips }));
    io.to(roomId).emit('game_over', { standings, finalState: game.getState() });
    return;
  }
  game.resetForNext();
  io.to(roomId).emit('round_reset', { gameState: game.getState() });
}

io.on('connection', (socket) => {
  // Join lobby channel and send existing rooms
  socket.join('lobby');
  io.to(socket.id).emit('rooms_list', getRoomsSummary());

  // Lobby chat
  socket.on('lobby_chat', (msg) => {
    const user = socket.request?.session?.passport?.user;
    const name = user?.displayName || 'Guest';
    const photo = user?.photo || null;
    io.to('lobby').emit('lobby_message', { from: name, photo, msg, at: Date.now() });
  });
  socket.on('get_rooms', () => io.to(socket.id).emit('rooms_list', getRoomsSummary()));

  // Create room
  socket.on('create_room', (data = {}) => {
    const roomId = crypto.randomBytes(4).toString('hex');
    const user = socket.request?.session?.passport?.user;
    const name = user?.displayName || data.playerName || 'Player';
    const photo = user?.photo || data.photo || null;
    const startingChips = Number(data.startingChips) || 1000;

    const game = new GameRoom(roomId);
    const add = game.addPlayer({ socketId: socket.id, name, photo, chips: startingChips });
    if (!add.success) return;

    games.set(roomId, game);
    playerToGame.set(socket.id, roomId);
    socket.join(roomId);

    io.to(socket.id).emit('room_created', { roomId, gameState: game.getState() });
    io.to('lobby').emit('rooms_update', getRoomsSummary());
  });

  // Join room
  socket.on('join_room', (data = {}) => {
    const { roomId } = data;
    const game = games.get(roomId);
    if (!game) return io.to(socket.id).emit('error', { message: 'Room not found' });
    if (!game.hasRoom()) return io.to(socket.id).emit('error', { message: 'Room is full' });

    const user = socket.request?.session?.passport?.user;
    const name = user?.displayName || data.playerName || 'Player';
    const photo = user?.photo || data.photo || null;
    const startingChips = Number(data.startingChips) || 1000;

    const add = game.addPlayer({ socketId: socket.id, name, photo, chips: startingChips });
    if (!add.success) return io.to(socket.id).emit('error', { message: add.error });

    playerToGame.set(socket.id, roomId);
    socket.join(roomId);

    io.to(roomId).emit('player_joined', { gameState: game.getState() });
    io.to('lobby').emit('rooms_update', getRoomsSummary());
  });

  // Room chat
  socket.on('room_chat', (msg) => {
    const roomId = playerToGame.get(socket.id);
    if (!roomId) return;
    const user = socket.request?.session?.passport?.user;
    const name = user?.displayName || 'Guest';
    const photo = user?.photo || null;
    io.to(roomId).emit('room_message', { from: name, photo, msg, at: Date.now() });
  });

  // Betting
  socket.on('place_bet', (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (!game) return;

    let playerKey = null;
    for (const [k, p] of game.players.entries()) if (p.socketId === socket.id) { playerKey = k; break; }
    if (!playerKey) return;

    const amount = Number(data.betAmount || 0);
    const result = game.placeBet(playerKey, amount);
    if (!result.success) return io.to(socket.id).emit('error', { message: result.error });

    io.to(roomId).emit('bet_placed', { gameState: game.getState() });
    if (game.allReady()) runAutoRound(game);
  });

  // Disconnection
  socket.on('disconnect', () => {
    const roomId = playerToGame.get(socket.id);
    if (roomId) {
      const game = games.get(roomId);
      if (game) {
        for (const [k, p] of game.players.entries()) if (p.socketId === socket.id) { p.connected = false; }
        io.to(roomId).emit('player_disconnected', { gameState: game.getState() });
        setTimeout(() => {
          const anyConnected = [...game.players.values()].some(p => p.connected);
          if (!anyConnected) { games.delete(roomId); io.to('lobby').emit('rooms_update', getRoomsSummary()); }
        }, 30000);
      }
      playerToGame.delete(socket.id);
    }
  });
});

serverHttp.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});