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
const { AutoModerationService } = require('./src/services/AutoModerationService');

// WebAuthn Biometric Authentication
const webauthn = require('./src/webauthn');

// Social 2.0 Services
const { initSyndicateService, getSyndicateService } = require('./src/services/SyndicateService');
const { initReferralService, getReferralService } = require('./src/services/ReferralService');
const { initGenerosityService, getGenerosityService } = require('./src/services/GenerosityService');
const { initEngagementServiceV2, getEngagementServiceV2 } = require('./src/services/EngagementServiceV2');
const { createDividendDistributor } = require('./src/jobs/DividendDistributor');
const { createHappyHourScheduler } = require('./src/jobs/HappyHourScheduler');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
const APP_VERSION = '4.0.0';

// =============================================================================
// NIGHTCLUB HOURS MIDDLEWARE
// =============================================================================

/**
 * Gets the current time in Eastern Time (approximated).
 * NOTE: This is a simplified check and may not be accurate during DST transitions.
 * A library like date-fns-tz would be more robust.
 * @returns {{etDate: Date, etHour: number}}
 */
function getCurrentEasternTime() {
    const now = new Date();
    // Crude check for DST in North America (March to November)
    const month = now.getUTCMonth(); // 0-11
    const isDST = month >= 2 && month <= 10;
    const etOffset = isDST ? -4 : -5; // EDT is UTC-4, EST is UTC-5

    // Create a new date object representing ET
    const etDate = new Date(now.getTime() + etOffset * 3600 * 1000);
    const etHour = etDate.getUTCHours();

    return { etDate, etHour };
}


/**
 * Checks if the casino is within operating hours (10 PM - 2 AM ET).
 * @returns {{isOpen: boolean, nextOpenTime: Date}}
 */
function getOperatingHoursStatus() {
    const { etDate, etHour } = getCurrentEasternTime();

    // Operating hours are 10 PM (22) to 2 AM (02)
    const isOpen = etHour >= 22 || etHour < 2;

    // Calculate the next opening time
    const nextOpenTime = new Date(etDate);
    nextOpenTime.setUTCHours(22, 0, 0, 0);

    // If it's already past 10 PM today, the next opening is tomorrow
    if (etHour >= 22) {
        nextOpenTime.setUTCDate(nextOpenTime.getUTCDate() + 1);
    }

    return { isOpen, nextOpenTime };
}


/**
 * Middleware to enforce casino operating hours for Express routes.
 */
function checkOperatingHours(req, res, next) {
    // Allow health checks and auth routes to always pass
    if (req.path === '/health' || req.path.startsWith('/auth')) {
        return next();
    }

    // Allow admin users to bypass operating hours
    if (req.user && req.user.isAdmin) {
        return next();
    }

    const { isOpen, nextOpenTime } = getOperatingHoursStatus();

    if (isOpen) {
        return next();
    }

    res.status(503).json({
        error: 'Casino is currently closed.',
        message: 'The nightclub is only open from 10 PM to 2 AM Eastern Time.',
        nextOpenTime: nextOpenTime.toISOString(),
    });
}


// Database health check
async function checkDatabaseConnection() {
  try {
    // Increase timeout to 30 seconds to account for cold starts and migrations
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 30000)
      )
    ]);
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

// Admin email
const ADMIN_EMAIL = 'smmohamed60@gmail.com';

// Initialize Auto-Moderation (lazy - will be created on first use)
let autoMod = null;
function getAutoMod() {
  if (!autoMod) {
    autoMod = new AutoModerationService(prisma);
  }
  return autoMod;
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

async function initializeSessionStore() {
  // Try Upstash HTTP client first (better for serverless Cloud Run)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  if (upstashUrl && upstashToken) {
    // Use Upstash HTTP client - no TCP timeout issues in serverless
    try {
      console.log('🔄 Connecting to Upstash Redis (HTTP)...');
      const { Redis } = require('@upstash/redis');

      const upstashRedis = new Redis({
        url: upstashUrl,
        token: upstashToken,
      });

      // Test connection with quick ping
      await upstashRedis.ping();

      // Create a Redis-compatible wrapper for RedisStore
      redisClient = {
        get: async (key) => await upstashRedis.get(key),
        set: async (key, value, options) => {
          if (options?.EX) {
            await upstashRedis.setex(key, options.EX, value);
          } else {
            await upstashRedis.set(key, value);
          }
        },
        del: async (key) => await upstashRedis.del(key),
        expire: async (key, seconds) => await upstashRedis.expire(key, seconds)
      };

      sessionStore = new RedisStore({
        client: redisClient,
        prefix: 'sess:',
        ttl: 7 * 24 * 60 * 60
      });

      console.log('✅ Upstash Redis (HTTP) initialized - perfect for Cloud Run!');
      return; // Success, exit early
    } catch (error) {
      console.warn('⚠️  Upstash HTTP failed, trying TCP Redis:', error.message);
    }
  }

  // Fallback to standard Redis TCP client
  if (redisUrl) {
    // Don't await - initialize Redis in background
    (async () => {
      try {
        console.log('🔄 Connecting to Redis (TCP)...');
        redisClient = createClient({
          url: redisUrl,
          socket: {
            tls: redisUrl.startsWith('rediss://'),
            rejectUnauthorized: false,
            connectTimeout: 5000,
            keepAlive: 30000
          }
        });

        redisClient.on('error', (err) => console.error('Redis Client Error:', err));
        redisClient.on('connect', () => console.log('✅ Redis session store connected'));

        await Promise.race([
          redisClient.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 5000)
          )
        ]);

        sessionStore = new RedisStore({
          client: redisClient,
          prefix: 'sess:',
          ttl: 7 * 24 * 60 * 60
        });

        console.log('✅ Redis session store initialized');
      } catch (error) {
        console.error('⚠️  Redis connection failed, using memory store:', error.message);
        sessionStore = null;
        if (redisClient) {
          redisClient.quit().catch(() => {});
          redisClient = null;
        }
      }
    })();
  } else {
    console.log('⚠️  No Redis URL configured, using memory store');
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
  
  // Update session middleware with Redis store if available
  // Note: Session middleware already initialized synchronously before routes
  
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
    callbackURL: '/auth/google/callback',
    passReqToCallback: true
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
      
      // Set admin flag if email matches
      if (profile.emails && profile.emails[0] && profile.emails[0].value === ADMIN_EMAIL) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { isAdmin: true }
        });
        console.log('👑 Admin user logged in:', dbUser.displayName);
      }

      // Store IP address for admin tracking
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent')
        }
      });
      
      const user = {
        id: profile.id,
        dbId: dbUser.id,
        email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
        displayName: profile.displayName,
        photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        chipBalance: Number(dbUser.chipBalance),
        currentStreak: dbUser.currentStreak,
        isAdmin: dbUser.isAdmin || (profile.emails && profile.emails[0] && profile.emails[0].value === ADMIN_EMAIL)
      };
      return done(null, user);
    } catch (error) {
      console.error('❌ Auth error:', error);
      console.error('Error stack:', error.stack);
      // Pass the actual error object to done() to trigger the err path in the callback
      return done(error, null);
    }
  }));
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));
  } else {
    console.log('⚠️  Google OAuth not configured - running without authentication');
  }
}

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://moes-casino-212973396288.us-central1.run.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Initialize session middleware IMMEDIATELY (before any routes)
// Redis store will be added later when available
sessionMiddleware = createSessionMiddleware();
app.use(sessionMiddleware);

