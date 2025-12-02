# 🎯 VegasCore Services - Quick Reference

**Last Updated:** December 2, 2024  
**Status:** ✅ All Core Services Configured

---

## 📊 Configured Services

### 1. **Supabase PostgreSQL** ✅
**Purpose:** Primary database (user data, transactions, game sessions)

- **Project ID:** `kitqcxholtgtudojbhyd`
- **Region:** `aws-1-us-east-1`
- **Host:** `aws-1-us-east-1.pooler.supabase.com`
- **Pooled Port:** `6543` (for app runtime)
- **Direct Port:** `5432` (for migrations)
- **Dashboard:** https://supabase.com/dashboard/project/kitqcxholtgtudojbhyd

**Tables Created:**
- ✅ User (progression & retention)
- ✅ Transaction (financial ledger)
- ✅ GameSession (audit trail)
- ✅ Hand (game rounds)
- ✅ Achievement + UserAchievement
- ✅ HappyHour (promotions)

---

### 2. **Upstash Redis** ✅
**Purpose:** Session storage, caching, real-time data

- **Host:** `huge-jaybird-43835.upstash.io`
- **Protocol:** REST API
- **Dashboard:** https://console.upstash.com/
- **Status:** Connected & Verified

**Use Cases:**
- Session storage (replace memorystore)
- Rate limiting
- Real-time leaderboards
- Cache frequently accessed data

---

### 3. **Google OAuth 2.0** ⚠️
**Purpose:** User authentication

- **Client ID:** `212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t.apps.googleusercontent.com`
- **Client Secret:** ⏳ **PENDING** - Add to `.env`
- **Console:** https://console.cloud.google.com/apis/credentials

**Next Steps:**
1. Get Client Secret from Google Cloud Console
2. Add `GOOGLE_CLIENT_SECRET` to `.env`
3. Configure authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (dev)
   - `https://yourdomain.com/auth/google/callback` (prod)

---

## 🔑 Environment Variables

```bash
# .env file (DO NOT COMMIT)
DATABASE_URL="postgresql://postgres.kitqcxholtgtudojbhyd:***@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.kitqcxholtgtudojbhyd:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
UPSTASH_REDIS_REST_URL="https://huge-jaybird-43835.upstash.io"
UPSTASH_REDIS_REST_TOKEN="***"
SESSION_SECRET="***"
GOOGLE_CLIENT_ID="212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="PENDING"
NODE_ENV="development"
PORT=3000
```

---

## 🧪 Testing Commands

```bash
# Test all services
npm run db:test

# Test database only
npx prisma db pull

# Test Redis manually (Node REPL)
node
> const { Redis } = require('@upstash/redis')
> const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
> await redis.ping()
```

---

## 📦 Installed Packages

```json
{
  "@prisma/client": "^5.22.0",
  "@upstash/redis": "^1.x",
  "dotenv": "^17.x",
  "express": "^5.2.1",
  "express-session": "^1.17.3",
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "socket.io": "^4.8.1"
}
```

---

## 🚀 Production Deployment Checklist

### Before Deploying:
- [ ] Get Google Client Secret
- [ ] Update authorized redirect URIs in Google Console
- [ ] Set all environment variables on hosting platform
- [ ] Test connections with `npm run db:test`
- [ ] Review Prisma connection pooling settings
- [ ] Enable Redis persistence if needed
- [ ] Configure CORS for your domain

### Recommended Platforms:
- **Railway** (good for Node.js + WebSockets)
- **Render** (free tier available)
- **Heroku** (classic choice)
- **Fly.io** (global edge deployment)

---

## 💡 Integration Examples

### Prisma (Database)
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create user
const user = await prisma.user.create({
  data: { displayName: 'Player1', chipBalance: 1000 }
});
```

### Upstash Redis (Cache/Sessions)
```javascript
const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache user data
await redis.set(`user:${userId}`, JSON.stringify(userData), { ex: 3600 });
const cached = await redis.get(`user:${userId}`);
```

### Google OAuth
```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  // Handle user login
}));
```

---

## 🔒 Security Notes

- ✅ `.env` file is gitignored
- ✅ Session secret is 64-char cryptographic hash
- ✅ Database uses connection pooling (Supabase)
- ✅ Redis uses secure REST API (Upstash)
- ⚠️ Remember to rotate secrets regularly
- ⚠️ Never commit credentials to git
- ⚠️ Use environment variables on hosting platform

---

## 📚 Service Documentation

- **Supabase:** https://supabase.com/docs
- **Upstash Redis:** https://docs.upstash.com/redis
- **Prisma:** https://www.prisma.io/docs
- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **Passport.js:** http://www.passportjs.org/

---

**Status:** Ready for development! Only missing Google Client Secret for full OAuth setup.
