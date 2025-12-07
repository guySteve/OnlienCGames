#!/bin/bash
################################################################################
# VegasCore v4.0.0 - Complete Production Deployment Script
# Region: us-central1 (Free Tier eligible)
# Memory: 512Mi | CPU: 1 | Min Instances: 0 (CRITICAL)
# Last Updated: December 7, 2024
################################################################################

set -e  # Exit immediately if any command fails

echo "=========================================="
echo "🎰 VegasCore v4.0.0 Deployment"
echo "=========================================="
echo ""

################################################################################
# STEP 1: Collect Variables
################################################################################
echo "📋 [STEP 1/6] Configuration"
echo "------------------------------------------"

# Prompt for PROJECT_ID only once
read -p "Enter your Google Cloud PROJECT_ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
  echo "❌ ERROR: PROJECT_ID cannot be empty"
  exit 1
fi

echo "✅ PROJECT_ID: $PROJECT_ID"
echo "✅ Region: us-central1"
echo "✅ Version: v4.0.0"
echo ""

################################################################################
# STEP 2: Pre-Flight & Storage Cleanup
################################################################################
echo "📋 [STEP 2/6] Pre-Flight & Storage Cleanup"
echo "------------------------------------------"

if [ -f "./setup-lifecycle-policy.sh" ]; then
  echo "✅ Found setup-lifecycle-policy.sh - running to keep storage < 5GB..."
  bash ./setup-lifecycle-policy.sh "$PROJECT_ID"
  echo "✅ Lifecycle policy applied successfully"
else
  echo "⚠️  setup-lifecycle-policy.sh not found - skipping storage cleanup"
  echo "   (Ensure your GCR storage stays under 5GB manually)"
fi
echo ""

################################################################################
# STEP 3: Database Migration
################################################################################
echo "📋 [STEP 3/6] Database Migration"
echo "------------------------------------------"
echo "Running Prisma migration..."

npx prisma db push --skip-generate --accept-data-loss

echo "✅ Database schema synchronized"
echo ""

################################################################################
# STEP 4: Docker Build & Tag
################################################################################
echo "📋 [STEP 4/6] Docker Build & Tag"
echo "------------------------------------------"
echo "Building Docker image with --no-cache..."

docker build --no-cache -t vegascore:v4.0.0 .

echo "✅ Image built: vegascore:v4.0.0"
echo ""

echo "Tagging images for GCR..."
docker tag vegascore:v4.0.0 gcr.io/$PROJECT_ID/vegascore:v4.0.0
docker tag vegascore:v4.0.0 gcr.io/$PROJECT_ID/vegascore:latest

echo "✅ Tagged: gcr.io/$PROJECT_ID/vegascore:v4.0.0"
echo "✅ Tagged: gcr.io/$PROJECT_ID/vegascore:latest"
echo ""

################################################################################
# STEP 5: Push to Google Container Registry
################################################################################
echo "📋 [STEP 5/6] Push to GCR"
echo "------------------------------------------"

docker push gcr.io/$PROJECT_ID/vegascore:v4.0.0
docker push gcr.io/$PROJECT_ID/vegascore:latest

echo "✅ Images pushed to GCR"
echo ""

################################################################################
# STEP 6: Deploy to Cloud Run (FREE TIER ENFORCED)
################################################################################
echo "📋 [STEP 6/6] Deploy to Cloud Run"
echo "------------------------------------------"
echo "⚠️  ENFORCING FREE TIER LIMITS:"
echo "   - Memory: 512Mi (not 1Gi)"
echo "   - CPU: 1 (not 2)"
echo "   - Min Instances: 0 (CRITICAL - allows scale-to-zero)"
echo "   - Max Instances: 5"
echo ""

gcloud run deploy vegascore \
  --image gcr.io/$PROJECT_ID/vegascore:v4.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5

echo ""
echo "✅ Deployment complete!"
echo ""

################################################################################
# POST-DEPLOYMENT INFORMATION
################################################################################
echo "=========================================="
echo "✅ DEPLOYMENT SUCCESSFUL"
echo "=========================================="
echo ""
echo "Service URL will be displayed above by gcloud."
echo "Save this URL for verification steps below."
echo ""

################################################################################
# POST-DEPLOYMENT MANUAL VERIFICATION CHECKLIST
################################################################################
cat << 'EOF'

========================================
📋 POST-DEPLOYMENT MANUAL VERIFICATION
========================================

PHASE I - Critical API Verification
------------------------------------
□ 1. Casino Status API
     Command: curl https://YOUR_DOMAIN/api/casino-status
     Expected: { "isOpen": boolean, "msUntilOpen": number, ... }
     Result: [ ] PASS  [ ] FAIL
     Notes: _________________________________

□ 2. Biometric Login During Closed Hours
     - Access site during closed hours
     - Biometric button visible: [ ] YES  [ ] NO
     - Login successful: [ ] YES  [ ] NO

□ 3. Admin Dashboard - All Users
     Command: curl -H "Cookie: SESSION" https://YOUR_DOMAIN/api/admin/users
     Expected: Array with isOnline field
     Result: [ ] PASS  [ ] FAIL
     Online status accurate: [ ] YES  [ ] NO

