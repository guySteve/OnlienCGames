# OAuth Troubleshooting Guide

## Issue: Service Unavailable After Google Sign-In

### Recent Fixes Applied

1. **Enhanced Error Logging**
   - Added detailed console logs at each OAuth step
   - Shows user creation/lookup process
   - Displays database operation results

2. **Improved Error Handling**
   - OAuth errors no longer throw, preventing "Service Unavailable"
   - Failed authentications redirect gracefully
   - Database errors are caught and logged

3. **Database Health Check**
   - Server verifies database connection on startup
   - Warning shown if database is unreachable
   - Non-critical transaction failures don't block user creation

4. **Better Fallback Mechanisms**
   - Welcome transaction failure doesn't prevent user creation
   - Daily reset check failure doesn't block login
   - Missing crypto import fixed in db.js

## How to Diagnose Issues

### Check Server Logs

When you sign in with Google, you should see:

```
🔐 Google OAuth callback received for: [Your Name]
📊 Looking up user: [Your Name] ID: [Google ID]
✅ User authenticated: [Your Name] Balance: 1000
✅ OAuth callback successful, redirecting to home
```

### For New Users:
```
👤 Creating new user: [Your Name]
✅ User created with ID: [UUID]
✅ Welcome transaction created
```

### For Existing Users:
```
✅ Existing user found: [Your Name] Balance: [Amount]
✅ Daily reset checked, new balance: [Amount]
```

## Common Issues & Solutions

### 1. Database Connection Failed

**Symptom**: `❌ Database connection failed`

**Solution**:
- Check your `.env` file has correct `DATABASE_URL`
- Verify database is running
- Test connection with: `npm run db:test`

### 2. Transaction Creation Failed

**Symptom**: `⚠️ Warning: Failed to create welcome transaction`

**Impact**: Non-critical - User can still play
**Solution**: These errors are logged but don't block login

### 3. Daily Reset Check Failed

**Symptom**: `⚠️ Warning: Daily reset check failed`

**Impact**: User keeps previous balance
**Solution**: Non-blocking - User can still play

### 4. User Creation Failed

**Symptom**: `❌ User creation/retrieval failed`

**Causes**:
- Database constraint violation
- Missing required fields
- Database connection timeout

**Solution**:
```bash
# Check database schema
npx prisma db push

# View current schema
npx prisma studio
```

## Testing OAuth Flow

### Manual Test Steps:

1. **Start Server**
   ```bash
   npm start
   ```

2. **Check Console**
   - Look for `✅ Database connection established`
   - Verify no startup errors

3. **Open Browser**
   - Go to `http://localhost:3000`
   - Click "Login" button

4. **Watch Server Logs**
   - Should see OAuth callback logs
   - User creation/lookup messages
   - Success confirmation

5. **Verify Login**
   - Should redirect to main page
   - Profile should show in header
   - Chip balance should display

## Emergency Fallback

If OAuth continues to fail, you can temporarily disable authentication:

### Option 1: Use Dev Mode (No Auth)
```javascript
// In server.js, add at top:
process.env.DEV_MODE = 'true';
```

### Option 2: Mock Authentication
```javascript
// Replace OAuth callback with:
app.get('/auth/google/callback', (req, res) => {
  req.session.passport = {
    user: {
      id: 'dev-user',
      displayName: 'Dev User',
      chipBalance: 1000
    }
  };
  res.redirect('/');
});
```

## Database Schema Check

Ensure your database has all required fields:

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes
npx prisma db push

# Check current state
npx prisma studio
```

## Required Environment Variables

```env
# Google OAuth (required for authentication)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Database (required)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Session (required)
SESSION_SECRET=your_secret_key

# Redis (optional - for encryption keys)
REDIS_URL=redis://...
```

## Callback URL Configuration

Make sure your Google OAuth app has the correct callback URL:

**Development**: `http://localhost:3000/auth/google/callback`
**Production**: `https://yourdomain.com/auth/google/callback`

## Still Having Issues?

1. **Clear browser cookies/cache**
2. **Check Google OAuth consent screen settings**
3. **Verify all environment variables are set**
4. **Check database is accessible**
5. **Look for any error messages in browser console**

## Debug Mode

Enable verbose logging:

```bash
# Set in .env
NODE_ENV=development
```

This will show:
- SQL queries
- Prisma operations
- Detailed error stacks

## Success Indicators

✅ Server starts without errors
✅ Database connection established  
✅ OAuth callback receives profile
✅ User created/retrieved from DB
✅ Redirect to home page successful
✅ User profile visible in UI
✅ Chip balance displayed

If you see all these, OAuth is working correctly!
