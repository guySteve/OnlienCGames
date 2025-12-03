require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const { getOrCreateUser, checkDailyReset, updateUserChips, canUserPlay, prisma } = require('./src/db');
const { getRoomKey, encryptMessage, decryptMessage, sanitizeMessage, deleteRoomKey } = require('./src/encryption');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
const APP_VERSION = '4.0.0';

// Database health check
async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection established');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Get user profile from database (nickname and avatar)
async function getUserProfile(googleId) {
  try {
    const user = await prisma.user.findUnique({
      where: { googleId },
      select: { nickname: true, customAvatar: true, displayName: true }
    });
    return {
      nickname: user?.nickname || user?.displayName || 'Player',
      avatar: user?.customAvatar || null
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { nickname: 'Player', avatar: null };
  }
}

const app = express();
app.set('trust proxy', 1);

// Redis client for sessions
let redisClient;
let sessionStore;

async function initializeSessionStore() {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  
  if (redisUrl) {
    try {
      // Create Redis client
      redisClient = createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          rejectUnauthorized: false
        }
      });
      
      redisClient.on('error', (err) => console.error('Redis Client Error:', err));
      redisClient.on('connect', () => console.log('✅ Redis session store connected'));
      
      await redisClient.connect();
      
      // Create Redis session store
      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'sess:',
        ttl: 7 * 24 * 60 * 60 // 7 days in seconds
      });
      
      console.log('✅ Redis session store initialized');
    } catch (error) {
      console.error('⚠️  Redis connection failed, falling back to memory store:', error.message);
      sessionStore = null;
    }
  } else {
    console.log('⚠️  No Redis URL configured, using memory store (not recommended for production)');
  }
}

// Sessions
let sessionMiddleware;

function createSessionMiddleware() {
  return session({
    store: sessionStore || undefined, // undefined uses default MemoryStore
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: NODE_ENV === 'production',
      sameSite: 'lax'
    },
    rolling: true // Reset session timeout on every request
  });
}

// Initialize session store and start authentication
async function initializeAuth() {
  await initializeSessionStore();
  
  // Create session middleware after store is initialized
  sessionMiddleware = createSessionMiddleware();
  app.use(sessionMiddleware);
  
  // Passport: Google (optional - skip if credentials not provided)
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  console.log('🔍 OAuth Configuration Check:');
  console.log('  GOOGLE_CLIENT_ID:', googleClientId ? '✅ Set' : '❌ Missing');
  console.log('  GOOGLE_CLIENT_SECRET:', googleClientSecret ? '✅ Set' : '❌ Missing');
  
  if (googleClientId && googleClientSecret) {
  passport.use(new GoogleStrategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    passReqToCallback: true,
    accessType: 'offline',
    prompt: 'consent'
  }, async (req, accessToken, refreshToken, profile, done) => {
    console.log('🔐 GoogleStrategy verify callback invoked for:', profile.displayName);
    try {
      console.log('🔐 Google OAuth callback received for:', profile.displayName);
      
      // Get or create user in database with daily reset check
      const dbUser = await getOrCreateUser(profile);
      
      if (!dbUser) {
        console.error('❌ Failed to create/get user from database');
        return done(new Error('Failed to create user'), null);
      }
      
      console.log('✅ User authenticated:', dbUser.displayName, 'Balance:', Number(dbUser.chipBalance));
      
      const user = {
        id: profile.id,
        dbId: dbUser.id,
        displayName: profile.displayName,
        photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        chipBalance: Number(dbUser.chipBalance),
        currentStreak: dbUser.currentStreak,
      };
      return done(null, user);
    } catch (error) {
      console.error('❌ Auth error:', error);
      console.error('Error stack:', error.stack);
      // Return a simple error instead of throwing to avoid "Service Unavailable"
      return done(null, false, { message: 'Authentication failed' });
    }
  }));
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));
    app.use(passport.initialize());
    app.use(passport.session());
  } else {
    console.log('⚠️  Google OAuth not configured - running without authentication');
  }
}

app.use(cors());
app.use(express.json());

