#!/bin/bash
# Docker Force Rebuild Script for Cloud Run
# Run this after starting Docker Desktop

set -e

echo "🔨 Starting Docker Force Rebuild..."
echo ""

# Check if Docker is running
echo "1. Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker Desktop is not running!"
    echo "Please start Docker Desktop first, then run this script again."
    exit 1
fi
echo "✅ Docker is running"

# Set your project ID here
read -p "Enter your GCP Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Project ID is required!"
    exit 1
fi

echo ""
echo "2. Cleaning up old images..."
docker system prune -f

echo ""
echo "3. Building with --no-cache (this will take 3-5 minutes)..."
docker build --no-cache -t gcr.io/$PROJECT_ID/game:latest .

echo ""
echo "✅ Build successful!"
echo ""
echo "4. Tagging with timestamp..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag gcr.io/$PROJECT_ID/game:latest gcr.io/$PROJECT_ID/game:$TIMESTAMP

echo ""
echo "5. Pushing to Google Container Registry..."
docker push gcr.io/$PROJECT_ID/game:latest
docker push gcr.io/$PROJECT_ID/game:$TIMESTAMP

echo ""
echo "✅ Images pushed successfully!"
echo ""
echo "📋 Next steps:"
echo "   Run the following command to deploy to Cloud Run:"
echo ""
echo "   gcloud run deploy game \\"
echo "     --image gcr.io/$PROJECT_ID/game:latest \\"
echo "     --platform managed \\"
echo "     --region us-central1 \\"
echo "     --allow-unauthenticated \\"
echo "     --memory 512Mi \\"
echo "     --cpu 1 \\"
echo "     --timeout 300 \\"
echo "     --set-env-vars NODE_ENV=production"
echo ""
echo "   "
