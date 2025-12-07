# VegasCore Overhaul - Production Deployment Checklist

**Target Deployment Date**: _______________  
**Deployed By**: _______________  
**Environment**: Production

---

## Pre-Deployment (1 Week Before)

### Code Review
- [ ] All 8 modified files reviewed by senior developer
- [ ] New WarTableZones.jsx component tested
- [ ] No console.log statements left in production code
- [ ] Error boundaries added around new components

### Testing
- [ ] All 10 issues manually tested in staging
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Timezone testing (EST, PST, GMT, JST, IST)
- [ ] Load testing: 50+ concurrent users on War Zones
- [ ] Load testing: 100+ users in Global Bingo Hall

### Documentation
- [ ] `VEGASCORE_COMPLETE_OVERHAUL_SUMMARY.md` reviewed
- [ ] `QUICK_START_OVERHAUL.md` shared with team
- [ ] `ARCHITECTURE_DIAGRAM.md` distributed
- [ ] API endpoint changes documented
- [ ] Socket event changes documented

---

## Day Before Deployment

### Backup
- [ ] Database backup created and verified
- [ ] Redis data exported (if applicable)
- [ ] Previous Docker image tagged and saved
- [ ] Environment variables backed up
- [ ] `.env` file saved securely

### Communication
- [ ] Users notified of upcoming deployment (if downtime expected)
- [ ] Maintenance window scheduled (if needed)
- [ ] Support team briefed on new features
- [ ] Rollback plan documented and reviewed

### Infrastructure
- [ ] Cloud Run service quota checked (concurrent instances)
- [ ] Database connection pool settings verified
- [ ] Redis/Upstash capacity confirmed
- [ ] CDN cache invalidation plan ready
- [ ] SSL certificates valid and not expiring soon

---

## Deployment Day - Pre-Deploy

### Build & Test
- [ ] `npm install` completed successfully
- [ ] `npm run build:ts` compiles without errors
- [ ] `npm run test:all` passes
- [ ] Docker image builds successfully
- [ ] Docker image tested locally

### Environment Variables
- [ ] `DATABASE_URL` confirmed (production database)
- [ ] `REDIS_URL` or `UPSTASH_REDIS_REST_URL` confirmed
- [ ] `SESSION_SECRET` is strong and unique
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set
- [ ] `NODE_ENV=production` set
- [ ] `PORT` configured correctly

### Database
- [ ] Prisma schema is synced (`prisma db push` or migrations run)
- [ ] No pending migrations
- [ ] Database accessible from deployment environment
- [ ] Connection pool size appropriate (10-20 connections)

---

## Deployment Execution

### 1. Build Docker Image
```bash
□ docker build -t vegascore:v4.0.0 .
□ docker tag vegascore:v4.0.0 gcr.io/PROJECT_ID/vegascore:v4.0.0
□ docker push gcr.io/PROJECT_ID/vegascore:v4.0.0
```

### 2. Deploy to Cloud Run
```bash
□ gcloud run deploy vegascore \
    --image gcr.io/PROJECT_ID/vegascore:v4.0.0 \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 2 \
    --max-instances 10 \
    --min-instances 1
```

### 3. Verify Deployment
```bash
□ Service URL obtained: ___________________________
□ Health endpoint responds: curl https://URL/health
□ Expected: { status: 'ok', timestamp: ... }
```

### 4. Clear Caches
```bash
□ Redis cache flushed (if needed): redis-cli FLUSHDB
□ Browser cache invalidation notice sent to users
```

---

## Post-Deployment Verification (Critical Path)

### Phase I Verification
- [ ] **Casino Status API**
  ```bash
  curl https://YOUR_DOMAIN/api/casino-status
  # Expected: { isOpen: boolean, msUntilOpen: number, ... }
  ```
  Result: ✅ / ❌  Notes: _______________

- [ ] **Biometric Login During Closed Hours**
  - Access site during closed hours
  - Biometric button visible: ✅ / ❌
  - Login successful: ✅ / ❌

- [ ] **Admin Dashboard - All Users**
  ```bash
  curl -H "Cookie: SESSION" https://YOUR_DOMAIN/api/admin/users
  # Expected: Array of all users with isOnline field
  ```
  Result: ✅ / ❌  Online status accurate: ✅ / ❌

- [ ] **Countdown Timer Accuracy**
  - Open from EST timezone: Time shown: _______________
  - Open from PST timezone: Time shown: _______________
  - Open from GMT timezone: Time shown: _______________
  - Times match within 1 second: ✅ / ❌

### Phase II Verification
- [ ] **Info Modal on Mobile**
  - Device: iPhone SE (375x667)
  - Open Rules modal
  - Scroll to bottom
  - No content clipping: ✅ / ❌
  - Smooth scroll: ✅ / ❌

- [ ] **Dealer Interaction**
  - Click dealer avatar
  - Speech bubble appears: ✅ / ❌
  - Voice plays (Chrome): ✅ / ❌ / N/A
  - Auto-dismiss after 3s: ✅ / ❌

- [ ] **Armed Cursor Controls**
  - War or Blackjack game
  - Modifier buttons visible: ✅ / ❌
  - ÷2 button works: ✅ / ❌
  - ×2 button works: ✅ / ❌
  - +5 and -5 work: ✅ / ❌
  - Cursor value displayed: ✅ / ❌

