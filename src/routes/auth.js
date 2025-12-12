// src/routes/auth.js
const express = require('express');
const passport = require('passport');
const webauthn = require('../webauthn');
const { prisma } = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiter for registration (guest and regular accounts)
// Prevents abuse: max 5 accounts per IP per 15 minutes
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 registrations
  message: { error: 'Too many accounts created. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth_denied' }),
  (req, res) => {
    res.redirect('/');
  }
);

// Username/Password Registration (with rate limiting)
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'smmohamed60@gmail.com';
    const isAdminUser = email === ADMIN_EMAIL;

    // Create user
    const newUserId = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        id: newUserId,
        email,
        password: hashedPassword,
        displayName: username,
        chipBalance: 100n,
        lastLogin: new Date(),
        updatedAt: new Date(),
        currentStreak: 1,
        isAdmin: isAdminUser,
      },
    });

    // Create welcome transaction
    try {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          amount: 1000,
          type: 'ADMIN_CREDIT',
          balanceBefore: 0n,
          balanceAfter: 1000n,
          description: 'Welcome to Moe\'s Card Room!',
        },
      });

      // Update balance
      await prisma.user.update({
        where: { id: user.id },
        data: { chipBalance: 1000n }
      });
    } catch (txError) {
      console.error('⚠️ Warning: Failed to create welcome transaction:', txError.message);
    }

    // Log user in
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Registration successful but login failed' });
      }
      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          chipBalance: Number(user.chipBalance),
          isAdmin: user.isAdmin
        }
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Username/Password Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Log user in
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          chipBalance: Number(user.chipBalance),
          isAdmin: user.isAdmin
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.clearCookie('sid').status(200).json({ ok: true }));
  });
});

router.post('/webauthn/register-start', webauthn.handleRegistrationStart);
router.post('/webauthn/register-finish', webauthn.handleRegistrationFinish);
router.post('/webauthn/login-start', webauthn.handleAuthenticationStart);
router.post('/webauthn/login-finish', webauthn.handleAuthenticationFinish);
router.get('/webauthn/authenticators', webauthn.getAuthenticators);
router.delete('/webauthn/authenticators/:id', webauthn.deleteAuthenticator);

router.get('/me', async (req, res) => {
    if (!req.user) return res.status(200).json({ authenticated: false });
    try {
        // req.user.id is the database id, not googleId
        const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!dbUser) {
            return res.status(200).json({ authenticated: false });
        }
        res.json({
            authenticated: true,
            user: {
                ...req.user,
                ...dbUser,
                chipBalance: Number(dbUser.chipBalance),
                isAdmin: dbUser.isAdmin // Ensure isAdmin is included
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.json({ authenticated: true, user: req.user });
    }
});

module.exports = router;