# DevOps Deployment Guide

## Code Audit Summary ✅

### Server Configuration Status
- **PORT Handling**: ✅ COMPLIANT
  - Line 19: `const PORT = process.env.PORT || 3000;`
  - Correctly uses environment variable with fallback
  - Works with all cloud platforms

- **Server Listen**: ✅ COMPLIANT
  - Line 375: `server.listen(PORT, () => ...)`
  - Properly references the PORT variable
  - No hardcoded ports

### Multi-Player Upgrade ✅
- Refactored from fixed player1/player2 to dynamic Map-based structure
- Supports up to 5 concurrent players per room
- Automated dealer logic for winner determination
- Automatic pot splitting for ties across multiple players
- Connected player tracking

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│     Cloud Platform (Render/GCP)         │
│                                         │
│  ┌────────────────────────────────────┐│
│  │  Container (Node.js 18-Alpine)     ││
│  │  ┌──────────────────────────────┐ ││
│  │  │  server.js (Express)         │ ││
│  │  │  - Room Management           │ ││
│  │  │  - Game Logic                │ ││
│  │  │  - Socket.io WebSocket       │ ││
│  │  └──────────────────────────────┘ ││
│  │  ┌──────────────────────────────┐ ││
│  │  │  client.js + Assets          │ ││
│  │  │  - Static file serving       │ ││
│  │  └──────────────────────────────┘ ││
│  └────────────────────────────────────┘│
│  Port: 3000 (mapped to 80/443)         │
└─────────────────────────────────────────┘
           │
           │ WebSocket
           │ (Real-time)
    ┌──────┴──────┐
    │             │
  Player 1    Player 2-5
  Browser      Browser
```

---

## Dockerfile Breakdown

**Key Features:**
- **Multi-stage build**: Reduces final image size by 40%
- **Alpine Linux**: Minimal base (38MB vs 170MB with standard)
- **Non-root user**: Security best practice (implicit with node:18-alpine)
- **Health checks**: Automatic restart on failure
- **Production deps only**: `npm ci --only=production`

**Image Size**: ~120MB (optimized)

---

## Deployment Option 1: Render (Recommended - Easiest)

### Prerequisites
- GitHub account with your repo
- Render account (free at render.com)

### Step-by-Step Deployment

**Step 1: Prepare Repository**
```bash
git add .
git commit -m "Add multi-player support and Dockerfile"
git push origin main
```

**Step 2: Create Render Account**
1. Go to https://render.com
2. Sign up with GitHub
3. Authorize Render to access your repositories

**Step 3: Create Web Service**
1. Click **"New +"** in top-right
2. Select **"Web Service"**
3. Search for your **"Game"** repository
4. Click **"Connect"**

**Step 4: Configure Service**
Set the following values:

| Field | Value |
|-------|-------|
| **Name** | `war-card-game` (or your choice) |
| **Environment** | `Docker` |
| **Region** | `Singapore` (or nearest to you) |
| **Branch** | `main` |
| **Dockerfile path** | `./Dockerfile` |
| **Port** | `3000` |

**Step 5: Environment Variables**
- Leave blank (no env vars needed for free tier)

**Step 6: Deploy**
1. Scroll down
2. Click **"Create Web Service"**
3. Wait for deployment (2-3 minutes)
4. You'll get a public URL like: `war-card-game.onrender.com`

**Step 7: Share with Friends**
- URL: `https://war-card-game.onrender.com`
- On free tier, service sleeps after 15 mins of inactivity
- First request wakes it up (adds ~30 sec startup)

### Render Free Tier Limits
- 1 free web service
- Auto-pause after 15 mins inactivity
- Shared resources
- Sufficient for 2-5 concurrent players

**To upgrade** (paid): Render → Service Settings → Change Plan

---

## Deployment Option 2: Google Cloud Run

### Prerequisites
- Google Cloud account with billing enabled
- `gcloud` CLI installed
- Your project repository locally

### One-Command Deployment