// Initialize passport middleware IMMEDIATELY (after session)
app.use(passport.initialize());
app.use(passport.session());

// API Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userId = req.user?.id || 'anonymous';
  console.log(`[${timestamp}] ${req.method} ${req.url} - User: ${userId}`);
  next();
});

// >>> APPLY NIGHTCLUB HOURS MIDDLEWARE TO ALL API AND GAME ROUTES <<<
app.use(checkOperatingHours);


// Welcome page for unauthenticated users
app.get('/', (req, res) => {
  if (!req.user) {
    return res.sendFile(path.join(__dirname, 'welcome.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin dashboard (restricted)
app.get('/admin', (req, res) => {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    return res.status(403).send('Access Denied');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve static files (legacy)
app.use(express.static(path.join(__dirname, '.')));

// Serve React frontend (production build)
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDistPath));

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
        // --- START DEBUG FIX: Capture the specific error message for debugging
        const debugMsg = encodeURIComponent(err.message);
        console.warn(`⚠️  Redirecting with specific error: ${debugMsg}`);
        return res.redirect(`/?error=oauth_error&debug_error=${debugMsg}`);
        // --- END DEBUG FIX ---
      }
      if (!user) {
        // Authentication failed (user denied access or other failure)
        console.warn('⚠️ OAuth authentication failed:', info?.message || 'Unknown reason');
        
        // --- START DEBUG FIX: Capture the specific error message for debugging
        const debugMsg = encodeURIComponent(info?.message || 'Authentication failed for unknown reason');
        return res.redirect(`/?error=auth_denied&debug_error=${debugMsg}`);
        // --- END DEBUG FIX ---
      }
      // Log in the user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Session login error:', loginErr.message);
          const debugMsg = encodeURIComponent(loginErr.message);
          return res.redirect(`/?error=session_error&debug_error=${debugMsg}`);
        }
        
        // Redirect to home page after successful authentication
        console.log('✅ OAuth callback successful, redirecting to home');
        return res.redirect('/');
      });
    })(req, res, next);
  }
);
// Health check endpoint (lightweight - prevents cold starts)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

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

// =============================================================================
// WEBAUTHN BIOMETRIC AUTHENTICATION ROUTES
// =============================================================================

// Registration (user must be logged in via Google OAuth first)
app.post('/auth/webauthn/register-start', webauthn.handleRegistrationStart);
app.post('/auth/webauthn/register-finish', webauthn.handleRegistrationFinish);

// Authentication (passwordless biometric login)
app.post('/auth/webauthn/login-start', webauthn.handleAuthenticationStart);
app.post('/auth/webauthn/login-finish', webauthn.handleAuthenticationFinish);

// Authenticator management
app.get('/auth/webauthn/authenticators', webauthn.getAuthenticators);
app.delete('/auth/webauthn/authenticators/:id', webauthn.deleteAuthenticator);

// =============================================================================

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

app.get('/api/casino-status', (req, res) => {
  const { isOpen, nextOpenTime } = getOperatingHoursStatus();
  res.json({ isOpen, nextOpenTime: nextOpenTime.toISOString() });
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

// Daily Reward Endpoint
app.post('/api/daily-reward', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const EngagementService = require('./src/services/EngagementService').EngagementService;
    const engagement = new EngagementService(prisma, redisClient || null);
    
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    
    const claimResult = await engagement.claimDailyReward(dbUser.id);
    
    res.json(claimResult);
  } catch (error) {
    console.error('Daily reward error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
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

// Tip the House endpoint
app.post('/api/tip-moe', express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  const { amount, note } = req.body;
  const tipAmount = Number(amount);
  
  if (!tipAmount || tipAmount <= 0) {
    return res.status(400).json({ error: 'Invalid tip amount' });
  }
  
  if (tipAmount < 1) {
    return res.status(400).json({ error: 'Minimum tip is 1 chip' });
  }
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has enough chips
    if (dbUser.chipBalance < BigInt(tipAmount)) {
      return res.status(400).json({ error: 'Insufficient chips' });
    }
    
    // Deduct chips and log transaction (chips are removed from economy)
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: dbUser.id },
        data: { chipBalance: { decrement: BigInt(tipAmount) } }
      });
      
      const tipTransaction = await tx.transaction.create({
        data: {
          userId: dbUser.id,
          amount: -tipAmount,
          type: 'TIP',
          balanceBefore: dbUser.chipBalance,
          balanceAfter: updatedUser.chipBalance,
          description: `Tipped Moe ${tipAmount} chips${note ? ': ' + note.substring(0, 100) : ''}`,
          metadata: { note: note || '', recipient: 'house' }
        }
      });
      
      return { updatedUser, tipTransaction };
    });
    
    // Update session user chip balance
    req.user.chipBalance = Number(result.updatedUser.chipBalance);
    
    console.log(`💰 ${dbUser.displayName} tipped the house ${tipAmount} chips${note ? ': ' + note : ''}`);
    
    res.json({ 
      ok: true, 
      newBalance: Number(result.updatedUser.chipBalance),
      message: `Thank you! Moe appreciates your ${tipAmount} chip tip 🎩`
    });
  } catch (error) {
    console.error('Error processing tip:', error);
    res.status(500).json({ error: 'Failed to process tip' });
  }
});

