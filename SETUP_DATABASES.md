# VegasCore Database Setup Guide

## Current Status
❌ Docker is not installed on your system  
❌ PostgreSQL not available  
❌ Redis not available

---

## Setup Options

### **Option 1: Docker Desktop (Recommended for Development)**

**Pros:** Easy, isolated, cross-platform  
**Cons:** Requires Docker Desktop installation

#### Step 1: Install Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop/
2. Install Docker Desktop for Windows
3. Restart your computer
4. Verify installation:
   ```powershell
   docker --version
   docker-compose --version
   ```

#### Step 2: Create docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: vegascore-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: dev_password_change_me
      POSTGRES_DB: vegascore
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: vegascore-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### Step 3: Start Containers
```powershell
docker-compose up -d
```

#### Step 4: Verify Running
```powershell
docker ps
# Should show 2 containers: vegascore-db and vegascore-redis
```

#### Step 5: Configure .env
```env
DATABASE_URL="postgresql://postgres:dev_password_change_me@localhost:5432/vegascore?schema=public"
REDIS_URL="redis://localhost:6379"
```

---

### **Option 2: Windows Native Installation**

**Pros:** No Docker needed, runs as Windows service  
**Cons:** More manual setup, harder to clean up

#### PostgreSQL Installation

1. **Download PostgreSQL 15+**
   - Visit: https://www.postgresql.org/download/windows/
   - Download the installer (EDB installer recommended)
   - Run installer

2. **Installation Steps:**
   - Choose installation directory (default: `C:\Program Files\PostgreSQL\15`)
   - Select components: PostgreSQL Server, pgAdmin 4, Command Line Tools
   - Set port: `5432` (default)
   - Set superuser password: **Remember this password!**
   - Set locale: Default
   - Complete installation

3. **Create Database:**
   ```powershell
   # Open PowerShell as Administrator
   cd "C:\Program Files\PostgreSQL\15\bin"
   
   # Connect to PostgreSQL
   .\psql -U postgres
   
   # Create database
   CREATE DATABASE vegascore;
   
   # Exit
   \q
   ```

4. **Update .env:**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/vegascore?schema=public"
   ```

#### Redis Installation

1. **Download Redis for Windows**
   - Visit: https://github.com/tporadowski/redis/releases
   - Download latest `.msi` file (e.g., `Redis-x64-5.0.14.1.msi`)
   - Run installer

2. **Installation Steps:**
   - Choose installation directory
   - Port: `6379` (default)
   - Check "Add to PATH"
   - Complete installation

3. **Start Redis Service:**
   ```powershell
   # Start Redis server
   redis-server
   
   # Or install as Windows service
   redis-server --service-install
   redis-server --service-start
   ```

4. **Verify Redis:**
   ```powershell
   redis-cli ping
   # Should return: PONG
   ```

5. **Update .env:**
   ```env
   REDIS_URL="redis://localhost:6379"
   ```

---

### **Option 3: Cloud Services (Free Tiers)**

**Pros:** No local installation, production-ready  
**Cons:** Requires internet connection

#### PostgreSQL - Supabase (Free)

1. Visit: https://supabase.com/
2. Sign up for free account
3. Create new project
4. Get connection string from Settings → Database
5. Update .env:
   ```env
   DATABASE_URL="postgresql://postgres.xxx:password@xxx.supabase.co:5432/postgres"
   ```

#### Redis - Upstash (Free)

1. Visit: https://upstash.com/
2. Sign up for free account
3. Create new Redis database
4. Copy connection string
5. Update .env:
   ```env
   REDIS_URL="rediss://:password@xxx.upstash.io:6379"
   ```

---

### **Option 4: Cloud Development Environment**

Use GitHub Codespaces or Gitpod for instant setup:

#### GitHub Codespaces
1. Push code to GitHub
2. Open repository in Codespaces
3. Docker is pre-installed
4. Run: `docker-compose up -d`

#### Gitpod
1. Push code to GitHub
2. Open in Gitpod: `https://gitpod.io/#https://github.com/YOUR_REPO`
3. Docker is pre-installed
4. Run: `docker-compose up -d`

---

## Recommended Setup Path

### **For Development (Local Testing):**
```
Option 1: Docker Desktop
↓
Most isolated, easiest to clean up, industry standard
```

### **For Quick Prototyping:**
```
Option 3: Cloud Services (Supabase + Upstash)
↓
Zero local installation, production-ready from day 1
```

### **For Production:**
```
Railway.app or Render.com
↓
Automatic PostgreSQL + Redis provisioning
```

---

## Current Recommendation for You

Since Docker is not installed, I recommend **Option 3 (Cloud Services)** for immediate testing:

### Quick Start with Cloud (5 minutes):

1. **Create Supabase Account:**
   - Go to https://supabase.com/
   - Sign up (free)
   - Create project: "VegasCore"
   - Copy connection string

2. **Create Upstash Account:**
   - Go to https://upstash.com/
   - Sign up (free)
   - Create Redis database: "vegascore-redis"
   - Copy connection string

3. **Update .env:**
   ```env
   DATABASE_URL="postgresql://postgres.xxx:password@xxx.supabase.co:5432/postgres"
   REDIS_URL="rediss://:password@xxx.upstash.io:6379"
   SESSION_SECRET="your-random-32-character-secret-here"
   NODE_ENV="development"
   PORT=3000
   ```

4. **Initialize Database:**
   ```powershell
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. **Start Development Server:**
   ```powershell
   npm run dev
   ```

---

## Verification Checklist

After setup, verify everything works:

```powershell
# Test Prisma connection
npx prisma studio
# Should open browser with database GUI

# Test Redis connection (if using Upstash)
# Use their web console to verify connection

# Test server start
npm run dev
# Should start without errors
```

---

## Troubleshooting

### PostgreSQL Connection Failed
```
Error: Can't reach database server at `localhost:5432`
```

**Solutions:**
1. Check PostgreSQL is running: `Get-Service -Name postgresql*`
2. Verify port 5432 is not blocked by firewall
3. Check DATABASE_URL in .env is correct
4. Try connecting with pgAdmin to verify credentials

### Redis Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**
1. Check Redis is running: `Get-Service -Name Redis`
2. Start Redis: `redis-server` or `redis-server --service-start`
3. Verify REDIS_URL in .env is correct
4. Test with: `redis-cli ping` (should return PONG)

### Prisma Migration Failed
```
Error: P1001: Can't reach database server
```

**Solutions:**
1. Ensure PostgreSQL is running
2. Check DATABASE_URL format is correct
3. Verify database "vegascore" exists
4. Check firewall isn't blocking connection

---

## Next Steps After Setup

1. ✅ Databases running
2. ✅ .env configured
3. ✅ Run `npx prisma migrate dev --name init`
4. ✅ Run `npx prisma studio` to view database
5. ✅ Start server: `npm run dev`
6. ✅ Test at http://localhost:3000

---

## Need Help?

- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Redis Docs:** https://redis.io/docs/
- **Prisma Docs:** https://www.prisma.io/docs/
- **Docker Docs:** https://docs.docker.com/

---

**Choose your setup option and follow the steps above. Cloud services (Option 3) are the fastest path forward without installing Docker.** 🚀
