# 🔧 Google OAuth Setup - Fix Redirect URI Mismatch

## ❌ Current Error
```
Error 400: redirect_uri_mismatch
```

This means Google doesn't recognize the callback URL your app is using.

---

## ✅ SOLUTION: Add Callback URL to Google Cloud Console

### Step 1: Open Google Cloud Console
Link: https://console.cloud.google.com/apis/credentials?project=vegascore-441322

(Or search for "vegascore-441322" in Google Cloud Console)

### Step 2: Find Your OAuth Client
1. Click on your OAuth 2.0 Client ID (should be named something like "Web client")
2. Look for the section "Authorized redirect URIs"

### Step 3: Add These Redirect URIs

You need to add **ALL** of these (click "+ ADD URI" for each):

```
http://localhost:3000/auth/google/callback
http://127.0.0.1:3000/auth/google/callback
http://[YOUR_LOCAL_IP]:3000/auth/google/callback
```

**To find your local IP:**
```powershell
ipconfig | Select-String "IPv4"
```
Example result: `192.168.1.100` → Add `http://192.168.1.100:3000/auth/google/callback`

### Step 4: Save Changes
Click **"SAVE"** at the bottom of the page.

⚠️ **Important:** Changes can take 5-10 minutes to propagate!

---

## Quick Fix Alternative: Update Your Client ID

If you can't access the Google Cloud Console, I can help you create a new OAuth client.

### Option A: Use Existing Credentials (Recommended)
Your current credentials:
- Client ID: `212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t.apps.googleusercontent.com`
- Just need to add the redirect URIs above

### Option B: Create New OAuth Client
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: **Web application**
4. Name: `VegasCore Local Dev`
5. Authorized redirect URIs: Add all three URLs from Step 3 above
6. Click **CREATE**
7. Copy the new Client ID and Secret to `.env` file

---

## After Adding Redirect URIs

### 1. Wait 5-10 minutes for Google to update

### 2. Clear your browser cookies
```
Chrome: Settings → Privacy → Clear browsing data → Cookies (Last hour)
Edge: Settings → Privacy → Clear browsing data → Cookies (Last hour)
```

### 3. Restart your server
```powershell
# Stop server
Get-Process -Name node | Stop-Process -Force

# Start fresh
cd C:\Users\smmoh\OneDrive\Documents\GitHub\Game
node server.js
```

### 4. Try login again
```
http://localhost:3000
```

---

## Verification Checklist

Before trying to login, verify these URLs are added in Google Console:

- [ ] `http://localhost:3000/auth/google/callback`
- [ ] `http://127.0.0.1:3000/auth/google/callback`
- [ ] `http://[YOUR_IP]:3000/auth/google/callback` (if accessing from network)

---

## What Each URL Does

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/...` | Standard local development |
| `http://127.0.0.1:3000/...` | Alternative localhost notation |
| `http://192.168.x.x:3000/...` | Access from other devices on network |

---

## Expected Flow After Fix

1. ✅ Click "Login with Google" on `http://localhost:3000`
2. ✅ Redirects to Google login page
3. ✅ Select your Google account
4. ✅ See consent screen (may say "app not verified" - this is OK)
5. ✅ Click "Advanced" → "Go to [app]" if needed
6. ✅ Redirects back to `http://localhost:3000` **logged in**

---

## Still Not Working?

### Check 1: Verify Environment Variables
```powershell
cd C:\Users\smmoh\OneDrive\Documents\GitHub\Game
node -e "require('dotenv').config(); console.log('Client ID:', process.env.GOOGLE_CLIENT_ID); console.log('Has Secret:', !!process.env.GOOGLE_CLIENT_SECRET);"
```

Expected output:
```
Client ID: 212973396288-to81l9hqrughbrpg9n5ud0gqb3c2uo5t.apps.googleusercontent.com
Has Secret: true
```

### Check 2: Verify Server Config
```powershell
# Check what callback URL the server is using
Select-String -Path "server.js" -Pattern "callbackURL"
```

Expected: `callbackURL: '/auth/google/callback'`

### Check 3: Test OAuth Redirect
```powershell
# This should redirect to Google
Start-Process "http://localhost:3000/auth/google"
```

---

## Production Deployment Note

When you deploy to production (e.g., `https://vegascore.com`), you'll need to:

1. Add production redirect URI: `https://vegascore.com/auth/google/callback`
2. Update `.env` with `NODE_ENV=production`
3. Ensure your domain uses HTTPS (required for OAuth)

---

## Visual Guide

### Google Cloud Console Screenshot Reference

```
APIs & Services → Credentials
  └── OAuth 2.0 Client IDs
      └── [Your Client Name]
          └── Authorized redirect URIs
              ├── http://localhost:3000/auth/google/callback   ← ADD THIS
              ├── http://127.0.0.1:3000/auth/google/callback   ← ADD THIS
              └── [SAVE BUTTON]
```

---

## Need Help?

If you're still stuck after adding the redirect URIs and waiting 10 minutes:

1. **Check Server Logs:** Look at the terminal running `node server.js` for errors
2. **Browser Console:** Press F12 in browser, check Console tab for errors
3. **Google Console:** Verify the redirect URIs are saved (refresh the page)

---

**Next Steps:**
1. Add redirect URIs to Google Cloud Console (link above)
2. Wait 5-10 minutes
3. Clear browser cookies
4. Restart server
5. Try login at `http://localhost:3000`

✅ Once redirect URIs are added, login will work perfectly!