// ========== ADMIN API ENDPOINTS ==========

// Get admin dashboard data
app.get('/api/admin/dashboard', isAdmin, async (req, res) => {
  try {
    // Get online users
    const onlineUsers = Array.from(io.sockets.sockets.values()).map(socket => {
      const user = socket.request?.session?.passport?.user;
      return {
        socketId: socket.id,
        userId: user?.id || 'guest',
        displayName: user?.displayName || 'Guest',
        email: user?.email || null,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        connectedAt: socket.handshake.time
      };
    });

    // Get total stats
    const totalUsers = await prisma.user.count();
    const bannedUsers = await prisma.user.count({ where: { isBanned: true } });
    const totalMessages = await prisma.chatMessage.count();
    const flaggedMessages = await prisma.chatMessage.count({ where: { isFlagged: true } });
    
    // Get recent moderation logs
    const recentModerations = await prisma.moderationLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        User: { select: { displayName: true, email: true } },
        Moderator: { select: { displayName: true } }
      }
    });

    // Get active rooms
    const activeRooms = Array.from(games.entries()).map(([roomId, game]) => ({
      roomId,
      type: game.getGameType ? game.getGameType() : 'WAR',
      playerCount: game.getPlayers ? game.getPlayers().length : (game.seatedCount || 0),
      pot: game.getPot ? game.getPot() : (game.pot || 0)
    }));

    res.json({
      online: {
        count: onlineUsers.length,
        users: onlineUsers
      },
      stats: {
        totalUsers,
        bannedUsers,
        totalMessages,
        flaggedMessages,
        activeRooms: activeRooms.length
      },
      recentModerations,
      activeRooms
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Get all users (paginated)
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const users = await prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        nickname: true,
        chipBalance: true,
        createdAt: true,
        lastLogin: true,
        isBanned: true,
        isAdmin: true,
        warnCount: true,
        totalHandsPlayed: true,
        ipAddress: true
      }
    });

    const total = await prisma.user.count({ where });

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Ban user
app.post('/api/admin/ban/:userId', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });

    const bannedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedBy: dbUser.id,
        banReason: reason || 'No reason provided'
      }
    });

    // Log moderation action
    await prisma.moderationLog.create({
      data: {
        moderatorId: dbUser.id,
        userId,
        action: 'BAN',
        reason,
        autoModerated: false
      }
    });

    // Disconnect user's sockets
    io.sockets.sockets.forEach(socket => {
      const user = socket.request?.session?.passport?.user;
      if (user?.id === bannedUser.googleId) {
        socket.emit('banned', { reason });
        socket.disconnect(true);
      }
    });

    console.log(`🔨 Admin banned user ${userId}: ${reason}`);

    res.json({ ok: true, user: bannedUser });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user
app.post('/api/admin/unban/:userId', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });

    const unbannedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedBy: null,
        banReason: null,
        warnCount: 0
      }
    });

    await prisma.moderationLog.create({
      data: {
        moderatorId: dbUser.id,
        userId,
        action: 'UNBAN',
        autoModerated: false
      }
    });

    console.log(`✅ Admin unbanned user ${userId}`);

    res.json({ ok: true, user: unbannedUser });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Get user details
app.get('/api/admin/user/:userId', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ChatMessage: {
          take: 50,
          orderBy: { createdAt: 'desc' }
        },
        moderationLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            Moderator: { select: { displayName: true } }
          }
        },
        Transaction: {
          take: 20,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to load user details' });
  }
});

// Get moderation logs
app.get('/api/admin/moderation-logs', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const logs = await prisma.moderationLog.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        User: { select: { displayName: true, email: true } },
        Moderator: { select: { displayName: true } }
      }
    });

    const total = await prisma.moderationLog.count();

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get moderation logs error:', error);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