// Welcome page for unauthenticated users
app.get('/', (req, res) => {
  if (!req.user) {
    return res.sendFile(path.join(__dirname, 'welcome.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(path.join(__dirname, '.')));

// Auth routes
app.get('/auth/google', (req, res, next) => {
  console.log('📍 /auth/google route accessed');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
app.get('/auth/google/callback', 
  (req, res, next) => {
    console.log('📍 /auth/google/callback route accessed');
    console.log('Query params:', req.query);
    passport.authenticate('google', { failureRedirect: '/?error=auth_denied' }, (err, user, info) => {
      console.log('🔐 Passport callback executed - err:', !!err, 'user:', !!user);
      if (err) {
        // Handle 2FA/MFA timeout and other OAuth errors
        console.error('❌ OAuth authentication error:', err.message);
        console.error('Error type:', err.name || err.constructor?.name);
        if (err.oauthError) {
          console.error('OAuth error details:', err.oauthError);
        }
        // Check if it's a timeout error from 2FA
        if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
          console.warn('⚠️  2FA/MFA verification timed out - user should retry');
          return res.redirect('/?error=2fa_timeout&retry=true');
        }
        // Redirect to home with error parameter for user feedback
        return res.redirect('/?error=oauth_error');
      }
      if (!user) {
        // Authentication failed (user denied access or other failure)
        console.warn('⚠️ OAuth authentication failed:', info?.message || 'Unknown reason');
        return res.redirect('/?error=auth_denied');
      }
      // Log in the user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Session login error:', loginErr.message);
          return res.redirect('/?error=session_error');
        }
        console.log('✅ OAuth callback successful, redirecting to home');
        return res.redirect('/');
      });
    })(req, res, next);
  }
);
app.get('/debug/oauth', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID ? '✅ Configured' : '❌ Missing',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '✅ Configured' : '❌ Missing',
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    accessingFrom: req.get('host'),
    protocol: req.protocol,
    expectedCallbackUrl: `${req.protocol}://${req.get('host')}/auth/google/callback`,
    nodeEnv: process.env.NODE_ENV,
    redisConfigured: process.env.REDIS_URL ? '✅ Yes' : '❌ No',
    databaseConfigured: process.env.DATABASE_URL ? '✅ Yes' : '❌ No'
  });
});
app.post('/logout', (req, res) => {
  req.logout(() => { req.session.destroy(() => res.clearCookie('sid').status(200).json({ ok: true })); });
});
app.get('/me', async (req, res) => {
  if (!req.user) return res.status(200).json({ authenticated: false });
  
  try {
    // Fetch all user data from database
    const dbUser = await prisma.user.findUnique({
      where: { googleId: req.user.id }
    });
    
    res.json({ 
      authenticated: true, 
      user: { 
        ...req.user, 
        dbId: dbUser?.id,
        nickname: dbUser?.nickname || req.user.displayName,
        customAvatar: dbUser?.customAvatar || null,
        needsAvatarSetup: dbUser?.needsAvatarSetup ?? true,
        chipBalance: dbUser ? Number(dbUser.chipBalance) : 0,
        currentStreak: dbUser?.currentStreak || 0,
        canPlay: dbUser && dbUser.chipBalance > 0n,
      } 
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.json({ authenticated: true, user: req.user });
  }
});

// Profile update endpoint
app.post('/profile', express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { nickname, avatar } = req.body;
  if (nickname && (typeof nickname !== 'string' || nickname.length > 30)) {
    return res.status(400).json({ error: 'Invalid nickname' });
  }
  if (avatar && (typeof avatar !== 'string' || avatar.length > 500)) {
    return res.status(400).json({ error: 'Invalid avatar URL' });
  }
  
  try {
    // Update in database only
    const updated = await prisma.user.update({
      where: { googleId: req.user.id },
      data: {
        nickname: nickname || req.user.displayName,
        customAvatar: avatar || null,
        needsAvatarSetup: false,
        updatedAt: new Date()
      }
    });
    
    res.json({ ok: true, profile: { nickname: updated.nickname, avatar: updated.customAvatar } });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Friend endpoints
app.get('/friends', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const dbUser = await prisma.user.findUnique({
      where: { googleId: req.user.id },
      include: {
        friendsInitiated: {
          where: { status: 'ACCEPTED' },
          include: { friend: { select: { id: true, displayName: true, nickname: true, customAvatar: true } } }
        },
        friendsReceived: {
          where: { status: 'ACCEPTED' },
          include: { user: { select: { id: true, displayName: true, nickname: true, customAvatar: true } } }
        }
      }
    });
    
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    
    const friends = [
      ...dbUser.friendsInitiated.map(f => ({ ...f.friend, friendshipId: f.id })),
      ...dbUser.friendsReceived.map(f => ({ ...f.user, friendshipId: f.id }))
    ];
    
    res.json({ friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

app.get('/friend-requests', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    
    const requests = await prisma.friendship.findMany({
      where: { friendId: dbUser.id, status: 'PENDING' },
      include: { user: { select: { id: true, displayName: true, nickname: true, customAvatar: true } } }
    });
    
    res.json({ requests });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

app.post('/friend-request', express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { friendEmail } = req.body;
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const friendUser = await prisma.user.findUnique({ where: { email: friendEmail } });
    
    if (!friendUser) return res.status(404).json({ error: 'User not found' });
    if (friendUser.id === dbUser.id) return res.status(400).json({ error: 'Cannot add yourself' });
    
    // Check if already friends or pending
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: dbUser.id, friendId: friendUser.id },
          { userId: friendUser.id, friendId: dbUser.id }
        ]
      }
    });
    
    if (existing) return res.status(400).json({ error: 'Friend request already exists' });
    
    const friendship = await prisma.friendship.create({
      data: { userId: dbUser.id, friendId: friendUser.id, status: 'PENDING' }
    });
    
    // Notify friend via socket if online
    const friendSocket = Array.from(io.sockets.sockets.values()).find(s => s.request.session?.passport?.user?.id === friendUser.googleId);
    if (friendSocket) {
      friendSocket.emit('friend_request', {
        from: { id: dbUser.id, displayName: dbUser.displayName, nickname: dbUser.nickname, customAvatar: dbUser.customAvatar },
        requestId: friendship.id
      });
    }
    
    res.json({ ok: true, friendship });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

app.post('/friend-request/:id/accept', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const friendship = await prisma.friendship.update({
      where: { id: req.params.id, friendId: dbUser.id },
      data: { status: 'ACCEPTED' }
    });
    
    res.json({ ok: true, friendship });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

app.post('/friend-request/:id/decline', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    await prisma.friendship.delete({
      where: { id: req.params.id, friendId: dbUser.id }
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

// Chip transfer endpoint
app.post('/transfer-chips', express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  const { friendId, amount } = req.body;
  const transferAmount = Number(amount);
  
  if (!friendId || !transferAmount || transferAmount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer details' });
  }
  
  if (transferAmount < 10) {
    return res.status(400).json({ error: 'Minimum transfer is 10 chips' });
  }
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const friendUser = await prisma.user.findUnique({ where: { id: friendId } });
    
    if (!friendUser) {
      return res.status(404).json({ error: 'Friend not found' });
    }
    
    if (dbUser.id === friendUser.id) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }
    
    // Verify friendship exists
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: dbUser.id, friendId: friendUser.id, status: 'ACCEPTED' },
          { userId: friendUser.id, friendId: dbUser.id, status: 'ACCEPTED' }
        ]
      }
    });
    
    if (!friendship) {
      return res.status(403).json({ error: 'Can only transfer chips to friends' });
    }
    
    // Check if user has enough chips
    if (dbUser.chipBalance < BigInt(transferAmount)) {
      return res.status(400).json({ error: 'Insufficient chips' });
    }
    
    // Perform transfer in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from sender
      const updatedSender = await tx.user.update({
        where: { id: dbUser.id },
        data: { chipBalance: { decrement: BigInt(transferAmount) } }
      });
      
      // Add to receiver
      const updatedReceiver = await tx.user.update({
        where: { id: friendUser.id },
        data: { chipBalance: { increment: BigInt(transferAmount) } }
      });
      
      // Create transaction records
      const senderTx = await tx.transaction.create({
        data: {
          userId: dbUser.id,
          amount: -transferAmount,
          type: 'TRANSFER_SENT',
          balanceBefore: dbUser.chipBalance,
          balanceAfter: updatedSender.chipBalance,
          relatedUserId: friendUser.id,
          description: `Sent ${transferAmount} chips to ${friendUser.nickname || friendUser.displayName}`,
          metadata: { recipientId: friendUser.id, recipientName: friendUser.nickname || friendUser.displayName }
        }
      });
      
      const receiverTx = await tx.transaction.create({
        data: {
          userId: friendUser.id,
          amount: transferAmount,
          type: 'TRANSFER_RECEIVED',
          balanceBefore: friendUser.chipBalance,
          balanceAfter: updatedReceiver.chipBalance,
          relatedUserId: dbUser.id,
          description: `Received ${transferAmount} chips from ${dbUser.nickname || dbUser.displayName}`,
          metadata: { senderId: dbUser.id, senderName: dbUser.nickname || dbUser.displayName }
        }
      });
      
      return { updatedSender, updatedReceiver, senderTx, receiverTx };
    });
    
    // Update session user chip balance
    req.user.chipBalance = Number(result.updatedSender.chipBalance);
    
    // Notify friend via socket if online
    const friendSocket = Array.from(io.sockets.sockets.values()).find(s => 
      s.request?.session?.passport?.user?.id === friendUser.googleId
    );
    
    if (friendSocket) {
      friendSocket.emit('chips_received', {
        amount: transferAmount,
        from: {
          name: dbUser.nickname || dbUser.displayName,
          photo: dbUser.customAvatar
        },
        newBalance: Number(result.updatedReceiver.chipBalance)
      });
    }
    
    res.json({ 
      ok: true, 
      newBalance: Number(result.updatedSender.chipBalance),
      message: `Successfully sent ${transferAmount} chips to ${friendUser.nickname || friendUser.displayName}`
    });
  } catch (error) {
    console.error('Error transferring chips:', error);
    res.status(500).json({ error: 'Failed to transfer chips' });
  }
});

