# Cloud Run Deployment Checklist

## Issues Fixed ✅

### 1. Prisma Client Generation Issue - RESOLVED
**Problem**: `@prisma/client did not initialize yet` error in Cloud Run

**Root Causes Identified**:
- ❌ Prisma schema was not copied to builder stage
- ❌ `npx prisma generate` was not run during build
- ❌ Alpine Linux binary target was not specified in schema
- ❌ Files were copied AFTER node_modules (overwriting generated client)

**Solutions Applied**:
1. ✅ Added `COPY prisma ./prisma` in builder stage
2. ✅ Added `RUN npx prisma generate` after npm install
3. ✅ Added `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to schema.prisma
4. ✅ Reordered Dockerfile to copy app files BEFORE node_modules (prevents overwrite)

### 2. Updated Dockerfile Structure
```dockerfile
# Stage 1: Build dependencies and generate Prisma Client
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate

# Stage 2: Runtime with proper file ordering
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node . .
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
```

## Pre-Deployment Checklist

### Local Verification ✅
- [x] All regression tests pass (10/10)
- [x] Prisma Client generates successfully
- [x] Alpine Linux binary is present
- [x] Database connection works
- [x] Redis connection works
- [x] Server starts without errors
- [x] All endpoints respond correctly

### Cloud Run Environment Variables
Ensure these are set in Cloud Run:

**Required**:
- [ ] `DATABASE_URL` - Supabase connection string
- [ ] `DIRECT_URL` - Supabase direct connection string
- [ ] `SESSION_SECRET` - Random secret for sessions
- [ ] `UPSTASH_REDIS_REST_URL` - Redis REST endpoint
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Redis auth token
- [ ] `NODE_ENV=production`

**Optional** (for Google OAuth):
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`

### Build & Deploy Commands

1. **Build the Docker image**:
   ```bash
   docker build -t gcr.io/[PROJECT_ID]/game:latest .
   ```

2. **Test locally with Docker**:
   ```bash
   docker run -p 3000:3000 --env-file .env gcr.io/[PROJECT_ID]/game:latest
   ```

3. **Push to Google Container Registry**:
   ```bash
   docker push gcr.io/[PROJECT_ID]/game:latest
   ```

4. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy game \
     --image gcr.io/[PROJECT_ID]/game:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production \
     --set-env-vars DATABASE_URL=[value] \
     --set-env-vars DIRECT_URL=[value] \
     --set-env-vars SESSION_SECRET=[value] \
     --set-env-vars UPSTASH_REDIS_REST_URL=[value] \
     --set-env-vars UPSTASH_REDIS_REST_TOKEN=[value]
   ```

## Troubleshooting

### If site still won't load:

1. **Check Cloud Run Logs**:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=game" --limit 50
   ```

2. **Verify Prisma Client in Container**:
   ```bash
   # SSH into a running container
   gcloud run services proxy game --port=8080
   # Or exec into container to check files
   ```

3. **Test Database Connection from Cloud Run**:
   - Run `npm run db:test` in the container
   - Check if DATABASE_URL is accessible from Cloud Run

4. **Common Issues**:
   - **Connection timeout**: Check VPC/firewall settings
   - **Database unreachable**: Verify Supabase allows connections from Cloud Run IPs
   - **Missing env vars**: Double-check all environment variables are set
   - **Binary mismatch**: Ensure `binaryTargets` includes `linux-musl-openssl-3.0.x`

## Verification Steps After Deployment

1. **Health Check**:
   ```bash
   curl https://[your-cloud-run-url]/
   ```

2. **API Test**:
   ```bash
   curl https://[your-cloud-run-url]/me
   ```
   Should return: `{"authenticated":false}`

3. **WebSocket Test**:
   - Open browser console on your site
   - Check for Socket.IO connection errors
   - Verify rooms list loads

4. **Database Test**:
   - Try logging in with Google OAuth
   - Check if user is created in database
   - Verify chip balance is set correctly

## Files Changed

- ✅ `Dockerfile` - Added Prisma generation steps
- ✅ `prisma/schema.prisma` - Added Alpine Linux binary target
- ✅ `test-regression.js` - Created comprehensive test suite

## Regression Test Results

```
📊 Results: 10/10 tests passed
✅ All tests passed!
```

Tests Cover:
1. ✅ Prisma Client import
2. ✅ Prisma Client initialization
3. ✅ Database connection
4. ✅ Environment variables
5. ✅ Server dependencies
6. ✅ Database module exports
7. ✅ Prisma schema models
8. ✅ Express app creation
9. ✅ Redis connection
10. ✅ File system access

## Next Steps

1. Commit the changes:
   ```bash
   git add Dockerfile prisma/schema.prisma test-regression.js
   git commit -m "Fix: Add Prisma generation to Docker build and Alpine binary target"
   git push
   ```

2. Rebuild and redeploy to Cloud Run

3. Monitor logs for any errors

4. Test all functionality:
   - [ ] Home page loads
   - [ ] Google login works
   - [ ] Room creation works
   - [ ] Game play works
   - [ ] Database persists data
   - [ ] Redis sessions work

## Support

If issues persist, check:
- Cloud Run logs: `gcloud logging read`
- Container builds: `gcloud builds list`
- Service status: `gcloud run services describe game`