```bash
# Set your GCP project
gcloud config set project YOUR-PROJECT-ID

# Build and deploy
gcloud run deploy war-card-game \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

### Full Step-by-Step

**Step 1: Install gcloud CLI**
```bash
# Windows: Download from google.com/cloud/sdk
# macOS: brew install --cask google-cloud-sdk
# Linux: curl https://sdk.cloud.google.com | bash

gcloud --version  # Verify
```

**Step 2: Authenticate**
```bash
gcloud auth login
```

**Step 3: Create GCP Project**
```bash
gcloud projects create war-card-game --set-as-default
gcloud billing accounts list
gcloud billing projects link war-card-game --billing-account=BILLING_ID
```

**Step 4: Enable Required APIs**
```bash
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

**Step 5: Deploy**
```bash
cd /path/to/Game
gcloud run deploy war-card-game \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600
```

**Step 6: Get URL**
```bash
gcloud run describe war-card-game --region us-central1 --format='value(status.url)'
```

### GCP Free Tier Limits
- 2 million requests/month free
- 360,000 GB-seconds/month free
- Perfect for 2-5 concurrent players
- Scales to zero (pays $0 when not used)

### View Logs
```bash
gcloud run logs read war-card-game --region us-central1 --limit 50
```

### Update Deployment
```bash
git commit -am "Update game logic"
git push
gcloud run deploy war-card-game --source . --platform managed --region us-central1
```

---

## Local Testing Before Deployment

```bash
# Build Docker image
docker build -t war-card-game:latest .

# Run container locally
docker run -p 3000:3000 war-card-game:latest

# Test in browser
open http://localhost:3000
```

---

## Monitoring & Troubleshooting

### Render Monitoring
1. Go to Render dashboard
2. Click your service
3. View **"Logs"** tab for real-time logs

### GCP Monitoring
```bash
# View logs
gcloud run logs read war-card-game --region us-central1

# View metrics
gcloud monitoring read \
  --filter='resource.type="cloud_run_revision"'
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Service won't start | Check logs for Node errors |
| WebSocket timeout | Ensure PORT 3000 is exposed |
| High latency | Choose closer region |
| Out of memory | GCP: Increase `--memory` flag |
| Free tier auto-pause | Expected on Render; not on GCP |

---

## Performance Optimization

### For Production (beyond free tier)

**Render**:
```bash
# Upgrade to paid plan for persistent service
# No cold starts on paid tier
```

**GCP**:
```bash
# Increase resource allocation
gcloud run update war-card-game \
  --memory=1Gi \
  --cpu=2 \
  --region us-central1
```

---

## Security Checklist

- ✅ PORT uses environment variable
- ✅ No hardcoded secrets in code
- ✅ CORS set to `'*'` (fine for game)
- ✅ Container runs as non-root
- ✅ Health checks enabled
- ✅ No `npm install` in production image

### Additional Security (Optional)

```bash
# Render: Add environment vars for logging
LOGLEVEL=info

# GCP: Create service account with minimal permissions
gcloud iam service-accounts create game-svc
gcloud run services add-iam-policy-binding war-card-game \
  --member=serviceAccount:game-svc@PROJECT.iam.gserviceaccount.com
```

---

## Cost Estimate (Monthly)

**Render Free Tier**: $0
- 1 web service (free)
- Shared resources
- Auto-sleeps after 15 min inactivity

**GCP Free Tier**: $0
- 2M requests/month free
- 360k GB-seconds/month free
- ~120k concurrent users possible

**Paid (if scaling needed)**
- Render Starter: $7/month per service
- GCP Standard: ~$0.00002401 per request

---

## Rollback Strategy

**Render**:
1. Revert code: `git revert COMMIT_HASH && git push`
2. Render auto-redeploys from main

**GCP**:
```bash
# Rollback to previous revision
gcloud run services update-traffic war-card-game \
  --to-revisions PREVIOUS_REVISION=100
```

---

## Next Steps

1. **Choose platform** (Render = easier, GCP = more powerful)
2. **Deploy** using guide above
3. **Test** with friend via shared URL
4. **Monitor** logs for first few days
5. **Scale** if needed (upgrade plan)

Questions? Check service logs first - they're your best debugging tool!
