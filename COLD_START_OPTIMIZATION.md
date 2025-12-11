# Cold Start Optimization Guide

## What We Did

Added several optimizations to reduce cold start impact and prevent OAuth timeouts on Google Cloud Run with `min-instances=0`:

### 1. **OAuth Timeout Extension**
- Increased OAuth callback timeout to 30 seconds
- Gives database/Redis connections more time to initialize on cold starts

### 2. **Redis Connection Optimization**
- Added 10-second connection timeout
- Enabled keep-alive for 30 seconds
- Reduces connection failures during cold starts

### 3. **Database Connection Pooling**
- Set connection limit to 10 concurrent connections
- Reuses connections efficiently

### 4. **Health Check Endpoint**
- Added `/health` endpoint for external monitoring
- Returns `{ status: 'ok', uptime: seconds }`

## Free External Monitoring (Keeps Instance Warm)

To reduce cold starts, use a **free uptime monitoring service** to ping your `/health` endpoint:

### Option 1: UptimeRobot (Recommended - FREE)
1. Sign up at https://uptimerobot.com (free tier)
2. Create a new monitor:
   - Type: HTTP(s)
   - URL: `https://<your-domain.com>/health`
   - Interval: **5 minutes** (free tier limit)
3. This pings every 5 minutes, keeping your instance mostly warm

### Option 2: Better Uptime (FREE)
1. Sign up at https://betteruptime.com
2. Create a monitor for `https://<your-domain.com>/health`
3. Set interval to 3-5 minutes

### Option 3: Cron-Job.org (FREE)
1. Sign up at https://cron-job.org/en/
2. Create a cron job to hit `/health` every 5 minutes
3. Completely free, no limits

## Cost Impact

- **With monitoring (5-min pings):** 
  - ~288 pings/day = ~12 hours runtime/day
  - Uses ~25% of free tier (12 hrs/day * 30 days = 360 hrs)
  - **Still FREE** and prevents most cold starts!

- **Without monitoring:**
  - Only runs when users access it
  - More cold starts, but still free for casual use

## Testing Cold Start Performance

```bash
# Simulate cold start
curl https://<your-domain.com>/health

# Check OAuth flow timing
time curl -I https://<your-domain.com>/auth/google
```

## When to Upgrade to min-instances=1

Consider upgrading when:
- You have consistent daily traffic
- OAuth failures are hurting user experience
- You're ready to pay ~$27/month for zero cold starts
- You've launched and generating revenue

Until then, external monitoring + these optimizations give you ~80% of the benefit at $0 cost!
