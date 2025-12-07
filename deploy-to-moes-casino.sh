#!/bin/bash
################################################################################
# Deploy to existing moes-casino service
################################################################################

set -e

PROJECT_ID="onlinecgames"
SERVICE_NAME="moes-casino"

echo "🚀 Deploying to existing service: $SERVICE_NAME"
echo ""

gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/vegascore:v4.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --project $PROJECT_ID

echo ""
echo "✅ Deployment complete!"
