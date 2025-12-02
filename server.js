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
const APP_VERSION = '2.0.0';

// In-memory profile storage (nickname, avatar)
const userProfiles = new Map(); // odUserId -> { nickname, avatar }

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
  // Include profile data (nickname, custom avatar)
  const profile = userProfiles.get(req.user.id) || {};
  res.json({ 
    authenticated: true, 
    user: { 
      ...req.user, 
      nickname: profile.nickname || req.user.displayName,
      customAvatar: profile.avatar || null
    } 
  });
});

// Profile update endpoint
app.post('/profile', express.json(), (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { nickname, avatar } = req.body;
  if (nickname && (typeof nickname !== 'string' || nickname.length > 30)) {
    return res.status(400).json({ error: 'Invalid nickname' });
  }
  if (avatar && (typeof avatar !== 'string' || avatar.length > 500)) {
    return res.status(400).json({ error: 'Invalid avatar URL' });
  }
  const existing = userProfiles.get(req.user.id) || {};
  userProfiles.set(req.user.id, { 
    nickname: nickname || existing.nickname || req.user.displayName,
    avatar: avatar || existing.avatar || null
  });
  res.json({ ok: true, profile: userProfiles.get(req.user.id) });
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
    // 5 seats (0-4), null means empty
    this.seats = [null, null, null, null, null];
    // Observers (not seated yet)
    this.observers = new Map(); // socketId -> { name, photo }
    this.pot = 0;
    this.deck = createDeck();
    this.roundActive = false;
    this.bettingPhase = true;
    this.minBet = getMinBet();
    // House/Dealer card for 1-player mode
    this.houseCard = null;
    this.status = ''; // For drama sequence
  }
  
  get seatedCount() { 
    return this.seats.filter(s => s !== null).length; 
  }
  
  get totalInRoom() {
    return this.seatedCount + this.observers.size;
  }
  
  hasEmptySeat() { 
    return this.seats.some(s => s === null); 
  }
  
  addObserver({ socketId, name, photo }) {
    this.observers.set(socketId, { socketId, name, photo });
    return { success: true };
  }
  
  removeObserver(socketId) {
    this.observers.delete(socketId);
  }
  
  sitAtSeat(socketId, seatIndex, chips = 1000) {
    if (seatIndex < 0 || seatIndex > 4) return { success: false, error: 'Invalid seat' };
    if (this.seats[seatIndex] !== null) return { success: false, error: 'Seat taken' };
    
    // Check if already seated elsewhere
    for (let i = 0; i < 5; i++) {
      if (this.seats[i] && this.seats[i].socketId === socketId) {
        return { success: false, error: 'Already seated' };
      }
    }
    
    const observer = this.observers.get(socketId);
    if (!observer) return { success: false, error: 'Not in room' };
    
    this.observers.delete(socketId);
    this.seats[seatIndex] = {
      socketId,
      name: observer.name,
      photo: observer.photo,
      chips,
      currentBet: 0,
      card: null,
      ready: false,
      connected: true
    };
    return { success: true, seatIndex };
  }
  
  leaveSeat(socketId) {
    for (let i = 0; i < 5; i++) {
      if (this.seats[i] && this.seats[i].socketId === socketId) {
        const player = this.seats[i];
        this.seats[i] = null;
        // Return to observers
        this.observers.set(socketId, { socketId, name: player.name, photo: player.photo });
        return { success: true, seatIndex: i };
      }
    }
    return { success: false, error: 'Not seated' };
  }
  
  getPlayerBySeat(seatIndex) {
    return this.seats[seatIndex];
  }
  
  getPlayerBySocket(socketId) {
    for (let i = 0; i < 5; i++) {
      if (this.seats[i] && this.seats[i].socketId === socketId) {
        return { seatIndex: i, player: this.seats[i] };
      }
    }
    return null;
  }
  
  ensureDeck() { 
    if (this.deck.length < this.seatedCount + 1) this.deck = createDeck(); 
  }
  
  placeBet(seatIndex, amount) {
    const min = this.minBet;
    const p = this.seats[seatIndex];
    if (!p) return { success: false, error: 'Seat empty' };
    if (amount < min) return { success: false, error: `Minimum bet is ${min}` };
    if (amount > p.chips) return { success: false, error: 'Insufficient chips' };
    if (p.ready) return { success: false, error: 'Bet already placed' };
    p.currentBet = amount; 
    p.chips -= amount; 
    this.pot += amount; 
    p.ready = true; 
    return { success: true };
  }
  
  allSeatedReady() {
    const seated = this.seats.filter(s => s !== null);
    if (seated.length === 0) return false;
    // All seated players must be connected, ready, and have bet
    for (const p of seated) {
      if (!(p.connected && p.ready && p.currentBet > 0)) return false;
    }
    return true;
  }
  
  dealCards() {
    this.ensureDeck();
    // Deal to all seated players
    for (let i = 0; i < 5; i++) {
      if (this.seats[i]) {
        this.seats[i].card = this.deck.pop();
      }
    }
    // If only 1 player, deal house card
    if (this.seatedCount === 1) {
      this.houseCard = this.deck.pop();
    } else {
      this.houseCard = null;
    }
    this.roundActive = true;
  }
  
  determine() {
    const hands = [];
    
    // Collect all seated players' hands
    for (let i = 0; i < 5; i++) {
      const p = this.seats[i];
      if (p && p.card) {
        hands.push({ 
          seatIndex: i, 
          name: p.name, 
          photo: p.photo, 
          value: p.card.value, 
          card: p.card,
          isHouse: false
        });
      }
    }
    
    // If only 1 player, add house to comparison
    if (this.seatedCount === 1 && this.houseCard) {
      hands.push({
        seatIndex: -1,
        name: 'House',
        photo: null,
        value: this.houseCard.value,
        card: this.houseCard,
        isHouse: true
      });
    }
    
    hands.sort((a, b) => b.value - a.value);
    const top = hands[0].value;
    const winners = hands.filter(h => h.value === top);
    
    if (winners.length === 1) {
      const winner = winners[0];
      if (!winner.isHouse && this.seats[winner.seatIndex]) {
        this.seats[winner.seatIndex].chips += this.pot;
      }
      // If house wins, pot is lost
      const result = { type: 'win', winners, pot: this.pot, houseCard: this.houseCard };
      this.pot = 0; 
      this.roundActive = false; 
      return result;
    }
    
    // Tie - split among non-house winners
    const playerWinners = winners.filter(w => !w.isHouse);
    if (playerWinners.length > 0) {
      const split = Math.floor(this.pot / playerWinners.length);
      const rem = this.pot % playerWinners.length;
      playerWinners.forEach((w, i) => {
        if (this.seats[w.seatIndex]) {
          this.seats[w.seatIndex].chips += split + (i === 0 ? rem : 0);
        }
      });
    }
    // If all winners include house in a tie, house gets portion too (pot lost)
    
    const result = { type: 'tie', winners, pot: this.pot, houseCard: this.houseCard };
    this.pot = 0; 
    this.roundActive = false; 
    return result;
  }
  
  resetForNext() {
    for (let i = 0; i < 5; i++) {
      if (this.seats[i]) {
        this.seats[i].card = null;
        this.seats[i].currentBet = 0;
        this.seats[i].ready = false;
      }
    }
    this.houseCard = null;
    this.bettingPhase = true;
    this.minBet = getMinBet();
    this.status = '';
  }
  
  getState() {
    const seats = this.seats.map((s, i) => {
      if (!s) return { seatIndex: i, empty: true };
      return {
        seatIndex: i,
        empty: false,
        socketId: s.socketId,
        name: s.name,
        photo: s.photo,
        chips: s.chips,
        currentBet: s.currentBet,
        card: s.card,
        connected: s.connected,
        ready: s.ready
      };
    });
    
    const observers = Array.from(this.observers.values()).map(o => ({
      socketId: o.socketId,
      name: o.name,
      photo: o.photo
    }));
    
    return {
      roomId: this.roomId,
      seats,
      observers,
      seatedCount: this.seatedCount,
      observerCount: this.observers.size,
      pot: this.pot,
      roundActive: this.roundActive,
      bettingPhase: this.bettingPhase,
      minBet: this.minBet,
      houseCard: this.houseCard,
      status: this.status
    };
  }
}

