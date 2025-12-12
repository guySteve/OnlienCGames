// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const { prisma } = require('./src/db');

// Initialize Passport BEFORE using it
require('./src/config/passport');
const passport = require('passport');
const { checkOperatingHours } = require('./src/middleware/operatingHours');
const { isAdmin } = require('./src/middleware/auth');
const webauthn = require('./src/webauthn');

const app = express();
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins in development (use specific domains in production)
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
const NODE_ENV = process.env.NODE_ENV || 'development';

const sessionMiddleware = session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: NODE_ENV === 'production',
        sameSite: 'lax'
    },
    rolling: true
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - User: ${req.user?.id || 'anonymous'}`);
  next();
});

app.use(checkOperatingHours);

// --- ROUTES ---
const authRouter = require('./src/routes/auth');
const profileRouter = require('./src/routes/profile');
const { createApiRouter } = require('./src/api/routes');
const { createAdminRouter } = require('./src/routes/admin');
const { EngagementService } = require('./src/services/EngagementService');
const { FriendService } = require('./src/services/FriendService');
const { ChatService } = require('./src/services/ChatService');
const { Redis } = require('@upstash/redis');

let redisClient = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log('✅ Redis client initialized');
} else {
  console.warn('⚠️  Redis not configured');
}

const engagementService = new EngagementService(prisma, redisClient);
const friendService = new FriendService(prisma);
const chatService = new ChatService(prisma);
const apiRouter = createApiRouter(prisma, engagementService, friendService, chatService);
const adminRouter = createAdminRouter(prisma, engagementService);

// Mount auth routes (but keep /me at root level)
app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profile', profileRouter);

// /me endpoint (needs to be at root for React app compatibility)
app.get('/me', async (req, res) => {
    if (!req.user) return res.status(200).json({ authenticated: false });
    try {
        const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!dbUser) {
            return res.status(200).json({ authenticated: false });
        }
        // Convert BigInt fields to Number before serialization
        const { chipBalance, ...restDbUser } = dbUser;
        res.json({
            authenticated: true,
            user: {
                ...req.user,
                ...restDbUser,
                chipBalance: Number(chipBalance),
                isAdmin: dbUser.isAdmin
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ authenticated: false, error: 'Failed to fetch user' });
    }
});

// Static files - Serve React app from frontend/dist
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// Legacy static files (for old client.js, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// SPA Fallback - Serve React app for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes, socket.io, and auth routes
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/auth') || req.path.startsWith('/me')) {
    return next();
  }

  // Serve React app
  const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Frontend not built. Run: cd frontend && npm run build');
  }
});

module.exports = { app, sessionMiddleware };