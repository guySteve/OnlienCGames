# Database Setup Guide for Moe's Card Room

## 🎯 Objective: $0/month Database Costs

**Google Cloud SQL has NO free tier**. To maintain zero infrastructure costs, we use external free-tier PostgreSQL providers.

---

## ✅ Recommended Free Tier Providers

### 1. **Supabase** (CURRENT SETUP) ⭐
- **Free Tier**: 500MB database, 2 GB bandwidth, 50,000 monthly active users
- **Features**: Built-in auth, real-time subscriptions, auto-generated REST API
- **Connection**: Pooled (pgBouncer) + Direct connections
- **Upgrade Path**: $25/mo for 8GB database

**Status**: ✅ Already configured (see `DATABASE_URL` in production)

### 2. **Neon** (Serverless Postgres)
- **Free Tier**: 3GB storage, auto-suspend after inactivity
- **Features**: Branching (git-like), instant restore, autoscaling
- **Connection**: Pooled via built-in proxy
- **Upgrade Path**: $19/mo for always-on compute

### 3. **Railway** (All-in-one platform)
- **Free Tier**: $5 free credit/month (~450 hours of database runtime)
- **Features**: One-click deploys, built-in observability
- **Connection**: Direct PostgreSQL connection
- **Upgrade Path**: Pay-as-you-go ($0.01/GB storage)

---

## 🔧 Setup Instructions

### Step 1: Choose Your Provider

**Already using Supabase?** ✅ Skip to Step 3 (verify configuration)

**Switching providers?** Follow the setup guide for your chosen platform:

#### Option A: Supabase (Recommended)
1. Go to https://supabase.com and create a free account
2. Create a new project (select region closest to `us-central1`)
3. Navigate to **Settings > Database**
4. Copy both connection strings:
   - **Pooled URL** (uses port 6543, pgBouncer) → `DATABASE_URL`
   - **Direct URL** (uses port 5432) → `DIRECT_URL`

#### Option B: Neon
1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the **Pooled connection string** → `DATABASE_URL`
4. Copy the **Direct connection string** → `DIRECT_URL`

#### Option C: Railway
1. Install Railway CLI: `npm i -g @railway/cli`
2. Run `railway login` and `railway init`
3. Add PostgreSQL plugin: `railway add postgresql`
4. Get connection string: `railway variables get DATABASE_URL`

---

### Step 2: Configure Cloud Run Environment Variables

Set the database URLs as Cloud Run secrets:

```bash
# Set the pooled connection (for app runtime)
gcloud run services update moes-casino \
  --region=us-central1 \
  --update-env-vars=DATABASE_URL="postgresql://user:password@host:6543/database?pgbouncer=true"

# Set the direct connection (for migrations only)
gcloud run services update moes-casino \
  --region=us-central1 \
  --update-env-vars=DIRECT_URL="postgresql://user:password@host:5432/database"
```

**🔒 Security Best Practice**: Use Google Secret Manager instead of env vars:

```bash
# Store DATABASE_URL as a secret
echo -n "postgresql://user:pass@host:6543/db" | \
  gcloud secrets create DATABASE_URL --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to use the secret
gcloud run services update moes-casino \
  --region=us-central1 \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest
```

---

### Step 3: Verify Configuration

Check that your `prisma/schema.prisma` is correctly configured:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")    // Pooled connection (pgBouncer)
  // directUrl is used for migrations only
}

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

**Why two URLs?**
- `DATABASE_URL`: Pooled connection for app runtime (handles 1000+ concurrent requests)
- `DIRECT_URL`: Direct connection for migrations (avoids pgBouncer limitations)

---

### Step 4: Run Database Migrations

#### Local Development
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate deploy
```

#### Production (Cloud Run)
Migrations run automatically on deployment via `start.sh`:
```bash
#!/bin/sh
npx prisma migrate deploy  # Auto-apply pending migrations
exec node server.js        # Start server
```

---

## 📊 Database Schema Overview

**25+ Tables** including:
- **User** (160 fields) - OAuth, chips, XP, VIP tiers, streaks
- **GameSession** - Game history with Provably Fair seeds
- **Transaction** - Complete audit trail of chip movements
- **Syndicate** - Guild/team system with treasury
- **ChatMessage** - Social features with auto-moderation
- **HappyHourSchedule** - Random bonus events

**See full schema**: `prisma/schema.prisma`

---

## 🔍 Monitoring Database Usage

### Supabase Dashboard
- Navigate to **Database > Usage**
- Monitor: Storage, Bandwidth, Active connections
- Set up alerts at 80% capacity

### CLI Monitoring
```bash
# Check database size
npx prisma db execute --stdin <<SQL
SELECT pg_size_pretty(pg_database_size(current_database()));
SQL

# Check table sizes
npx prisma db execute --stdin <<SQL
SELECT
  schemaname AS schema,
  tablename AS table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
SQL
```

---

## 🚨 Staying Within Free Tier Limits

### Supabase Free Tier (500MB)
- **Current usage**: ~50MB (schema only)
- **Projected usage**: 300MB at 10,000 users
- **Safety margin**: 200MB buffer

**Optimization Strategies**:
1. **Archive old sessions**: Delete `GameSession` records older than 90 days
2. **Compress chat**: Delete `ChatMessage` records older than 30 days
3. **Paginate queries**: Use `take` and `skip` to limit result sets
4. **Index wisely**: Only index frequently queried columns

### Auto-Cleanup Jobs
Enable these in production to prevent database bloat:

```javascript
// Add to server.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Run daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  // Delete game sessions older than 90 days
  await prisma.gameSession.deleteMany({
    where: {
      createdAt: {
        lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
    }
  });

  // Delete chat messages older than 30 days
  await prisma.chatMessage.deleteMany({
    where: {
      timestamp: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  console.log('Database cleanup completed');
});
```

---

## 🔄 Migration Guide (Switching Providers)

### Export from Supabase
```bash
# Using pg_dump
pg_dump "postgresql://user:pass@host:5432/db" > backup.sql
```

### Import to New Provider
```bash
# Neon
psql "postgresql://user:pass@new-host:5432/db" < backup.sql

# Railway
railway run psql < backup.sql
```

---

## 🆘 Troubleshooting

### Error: "Too many connections"
**Cause**: Exceeded connection pool limit
**Fix**: Use `DATABASE_URL` with pgBouncer enabled (port 6543)

### Error: "Migration failed"
**Cause**: Using pooled connection for migrations
**Fix**: Ensure `DIRECT_URL` is set and uses port 5432

### Error: "SSL connection required"
**Cause**: Missing `?sslmode=require` in connection string
**Fix**: Add `?sslmode=require` to both URLs

### Error: "Database does not exist"
**Cause**: Connection string points to wrong database
**Fix**: Verify database name matches your provider's dashboard

---

## 📚 Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Railway Docs](https://docs.railway.app)
- [Prisma Connection Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

---

**✅ Current Status**: Moe's Card Room is configured with Supabase free tier and will remain at $0/month database costs indefinitely.
