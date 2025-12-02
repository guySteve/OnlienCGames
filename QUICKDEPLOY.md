# Quick Deployment Cheatsheet

## 30-Second Deploy to Render

```
1. Push code to GitHub: git push origin main
2. Go to render.com → New Web Service
3. Select GitHub repo → Connect
4. Name: war-card-game
5. Environment: Docker
6. Click "Create Web Service"
7. Wait 2-3 min → Get URL
```

---

## 5-Minute Deploy to Google Cloud Run

```bash
gcloud run deploy war-card-game \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

---

## Code Audit Results

| Check | Status | Detail |
|-------|--------|--------|
| PORT variable | ✅ PASS | `const PORT = process.env.PORT \|\| 3000` |
| Server listen | ✅ PASS | `server.listen(PORT, ...)` |
| Multi-player | ✅ PASS | Updated for 5 players max |
| Cloud-ready | ✅ PASS | No hardcoded ports/paths |

---

## Container Specs

```dockerfile
Base Image:  node:18-alpine
Final Size:  ~120MB
Entry Point: node server.js
Port:        3000
Health:      Enabled
Optimization: Multi-stage build
```

---

## Test Locally

```bash
docker build -t war-card-game .
docker run -p 3000:3000 war-card-game
# Open http://localhost:3000
```

---

## Share Game

1. Deploy → Get URL
2. Friend visits URL
3. Both create/join game room
4. Play!

---

## Monitor Logs

**Render**: Service → Logs tab

**GCP**: 
```bash
gcloud run logs read war-card-game --region us-central1
```

---

## Free Tier Comparison

| | Render | GCP Run |
|---|--------|---------|
| Cost | $0 | $0 |
| Services | 1 free | Many free |
| Auto-pause | After 15 min | Never |
| Startup | Cold (30s) | Fast (<1s) |
| Best for | Learning | Production |

---

**Choose Render for simplicity, GCP for power.**
Both are free. Pick one and deploy! 🚀