// Table invite endpoints
app.get('/invites', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const invites = await prisma.tableInvite.findMany({
      where: { 
        toUserId: dbUser.id, 
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });
    
    // Get sender details
    const invitesWithSender = await Promise.all(invites.map(async inv => {
      const sender = await prisma.user.findUnique({
        where: { id: inv.fromUserId },
        select: { displayName: true, nickname: true, customAvatar: true }
      });
      return { ...inv, sender };
    }));
    
    res.json({ invites: invitesWithSender });
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
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
    
    // Multi-seat support: Allow same user to sit at multiple seats
    // Check if user is already seated somewhere to get their info
    let existingPlayer = null;
    for (let i = 0; i < 5; i++) {
      if (this.seats[i] && this.seats[i].socketId === socketId) {
        existingPlayer = this.seats[i];
        break;
      }
    }
    
    // If already seated, use existing player info for new seat
    if (existingPlayer) {
      this.seats[seatIndex] = {
        socketId,
        name: existingPlayer.name,
        photo: existingPlayer.photo,
        chips, // New seat gets fresh chips
        currentBet: 0,
        card: null,
        ready: false,
        connected: true
      };
      return { success: true, seatIndex };
    }
    
    // First time sitting - must be an observer
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
  
  leaveSeat(socketId, specificSeatIndex = null) {
    // If specific seat provided, leave only that seat
    if (specificSeatIndex !== null) {
      if (this.seats[specificSeatIndex] && this.seats[specificSeatIndex].socketId === socketId) {
        const player = this.seats[specificSeatIndex];
        this.seats[specificSeatIndex] = null;
        
        // Check if player still has other seats
        const stillSeated = this.seats.some(s => s !== null && s.socketId === socketId);
        if (!stillSeated) {
          // Return to observers if no more seats
          this.observers.set(socketId, { socketId, name: player.name, photo: player.photo });
        }
        return { success: true, seatIndex: specificSeatIndex };
      }
      return { success: false, error: 'Not your seat' };
    }
    
    // Legacy: leave first found seat
    for (let i = 0; i < 5; i++) {
      if (this.seats[i] && this.seats[i].socketId === socketId) {
        const player = this.seats[i];
        this.seats[i] = null;
        // Check if player still has other seats
        const stillSeated = this.seats.some(s => s !== null && s.socketId === socketId);
        if (!stillSeated) {
          this.observers.set(socketId, { socketId, name: player.name, photo: player.photo });
        }
        return { success: true, seatIndex: i };
      }
    }
    return { success: false, error: 'Not seated' };
  }
  
  // Get all seats for a specific socket
  getSeatsBySocket(socketId) {
    const seats = [];
    for (let i = 0; i < 5; i++) {
      if (this.seats[i] && this.seats[i].socketId === socketId) {
        seats.push(i);
      }
    }
    return seats;
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
  socket.on('lobby_chat', async (msg) => {
    const user = socket.request?.session?.passport?.user;
    if (!user) {
      const name = 'Guest';
      const photo = null;
      io.to('lobby').emit('lobby_message', { from: name, photo, msg, at: Date.now() });
    } else {
      const profile = await getUserProfile(user.id);
      io.to('lobby').emit('lobby_message', { from: profile.nickname, photo: profile.avatar, msg, at: Date.now() });
    }
  });
  socket.on('get_rooms', () => io.to(socket.id).emit('rooms_list', getRoomsSummary()));

  // Create room - player joins as observer first
  socket.on('create_room', async (data = {}) => {
    const roomId = crypto.randomBytes(4).toString('hex');
    const user = socket.request?.session?.passport?.user;
    const profile = user ? await getUserProfile(user.id) : { nickname: 'Player', avatar: null };
    const name = profile.nickname || data.playerName || 'Player';
    const photo = profile.avatar || data.photo || null;

    const game = new GameRoom(roomId);
    game.addObserver({ socketId: socket.id, name, photo });

    games.set(roomId, game);
    playerToGame.set(socket.id, roomId);
    socket.join(roomId);

    io.to(socket.id).emit('room_created', { roomId, gameState: game.getState(), startingChips: Number(data.startingChips) || 1000 });
    io.to('lobby').emit('rooms_update', getRoomsSummary());
  });

  // Join room - player joins as observer first
  socket.on('join_room', async (data = {}) => {
    const { roomId } = data;
    const game = games.get(roomId);
    if (!game) return io.to(socket.id).emit('error', { message: 'Room not found' });

    const user = socket.request?.session?.passport?.user;
    const profile = user ? await getUserProfile(user.id) : { nickname: 'Player', avatar: null };
    const name = profile.nickname || data.playerName || 'Player';
    const photo = profile.avatar || data.photo || null;

    game.addObserver({ socketId: socket.id, name, photo });
    playerToGame.set(socket.id, roomId);
    socket.join(roomId);

    // Send room_joined event to the joiner specifically
    io.to(socket.id).emit('room_joined', { roomId, gameState: game.getState(), startingChips: Number(data.startingChips) || 1000 });
    
    // Notify everyone in room (including joiner)
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

  // Leave seat (become observer again) - supports specific seat for multi-seat
  socket.on('leave_seat', (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (!game) return;

    const specificSeatIndex = data.seatIndex !== undefined ? Number(data.seatIndex) : null;
    const result = game.leaveSeat(socket.id, specificSeatIndex);
    if (result.success) {
      io.to(roomId).emit('seat_left', { seatIndex: result.seatIndex, gameState: game.getState() });
      io.to('lobby').emit('rooms_update', getRoomsSummary());
    }
  });

  // Room chat
  socket.on('room_chat', async (msg) => {
    const roomId = playerToGame.get(socket.id);
    if (!roomId) return;
    const user = socket.request?.session?.passport?.user;
    if (!user) {
      const name = 'Guest';
      const photo = null;
      io.to(roomId).emit('room_message', { from: name, photo, msg, at: Date.now() });
    } else {
      const profile = await getUserProfile(user.id);
      io.to(roomId).emit('room_message', { from: profile.nickname, photo: profile.avatar, msg, at: Date.now() });
    }
  });

  // Betting - supports specific seat for multi-seat
  socket.on('place_bet', (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);
    if (!game) return;

    // Check if seatIndex is specified for multi-seat betting
    let seatIndex;
    if (data.seatIndex !== undefined) {
      seatIndex = Number(data.seatIndex);
      // Verify the seat belongs to this socket
      const seat = game.getPlayerBySeat(seatIndex);
      if (!seat || seat.socketId !== socket.id) {
        return io.to(socket.id).emit('error', { message: 'Not your seat' });
      }
    } else {
      // Legacy: find first seat for this socket
      const playerInfo = game.getPlayerBySocket(socket.id);
      if (!playerInfo) return io.to(socket.id).emit('error', { message: 'Not seated' });
      seatIndex = playerInfo.seatIndex;
    }

    const amount = Number(data.betAmount || 0);
    const result = game.placeBet(seatIndex, amount);
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

  // Send table invite
  socket.on('send_invite', async (data) => {
    const user = socket.request?.session?.passport?.user;
    if (!user) return;
    
    const roomId = playerToGame.get(socket.id);
    if (!roomId) return io.to(socket.id).emit('error', { message: 'Not in a room' });
    
    try {
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      const friendUser = await prisma.user.findUnique({ where: { id: data.friendId } });
      
      if (!friendUser) return io.to(socket.id).emit('error', { message: 'Friend not found' });
      
      // Create invite that expires in 5 minutes
      const invite = await prisma.tableInvite.create({
        data: {
          roomId,
          fromUserId: dbUser.id,
          toUserId: friendUser.id,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        }
      });
      
      // Find friend's socket and send notification
      const friendSocket = Array.from(io.sockets.sockets.values()).find(s => 
        s.request?.session?.passport?.user?.id === friendUser.googleId
      );
      
      if (friendSocket) {
        const inviterProfile = await getUserProfile(user.id);
        friendSocket.emit('table_invite', {
          inviteId: invite.id,
          roomId: invite.roomId,
          from: {
            name: inviterProfile.nickname,
            photo: inviterProfile.avatar
          }
        });
      }
      
      io.to(socket.id).emit('invite_sent', { ok: true });
    } catch (error) {
      console.error('Error sending invite:', error);
      io.to(socket.id).emit('error', { message: 'Failed to send invite' });
    }
  });
  
  // Accept table invite
  socket.on('accept_invite', async (data) => {
    try {
      const invite = await prisma.tableInvite.findUnique({ where: { id: data.inviteId } });
      if (!invite || invite.status !== 'PENDING') {
        return io.to(socket.id).emit('error', { message: 'Invalid invite' });
      }
      
      if (new Date() > invite.expiresAt) {
        await prisma.tableInvite.update({
          where: { id: data.inviteId },
          data: { status: 'EXPIRED' }
        });
        return io.to(socket.id).emit('error', { message: 'Invite expired' });
      }
      
      await prisma.tableInvite.update({
        where: { id: data.inviteId },
        data: { status: 'ACCEPTED' }
      });
      
      // Join the room
      const game = games.get(invite.roomId);
      if (!game) return io.to(socket.id).emit('error', { message: 'Room no longer exists' });
      
      const user = socket.request?.session?.passport?.user;
      const profile = user ? await getUserProfile(user.id) : { nickname: 'Player', avatar: null };
      const name = profile.nickname || 'Player';
      const photo = profile.avatar || null;
      
      game.addObserver({ socketId: socket.id, name, photo });
      playerToGame.set(socket.id, invite.roomId);
      socket.join(invite.roomId);
      
      io.to(socket.id).emit('invite_accepted', { roomId: invite.roomId, gameState: game.getState() });
      io.to(invite.roomId).emit('observer_joined', { gameState: game.getState() });
    } catch (error) {
      console.error('Error accepting invite:', error);
      io.to(socket.id).emit('error', { message: 'Failed to accept invite' });
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

// Initialize and start server
async function startServer() {
  await initializeAuth();
  
  serverHttp.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.warn('⚠️  Server started but database connection failed. Some features may not work.');
    }
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  serverHttp.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});