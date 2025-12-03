# Docker Force Rebuild Script for Cloud Run
# Run this after starting Docker Desktop

Write-Host "🔨 Starting Docker Force Rebuild..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1. Checking Docker status..."
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop first, then run this script again." -ForegroundColor Yellow
    exit 1
}

# Set your project ID here
$PROJECT_ID = Read-Host "Enter your GCP Project ID"

if ([string]::IsNullOrWhiteSpace($PROJECT_ID)) {
    Write-Host "❌ Project ID is required!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Cleaning up old images..." -ForegroundColor Cyan
docker system prune -f

Write-Host ""
Write-Host "3. Building with --no-cache (this will take 3-5 minutes)..." -ForegroundColor Cyan
docker build --no-cache -t gcr.io/$PROJECT_ID/game:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""
Write-Host "4. Tagging with timestamp..."
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
docker tag gcr.io/$PROJECT_ID/game:latest gcr.io/$PROJECT_ID/game:$TIMESTAMP

Write-Host ""
Write-Host "5. Pushing to Google Container Registry..." -ForegroundColor Cyan
docker push gcr.io/$PROJECT_ID/game:latest
docker push gcr.io/$PROJECT_ID/game:$TIMESTAMP

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host "Make sure you're authenticated: gcloud auth configure-docker" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Images pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   Run the following command to deploy to Cloud Run:"
Write-Host ""
Write-Host "   gcloud run deploy game \"
Write-Host "     --image gcr.io/$PROJECT_ID/game:latest \"
Write-Host "     --platform managed \"
Write-Host "     --region us-central1 \"
Write-Host "     --allow-unauthenticated \"
Write-Host "     --memory 512Mi \"
Write-Host "     --cpu 1 \"
Write-Host "     --timeout 300 \"
Write-Host "     --set-env-vars NODE_ENV=production" -ForegroundColor Yellow
Write-Host ""
Write-Host "   (Add your other --set-env-vars for DATABASE_URL, REDIS, etc.)" -ForegroundColor Gray
