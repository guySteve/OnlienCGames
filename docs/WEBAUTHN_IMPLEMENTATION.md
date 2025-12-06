# WebAuthn Biometric Authentication Implementation

## Overview

This implementation adds passwordless biometric login to Moe's Casino using the Web Authentication API (WebAuthn/FIDO2). Admin users can register their biometric credentials (Touch ID, Face ID, Windows Hello) and log in instantly when the casino is closed or for faster access.

## Architecture

### Free-Tier Optimizations

✅ **Minimal Database Calls**
- Single `findUnique` queries with efficient selects
- Direct Prisma lookups without expensive joins
- No N+1 query problems

✅ **Efficient Data Storage**
- `Bytes` data type for cryptographic keys (space-efficient)
- `BigInt` for replay attack counters
- Optional metadata stored as JSON when needed

✅ **Fast Compute**
- Cryptographic verification happens in a single request lifecycle
- Session-based challenge storage (no DB writes during registration)
- Minimal overhead on authentication flow

## Database Schema

### Authenticator Model

```prisma
model Authenticator {
  id                   Int      @id @default(autoincrement())
  createdAt            DateTime @default(now())

  userId               String
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  credentialID         Bytes    @unique
  credentialPublicKey  Bytes
  counter              BigInt   @default(0)

  transports           String?
  deviceName           String?  @db.VarChar(100)

  @@unique([userId, credentialID])
  @@index([userId])
}
```

### User Model Updates

Added relation to the User model:

```prisma
model User {
  // ... existing fields ...
  authenticators        Authenticator[]
}
```

## Backend API Endpoints

All endpoints are in `src/webauthn.js` and integrated into `server.js`.

### Configuration

Set these environment variables:

```bash
# Required
WEBAUTHN_RP_ID=playwar.games
PUBLIC_URL=https://playwar.games

# Optional (for development)
WEBAUTHN_ORIGIN_DEV=http://localhost:3000
WEBAUTHN_ORIGIN_PROD=https://playwar.games
```

### Registration Flow (Setup)

**POST `/auth/webauthn/register-start`**
- Requires: User authenticated via Google OAuth
- Returns: Registration challenge options
- Stores challenge in session (no DB write)

**POST `/auth/webauthn/register-finish`**
- Requires: Registration credential from browser
- Body: `{ credential, deviceName? }`
- Verifies credential and saves to database
- Returns: Success message with authenticator details

### Authentication Flow (Login)

**POST `/auth/webauthn/login-start`**
- Body: `{ email }`
- Returns: Authentication challenge options
- Stores challenge in session

**POST `/auth/webauthn/login-finish`**
- Body: `{ credential }`
- Verifies biometric signature
- Logs user in via Passport session
- Updates counter (replay attack prevention)
- Returns: User data

### Management Endpoints

**GET `/auth/webauthn/authenticators`**
- Requires: Authenticated user
- Returns: List of registered biometric devices

**DELETE `/auth/webauthn/authenticators/:id`**
- Requires: Authenticated user
- Removes a biometric device

## Frontend Components

### BiometricSetup Component

**Location:** `frontend/src/components/BiometricSetup.jsx`

**Usage:**
```jsx
import BiometricSetup from './components/BiometricSetup';

// In admin settings or user profile
<BiometricSetup />
```

**Features:**
- Checks browser support for WebAuthn
- Displays registration form with optional device naming
- Shows list of registered devices
- Allows removal of devices
- Error handling and user feedback

**Flow:**
1. User clicks "Set Up Biometric Login"
2. Component calls `/auth/webauthn/register-start`
3. Browser prompts for biometric (Touch ID, Face ID, etc.)
4. Component sends credential to `/auth/webauthn/register-finish`
5. Device is saved and listed

### BiometricLogin Component

**Location:** `frontend/src/components/BiometricLogin.jsx`

**Usage:**
```jsx
import BiometricLogin from './components/BiometricLogin';

// On login page or when casino is closed
<BiometricLogin
  adminEmail="smmohamed60@gmail.com"
  onSuccess={(user) => {
    // Handle successful login
    console.log('Logged in as:', user.displayName);
  }}
/>
```

**Features:**
- Email input for user identification
- One-click biometric authentication
- Error handling and user feedback
- Automatic redirect or custom success handler

