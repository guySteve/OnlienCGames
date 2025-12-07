#!/bin/bash
################################################################################
# Deploy to existing moes-casino service - VegasCore 5.0
################################################################################

set -e

PROJECT_ID="onlinecgames"
SERVICE_NAME="moes-casino"
VERSION="v5.0.0"

echo "=========================================="
echo "🎰 VegasCore 5.0 - Organic Luxury Deployment"
echo "=========================================="
echo "🚀 Deploying to: $SERVICE_NAME"
echo "📦 Version: $VERSION"
echo ""

gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/vegascore:$VERSION \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --project $PROJECT_ID

echo ""
echo "✅ VegasCore 5.0 Deployment Complete!"
echo "🎨 Organic Luxury design system active"
echo "🏛️ Social 2.0 features live"
