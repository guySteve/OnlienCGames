# War Card Game - Online Multiplayer

A real-time 1v1 War card game with WebSocket multiplayer support. Two players compete in real-time with betting using fake chips.

## Features

- **Real-time Multiplayer**: Play against an opponent in real-time using WebSockets
- **Room-based Matchmaking**: Create or join games with room codes
- **Live Betting**: Both players place bets and play simultaneously
- **Chip System**: Start with customizable chips and grow your wealth
- **Game Statistics**: Track wins, losses, and final chip counts
- **Connection Status**: See if your opponent is online
- **Responsive Design**: Works on desktop and mobile devices
- **Server-side Game Logic**: Secure server-validated game state

## Architecture

- **Frontend**: HTML5, CSS3, Vanilla JavaScript + Socket.io client
- **Backend**: Node.js + Express + Socket.io for real-time communication
- **Game State**: Server-authoritative game logic

## Quick Start

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open `http://localhost:3000` in your browser

## How to Play

1. **Create or Join a Game**:
   - Click "Create Game" to start a new game and get a Room ID
   - Share the Room ID with your friend
   - Or enter a Room ID to join an existing game

2. **Betting Phase**:
   - Both players enter a bet amount
   - Place bets sequentially (first player bets, then second player)

3. **Card Draw**:
   - Once both players bet, cards are automatically drawn
   - Highest card wins the pot
   - If tied, pot is split

4. **Continue or End**:
   - Click "Next Round" to continue
   - Game ends when someone runs out of chips
   - Or click "End Game" to finish anytime

## Card Values

- Ace (A) = 14
- King (K) = 13
- Queen (Q) = 12
- Jack (J) = 11
- 10-2 = Face value

## Deployment

### Heroku (Recommended for Free Tier Alternative)

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create and deploy
heroku create your-app-name
git push heroku main
heroku open
```

### Railway (Simple & Easy)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects Node.js and deploys
5. Your game is live!

### Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Set Build Command: `npm install`
5. Set Start Command: `npm start`
6. Deploy!

### Netlify (With Backend)

Netlify doesn't support WebSocket servers. Use Railway or Render instead.

### Self-hosted

Deploy to any Node.js hosting (AWS, DigitalOcean, VPS, etc.):

```bash
npm install
npm start
```

The server runs on the PORT environment variable (defaults to 3000).

## Environment Variables

- `PORT` - Server port (default: 3000)

## File Structure

- `server.js` - Express server & Socket.io game logic
- `client.js` - Frontend client logic
- `index.html` - Game UI
- `styles.css` - Game styling
- `package.json` - Dependencies
- `README.md` - This file

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Client**: Vanilla JavaScript + HTML5/CSS3

## License

MIT - Feel free to use and modify!