□ 4. Countdown Timer Accuracy (Multi-Timezone)
     - Test from EST timezone: Time shown: __________
     - Test from PST timezone: Time shown: __________
     - Test from GMT timezone: Time shown: __________
     - Times match within 1 second: [ ] YES  [ ] NO

PHASE II - UI/UX Verification
------------------------------
□ 5. Info Modal on Mobile
     - Device: iPhone SE (375x667)
     - Open Rules modal
     - Scroll to bottom
     - No content clipping: [ ] PASS  [ ] FAIL
     - Smooth scroll: [ ] YES  [ ] NO

□ 6. Dealer Interaction
     - Click dealer avatar
     - Speech bubble appears: [ ] YES  [ ] NO
     - Voice plays (Chrome): [ ] YES  [ ] NO  [ ] N/A
     - Auto-dismiss after 3s: [ ] YES  [ ] NO

□ 7. Armed Cursor Controls
     - Open War or Blackjack game
     - Modifier buttons visible: [ ] YES  [ ] NO
     - ÷2 button works: [ ] YES  [ ] NO
     - ×2 button works: [ ] YES  [ ] NO
     - +5 and -5 work: [ ] YES  [ ] NO
     - Cursor value displayed: [ ] YES  [ ] NO

PHASE III - War Zones Features
-------------------------------
□ 8. War Zones Rendering
     - 5 zones visible: [ ] YES  [ ] NO
     - 5 spots per zone (25 total): [ ] YES  [ ] NO
     - Empty spots show dashed border: [ ] YES  [ ] NO
     - Hover effect works: [ ] YES  [ ] NO

□ 9. War Zones Betting
     - Place bet on spot 0: [ ] YES  [ ] NO
     - Place bet on spot 12: [ ] YES  [ ] NO
     - Player color shows: [ ] YES  [ ] NO
     - "YOU" indicator shows: [ ] YES  [ ] NO
     - Multiple bets work: [ ] YES  [ ] NO

□ 10. Blackjack Walk-On
      - Click empty seat + bet
      - No "must sit" error: [ ] YES  [ ] NO
      - Bet placed immediately: [ ] YES  [ ] NO

PHASE IV - New Game Features
-----------------------------
□ 11. Global Bingo Hall
      - Check server logs for startup message
      - Log contains "Global Bingo Hall is now running": [ ] YES  [ ] NO
      - User A joins Bingo
      - User B joins Bingo
      - Both users in same room: [ ] YES  [ ] NO
      - Both see same ball calls: [ ] YES  [ ] NO

□ 12. Let It Ride
      - Open game lobby
      - "Let It Ride" card visible: [ ] YES  [ ] NO
      - Click card opens game: [ ] YES  [ ] NO

PERFORMANCE CHECKS
------------------
□ 13. Response Times
      - Casino Status API: _______ ms (target: < 50ms)
      - Admin Users API: _______ ms (target: < 200ms)
      - Socket bet placement: _______ ms (target: < 100ms)

□ 14. Load Testing
      - 25 concurrent bets on War Zones: [ ] PASS  [ ] FAIL
      - 100 users in Bingo Hall: [ ] PASS  [ ] FAIL
      - No memory leaks after 1 hour: [ ] PASS  [ ] FAIL

MONITORING SETUP
----------------
□ 15. Cloud Run Logs Accessible
      Command: gcloud run services logs read vegascore --region us-central1
      Result: [ ] PASS  [ ] FAIL

□ 16. Check for Errors in First 5 Minutes
      - No error spikes: [ ] YES  [ ] NO
      - User login rate normal: [ ] YES  [ ] NO
      - Game creation rate normal: [ ] YES  [ ] NO

========================================
⚠️  ROLLBACK TRIGGER CONDITIONS
========================================

Rollback IMMEDIATELY if:
  [ ] Error rate > 5% within 15 minutes
  [ ] Admin dashboard completely broken
  [ ] Users unable to login
  [ ] Database connection failures
  [ ] Memory leak detected (> 512MB growth in 10 minutes)

Rollback Command:
  gcloud run deploy vegascore \
    --image gcr.io/PROJECT_ID/vegascore:PREVIOUS_TAG \
    --region us-central1

========================================
💰 FREE TIER COST VERIFICATION
========================================

□ Verify min-instances is 0 (allows scale-to-zero):
  gcloud run services describe vegascore --region us-central1 | grep minInstanceCount
  Expected output: minInstanceCount: 0

□ Verify memory is 512Mi:
  gcloud run services describe vegascore --region us-central1 | grep memory
  Expected output: memory: 512Mi

□ Monitor billing for first 24 hours:
  https://console.cloud.google.com/billing

========================================
✅ DEPLOYMENT CHECKLIST COMPLETE
========================================

Next Steps:
1. Complete all verification checks above
2. Monitor Cloud Run logs for 1 hour
3. Review billing dashboard after 24 hours
4. Update team on deployment status

Version: v4.0.0
Region: us-central1
Date: December 7, 2024
EOF

echo ""
echo "=========================================="
echo "🎉 Deployment script finished!"
echo "=========================================="