// Delete flagged message
app.delete('/api/admin/message/:messageId', isAdmin, async (req, res) => {
  try {
    const { messageId } = req.params;
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await prisma.chatMessage.delete({
      where: { id: messageId }
    });

    await prisma.moderationLog.create({
      data: {
        moderatorId: dbUser.id,
        userId: message.userId,
        action: 'MESSAGE_DELETED',
        reason: 'Admin deleted message',
        details: { messageId, message: message.message }
      }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Broadcast admin message
app.post('/api/admin/broadcast', isAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    
    io.emit('admin_broadcast', {
      message,
      timestamp: Date.now()
    });

    console.log(`📢 Admin broadcast: ${message}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

// =============================================================================
// SOCIAL 2.0 API ROUTES
// =============================================================================

// --- Syndicate Routes ---
app.get('/api/syndicate/my', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const membership = await getSyndicateService().getUserSyndicate(dbUser.id);
    res.json(membership || null);
  } catch (error) {
    console.error('Get syndicate error:', error);
    res.status(500).json({ error: 'Failed to get syndicate' });
  }
});

app.get('/api/syndicates', async (req, res) => {
  try {
    const { query, page, limit, sortBy } = req.query;
    const result = await getSyndicateService().searchSyndicates(query, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sortBy: sortBy || 'weeklyXP'
    });
    res.json(result);
  } catch (error) {
    console.error('Search syndicates error:', error);
    res.status(500).json({ error: 'Failed to search syndicates' });
  }
});

app.get('/api/syndicate/:id', async (req, res) => {
  try {
    const dbUser = req.user ? await prisma.user.findUnique({ where: { googleId: req.user.id } }) : null;
    const syndicate = await getSyndicateService().getSyndicate(req.params.id, dbUser?.id);
    if (!syndicate) return res.status(404).json({ error: 'Syndicate not found' });
    res.json(syndicate);
  } catch (error) {
    console.error('Get syndicate error:', error);
    res.status(500).json({ error: 'Failed to get syndicate' });
  }
});

app.post('/api/syndicate/create', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const { name, tag, description, isPublic, minLevelToJoin } = req.body;
    const result = await getSyndicateService().createSyndicate(dbUser.id, name, tag, {
      description, isPublic, minLevelToJoin
    });
    res.json(result);
  } catch (error) {
    console.error('Create syndicate error:', error);
    res.status(500).json({ error: 'Failed to create syndicate' });
  }
});

app.post('/api/syndicate/join/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const result = await getSyndicateService().joinSyndicate(dbUser.id, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Join syndicate error:', error);
    res.status(500).json({ error: 'Failed to join syndicate' });
  }
});

app.post('/api/syndicate/leave', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const result = await getSyndicateService().leaveSyndicate(dbUser.id);
    res.json(result);
  } catch (error) {
    console.error('Leave syndicate error:', error);
    res.status(500).json({ error: 'Failed to leave syndicate' });
  }
});

app.post('/api/syndicate/donate', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const { amount } = req.body;
    const result = await getSyndicateService().donateToTreasury(dbUser.id, parseInt(amount));
    res.json(result);
  } catch (error) {
    console.error('Donate error:', error);
    res.status(500).json({ error: 'Failed to donate' });
  }
});

app.get('/api/syndicate/leaderboard', async (req, res) => {
  try {
    const { sortBy, limit } = req.query;
    const leaderboard = await getSyndicateService().getSyndicateLeaderboard(sortBy, parseInt(limit) || 50);
    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// --- Referral Routes ---
app.get('/api/referral/code', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const code = await getReferralService().getUserReferralCode(dbUser.id);
    res.json(code);
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

app.get('/api/referral/stats', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const stats = await getReferralService().getReferralStats(dbUser.id);
    res.json(stats);
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

app.post('/api/referral/validate', async (req, res) => {
  try {
    const { code } = req.body;
    const result = await getReferralService().validateCode(code);
    res.json(result);
  } catch (error) {
    console.error('Validate referral error:', error);
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

app.get('/api/referral/leaderboard', async (req, res) => {
  try {
    const { period, limit } = req.query;
    const leaderboard = await getReferralService().getReferralLeaderboard(period || 'all', parseInt(limit) || 20);
    res.json(leaderboard);
  } catch (error) {
    console.error('Referral leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// --- Generosity Routes ---
app.post('/api/generosity/tip', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const { amount, message, isAnonymous } = req.body;
    const result = await getGenerosityService().tipTheHouse(dbUser.id, parseInt(amount), { message, isAnonymous });
    res.json(result);
  } catch (error) {
    console.error('Tip error:', error);
    res.status(500).json({ error: 'Failed to tip' });
  }
});

app.get('/api/generosity/stats', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const stats = await getGenerosityService().getUserGenerosityStats(dbUser.id);
    res.json(stats);
  } catch (error) {
    console.error('Get generosity stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/generosity/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getGenerosityService().getWeeklyLeaderboard(20);
    res.json(leaderboard);
  } catch (error) {
    console.error('Generosity leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

app.get('/api/generosity/feed', async (req, res) => {
  try {
    const { limit } = req.query;
    const feed = await getGenerosityService().getRecentTips(parseInt(limit) || 20);
    res.json(feed);
  } catch (error) {
    console.error('Tip feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// --- Happy Hour Routes ---
app.get('/api/happy-hour/status', async (req, res) => {
  try {
    const engagement = getEngagementServiceV2();
    const active = await engagement.getActiveHappyHour();
    res.json({ active: !!active, ...active });
  } catch (error) {
    console.error('Happy hour status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// --- Streak Routes (Enhanced) ---
app.get('/api/streak/status', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
    const status = await getEngagementServiceV2().getStreakStatus(dbUser.id);
    res.json(status);
  } catch (error) {
    console.error('Streak status error:', error);
    res.status(500).json({ error: 'Failed to get streak status' });
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
  constructor(roomId, displayName = null) {
    this.roomId = roomId;
    this.displayName = displayName; // Custom room name set by creator
    this.creatorSocketId = null; // Track who created the room
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
      displayName: this.displayName,
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
    displayName: g.displayName,
    seatedCount: g.seatedCount, 
    observerCount: g.observers.size,
    hasEmptySeat: g.hasEmptySeat(),
    gameType: g.getGameType ? g.getGameType() : 'WAR'
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

// Helper function to get Bingo letter from number
function getBingoLetter(num) {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  if (num >= 61 && num <= 75) return 'O';
  return '';
}

// Get Bingo rooms summary for lobby
function getBingoRoomsSummary() {
  const bingoRooms = Array.from(games.entries())
    .filter(([id, game]) => game.getGameType && game.getGameType() === 'BINGO')
    .map(([id, game]) => ({
      roomId: id,
      displayName: game.config?.displayName || null,
      type: 'BINGO',
      playerCount: game.getPlayers ? game.getPlayers().length : 0,
      phase: game.getGameState().phase,
      pot: game.getPot()
    }));
  return bingoRooms;
}

io.on('connection', (socket) => {
  // Check if user is admin
  const user = socket.request?.session?.passport?.user;
  const isAdminUser = user && user.isAdmin;

  // Enforce operating hours for socket connections (unless admin)
  if (!isAdminUser) {
    const { isOpen, nextOpenTime } = getOperatingHoursStatus();
    if (!isOpen) {
        socket.emit('error', {
            message: 'Casino is closed.',
            details: 'The nightclub is only open from 10 PM to 2 AM Eastern Time.',
            nextOpenTime: nextOpenTime.toISOString(),
        });
        socket.disconnect(true);
        return;
    }
  }

  // Join lobby channel and send existing rooms
  socket.join('lobby');
  io.to(socket.id).emit('rooms_list', getRoomsSummary());

  // Lobby chat with auto-moderation
  socket.on('lobby_chat', async (msg) => {
    const user = socket.request?.session?.passport?.user;
    
    if (!user) {
      // Guests can't chat
      return io.to(socket.id).emit('error', { message: 'Please log in to chat' });
    }

    try {
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      if (!dbUser) return;

      const profile = await getUserProfile(user.id);
      
      // Try auto-moderation, but don't crash if tables don't exist yet
      try {
        const modResult = await getAutoMod().filterMessage(dbUser.id, msg, 'lobby');

        if (!modResult.allowed) {
          // Message blocked
          io.to(socket.id).emit('chat_filtered', { 
            reason: modResult.reason,
            severity: modResult.severity
          });
          return;
        }

        // Save to database
        await getAutoMod().saveChatMessage(
          dbUser.id, 
          modResult.filtered, 
          'lobby', 
          modResult.filtered !== msg,
          modResult.reason
        );

        // Broadcast filtered message
        io.to('lobby').emit('lobby_message', { 
          from: profile.nickname, 
          photo: profile.avatar, 
          msg: modResult.filtered, 
          at: Date.now(),
          filtered: modResult.filtered !== msg
        });

        // Notify user if their message was filtered
        if (modResult.filtered !== msg) {
          io.to(socket.id).emit('chat_filtered', {
            reason: modResult.reason,
            severity: 'low',
            message: 'Your message was filtered for profanity'
          });
        }
      } catch (modError) {
        // If moderation fails (e.g., tables don't exist), just send unfiltered message
        console.warn('Auto-moderation disabled:', modError.message);
        io.to('lobby').emit('lobby_message', { 
          from: profile.nickname, 
          photo: profile.avatar, 
          msg, 
          at: Date.now()
        });
      }
    } catch (error) {
      console.error('Lobby chat error:', error);
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
    
    // Get custom room name from data, sanitize and limit length
    const displayName = data.roomName ? 
      sanitizeMessage(data.roomName).substring(0, 30) : null;

    const game = new GameRoom(roomId, displayName);
    game.creatorSocketId = socket.id;
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

  // Room chat with auto-moderation
  socket.on('room_chat', async (msg) => {
    const roomId = playerToGame.get(socket.id);
    if (!roomId) return;
    
    const user = socket.request?.session?.passport?.user;
    if (!user) {
      return io.to(socket.id).emit('error', { message: 'Please log in to chat' });
    }

    try {
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      if (!dbUser) return;

      const profile = await getUserProfile(user.id);
      
      // Try auto-moderation, but don't crash if tables don't exist yet
      try {
        const modResult = await getAutoMod().filterMessage(dbUser.id, msg, roomId);

        if (!modResult.allowed) {
          // Message blocked
          io.to(socket.id).emit('chat_filtered', { 
            reason: modResult.reason,
            severity: modResult.severity
          });
          return;
        }

        // Save to database
        await getAutoMod().saveChatMessage(
          dbUser.id, 
          modResult.filtered, 
          roomId, 
          modResult.filtered !== msg,
          modResult.reason
        );

        // Broadcast filtered message
        io.to(roomId).emit('room_message', { 
          from: profile.nickname, 
          photo: profile.avatar, 
          msg: modResult.filtered, 
          at: Date.now(),
          filtered: modResult.filtered !== msg
        });

        // Notify user if their message was filtered
        if (modResult.filtered !== msg) {
          io.to(socket.id).emit('chat_filtered', {
            reason: modResult.reason,
            severity: 'low',
            message: 'Your message was filtered for profanity'
          });
        }
      } catch (modError) {
        // If moderation fails (e.g., tables don't exist), just send unfiltered message
        console.warn('Auto-moderation disabled:', modError.message);
        io.to(roomId).emit('room_message', { 
          from: profile.nickname, 
          photo: profile.avatar, 
          msg, 
          at: Date.now()
        });
      }
    } catch (error) {
      console.error('Room chat error:', error);
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

  // ===== HEAD-TO-HEAD WAR HANDLERS =====

  // Store for private War rooms by table code
  const privateWarRooms = new Map(); // tableCode -> roomId

  // Create private War room (Head-to-Head mode)
  socket.on('create_private_war', async (data = {}) => {
    const roomId = 'war_pvt_' + crypto.randomBytes(4).toString('hex');
    const user = socket.request?.session?.passport?.user;

    if (!user) {
      return io.to(socket.id).emit('error', { message: 'Must be logged in to create private game' });
    }

    try {
      const WarEngine = require('./src/engines/WarEngine').WarEngine;
      const EngagementService = require('./src/services/EngagementService').EngagementService;

      const engagement = new EngagementService(prisma, redisClient || null);
      const warGame = new WarEngine(
        roomId,
        prisma,
        redisClient || null,
        engagement,
        { isPrivate: true } // Enable private mode
      );

      // Initialize with QRNG if player seed provided
      if (data.playerSeed) {
        await warGame.initializeWithQRNG(data.playerSeed);
      }

      games.set(roomId, warGame);
      privateWarRooms.set(warGame.getTableCode(), roomId);
      playerToGame.set(socket.id, roomId);
      socket.join(roomId);

      const profile = await getUserProfile(user.id);
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      const chips = Number(data.chips) || Number(dbUser?.chipBalance) || 1000;

      // Join game as a player (new multi-spot API)
      const joinResult = warGame.joinGame(socket.id, profile.nickname, profile.avatar, chips);

      io.to(socket.id).emit('private_war_created', {
        roomId,
        tableCode: warGame.getTableCode(),
        gameState: warGame.getGameState(),
        profile: profile,
        playerColor: joinResult.color
      });

      console.log(`🎴 Private War room created: ${roomId} with code ${warGame.getTableCode()}`);

    } catch (error) {
      console.error('Error creating private War room:', error);
      io.to(socket.id).emit('error', { message: 'Failed to create private game' });
    }
  });

  // Join private War room by table code
  socket.on('join_private_war', async (data = {}) => {
    const { tableCode } = data;

    if (!tableCode) {
      return io.to(socket.id).emit('error', { message: 'Table code required' });
    }

    const roomId = privateWarRooms.get(tableCode);
    if (!roomId) {
      return io.to(socket.id).emit('error', { message: 'Invalid table code. Game not found.' });
    }

    const warGame = games.get(roomId);
    if (!warGame || warGame.getGameType() !== 'WAR') {
      return io.to(socket.id).emit('error', { message: 'Game not found' });
    }

    if (!warGame.isWaitingForOpponent()) {
      return io.to(socket.id).emit('error', { message: 'Game is full or already started' });
    }

    const user = socket.request?.session?.passport?.user;
    if (!user) {
      return io.to(socket.id).emit('error', { message: 'Must be logged in to join' });
    }

    try {
      const profile = await getUserProfile(user.id);
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      const chips = Number(data.chips) || Number(dbUser?.chipBalance) || 1000;

      // Join game as a player (new multi-spot API)
      const joinResult = warGame.joinGame(socket.id, profile.nickname, profile.avatar, chips);

      if (!joinResult.success) {
        return io.to(socket.id).emit('error', { message: joinResult.error || 'Could not join game' });
      }

      playerToGame.set(socket.id, roomId);
      socket.join(roomId);

      io.to(socket.id).emit('private_war_joined', {
        roomId,
        gameState: warGame.getGameState(),
        profile: profile,
        playerColor: joinResult.color
      });

      // Notify both players that opponent has arrived
      io.to(roomId).emit('opponent_joined', {
        gameState: warGame.getGameState(),
        message: 'Opponent has joined! Place your bets to begin.'
      });

      console.log(`🎴 Player joined private War room: ${roomId}`);

    } catch (error) {
      console.error('Error joining private War room:', error);
      io.to(socket.id).emit('error', { message: 'Failed to join game' });
    }
  });

  // Place bet on War betting spot (new multi-spot API)
  socket.on('place_war_bet', async (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);

    if (!game || game.getGameType() !== 'WAR') {
      return io.to(socket.id).emit('error', { message: 'Not in a War game' });
    }

    const { seatIndex, spotIndex, betAmount } = data;

    if (seatIndex === undefined || spotIndex === undefined || !betAmount) {
      return io.to(socket.id).emit('error', { message: 'Missing bet parameters' });
    }

    try {
      const success = await game.placeBet(socket.id, Number(betAmount), Number(seatIndex), Number(spotIndex));

      if (!success) {
        return io.to(socket.id).emit('error', { message: 'Failed to place bet' });
      }

      // Broadcast updated game state to all players
      io.to(roomId).emit('war_bet_placed', {
        gameState: game.getGameState(),
        seatIndex: Number(seatIndex),
        spotIndex: Number(spotIndex)
      });

      // Auto-start if there are active bets
      if (game.hasActiveBets()) {
        setTimeout(async () => {
          if (game.hasActiveBets() && game.bettingPhase) {
            await game.startNewHand();
            io.to(roomId).emit('war_hand_started', { gameState: game.getGameState() });

            // Resolve after a delay
            setTimeout(async () => {
              const results = await game.resolveHand();
              io.to(roomId).emit('war_hand_resolved', {
                gameState: game.getGameState(),
                results
              });

              // Reset for next round
              setTimeout(async () => {
                await game.resetForNextRound();
                io.to(roomId).emit('war_round_reset', { gameState: game.getGameState() });
              }, 3000);
            }, 2000);
          }
        }, 3000); // 3 second delay to let players place more bets
      }

    } catch (error) {
      console.error('Error placing War bet:', error);
      io.to(socket.id).emit('error', { message: 'Failed to place bet' });
    }
  });

  // Remove bet from War betting spot
  socket.on('remove_war_bet', async (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const game = games.get(roomId);

    if (!game || game.getGameType() !== 'WAR') {
      return io.to(socket.id).emit('error', { message: 'Not in a War game' });
    }

    const { seatIndex, spotIndex } = data;

    if (seatIndex === undefined || spotIndex === undefined) {
      return io.to(socket.id).emit('error', { message: 'Missing parameters' });
    }

    try {
      const success = game.removeBet(socket.id, Number(seatIndex), Number(spotIndex));

      if (!success) {
        return io.to(socket.id).emit('error', { message: 'Failed to remove bet' });
      }

      // Broadcast updated game state
      io.to(roomId).emit('war_bet_removed', {
        gameState: game.getGameState(),
        seatIndex: Number(seatIndex),
        spotIndex: Number(spotIndex)
      });

    } catch (error) {
      console.error('Error removing War bet:', error);
      io.to(socket.id).emit('error', { message: 'Failed to remove bet' });
    }
  });

  // ===== BINGO GAME HANDLERS =====

  // Create Bingo room
  socket.on('create_bingo_room', async (data = {}) => {
    const roomId = 'bingo_' + crypto.randomBytes(4).toString('hex');
    const user = socket.request?.session?.passport?.user;
    
    if (!user) {
      return io.to(socket.id).emit('error', { message: 'Must be logged in to create Bingo room' });
    }
    
    try {
      const BingoEngine = require('./src/engines/BingoEngine').BingoEngine;
      const EngagementService = require('./src/services/EngagementService').EngagementService;
      
      // Get custom room name from data, sanitize and limit length
      const displayName = data.roomName ? 
        sanitizeMessage(data.roomName).substring(0, 30) : null;
      
      const engagement = new EngagementService(prisma, redisClient || null);
      const bingoGame = new BingoEngine(
        { roomId, displayName, minBet: 1, maxBet: 5, maxPlayers: 50 },
        prisma,
        redisClient || null,
        engagement
      );
      
      // Set up ball call callback for voice announcements
      bingoGame.setBallCallCallback((ball) => {
        io.to(roomId).emit('bingo_ball_called', { 
          ball, 
          letter: getBingoLetter(ball),
          gameState: bingoGame.getGameState() 
        });
      });
      
      // Set up game end callback
      bingoGame.setGameEndCallback((data) => {
        if (data.type === 'ROUND_RESET') {
          // New round starting
          io.to(roomId).emit('bingo_round_reset', { 
            gameState: bingoGame.getGameState(),
            message: '🎱 New round starting! Buy your cards now!'
          });
          
          // Auto-start next game after 30 seconds
          setTimeout(async () => {
            if (games.has(roomId)) {
              await bingoGame.startNewHand();
              io.to(roomId).emit('bingo_game_started', { gameState: bingoGame.getGameState() });
            }
          }, 30000);
        } else {
          // Winner announced
          io.to(roomId).emit('bingo_winner', data);
        }
      });
      
      games.set(roomId, bingoGame);
      playerToGame.set(socket.id, roomId);
      socket.join(roomId);
      
      const profile = await getUserProfile(user.id);
      io.to(socket.id).emit('bingo_room_created', { 
        roomId, 
        gameState: bingoGame.getGameState(),
        profile: profile
      });
      io.to('lobby').emit('rooms_update', getBingoRoomsSummary());
      
      // Auto-start game after 30 seconds
      setTimeout(async () => {
        if (games.has(roomId)) {
          await bingoGame.startNewHand();
          io.to(roomId).emit('bingo_game_started', { gameState: bingoGame.getGameState() });
        }
      }, 30000);
      
    } catch (error) {
      console.error('Error creating Bingo room:', error);
      io.to(socket.id).emit('error', { message: 'Failed to create Bingo room' });
    }
  });

  // ===== BLACKJACK GAME HANDLERS =====
  socket.on('create_blackjack_room', async (data = {}) => {
    const roomId = 'bj_' + crypto.randomBytes(4).toString('hex');
    const user = socket.request?.session?.passport?.user;
    
    if (!user) {
      return io.to(socket.id).emit('error', { message: 'Must be logged in to create Blackjack room' });
    }
    
    try {
      const BlackjackEngine = require('./src/engines/BlackjackEngine').BlackjackEngine;
      const EngagementService = require('./src/services/EngagementService').EngagementService;
      
      // Get custom room name from data, sanitize and limit length
      const displayName = data.roomName ? 
        sanitizeMessage(data.roomName).substring(0, 30) : null;
      
      const engagement = new EngagementService(prisma, redisClient || null);
      const bjGame = new BlackjackEngine(
        { roomId, displayName, minBet: 10, maxBet: 500, maxPlayers: 5 },
        prisma,
        redisClient || null,
        engagement
      );
      
      // Initialize with QRNG if player seed provided
      if (data.playerSeed) {
        await bjGame.initializeWithQRNG(data.playerSeed);
      }

      games.set(roomId, bjGame);
      playerToGame.set(socket.id, roomId);
      socket.join(roomId);

      const profile = await getUserProfile(user.id);
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });

      if (!dbUser) {
        return io.to(socket.id).emit('error', { message: 'User not found in database' });
      }

      // Add player to the game with proper initialization
      await bjGame.addPlayer(dbUser.id, 0);

      // Get properly initialized game state
      const gameState = bjGame.getGameState();

      io.to(socket.id).emit('room_created', {
        roomId,
        gameState: gameState,
        gameType: 'BLACKJACK',
        profile: profile,
        dualSeeds: bjGame.getDualSeeds()
      });
      io.to('lobby').emit('rooms_update', getRoomsSummary());
      
    } catch (error) {
      console.error('Error creating Blackjack room:', error);
      io.to(socket.id).emit('error', { message: 'Failed to create room' });
    }
  });
  
  // Join Bingo room
  socket.on('join_bingo_room', async (data = {}) => {
    const { roomId } = data;
    const bingoGame = games.get(roomId);
    
    if (!bingoGame || bingoGame.getGameType() !== 'BINGO') {
      return io.to(socket.id).emit('error', { message: 'Bingo room not found' });
    }
    
    const user = socket.request?.session?.passport?.user;
    if (!user) {
      return io.to(socket.id).emit('error', { message: 'Must be logged in to play Bingo' });
    }
    
    try {
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      if (!dbUser) {
        return io.to(socket.id).emit('error', { message: 'User not found in database' });
      }
      await bingoGame.addPlayer(dbUser.id);
      
      playerToGame.set(socket.id, roomId);
      socket.join(roomId);
      
      const profile = await getUserProfile(user.id);
      io.to(socket.id).emit('bingo_room_joined', { 
        roomId, 
        gameState: bingoGame.getGameState(),
        cards: bingoGame.getPlayerCards(dbUser.id),
        profile: profile
      });
      io.to(roomId).emit('bingo_player_joined', { gameState: bingoGame.getGameState() });
    } catch (error) {
      console.error('Error joining Bingo room:', error);
      io.to(socket.id).emit('error', { message: 'Failed to join Bingo room' });
    }
  });
  
  // Buy Bingo card
  socket.on('buy_bingo_card', async (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const bingoGame = games.get(roomId);
    
    if (!bingoGame || bingoGame.getGameType() !== 'BINGO') {
      return io.to(socket.id).emit('error', { message: 'Not in a Bingo room' });
    }
    
    const user = socket.request?.session?.passport?.user;
    if (!user) return;
    
    try {
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      if (!dbUser) {
        return io.to(socket.id).emit('error', { message: 'User not found' });
      }
      const success = await bingoGame.placeBet(dbUser.id, 1);
      
      if (success) {
        const cards = bingoGame.getPlayerCards(dbUser.id);
        io.to(socket.id).emit('bingo_card_purchased', { 
          cards,
          gameState: bingoGame.getGameState()
        });
        io.to(roomId).emit('bingo_pot_updated', { gameState: bingoGame.getGameState() });
      } else {
        const gameState = bingoGame.getGameState();
        
        // Give helpful message based on phase
        let message = 'Cannot buy card';
        if (gameState.phase === 'PLAYING') {
          message = '⏳ Game in progress! You can buy cards for the next round.';
        } else if (gameState.phase === 'COMPLETE') {
          message = '🎉 Game over! Next round starting soon...';
        } else {
          message = 'Cannot buy card (insufficient chips or max 5 cards reached)';
        }
        
        io.to(socket.id).emit('error', { message });
      }
    } catch (error) {
      console.error('Error buying Bingo card:', error);
      io.to(socket.id).emit('error', { message: 'Failed to buy Bingo card' });
    }
  });
  
  // Claim BINGO
  socket.on('claim_bingo', async (data = {}) => {
    const roomId = playerToGame.get(socket.id);
    const bingoGame = games.get(roomId);
    
    if (!bingoGame || bingoGame.getGameType() !== 'BINGO') {
      return io.to(socket.id).emit('error', { message: 'Not in a Bingo room' });
    }
    
    const user = socket.request?.session?.passport?.user;
    if (!user) return;
    
    try {
      const dbUser = await prisma.user.findUnique({ where: { googleId: user.id } });
      const { cardId } = data;
      
      const result = await bingoGame.claimBingo(dbUser.id, cardId);
      
      if (result.valid) {
        const profile = await getUserProfile(user.id);
        io.to(roomId).emit('bingo_winner', {
          winner: {
            userId: dbUser.id,
            name: profile.nickname,
            photo: profile.avatar,
            cardId,
            pattern: result.pattern
          },
          gameState: bingoGame.getGameState()
        });
      } else {
        io.to(socket.id).emit('error', { message: 'Invalid BINGO claim - pattern not complete!' });
      }
    } catch (error) {
      console.error('Error claiming BINGO:', error);
      io.to(socket.id).emit('error', { message: 'Failed to claim BINGO' });
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
        
        // Get state using the appropriate method for the game type
        const gameState = game.getGameState ? game.getGameState() : game.getState();
        io.to(roomId).emit('player_disconnected', { gameState });
        
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

// SPA Fallback: Serve React app for any unmatched routes (must be after all API routes)
const fs = require('fs');
app.get('*', (req, res, next) => {
  // Skip API routes and socket.io
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/auth')) {
    return next();
  }
  
  const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback to legacy index.html if React build doesn't exist
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Initialize and start server
function startServer() {
  try {
    console.log('🚀 Starting server on port', PORT);
    
    // Start HTTP server FIRST - blocking until ready
    serverHttp.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on port ${PORT}`);
      
      // Initialize everything else AFTER server is listening
      initializeAuth().then(async () => {
        console.log('✅ Authentication initialized');
        try {
          const dbConnected = await checkDatabaseConnection();
          if (!dbConnected) {
            console.warn('⚠️  Database connection failed. Some features may not work.');
          } else {
            // Initialize Social 2.0 Services
            try {
              const redis = redisClient || {
                setex: () => Promise.resolve(),
                get: () => Promise.resolve(null),
                del: () => Promise.resolve(),
                lpush: () => Promise.resolve(),
                ltrim: () => Promise.resolve(),
                expire: () => Promise.resolve(),
                incrby: () => Promise.resolve(),
                publish: () => Promise.resolve()
              };

              initSyndicateService(prisma, redis, io);
              initEngagementServiceV2(prisma, redis, getSyndicateService());
              initReferralService(prisma, redis, getSyndicateService());
              initGenerosityService(prisma, redis, io);

              // Start background jobs
              const dividendDistributor = createDividendDistributor(prisma, redis, getSyndicateService(), io);
              dividendDistributor.start();

              const happyHourScheduler = createHappyHourScheduler(prisma, redis, io);
              happyHourScheduler.start();

              console.log('✅ Social 2.0 services initialized');
            } catch (serviceErr) {
              console.error('⚠️  Social 2.0 services failed to initialize:', serviceErr.message);
            }

            console.log('✅ All systems ready');
          }
        } catch (dbErr) {
          console.error('❌ Database check error:', dbErr);
        }
      }).catch(err => {
        console.error('❌ Auth initialization error:', err);
      });
    });
    
    // Handle startup errors
    serverHttp.on('error', (err) => {
      console.error('❌ Server startup error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Fatal startup error:', err);
    process.exit(1);
  }
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
startServer();
