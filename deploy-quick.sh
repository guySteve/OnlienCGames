#!/bin/bash
################################################################################
# VegasCore v5.0.0 - Quick Deployment (No gcloud dependency)
# For environments where gcloud CLI is unavailable
################################################################################

set -e

PROJECT_ID="onlinecgames"
VERSION="v5.0.0"

echo "=========================================="
echo "🎰 VegasCore v5.0.0 - Organic Luxury"
echo "=========================================="
echo "PROJECT_ID: $PROJECT_ID"
echo "VERSION: $VERSION"
echo "Region: us-central1"
echo ""

################################################################################
# STEP 1: Database Migration
################################################################################
echo "📋 [STEP 1/4] Database Migration"
echo "------------------------------------------"

npx prisma db push --skip-generate --accept-data-loss

echo "✅ Database schema synchronized"
echo ""

################################################################################
# STEP 2: Docker Build & Tag
################################################################################
echo "📋 [STEP 2/4] Docker Build & Tag"
echo "------------------------------------------"

docker build --no-cache -t vegascore:$VERSION .

echo "✅ Image built"
echo ""

docker tag vegascore:$VERSION gcr.io/$PROJECT_ID/vegascore:$VERSION
docker tag vegascore:$VERSION gcr.io/$PROJECT_ID/vegascore:latest

echo "✅ Images tagged"
echo ""

################################################################################
# STEP 3: Push to GCR
################################################################################
echo "📋 [STEP 3/4] Push to GCR"
echo "------------------------------------------"

docker push gcr.io/$PROJECT_ID/vegascore:$VERSION
docker push gcr.io/$PROJECT_ID/vegascore:latest

echo "✅ Images pushed"
echo ""

################################################################################
# STEP 4: Deploy Instructions
################################################################################
echo "📋 [STEP 4/4] Deploy to Cloud Run"
echo "------------------------------------------"
echo ""
echo "⚠️  gcloud CLI requires Python. Please run this command manually:"
echo ""
echo "gcloud run deploy moes-casino \\"
echo "  --image gcr.io/$PROJECT_ID/vegascore:$VERSION \\"
echo "  --platform managed \\"
echo "  --region us-central1 \\"
echo "  --allow-unauthenticated \\"
echo "  --memory 512Mi \\"
echo "  --cpu 1 \\"
echo "  --min-instances 0 \\"
echo "  --max-instances 5"
echo ""
echo "OR use Google Cloud Console:"
echo "https://console.cloud.google.com/run/deploy/us-central1/moes-casino?project=$PROJECT_ID"
echo ""
echo "✅ VegasCore 5.0 Build Complete!"
echo "🎨 Organic Luxury design system packaged"
echo "🏛️ Social 2.0 features ready"
echo ""
