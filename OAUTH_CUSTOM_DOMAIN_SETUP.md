# OAuth Custom Domain Setup Guide

## Problem
After OAuth sign-in, users are redirected to the long Cloud Run URL instead of staying on `playwar.games`.

## Root Cause
Google OAuth is configured to redirect to your Cloud Run URL, not your custom domain.

## Solution

### Step 1: Update Google Cloud Console OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://playwar.games/auth/google/callback
   ```
5. Keep your existing Cloud Run URL as a backup:
   ```
   https://onlinecgames-XXXXX-uc.a.run.app/auth/google/callback
   ```
6. Click **Save**

### Step 2: Set Environment Variable in Cloud Run

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on your service: `onlinecgames`
3. Click **Edit & Deploy New Revision**
4. Scroll to **Variables & Secrets**
5. Add a new environment variable:
   - **Name:** `GOOGLE_CALLBACK_URL`
   - **Value:** `https://playwar.games/auth/google/callback`
6. Click **Deploy**

### Step 3: Verify Your Custom Domain

Make sure `playwar.games` is properly mapped to your Cloud Run service:

1. In Cloud Run, click on your service
2. Go to **Domain Mappings** tab
3. Ensure `playwar.games` is listed and status is "Active"
4. If not, click **Add Mapping** and follow the DNS setup instructions

### Step 4: Test the Flow

1. Visit `https://playwar.games`
2. Click "Enter the Room"
3. Complete Google sign-in
4. You should be redirected back to `https://playwar.games` (not the Cloud Run URL)

## Alternative: Allow Both Domains

If you want to support both domains temporarily:

**In `.env` (or Cloud Run environment variables):**
```bash
# Don't set GOOGLE_CALLBACK_URL - let it auto-detect
# This way it works on both playwar.games and Cloud Run URL
```

**In Google Console:**
```
Add both redirect URIs:
https://playwar.games/auth/google/callback
https://onlinecgames-XXXXX-uc.a.run.app/auth/google/callback
```

## Troubleshooting

### Still redirecting to Cloud Run URL?
- Clear browser cookies
- Make sure environment variable is set in Cloud Run (not just locally)
- Restart the Cloud Run service after changing env vars

### Getting "redirect_uri_mismatch" error?
- The callback URL in Google Console doesn't match your environment variable
- Double-check the exact URL (no trailing slashes, correct protocol https://)

### Session lost after redirect?
- Make sure `sameSite: 'none'` is set in server.js (already done)
- Ensure `secure: true` in production (already done)
- Check that cookies are enabled in browser

## Current Configuration

Your server.js is already configured to:
- Use `GOOGLE_CALLBACK_URL` environment variable if set
- Fall back to auto-detecting the domain if not set
- Set `sameSite: 'none'` for cross-site cookie support
- Redirect to `https://playwar.games` after successful auth

You just need to complete Steps 1 and 2 above!
