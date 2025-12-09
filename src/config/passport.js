// Passport configuration for Google OAuth
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getOrCreateUser, prisma } = require('../db');

// Serialize user for session (store database user.id)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session (retrieve by database user.id)
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || { id });
  } catch (err) {
    console.error('Deserialize user error:', err);
    done(err, null);
  }
});

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await getOrCreateUser(profile);
      return done(null, user);
    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err, null);
    }
  }
));

module.exports = passport;
