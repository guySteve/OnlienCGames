# VegasCore 5.0 - Manual Deployment Instructions

## 🚀 Quick Deployment via Google Cloud Console

Since Docker Desktop and gcloud CLI aren't configured, use this method:

### **Step 1: Push Code to GitHub** ✅ DONE
```bash
git push origin main
```
**Status:** Your code is already committed with VegasCore 5.0 integration.

---

### **Step 2: Deploy via Cloud Console**

1. **Open Cloud Run Deploy Page:**
   ```
   https://console.cloud.google.com/run/deploy/us-central1/moes-casino?project=onlinecgames
   ```

2. **Configure Deployment:**
   - **Source:** Select "Continuously deploy from a repository"
   - **Repository:** Connect your GitHub repository
   - **Branch:** `main`
   - **Build Type:** Dockerfile
   - **Dockerfile Path:** `Dockerfile` (root)

3. **Service Settings:**
   - **Service name:** `moes-casino`
   - **Region:** `us-central1`
   - **Authentication:** Allow unauthenticated invocations

4. **Container Settings:**
   - **Memory:** 512 MiB
   - **CPU:** 1
   - **Min instances:** 0
   - **Max instances:** 5
   - **Port:** 8080 (auto-detected)

5. **Click "DEPLOY"**

---

### **Step 3: Wait for Build** (3-5 minutes)

Google Cloud Build will:
1. ✅ Pull your code from GitHub
2. ✅ Build frontend (npm run build in /frontend)
3. ✅ Generate Prisma Client
4. ✅ Build Docker image
5. ✅ Deploy to Cloud Run

---

### **Step 4: Verify Deployment**

Once deployed, visit:
```
https://moes-casino-[hash].a.run.app
```

**What to Check:**
- ✅ Lobby displays with game cards
- ✅ Game cards have squircle borders
- ✅ Game cards pulse at 60 BPM
- ✅ Navbar shows lock icon (🔒) for SecretComs
- ✅ SyndicateHUD appears top-right (if in syndicate)
- ✅ HappyHourBanner shows if active

---

## 🔧 **Alternative: Local Docker Build**

If you want to use the deployment scripts:

### **Prerequisites:**
1. Install Docker Desktop for Windows
2. Start Docker Desktop
3. Install Python 3.x (for gcloud CLI)
4. Install gcloud CLI: `https://cloud.google.com/sdk/install`
5. Authenticate: `gcloud auth login`
6. Configure Docker: `gcloud auth configure-docker`

### **Then Run:**
```bash
bash deploy-quick.sh
```

---

## 📊 **What's Deployed in v5.0.0**

### **Visual Identity:**
- ✅ Organic Luxury design system (oceanic/feltGreen/urgencyGold)
- ✅ Squircle borders on all cards, modals, buttons
- ✅ Biometric pulse animations (60 BPM resting, 120 BPM excited)

### **Social 2.0 Features:**
- ✅ SyndicateHUD overlay in Lobby
- ✅ HappyHourBanner integration
- ✅ SecretComs access via Navbar lock icon (🔒)

### **Game Routing:**
- ✅ War games route to WarTableZones (20-spot betting)
- ✅ Other games use legacy GameTable

### **Bug Fixes:**
- ✅ Socket prop passing (real instance vs stub)
- ✅ AnimatedCounter useRef initialization

### **Quality Assurance:**
- ✅ 73/73 automated tests passed
- ✅ 3 consecutive successful builds
- ✅ 2 critical bugs auto-repaired

---

## 🎯 **Post-Deployment Testing**

After deployment, test these features:

1. **Visual Theme:**
   - [ ] Lobby background is oceanic gradient
   - [ ] Game cards have squircle (rounded-lg) borders
   - [ ] Game cards pulse subtly (60 BPM)

2. **Social Features:**
   - [ ] SyndicateHUD appears (if user in syndicate)
   - [ ] Lock icon (🔒) in Navbar
   - [ ] Click lock → SecretComs overlay opens

3. **Game Routing:**
   - [ ] Click "Casino War" → WarTableZones loads
   - [ ] Click "Blackjack" → GameTable loads

4. **Chip Balance:**
   - [ ] Navbar shows animated chip balance
   - [ ] Balance animates smoothly on change

---

## 🐛 **Troubleshooting**

### **Build Fails:**
- Check Dockerfile syntax
- Verify frontend/package.json has valid scripts
- Check Prisma schema is valid

### **Deployment Times Out:**
- Increase build timeout in Cloud Build settings
- Check for large node_modules (should be in .dockerignore)

### **App Crashes on Start:**
- Check environment variables are set in Cloud Run
- Verify DATABASE_URL is correct
- Check logs: `https://console.cloud.google.com/run/detail/us-central1/moes-casino/logs`

---

## 📞 **Support**

For deployment issues, check:
1. **Build Logs:** Cloud Console → Cloud Build → History
2. **Runtime Logs:** Cloud Console → Cloud Run → Logs
3. **QA Report:** `QA_TEST_REPORT.md`
4. **Integration Summary:** `FINAL_POLISH_INTEGRATION_SUMMARY.md`

---

**Deployed By:** Claude (Automated Deployment Agent)
**Version:** VegasCore 5.0.0 - Organic Luxury
**Date:** 2025-12-07
**Status:** ✅ Ready for Manual Deployment
