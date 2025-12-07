#!/bin/bash
################################################################################
# VegasCore v5.0.0 - Cloud Build Deployment (No local Docker required)
# Builds image directly in Google Cloud
################################################################################

set -e

PROJECT_ID="onlinecgames"
SERVICE_NAME="moes-casino"
VERSION="v5.0.0"
REGION="us-central1"

echo "=========================================="
echo "☁️  VegasCore 5.0 - Cloud Build Deployment"
echo "=========================================="
echo "PROJECT_ID: $PROJECT_ID"
echo "SERVICE: $SERVICE_NAME"
echo "VERSION: $VERSION"
echo "REGION: $REGION"
echo ""

################################################################################
# STEP 1: Database Migration
################################################################################
echo "📋 [STEP 1/3] Database Migration"
echo "------------------------------------------"

npx prisma db push --skip-generate --accept-data-loss

echo "✅ Database schema synchronized"
echo ""

################################################################################
# STEP 2: Build in Cloud (No local Docker needed)
################################################################################
echo "📋 [STEP 2/3] Cloud Build"
echo "------------------------------------------"
echo "Building image in Google Cloud (this takes ~3-5 minutes)..."
echo ""

gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/vegascore:$VERSION \
  --project $PROJECT_ID \
  --timeout=10m

echo ""
echo "✅ Image built in cloud and pushed to GCR"
echo ""

# Also tag as latest
gcloud container images add-tag \
  gcr.io/$PROJECT_ID/vegascore:$VERSION \
  gcr.io/$PROJECT_ID/vegascore:latest \
  --project $PROJECT_ID

echo "✅ Tagged as latest"
echo ""

################################################################################
# STEP 3: Deploy to Cloud Run
################################################################################
echo "📋 [STEP 3/3] Deploy to Cloud Run"
echo "------------------------------------------"

gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/vegascore:$VERSION \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --project $PROJECT_ID

echo ""
echo "=========================================="
echo "✅ VegasCore 5.0 Deployment Complete!"
echo "=========================================="
echo ""
echo "🎨 Organic Luxury design system: ACTIVE"
echo "🏛️ Social 2.0 features: LIVE"
echo "🔧 Circuit breaker protection: READY"
echo ""
echo "📊 Deployment Details:"
echo "   • Service: $SERVICE_NAME"
echo "   • Version: $VERSION"
echo "   • Region: $REGION"
echo "   • Memory: 512Mi"
echo "   • CPU: 1 vCPU"
echo ""
echo "🌐 Service URL:"
gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)' \
  --project $PROJECT_ID
echo ""
echo "=========================================="