**Flow:**
1. User enters email address
2. User clicks "Sign In with Biometric"
3. Component calls `/auth/webauthn/login-start`
4. Browser prompts for biometric
5. Component sends credential to `/auth/webauthn/login-finish`
6. User is logged in and session is created

## Integration Guide

### Step 1: Database Migration

Run the migration to create the Authenticator table:

```bash
npx prisma db push
```

Or create a migration:

```bash
npx prisma migrate dev --name add_webauthn_authenticator
```

### Step 2: Environment Variables

Add to your `.env` file:

```bash
WEBAUTHN_RP_ID=playwar.games
PUBLIC_URL=https://playwar.games
```

For local development, also add:

```bash
WEBAUTHN_ORIGIN_DEV=http://localhost:3000
```

### Step 3: Admin Setup Flow

1. **First-time setup:** Admin signs in with Google OAuth
2. **Navigate to settings:** Show the BiometricSetup component
3. **Register biometric:** Admin clicks "Set Up Biometric Login"
4. **Done:** Admin can now use BiometricLogin component

### Step 4: Fast Login When Casino is Closed

Update your closed casino page to show BiometricLogin:

```jsx
import BiometricLogin from './components/BiometricLogin';

function CasinoClosed() {
  return (
    <div>
      <h1>Casino is Closed</h1>
      <p>Open hours: 10 PM - 2 AM ET</p>

      <div className="admin-login">
        <h2>Admin Access</h2>
        <BiometricLogin
          adminEmail="smmohamed60@gmail.com"
          onSuccess={() => {
            window.location.reload();
          }}
        />
      </div>
    </div>
  );
}
```

## Security Features

### FIDO2/WebAuthn Standards
- Industry-standard authentication protocol
- Used by Google, Microsoft, Apple, and major financial institutions
- Phishing-resistant by design

### Replay Attack Prevention
- Counter-based verification (increments with each use)
- Prevents credential reuse attacks

### Origin Verification
- Credentials are bound to specific domains
- Cannot be used on different sites

### Device-Bound Credentials
- Private keys never leave the device
- Biometric data stays on device (not sent to server)

### User Verification
- Requires biometric (Touch ID, Face ID, Windows Hello)
- Cannot be bypassed

## Browser Support

✅ **Chrome/Edge:** Full support
✅ **Safari:** Full support (iOS 14.3+, macOS 11.2+)
✅ **Firefox:** Full support
❌ **Internet Explorer:** Not supported

## Testing

### Local Testing

1. Use HTTPS or localhost (required for WebAuthn)
2. Ensure you have a biometric device (Touch ID, Windows Hello, etc.)
3. Sign in with Google OAuth first
4. Navigate to BiometricSetup and register
5. Log out and test BiometricLogin

### Production Testing

1. Deploy to your production domain (must match WEBAUTHN_RP_ID)
2. Ensure HTTPS is enabled
3. Test with different devices (iPhone, MacBook, Windows PC)
4. Verify counter increments correctly

## Troubleshooting

### "Biometric Login Not Supported"
- Browser doesn't support WebAuthn
- Device doesn't have biometric hardware
- User needs to enable biometrics in system settings

### "Invalid session" errors
- Session expired (5 minute timeout on challenges)
- User needs to restart the registration/login flow

### "Origin mismatch" errors
- WEBAUTHN_RP_ID doesn't match domain
- PUBLIC_URL is incorrect
- Using HTTP instead of HTTPS (except localhost)

### "No registered biometric devices found"
- User hasn't set up biometric login yet
- Need to use BiometricSetup component first

## Future Enhancements

1. **Conditional UI:** Allow non-admins to use biometric login
2. **Multi-device sync:** Support for multiple devices per user
3. **Backup codes:** Fallback authentication method
4. **Audit logging:** Track biometric login attempts
5. **Device attestation:** Verify hardware authenticity

## References

- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [SimpleWebAuthn Documentation](https://simplewebauthn.dev/)
- [FIDO Alliance](https://fidoalliance.org/)
- [Can I Use WebAuthn](https://caniuse.com/webauthn)

## Support

For issues or questions:
- Check browser console for error messages
- Verify environment variables are set correctly
- Ensure database migration has run
- Review server logs for backend errors
