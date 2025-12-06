# WebAuthn Integration Steps

This guide shows you exactly how to integrate the BiometricSetup and BiometricLogin components into your existing app.

## Quick Summary

You need to:
1. **Add Settings button to Navbar** - Access BiometricSetup
2. **Add SettingsView to App.jsx** - Show settings page
3. **Check casino hours and show CasinoClosedView** - Show BiometricLogin when closed
4. **Run database migration** - Create Authenticator table
5. **Set environment variables** - Configure WebAuthn

---

## Step 1: Update Navbar to Include Settings Button

**File:** `frontend/src/components/ui/Navbar.jsx`

Add a settings button next to the logout button:

```jsx
// @/components/ui/Navbar.jsx
export function Navbar({ user, onLogout, onSettings }) {
  return (
    <motion.header
      // ... existing code ...
    >
      <div className="safe-area-top m-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg">
          {/* ... existing avatar and name code ... */}

          <div className="flex items-center gap-4">
            <div className="bg-black/30 px-4 py-2 rounded-full border border-yellow-500/20 text-yellow-400 font-mono text-lg">
              $<AnimatedCounter value={user?.chipBalance || 0} />
            </div>

            {/* ADD THIS SETTINGS BUTTON */}
            {onSettings && (
              <button
                onClick={onSettings}
                className="text-slate-400 hover:text-white text-xs transition-colors"
              >
                ⚙️ Settings
              </button>
            )}

            {onLogout && (
              <button onClick={onLogout} className="text-slate-400 hover:text-white text-xs">
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
```

---

## Step 2: Update App.jsx to Add Settings View

**File:** `frontend/src/App.jsx`

### 2a. Add imports at the top:

```jsx
// Add these imports
import { SettingsView } from './views/SettingsView';
import { CasinoClosedView } from './components/CasinoClosedView';
```

### 2b. Add state for casino status and settings view:

```jsx
function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('loading');

  // ADD THESE NEW STATES
  const [casinoStatus, setCasinoStatus] = useState({ isOpen: true, nextOpenTime: null });

  // ... rest of existing state ...
```

### 2c. Check casino operating hours on load:

Add this useEffect after the authentication useEffect:

```jsx
// Check casino operating hours
useEffect(() => {
  const checkOperatingHours = async () => {
    try {
      const response = await fetch('/api/casino-status');
      if (response.ok) {
        const data = await response.json();
        setCasinoStatus(data);
      }
    } catch (err) {
      console.error('Failed to check casino status:', err);
    }
  };

  if (user && !user.isAdmin) {
    checkOperatingHours();
    // Check every minute
    const interval = setInterval(checkOperatingHours, 60000);
    return () => clearInterval(interval);
  }
}, [user]);
```

### 2d. Add settings handler:

```jsx
const handleSettings = () => {
  setView('settings');
};
```

### 2e. Update the Navbar to include onSettings:

```jsx
<Navbar user={user} onLogout={handleLogout} onSettings={handleSettings} />
```

### 2f. Add settings view to the render logic:

In the `renderView()` function, inside the authenticated views section, add:

```jsx
{view === 'settings' && (
  <motion.div key="settings" variants={pageVariants} initial="initial" animate="in" exit="exit">
    <SettingsView user={user} onBack={() => setView('lobby')} />
  </motion.div>
)}
```

### 2g. Show CasinoClosedView when casino is closed (for non-admins):

Update the authenticated views section:

```jsx
// --- Authenticated Views ---
return (
  <div className="min-h-screen bg-slate-900">
    {/* Only show navbar if casino is open or user is admin */}
    {(casinoStatus.isOpen || user.isAdmin) && (
      <Navbar user={user} onLogout={handleLogout} onSettings={handleSettings} />
    )}

    {/* Show casino closed view for non-admins when closed */}
    {!casinoStatus.isOpen && !user.isAdmin ? (
      <CasinoClosedView
        nextOpenTime={casinoStatus.nextOpenTime}
        onLoginSuccess={(adminUser) => {
          setUser(adminUser);
          window.location.reload();
        }}
      />
    ) : (
      <AnimatePresence mode="wait">
        {view === 'lobby' && (
          <motion.div key="lobby">
            <GameLobbyView onJoinGame={handleJoinGame} />
          </motion.div>
        )}
        {view === 'settings' && (
          <motion.div key="settings" variants={pageVariants} initial="initial" animate="in" exit="exit">
            <SettingsView user={user} onBack={() => setView('lobby')} />
          </motion.div>
        )}
        {/* ... rest of existing views ... */}
      </AnimatePresence>
    )}
  </div>
)
```

