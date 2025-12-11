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

app.use('/api', apiRouter);
app.use('/api/admin', adminRouter);

// Static files
app.use(express.static(path.join(__dirname, '.')));
app.use(express.static(path.join(__dirname, 'public')));
const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDistPath));

app.get('/', (req, res) => {
  if (!req.user) {
    return res.sendFile(path.join(__dirname, 'welcome.html'));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// SPA Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/auth')) {
    return next();
  }
  const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

module.exports = { app, sessionMiddleware };