// src/routes/auth.js
const express = require('express');
const passport = require('passport');
const webauthn = require('../webauthn');
const { prisma } = require('../db');

const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?error=auth_denied' }),
  (req, res) => {
    res.redirect('/');
  }
);

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
        const dbUser = await prisma.user.findUnique({ where: { googleId: req.user.id } });
        res.json({ authenticated: true, user: { ...req.user, ...dbUser, chipBalance: Number(dbUser.chipBalance) } });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.json({ authenticated: true, user: req.user });
    }
});

module.exports = router;