### Phase III Verification
- [ ] **War Zones Rendering**
  - 5 zones visible: ✅ / ❌
  - 5 spots per zone (25 total): ✅ / ❌
  - Empty spots show dashed border: ✅ / ❌
  - Hover effect works: ✅ / ❌

- [ ] **War Zones Betting**
  - Place bet on spot 0: ✅ / ❌
  - Place bet on spot 12: ✅ / ❌
  - Player color shows: ✅ / ❌
  - "YOU" indicator shows: ✅ / ❌
  - Multiple bets work: ✅ / ❌

- [ ] **Blackjack Walk-On**
  - Click empty seat + bet
  - No "must sit" error: ✅ / ❌
  - Bet placed immediately: ✅ / ❌

### Phase IV Verification
- [ ] **Global Bingo Hall**
  - Check server logs for startup message
  - Log contains "Global Bingo Hall is now running": ✅ / ❌
  - User A joins Bingo
  - User B joins Bingo
  - Both users in same room: ✅ / ❌
  - Both see same ball calls: ✅ / ❌

- [ ] **Let It Ride**
  - Open game lobby
  - "Let It Ride" card visible: ✅ / ❌
  - Click card opens game: ✅ / ❌

---

## Performance Verification

### Response Times
- [ ] Casino Status API: _____ ms (target: < 50ms)
- [ ] Admin Users API: _____ ms (target: < 200ms)
- [ ] Socket bet placement: _____ ms (target: < 100ms)

### Load Testing
- [ ] 25 concurrent bets on War Zones: ✅ / ❌
- [ ] 100 users in Bingo Hall: ✅ / ❌
- [ ] No memory leaks after 1 hour: ✅ / ❌

### Database
- [ ] Connection pool not exhausted
- [ ] Query response times < 100ms
- [ ] No connection errors in logs

---

## Monitoring Setup

### Logs
- [ ] Cloud Run logs accessible
- [ ] Error tracking enabled (Sentry/similar)
- [ ] Log retention period set (30 days minimum)

### Alerts
- [ ] High error rate alert configured
- [ ] Memory usage alert (> 80%)
- [ ] CPU usage alert (> 80%)
- [ ] Database connection pool alert

### Dashboards
- [ ] Real-time user count dashboard
- [ ] Game type distribution chart
- [ ] Error rate over time graph
- [ ] Response time histogram

---

## Rollback Plan (If Issues Found)

### Trigger Conditions
Rollback immediately if:
- [ ] Error rate > 5% within 15 minutes
- [ ] Admin dashboard completely broken
- [ ] Users unable to login
- [ ] Database connection failures
- [ ] Memory leak detected (> 1GB growth in 10 minutes)

### Rollback Steps
1. [ ] Identify previous stable image tag: _______________
2. [ ] Deploy previous image:
   ```bash
   gcloud run deploy vegascore \
     --image gcr.io/PROJECT_ID/vegascore:PREVIOUS_TAG
   ```
3. [ ] Verify previous version is running
4. [ ] Clear Redis cache
5. [ ] Notify users of rollback
6. [ ] Document issues encountered

### Post-Rollback
- [ ] Root cause analysis scheduled
- [ ] Bugs logged with reproduction steps
- [ ] Fix timeline established
- [ ] Re-deployment date set

---

## Communication

### Success Communication
- [ ] Team notified of successful deployment
- [ ] Users notified of new features (via in-app message or email)
- [ ] Documentation portal updated
- [ ] Social media announcement (if applicable)

### Issue Communication
- [ ] Support team notified of known issues
- [ ] Users notified of degraded performance (if any)
- [ ] Status page updated (if applicable)
- [ ] ETA for fixes provided

---

## Post-Deployment Monitoring (First 24 Hours)

### Hour 1
- [ ] No error spikes in logs
- [ ] User login rate normal
- [ ] Game creation rate normal
- [ ] Database performance stable

### Hour 6
- [ ] No memory growth trend
- [ ] Response times consistent
- [ ] User feedback reviewed (support tickets)
- [ ] No critical bugs reported

### Hour 24
- [ ] All metrics stable
- [ ] User engagement metrics reviewed
- [ ] Feature adoption tracked (War Zones usage, Bingo Hall joins)
- [ ] Performance baselines established

---

## Sign-Off

### Development Team
- [ ] Lead Developer: _______________  Date: _______
- [ ] QA Engineer: _______________    Date: _______
- [ ] DevOps: _______________        Date: _______

### Deployment Success
- [ ] All critical path tests passed
- [ ] No P0/P1 bugs found
- [ ] Monitoring confirmed operational
- [ ] Rollback plan ready (but not needed)

### Final Notes
```
Deployment completed at: _______________
Total downtime (if any): _______________
Issues encountered: _______________
User impact: _______________
Next steps: _______________
```

---

## Appendix: Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Lead Developer | _______________ | _______________ |
| DevOps Engineer | _______________ | _______________ |
| Database Admin | _______________ | _______________ |
| Cloud Platform Support | Google Cloud | support.google.com |

---

**Checklist Version**: 1.0  
**Last Updated**: December 7, 2024  
**Template Owner**: VegasCore Team
