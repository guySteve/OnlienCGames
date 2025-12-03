# Setting Up Automatic Deployment

## What This Does

When you push to GitHub `main` branch, Cloud Build will automatically:
1. ✅ Build your Docker image (with `--no-cache`)
2. ✅ Push to Google Container Registry
3. ✅ Deploy to Cloud Run
4. ✅ Your site updates in ~5 minutes

## One-Time Setup Required

### Step 1: Connect GitHub to Cloud Build

1. **Go to Cloud Build Triggers**
   ```
   https://console.cloud.google.com/cloud-build/triggers
   ```

2. **Click "Connect Repository"**
   - Select "GitHub"
   - Authenticate with GitHub
   - Select your repository: `guySteve/OnlienCGames`
   - Click "Connect"

3. **Create Trigger**
   - Click "Create Trigger"
   - **Name**: `deploy-on-push`
   - **Event**: Push to a branch
   - **Source**: `^main$` (or `^master$` if that's your default)
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Location**: `/cloudbuild.yaml`
   - Click "Create"

### Step 2: Grant Cloud Build Permissions

Cloud Build needs permission to deploy to Cloud Run:

```powershell
# Get your project number
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"

# Grant Cloud Run Admin role (replace PROJECT_NUMBER)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID `
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" `
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID `
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" `
  --role="roles/iam.serviceAccountUser"
```

### Step 3: Set Environment Variables in Cloud Run

The `cloudbuild.yaml` deploys but doesn't set environment variables (for security).

**Set these once in Cloud Run console:**

```
NODE_ENV=production
DATABASE_URL=your-supabase-url
DIRECT_URL=your-supabase-direct-url
SESSION_SECRET=your-secret
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
GOOGLE_CLIENT_ID=your-google-client-id (optional)
GOOGLE_CLIENT_SECRET=your-google-client-secret (optional)
```

**To set via command:**
```powershell
gcloud run services update game `
  --region=us-central1 `
  --update-env-vars NODE_ENV=production,DATABASE_URL="...",DIRECT_URL="...",SESSION_SECRET="...",UPSTASH_REDIS_REST_URL="...",UPSTASH_REDIS_REST_TOKEN="..."
```

## How to Use

### Normal Workflow (Auto-Deploy)

```bash
# Make changes to your code
git add .
git commit -m "Your changes"
git push origin main

# Cloud Build automatically:
# - Builds Docker image
# - Deploys to Cloud Run
# - Done in ~5 minutes!
```

### Check Build Status

**Via Console:**
```
https://console.cloud.google.com/cloud-build/builds
```

**Via CLI:**
```powershell
gcloud builds list --limit=5
```

**View Logs:**
```powershell
gcloud builds log BUILD_ID
```

### If Build Fails

1. Check logs in Cloud Build console
2. Common issues:
   - Missing permissions (see Step 2)
   - Dockerfile syntax errors
   - Missing dependencies
   - Environment variables not set

## Manual Deploy (Bypass CI/CD)

If you need to deploy manually:

```powershell
.\rebuild-docker.ps1
```

## Files Created

- ✅ `cloudbuild.yaml` - Build and deploy configuration
- ✅ `.gcloudignore` - Files to exclude from builds
- ✅ `SETUP_AUTO_DEPLOY.md` - This file

## Configuration Details

### cloudbuild.yaml Settings

- **Build timeout**: 20 minutes
- **Machine type**: N1_HIGHCPU_8 (faster builds)
- **Memory**: 512Mi for Cloud Run
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds (5 min)
- **Min instances**: 0 (scales to zero)
- **Max instances**: 10

### Customize Settings

Edit `cloudbuild.yaml` to change:
- Memory: `--memory=1Gi`
- CPU: `--cpu=2`
- Region: `--region=us-east1`
- Min instances: `--min-instances=1` (keeps warm)

## Cost Considerations

**Cloud Build Free Tier:**
- ✅ First 120 build-minutes/day FREE
- Each build takes ~3-5 minutes
- ~24-40 free builds per day

**After Free Tier:**
- $0.003 per build-minute
- ~$0.01-0.02 per deployment

**Cloud Run:**
- Free tier: 2 million requests/month
- Your deployment should stay in free tier with normal use

## Troubleshooting

### "Repository not found"
- Check GitHub connection in Cloud Build console
- Re-authenticate GitHub

### "Permission denied to deploy"
- Run the IAM commands in Step 2
- Wait 1-2 minutes for permissions to propagate

### "Build timeout"
- Increase timeout in `cloudbuild.yaml`
- Check if npm install is hanging

### "Environment variables not set"
- Set them in Cloud Run console (Step 3)
- They persist across deployments

### "Still seeing old version"
- Check build completed successfully
- Hard refresh browser (Ctrl+Shift+R)
- Check Cloud Run revision is latest

## Security Notes

- ✅ Environment variables NOT in git
- ✅ Secrets stored in Cloud Run (encrypted)
- ✅ Build logs are private to your project
- ✅ Only your GitHub account can trigger builds

## Next Steps

1. ✅ Complete Step 1: Connect GitHub
2. ✅ Complete Step 2: Grant permissions
3. ✅ Complete Step 3: Set environment variables
4. ✅ Test: Push a small change to trigger first build
5. ✅ Monitor: Watch build in console
6. ✅ Verify: Check your site updates

## Success Indicators

You'll know it's working when:
- ✅ Push to GitHub triggers build automatically
- ✅ Build completes in ~5 minutes
- ✅ Cloud Run shows new revision
- ✅ Your site shows the changes
- ✅ No manual `docker build` needed!

---

**Pro Tip**: Keep `rebuild-docker.ps1` for emergency manual deploys, but normal workflow is just `git push`!
