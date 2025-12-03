# Docker Rebuild Instructions

## Issue Fixed: OpenSSL Missing
The Dockerfile has been updated to include OpenSSL in both build and runtime stages to fix the Prisma error.

## Steps to Force Rebuild

### Option 1: Manual Commands (Windows)

1. **Start Docker Desktop**
   - Make sure Docker Desktop is running

2. **Open PowerShell in this directory**
   ```powershell
   cd C:\Users\smmoh\OneDrive\Documents\GitHub\Game
   ```

3. **Set your GCP Project ID**
   ```powershell
   $PROJECT_ID = "your-project-id"
   ```

4. **Clean rebuild (no cache)**
   ```powershell
   docker build --no-cache -t gcr.io/$PROJECT_ID/game:latest .
   ```

5. **Push to GCR**
   ```powershell
   docker push gcr.io/$PROJECT_ID/game:latest
   ```

6. **Deploy to Cloud Run**
   ```powershell
   gcloud run deploy game `
     --image gcr.io/$PROJECT_ID/game:latest `
     --platform managed `
     --region us-central1 `
     --allow-unauthenticated `
     --memory 512Mi `
     --cpu 1 `
     --timeout 300 `
     --set-env-vars NODE_ENV=production,DATABASE_URL="your-url",DIRECT_URL="your-url",SESSION_SECRET="your-secret",UPSTASH_REDIS_REST_URL="your-url",UPSTASH_REDIS_REST_TOKEN="your-token"
   ```

### Option 2: Use the Script

**Windows (PowerShell):**
```powershell
.\rebuild-docker.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x rebuild-docker.sh
./rebuild-docker.sh
```

## What Changed in Dockerfile

### Build Stage (Line 13):
```dockerfile
RUN apk add --no-cache openssl
```

### Runtime Stage (Line 27):
```dockerfile
RUN apk add --no-cache openssl
```

This ensures the required `libssl.so.1.1` library is available for Prisma's query engine.

## Verification Checklist

After rebuild and deploy:

- [ ] Docker build completes without errors
- [ ] Image pushed to gcr.io successfully
- [ ] Cloud Run deployment successful
- [ ] Check Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision" --limit 20`
- [ ] No more "libssl.so.1.1: No such file or directory" errors
- [ ] Prisma Client initializes correctly
- [ ] Database connections work

## Troubleshooting

### "Docker is not running"
- Start Docker Desktop application
- Wait for it to fully start (whale icon in system tray)
- Run the script again

### "Cannot push to gcr.io"
```powershell
gcloud auth configure-docker
```

### "Permission denied" (Linux/Mac)
```bash
sudo chmod +x rebuild-docker.sh
```

### Still seeing OpenSSL errors?
1. Verify the Dockerfile has both OpenSSL install lines
2. Make sure you did `--no-cache` build
3. Check Cloud Run is using the new image (check timestamp)
4. View logs: `gcloud run services describe game --region us-central1`

## Current Dockerfile Structure

```dockerfile
# Build Stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
RUN apk add --no-cache openssl          # ← ADDED
COPY prisma ./prisma
RUN npx prisma generate

# Runtime Stage
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl          # ← ADDED
ENV NODE_ENV=production
COPY --chown=node:node . .
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "server.js"]
```

## Environment Variables Required

Make sure these are set in Cloud Run:

- `NODE_ENV=production`
- `DATABASE_URL` (Supabase connection)
- `DIRECT_URL` (Supabase direct connection)
- `SESSION_SECRET` (random secret)
- `UPSTASH_REDIS_REST_URL` (Redis endpoint)
- `UPSTASH_REDIS_REST_TOKEN` (Redis token)

Optional:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
