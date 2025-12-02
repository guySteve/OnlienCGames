# 🚀 Quick Start - Moe's Card Room

**Status:** Ready to launch in 3 steps!

---

## Step 1: Get Google Client Secret (5 min)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find OAuth 2.0 Client: `212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t`
3. Click on it and copy the **Client Secret**
4. Add to `.env` file:
   ```bash
   GOOGLE_CLIENT_SECRET="paste_your_secret_here"
   ```

---

## Step 2: Test Locally (2 min)

```bash
# Test all systems
npm run db:test

# Start server
npm start

# Open browser
# http://localhost:3000
```

**Expected:**
- ✅ See welcome page: "Moe's Card Room"
- ✅ Click "ENTER THE ROOM"
- ✅ Login with Google
- ✅ See chip balance (1000) in header
- ✅ Chat shows 🔒 encryption indicator

---

## Step 3: Deploy to Production (10 min)

### Option A: Render (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Production ready - v4.0.0"
   git push origin main
   ```

2. **Deploy on Render:**
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name:** moes-card-room
     - **Build Command:** `npm install && npx prisma generate`
     - **Start Command:** `npm start`
     - **Environment:** Node

3. **Add Environment Variables:**
   ```
   DATABASE_URL=postgresql://postgres.kitqcxholtgtudojbhyd:2KF0pV31tAXJ4v1j@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   
   DIRECT_URL=postgresql://postgres.kitqcxholtgtudojbhyd:2KF0pV31tAXJ4v1j@aws-1-us-east-1.pooler.supabase.com:5432/postgres
   
   UPSTASH_REDIS_REST_URL=https://huge-jaybird-43835.upstash.io
   
   UPSTASH_REDIS_REST_TOKEN=Aas7AAIncDJjMTVhMjU4MWZhMzU0YWNlYjY1NzVlZTkyMjdkMjgyM3AyNDM4MzU
   
   SESSION_SECRET=68680329dfa4b1200ffb74e14c9c264a27de0b6d998992b4ef518620fe6b1cc8
   
   GOOGLE_CLIENT_ID=212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t.apps.googleusercontent.com
   
   GOOGLE_CLIENT_SECRET=[YOUR_SECRET_FROM_STEP_1]
   
   NODE_ENV=production
   PORT=3000
   ```

4. **Update Google OAuth Redirect URI:**
   - Go to Google Cloud Console
   - Add: `https://your-render-url.onrender.com/auth/google/callback`

5. **Deploy!**
   - Click "Create Web Service"
   - Wait 2-3 minutes for build
   - Click the URL to test!

### Option B: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set DATABASE_URL="..."
railway variables set GOOGLE_CLIENT_SECRET="..."
# (add all variables from above)

# Deploy
railway up
```

---

## ✅ Post-Deploy Verification

### Test These Features:

1. **Welcome Page**
   - Visit your URL
   - Should see "Moe's Card Room" landing page
   - Disclaimer visible

2. **Authentication**
   - Click "ENTER THE ROOM"
   - Login with Google works
   - Redirects back to game

3. **Chip System**
   - Header shows chip balance (1000)
   - Can place bets
   - Chips deduct correctly

4. **Encryption**
   - Join a room
   - Chat shows 🔒 icon
   - Messages send and decrypt

5. **Mobile**
   - Open on phone
   - UI scales perfectly
   - Buttons are tappable
   - Table feels spacious

---

## 🎯 That's It!

Your casino is live! Players can:
- ✅ Login with Google
- ✅ Get 1000 daily chips
- ✅ Play Casino War
- ✅ Chat privately (encrypted)
- ✅ Come back tomorrow for fresh chips

---

## 📱 Share Your Casino

```
🎰 Welcome to Moe's Card Room!
♠️ Classic Casino War
💰 1000 free chips daily
🔒 Private encrypted chat
📱 Play on any device

[Your URL Here]

For entertainment only - No real gambling!
```

---

## 🆘 Need Help?

**Database issues?**
```bash
npm run db:test
```

**Chat not encrypting?**
- Check crypto-js CDN loaded (view source)
- Check browser console for errors

**Google login fails?**
- Verify redirect URI in Google Console
- Check GOOGLE_CLIENT_SECRET in env vars

**Chips not resetting?**
- Server timezone should be EST
- Check Transaction table for DAILY_STREAK entries

---

## 📊 Monitor Your Casino

### Check Logs
```bash
# Render
render logs

# Railway  
railway logs

# Heroku
heroku logs --tail
```

### View Database
```bash
npm run db:studio
# Opens Prisma Studio at localhost:5555
```

### Check Active Players
```bash
# In Prisma Studio:
# - Click "User" table
# - See all registered players
# - View chip balances
# - Check last login times
```

---

## 🎉 Launch Checklist

- [ ] Google Client Secret added to .env
- [ ] Tested locally (npm start)
- [ ] Pushed to GitHub
- [ ] Deployed to hosting platform
- [ ] Environment variables set
- [ ] Google OAuth redirect URI updated
- [ ] Tested on mobile device
- [ ] Verified chat encryption (🔒 icon)
- [ ] Tested daily chip reset (wait till midnight or change server date)
- [ ] Shared with friends!

---

**You're all set! Enjoy your casino! 🎰**

Questions? Check `FINAL_SETUP.md` for complete documentation.
