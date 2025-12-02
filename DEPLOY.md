# War Card Game - Quick Deploy Guide

## What's Included

This is a full real-time multiplayer card game with:
- **Server**: Node.js + Express + Socket.io
- **Client**: HTML5 + CSS3 + Vanilla JavaScript
- **Game Logic**: Server-authoritative validation
- **Real-time**: WebSocket communication for instant updates

## Quick Start (Local Testing)

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

## Deploy to Railway (Easiest)

Railway is the easiest option for deploying this game.

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy Repository**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Find and select your Game repository
   - Click "Deploy Now"

3. **Access Your Game**
   - Railway will assign a domain (e.g., `yourapp-production.up.railway.app`)
   - Share the URL with your friend
   - Click "Create Game" or "Join Game"

**That's it!** No configuration needed. Railway auto-detects Node.js.

---

## Deploy to Heroku

```bash
# 1. Install Heroku CLI from heroku.com/cli

# 2. Login
heroku login

# 3. Create app
heroku create your-game-name

# 4. Deploy
git push heroku main

# 5. Open
heroku open
```

Your game will be live at `your-game-name.herokuapp.com`

---

## Deploy to Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click "Create Web Service"

Your game will be live in 2-3 minutes!

---

## How to Share with Friends

Once deployed, share your URL with a friend:

1. **Friend visits**: `https://your-app-url.com`
2. **Friend clicks**: "Create Game" (gets a Room ID)
   - OR "Join Game" (enters a Room ID you provide)
3. You do the same
4. Game starts automatically when both players are ready!

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Hosting Server                   │
│  (Railway, Heroku, Render, or Your Own Server)     │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  Node.js / Express / Socket.io              │  │
│  │  ├─ server.js (Game Logic)                  │  │
│  │  └─ All game state validation here          │  │
│  └─────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────┘
               │ WebSocket
               │ (Real-time)
      ┌────────┴────────┐
      │                 │
   Player 1          Player 2
   Browser           Browser
  (client.js)       (client.js)
```

---

## Troubleshooting

**"Port already in use"**: Change PORT in server.js or use a different port

**"Cannot find module"**: Run `npm install`

**"WebSocket connection failed"**: 
- Check your hosting provider allows WebSocket connections (most do)
- Verify the URL is correct (use https:// on secure connections)

**"Opponent not connecting"**: 
- Make sure both are on the same Room ID
- Check if opponent's browser WebSocket is enabled
- Try reloading the page

---

## Files Explanation

| File | Purpose |
|------|---------|
| `server.js` | Game server with room management and validation |
| `client.js` | Browser-side game logic and UI updates |
| `index.html` | Game interface |
| `styles.css` | Visual styling |
| `package.json` | Dependencies and scripts |
| `Procfile` | Heroku deployment configuration |

---

## Environment

All configuration is automatic. The server uses PORT environment variable (defaults to 3000).

No secrets or `.env` files needed for basic deployment!

---

## Next Steps

1. Deploy to Railway/Heroku/Render (choose one)
2. Get the public URL
3. Share with a friend
4. Play!

Enjoy your game!
