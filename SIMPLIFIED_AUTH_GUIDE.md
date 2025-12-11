# 🔐 Simplified Authentication Guide

**Updated:** December 11, 2024 @ 6:01 PM EST  
**Status:** ✅ Deployed and Ready

---

## What Changed?

We've **simplified the login process** to remove Google OAuth dependency and make it easier for users to start playing immediately.

### New Authentication Options:

1. **🎮 Play as Guest** (Instant - No Account Needed)
   - Click "PLAY AS GUEST" button
   - Automatically creates a temporary account (Guest12345)
   - Start playing in 1 second
   - Gets 100 chips to start

2. **📧 Email/Password Login** (Traditional)
   - Enter email and password
   - Click "SIGN IN"
   - For returning players

3. **✍️ Create Account** (New Players)
   - Click "CREATE ACCOUNT"
   - Fill in username, email, password
   - Get 100 welcome chips
   - Account saved permanently

4. **🔐 Google OAuth** (Still Available)
   - Backend routes still work at `/auth/google`
   - Not shown on welcome page by default
   - Can be re-enabled if needed

---

## API Endpoints

### POST `/auth/register`
Register a new user account.

**Request:**
```json
{
  "username": "PlayerOne",
  "email": "player@example.com",
  "password": "secret123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "player@example.com",
    "displayName": "PlayerOne",
    "chipBalance": 100,
    "isAdmin": false
  }
}
```

**Response (Error):**
```json
{
  "error": "Email already registered"
}
```

---

### POST `/auth/login`
Login with email and password.

**Request:**
```json
{
  "email": "player@example.com",
  "password": "secret123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "player@example.com",
    "displayName": "PlayerOne",
    "chipBalance": 1500,
    "isAdmin": false
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid email or password"
}
```

---

### POST `/auth/guest`
Create a guest account for instant play.

**Request:** (Empty body)

**Response (Success):**
```json
{
  "success": true,
  "guest": true,
  "user": {
    "id": "uuid",
    "displayName": "Guest42857",
    "chipBalance": 100
  }
}
```

**Notes:**
- Guest accounts are temporary (no password)
- Username format: `Guest12345` (random number)
- Email format: `guest12345@moescardroom.local`
- Rate limited: 5 accounts per IP per 15 minutes

---

### POST `/auth/logout`
Logout current user.

**Response:**
```json
{
  "ok": true
}
```

---

## Frontend Integration

The `welcome.html` page now includes:

1. **Login Form** (default view)
   - Email input
   - Password input
   - "SIGN IN" button
   - "CREATE ACCOUNT" button (switches to register form)
   - "PLAY AS GUEST" button

2. **Register Form** (toggled view)
   - Username input
   - Email input
   - Password input (6+ chars required)
   - "CREATE ACCOUNT" button
   - "BACK TO SIGN IN" button

3. **JavaScript Functions:**
   - `handleLogin()` - Submits login form
   - `handleRegister()` - Submits registration form
   - `handleGuestLogin()` - Creates guest account
   - `showLoginForm()` - Toggle to login view
   - `showRegisterForm()` - Toggle to register view

---

## Security Features

### Rate Limiting
- **5 registrations per IP per 15 minutes**
- Prevents account spam and abuse
- Applied to both `/auth/register` and `/auth/guest`

### Password Requirements
- Minimum 6 characters
- Hashed with bcrypt (10 rounds)
- Never stored in plaintext

### Session Management
- Express session with secure cookies
- `maxAge: 7 days`
- `sameSite: 'lax'`
- `secure: true` in production (HTTPS only)

### Admin Detection
- Admin email: `smmohamed60@gmail.com` (from env var)
- Automatically sets `isAdmin: true` on registration
- Admin users bypass operating hours restrictions

---

## User Experience Flow

### New Player (Guest):
1. Visit https://playwar.games
2. Click "PLAY AS GUEST"
3. Redirected to lobby
4. Can play immediately with 100 chips

### New Player (Account):
1. Visit https://playwar.games
2. Click "CREATE ACCOUNT"
3. Fill in username, email, password
4. Click "CREATE ACCOUNT"
5. Success message shown
6. Form switches back to login
7. Enter credentials and sign in
8. Redirected to lobby

### Returning Player:
1. Visit https://playwar.games
2. Enter email and password
3. Click "SIGN IN"
4. Redirected to lobby
5. Last chip balance restored

---

## Testing Checklist

### Before Launch:
- [x] Guest login creates account
- [x] Guest login redirects to lobby
- [x] Registration validates all fields
- [x] Registration checks password length
- [x] Registration rejects duplicate emails
- [x] Login validates credentials
- [x] Login updates lastLogin timestamp
- [x] Login redirects to lobby
- [x] Rate limiting blocks excessive requests
- [x] Session persists across page refreshes
- [x] Logout clears session

### After Deployment:
- [ ] Visit https://playwar.games
- [ ] Test guest login flow
- [ ] Test account creation
- [ ] Test login with created account
- [ ] Test wrong password rejection
- [ ] Test duplicate email rejection
- [ ] Test rate limiting (try 6 signups quickly)

---

## Troubleshooting

### "Email already registered" error
- User already has an account with that email
- Try logging in instead
- Use forgot password feature (if implemented)

### "Password must be at least 6 characters" error
- Password too short
- Choose a longer password

### "Connection error. Please try again." message
- Server is down or unreachable
- Check Cloud Run logs
- Verify database is accessible

### Guest login not working
- Check rate limiter (max 5 per 15 min)
- Check database connection
- Verify `/auth/guest` endpoint is accessible

### Session not persisting
- Check `SESSION_SECRET` is set in env
- Verify cookies are enabled in browser
- Check `sameSite` cookie setting

---

## Google OAuth (Legacy)

Google OAuth is **still available** via backend routes but **not shown on welcome page**.

To re-enable on welcome page:
1. Replace auth form in `welcome.html` with:
   ```html
   <a href="/auth/google" class="login-btn">SIGN IN WITH GOOGLE</a>
   ```

2. Verify environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL=https://playwar.games/auth/google/callback`

3. Ensure Google Cloud Console OAuth consent screen is configured

---

## Production Deployment

### Environment Variables Required:
```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SESSION_SECRET=your_strong_random_secret_32_chars_min
NODE_ENV=production
PORT=8080

# Optional (for Google OAuth):
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://playwar.games/auth/google/callback
```

### Cloud Build Auto-Deploys:
- Push to main branch triggers build
- No manual deployment needed
- Changes live in ~5 minutes

---

## Summary

✅ **Simplified authentication** removes barriers to entry  
✅ **Guest login** lets users try the game instantly  
✅ **Email/password** gives users permanent accounts  
✅ **Google OAuth** still works as fallback  
✅ **Rate limiting** prevents abuse  
✅ **Secure sessions** keep users logged in  

**Result:** Faster onboarding, better conversion, happier users! 🎰

---

**Need Help?**  
Check server logs: Cloud Run → Logs → Filter for "auth"  
Check database: Supabase → SQL Editor → `SELECT * FROM "User" LIMIT 10;`

**Questions?**  
All auth routes are in: `src/routes/auth.js`  
All frontend auth is in: `welcome.html` (lines 259-353)
