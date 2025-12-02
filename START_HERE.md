# 🎴 War Card Game - START HERE

## What You Have

A **fully functional multiplayer card game** ready to deploy to the cloud.

### Features
- ✅ Real-time WebSocket multiplayer (2-5 players per room)
- ✅ Automated dealer and winner logic
- ✅ Fake chip betting system
- ✅ Room-based matchmaking
- ✅ Cloud-ready (Docker + Production config)

---

## Quick Start (3 Steps)

### Step 1: Deploy (Choose One)

**OPTION A: Render (Easiest - 2 minutes)**
```
1. Go to render.com
2. Sign up with GitHub
3. Click "New Web Service"
4. Select this Game repo
5. Set Environment to "Docker"
6. Click "Create"
7. Wait 2-3 min → Get URL
```

**OPTION B: Google Cloud Run (5 minutes)**
```bash
gcloud run deploy war-card-game --source . --platform managed --region us-central1 --allow-unauthenticated --port 3000
```

### Step 2: Get Your URL
- **Render**: `war-card-game.onrender.com` (auto-assigned)
- **GCP**: `war-card-game-abc123.run.app` (shown after deploy)

### Step 3: Share & Play
```
1. You: Open your URL in browser
2. Click "Create Game" → Get Room ID
3. Send Room ID to friend
4. Friend: Opens your URL → Click "Join Game" → Enter Room ID
5. Both place bets and play!
```

---

## File Guide

| File | Purpose |
|------|---------|
| `server.js` | **Your game server** - runs on Render/GCP |
| `client.js` | **Browser code** - what players see |
| `index.html` | Game UI layout |
| `styles.css` | Visual styling |
| `Dockerfile` | Container config for cloud |
| `package.json` | Node.js dependencies |

---

## Code Audit Results

✅ **All systems GO for cloud deployment**

```
✅ PORT uses environment variable (not hardcoded)
✅ Server properly configured for cloud
✅ Multi-player support (up to 5 players)
✅ Automated dealer logic
✅ Docker container optimized (120MB)
✅ No secrets or hardcoded credentials
```

---

## Architecture

```
Your Game Server (Cloud)
        ↓
   Port 3000
        ↓
Players Browser (WebSocket)
    ↙           ↘
  You         Friend
```

---

## Important: GitHub vs Cloud

| | GitHub | Cloud (Render/GCP) |
|---|--------|-------------------|
| **Code lives here** | ✅ Yes | ❌ No |
| **Game runs here** | ❌ No | ✅ Yes |
| **You play here** | ❌ No | ✅ Yes |
| **URL to share** | ❌ No | ✅ Yes |

**You access the game from the cloud URL, NOT GitHub!**

See `WHERE_TO_ACCESS.md` for detailed explanation.

---

## Next Steps

1. **Push code**: `git push origin main`
2. **Deploy** (choose Render or GCP)
3. **Test**: Open the URL in browser
4. **Play**: Create a game room and share with friend

---

## Documentation

- **QUICKDEPLOY.md** - 30-second cheatsheet
- **DEVOPS.md** - Complete DevOps guide with code audit
- **WHERE_TO_ACCESS.md** - Detailed explanation of GitHub vs Cloud
- **README.md** - Full game documentation
- **DEPLOY.md** - Legacy deployment info

---

## Support

### It won't deploy?
1. Check Render/GCP logs
2. Verify Dockerfile exists
3. Ensure code pushed to GitHub main branch

### Game won't load?
1. Wait for server to start (first load takes 30s on Render free tier)
2. Check browser console for errors
3. Make sure both players are on same Room ID

### Need to update code?
```bash
git push origin main    # Push changes
# Render auto-redeploys in 2 min
# For GCP: run deploy command again
```

---

## What's Different From Before

**Before**: Local 2-player only
**Now**: 
- Cloud-hosted (always on)
- Up to 5 players per room
- Shareable with friends via URL
- Automated dealer logic
- Production-ready

---

## Free Tier Details

**Render**
- 1 free service
- Auto-pauses after 15 min inactivity
- First request wakes it up (30 sec startup)

**Google Cloud Run**
- 2 million free requests/month
- Always running (no auto-pause)
- Faster startup (<1 second)

**Recommendation**: Choose **Render** for learning, **GCP** for always-on.

---

## Deploy Now!

```
Ready to go live? Pick one:

1. Render (easier):    render.com → New Web Service
2. GCP (more powerful): gcloud run deploy war-card-game ...
```

**Your game goes live in 2-5 minutes! 🚀**

---

## Questions?

- **How do I play?** Create room → Share Room ID with friend → Friend joins
- **Can we play with 3+ friends?** Yes! Up to 5 players per room
- **Is it free?** Yes! Both Render and GCP have free tiers
- **How do I update the game?** `git push origin main` → Auto-redeploys
- **Where do I access it?** The cloud URL (Render/GCP), NOT GitHub

See `WHERE_TO_ACCESS.md` for more details.