---

## Step 3: Add Casino Status Endpoint (Backend)

**File:** `server.js`

Add this endpoint after the existing `/me` endpoint:

```javascript
// Casino status endpoint
app.get('/api/casino-status', (req, res) => {
  const { isOpen, nextOpenTime } = getOperatingHoursStatus();
  res.json({ isOpen, nextOpenTime });
});
```

This uses the existing `getOperatingHoursStatus()` function already in your server.js.

---

## Step 4: Run Database Migration

Open your terminal and run:

```bash
# Push schema changes to database
npx prisma db push

# Or create a migration (preferred for production)
npx prisma migrate dev --name add_webauthn_authenticator
```

---

## Step 5: Set Environment Variables

Add to your `.env` file:

```bash
# WebAuthn Configuration
WEBAUTHN_RP_ID=playwar.games
PUBLIC_URL=https://playwar.games

# For local development, also add:
WEBAUTHN_ORIGIN_DEV=http://localhost:3000
```

**Important:** Make sure these values match your actual domain!

---

## Step 6: Install Frontend Dependencies

The backend packages are already installed. Make sure the frontend has the required package:

```bash
cd frontend
npm install @simplewebauthn/browser
cd ..
```

---

## Complete File Summary

### New Files Created ✅

1. ✅ `src/webauthn.js` - Backend WebAuthn logic
2. ✅ `frontend/src/components/BiometricSetup.jsx` - Setup component
3. ✅ `frontend/src/components/BiometricLogin.jsx` - Login component
4. ✅ `frontend/src/views/SettingsView.jsx` - Settings page
5. ✅ `frontend/src/components/CasinoClosedView.jsx` - Closed casino page

### Files to Modify 📝

1. ✅ `server.js` - Already added WebAuthn routes (lines 469-479)
2. ✅ `prisma/schema.prisma` - Already added Authenticator model
3. ⚠️ `frontend/src/components/ui/Navbar.jsx` - Need to add onSettings prop and button
4. ⚠️ `frontend/src/App.jsx` - Need to add SettingsView, CasinoClosedView, and casino status check

---

## Testing Checklist

### Setup Flow (First Time)

1. ✅ Start your server and frontend
2. ✅ Sign in with Google OAuth
3. ✅ Click "⚙️ Settings" button in navbar
4. ✅ Go to "🔐 Security" tab
5. ✅ Click "🔐 Set Up Biometric Login"
6. ✅ Use your biometric (Touch ID, Face ID, Windows Hello)
7. ✅ Verify device appears in "Registered Devices" list

### Login Flow (After Setup)

1. ✅ Log out of the app
2. ✅ Wait until casino is closed (or simulate by changing system time)
3. ✅ Visit the app - you should see "Casino Closed" page
4. ✅ Click "🔐 Admin Fast Login"
5. ✅ Enter your email address
6. ✅ Click "Sign In with Biometric"
7. ✅ Use your biometric
8. ✅ You should be logged in and bypass the closed hours!

---

## Troubleshooting

### "Settings button not showing"
- Make sure you added `onSettings` prop to Navbar component
- Check that you're passing the handler: `<Navbar ... onSettings={handleSettings} />`

### "Casino closed view not showing"
- Check `/api/casino-status` endpoint returns correct data
- Verify `casinoStatus` state is being set correctly
- Make sure you're testing with a non-admin account (admin always bypasses)

### "Biometric setup not working"
- Open browser console and check for errors
- Verify you're using HTTPS (or localhost for development)
- Check that your device supports biometrics
- Make sure `@simplewebauthn/browser` is installed in frontend

### "Database migration fails"
- Make sure DATABASE_URL is set correctly in .env
- Check that you have write permissions to the database
- Try `npx prisma db push` instead of migrate

---

## Quick Start Commands

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Run database migration
npx prisma db push

# 3. Start the server
npm start

# 4. In another terminal, start frontend dev server
cd frontend
npm run dev
```

---

## What You Get

✅ **Secure biometric login** - Touch ID, Face ID, Windows Hello
✅ **Admin bypass** - Access casino when closed
✅ **Settings page** - Manage biometric devices
✅ **Professional UI** - Matches your existing design
✅ **Free-tier optimized** - Minimal database calls and efficient storage
✅ **Production-ready** - Follows WebAuthn best practices

---

## Need Help?

Check the full implementation guide: `docs/WEBAUTHN_IMPLEMENTATION.md`

Or review the backend code: `src/webauthn.js`