function getRoomsSummary() {
  return Array.from(games.values()).map(g => ({ 
    roomId: g.roomId, 
    seatedCount: g.seatedCount, 
    observerCount: g.observers.size,
    hasEmptySeat: g.hasEmptySeat()
  }));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runAutoRound(game) {
  if (!game.allSeatedReady()) return;
  const roomId = game.roomId;
  
  // Drama sequence: Bets Locked
  game.status = 'Bets Locked...';
  io.to(roomId).emit('bets_locked', { gameState: game.getState() });
  await sleep(1000);
  
  // Deal player cards
  game.status = 'Dealing cards...';
  game.dealCards();
  io.to(roomId).emit('cards_dealt', { gameState: game.getState() });
  await sleep(1000);
  
  // If 1 player mode, show house card reveal
  if (game.seatedCount === 1 && game.houseCard) {
    game.status = 'House reveals...';
    io.to(roomId).emit('house_reveal', { gameState: game.getState() });
    await sleep(1000);
  }
  
  // Determine winner
  game.status = 'Revealing winner...';
  const result = game.determine();
  io.to(roomId).emit('round_result', { gameState: game.getState(), result });
  await sleep(1200);
  
  // Check for game over (any player at 0 chips)
  const bustedPlayers = game.seats.filter(s => s !== null && s.chips <= 0);
  if (bustedPlayers.length > 0) {
    const standings = game.seats
      .map((s, seatIndex) => s !== null ? { seatIndex, name: s.name, chips: s.chips } : null)
      .filter(s => s !== null);
    io.to(roomId).emit('game_over', { standings, finalState: game.getState() });
    return;
  }
  
  game.resetForNext();
  game.status = 'Place your bets!';
  io.to(roomId).emit('round_reset', { gameState: game.getState() });
}

io.on('connection', (socket) => {
  // Join lobby channel and send existing rooms
  socket.join('lobby');
  io.to(socket.id).emit('rooms_list', getRoomsSummary());

  // Lobby chat
  socket.on('lobby_chat', (msg) => {
    const user = socket.request?.session?.passport?.user;
    const profile = user ? (userProfiles.get(user.id) || {}) : {};
    const name = profile.nickname || user?.displayName || 'Guest';
    const photo = profile.avatar || user?.photo || null;
    io.to('lobby').emit('lobby_message', { from: name, photo, msg, at: Date.now() });
  });
  socket.on('get_rooms', () => io.to(socket.id).emit('rooms_list', getRoomsSummary()));

  // Create room - player joins as observer first
  socket.on('create_room', (data = {}) => {
    const roomId = crypto.randomBytes(4).toString('hex');
    const user = socket.request?.session?.passport?.user;
    const profile = user ? (userProfiles.get(user.id) || {}) : {};
    const name = profile.nickname || user?.displayName || data.playerName || 'Player';
    const photo = profile.avatar || user?.photo || data.photo || null;

    const game = new GameRoom(roomId);
    game.addObserver({ socketId: socket.id, name, photo });

    games.set(roomId, game);
    playerToGame.set(socket.id, roomId);
    socket.join(roomId);

    io.to(socket.id).emit('room_created', { roomId, gameState: game.getState(), startingChips: Number(data.startingChips) || 1000 });
    io.to('lobby').emit('rooms_update', getRoomsSummary());
  });

  // Join room - player joins as observer first
  socket.on('join_room', (data = {}) => {
    const { roomId } = data;
    const game = games.get(roomId);
    if (!game) return io.to(socket.id).emit('error', { message: 'Room not found' });

    const user = socket.request?.session?.passport?.user;
    const profile = user ? (userProfiles.get(user.id) || {}) : {};
    const name = profile.nickname || user?.displayName || data.playerName || 'Player';
    const photo = profile.avatar || user?.photo || data.photo || null;

    game.addObserver({ socketId: socket.id, name, photo });
    playerToGame.set(socket.id, roomId);
    socket.join(roomId);

    io.to(roomId).emit('observer_joined', { gameState: game.getState() });
    io.to('lobby').emit('rooms_update', getRoomsSummary());
  });

  // Sit at a specific seat
  socket.on('sit_at_seat', (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (!game) return io.to(socket.id).emit('error', { message: 'Not in a room' });

    const seatIndex = Number(data.seatIndex);
    const chips = Number(data.chips) || 1000;
    const result = game.sitAtSeat(socket.id, seatIndex, chips);
    
    if (!result.success) {
      return io.to(socket.id).emit('error', { message: result.error });
    }

    io.to(roomId).emit('seat_taken', { seatIndex, gameState: game.getState() });
    io.to('lobby').emit('rooms_update', getRoomsSummary());
  });

  // Leave seat (become observer again)
  socket.on('leave_seat', () => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (!game) return;

    const result = game.leaveSeat(socket.id);
    if (result.success) {
      io.to(roomId).emit('seat_left', { seatIndex: result.seatIndex, gameState: game.getState() });
      io.to('lobby').emit('rooms_update', getRoomsSummary());
    }
  });

  // Room chat
  socket.on('room_chat', (msg) => {
    const roomId = playerToGame.get(socket.id);
    if (!roomId) return;
    const user = socket.request?.session?.passport?.user;
    const profile = user ? (userProfiles.get(user.id) || {}) : {};
    const name = profile.nickname || user?.displayName || 'Guest';
    const photo = profile.avatar || user?.photo || null;
    io.to(roomId).emit('room_message', { from: name, photo, msg, at: Date.now() });
  });

  // Betting
  socket.on('place_bet', (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (!game) return;

    const playerInfo = game.getPlayerBySocket(socket.id);
    if (!playerInfo) return io.to(socket.id).emit('error', { message: 'Not seated' });

    const amount = Number(data.betAmount || 0);
    const result = game.placeBet(playerInfo.seatIndex, amount);
    if (!result.success) return io.to(socket.id).emit('error', { message: result.error });

    io.to(roomId).emit('bet_placed', { gameState: game.getState() });
    if (game.allSeatedReady()) runAutoRound(game);
  });

  // Get current game state
  socket.on('get_game_state', () => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (game) {
      io.to(socket.id).emit('game_state', { gameState: game.getState() });
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    const roomId = playerToGame.get(socket.id);
    if (roomId) {
      const game = games.get(roomId);
      if (game) {
        // Check if player was seated
        for (let i = 0; i < 5; i++) {
          if (game.seats[i] && game.seats[i].socketId === socket.id) {
            game.seats[i].connected = false;
          }
        }
        // Remove from observers
        game.removeObserver(socket.id);
        
        io.to(roomId).emit('player_disconnected', { gameState: game.getState() });
        
        // Clean up room if empty after timeout
        setTimeout(() => {
          const anySeatedConnected = game.seats.some(s => s !== null && s.connected);
          const hasObservers = game.observers.size > 0;
          if (!anySeatedConnected && !hasObservers) { 
            games.delete(roomId); 
            io.to('lobby').emit('rooms_update', getRoomsSummary()); 
          }
        }, 30000);
      }
      playerToGame.delete(socket.id);
    }
  });
});

serverHttp.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});