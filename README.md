# Moe's Card Room - Casino War

A real-time multiplayer Casino War card game with WebSocket support. Up to 5 players compete in real-time with betting using virtual chips.

**Live URL**: https://onlinecgames-212973396288.us-east1.run.app

## Features

- **Real-time Multiplayer**: Play against opponents in real-time using WebSockets (up to 5 players per table)
- **Room-based Matchmaking**: Create or join games with room codes
- **Google OAuth Authentication**: Secure sign-in with Google
- **Live Betting**: All players place bets simultaneously
- **Chip System**: Daily chip allocation with streak bonuses
- **Friends System**: Add friends, send table invites, transfer chips
- **Responsive Design**: Works on desktop and mobile devices
- **Server-side Game Logic**: Secure server-validated game state

## Architecture

- **Frontend**: HTML5, CSS3, Vanilla JavaScript + Socket.io client
- **Backend**: Node.js + Express + Socket.io for real-time communication
- **Database**: PostgreSQL (Supabase) with Prisma ORM
- **Session Store**: Redis (Upstash)
- **Hosting**: Google Cloud Run (us-east1)
- **CI/CD**: Google Cloud Build (auto-deploy on push to main)

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)
- Redis instance (or Upstash account)
- Google OAuth credentials

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

4. Generate Prisma client:
```bash
npx prisma generate
```

5. Push database schema:
```bash
npx prisma db push
```

6. Start the server:
```bash
npm start
```

7. Open `http://localhost:3000` in your browser

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (with pgbouncer) | Yes |
| `DIRECT_URL` | PostgreSQL direct connection string | Yes |
| `REDIS_URL` or `UPSTASH_REDIS_REST_URL` | Redis connection string | Yes |
| `SESSION_SECRET` | Secret for session encryption (min 32 chars) | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (default: /auth/google/callback) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `PORT` | Server port (default: 3000) | No |

## Deployment to Google Cloud Run

### Automatic Deployment (Recommended)

Push to the `main` branch triggers automatic deployment via Cloud Build:

```bash
git push origin main
```

The `cloudbuild.yaml` is configured to:
1. Build Docker image with no cache
2. Push to Google Container Registry
3. Deploy to Cloud Run in `us-east1`

### Manual Deployment

```bash
gcloud run deploy onlinecgames \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --port 3000
```

## Troubleshooting OAuth Issues

### Problem: "Sign in was cancelled" or redirect_uri_mismatch

This occurs when Google OAuth callback URL doesn't match the configured redirect URIs.

### Solution

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials

2. **Click on your OAuth 2.0 Client ID**

3. **Under "Authorized redirect URIs", add your Cloud Run callback URL**:
   ```
   https://onlinecgames-212973396288.us-east1.run.app/auth/google/callback
   ```

4. **Click SAVE** and wait 1-2 minutes for propagation

5. **Set the GOOGLE_CALLBACK_URL environment variable in Cloud Run**:
   - Go to https://console.cloud.google.com/run
   - Click "onlinecgames" service
   - Click "EDIT & DEPLOY NEW REVISION"
   - Scroll to "Variables & Secrets"
   - Add: `GOOGLE_CALLBACK_URL = https://onlinecgames-212973396288.us-east1.run.app/auth/google/callback`
   - Click DEPLOY

6. **Verify the configuration**:
   - Visit: https://onlinecgames-212973396288.us-east1.run.app/debug/oauth
   - Check that `expectedCallbackUrl` matches what you added to Google Console

### Required OAuth Redirect URIs

For development and production, add these to your Google OAuth client:

| Environment | Redirect URI |
|-------------|--------------|
| Production | `https://onlinecgames-212973396288.us-east1.run.app/auth/google/callback` |
| Local Dev | `http://localhost:3000/auth/google/callback` |

### Common OAuth Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Sign in was cancelled" | Redirect URI mismatch | Add correct callback URL to Google Console |
| Service Unavailable | Database connection failed | Check DATABASE_URL environment variable |
| 2FA Timeout | User took too long on 2FA | Retry sign-in quickly |

## How to Play

1. **Sign In**: Click "ENTER THE ROOM" and sign in with Google
2. **Create or Join Table**: Create a new table or join an existing one
3. **Sit Down**: Click an empty seat to sit at the table
4. **Place Bet**: Enter your bet amount and click "Place Bet"
5. **Wait for Results**: Once all players bet, cards are dealt automatically
6. **Collect Winnings**: Highest card wins the pot!

## Card Values

- Ace (A) = 14 (highest)
- King (K) = 13
- Queen (Q) = 12
- Jack (J) = 11
- 10-2 = Face value

## File Structure

```
├── server.js           # Express server & Socket.io game logic
├── client.js           # Frontend client logic
├── index.html          # Game UI
├── welcome.html        # Landing page for unauthenticated users
├── styles.css          # Game styling
├── package.json        # Dependencies
├── Dockerfile          # Docker configuration
├── cloudbuild.yaml     # Cloud Build CI/CD configuration
├── prisma/
│   └── schema.prisma   # Database schema
└── src/
    ├── db.js           # Database operations
    ├── encryption.js   # Message encryption
    └── client-crypto.js # Client-side crypto utilities
```

## Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js 5
- **Real-time**: Socket.io 4
- **Database**: PostgreSQL + Prisma
- **Session Store**: Redis
- **Authentication**: Passport.js + Google OAuth 2.0
- **Hosting**: Google Cloud Run
- **CI/CD**: Google Cloud Build

## License

MIT - Feel free to use and modify!
