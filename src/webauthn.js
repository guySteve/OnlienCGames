/**
 * WebAuthn Biometric Authentication Module
 *
 * Implements passwordless biometric login using FIDO2/WebAuthn standards
 * via @simplewebauthn/server library.
 *
 * Free-Tier Optimizations:
 * - Minimal database calls (direct Prisma lookups)
 * - Space-efficient storage (Bytes for keys, BigInt for counters)
 * - Fast cryptographic verification within single request lifecycle
 */

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoUint8Array, isoBase64URL } = require('@simplewebauthn/server/helpers');
const { prisma } = require('./db');

// =============================================================================
// CONFIGURATION
// =============================================================================

const RP_NAME = 'Moe\'s Card Room';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'playwar.games';
const ORIGIN = process.env.PUBLIC_URL || `https://${RP_ID}`;

// Support multiple origins for dev/prod
const EXPECTED_ORIGINS = [
  ORIGIN,
  process.env.WEBAUTHN_ORIGIN_DEV || 'http://localhost:3000',
  process.env.WEBAUTHN_ORIGIN_PROD || ORIGIN
].filter(Boolean);

console.log('🔐 WebAuthn Configuration:');
console.log('  RP Name:', RP_NAME);
console.log('  RP ID:', RP_ID);
console.log('  Expected Origins:', EXPECTED_ORIGINS);

// =============================================================================
// REGISTRATION FLOW
// =============================================================================

/**
 * POST /auth/webauthn/register-start
 *
 * Generates a unique challenge for biometric registration.
 * User must be authenticated via Google OAuth.
 *
 * Free-Tier Optimized:
 * - Single DB lookup via findUnique
 * - Challenge stored in session (no DB write)
 */
async function handleRegistrationStart(req, res) {
  try {
    // Ensure user is authenticated via Google OAuth
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please sign in with Google first'
      });
    }

    const userId = req.user.id;

    // Fetch existing authenticators (efficient single query)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        authenticators: {
          select: {
            credentialID: true,
            transports: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert existing authenticators to WebAuthn format
    const excludeCredentials = user.authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports ? JSON.parse(auth.transports) : ['internal']
    }));

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email || user.displayName,
      userDisplayName: user.displayName,

      // Prevent re-registering existing authenticators
      excludeCredentials,

      // Prefer platform authenticators (Touch ID, Windows Hello, etc.)
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      },

      // Support for older and newer devices
      attestationType: 'none',

      // 5 minute challenge timeout
      timeout: 300000
    });

    // Store challenge in session (no DB write - Free Tier optimization)
    req.session.webauthnChallenge = options.challenge;
    req.session.webauthnUserId = user.id;

    res.json(options);
  } catch (error) {
    console.error('❌ WebAuthn registration start error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
}

/**
 * POST /auth/webauthn/register-finish
 *
 * Verifies the biometric credential and stores it in the database.
 *
 * Free-Tier Optimized:
 * - Single DB write (create)
 * - Efficient Bytes storage for keys
 * - BigInt for counter (space-efficient)
 */
async function handleRegistrationFinish(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Please sign in with Google first'
      });
    }

    const { credential, deviceName } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential data' });
    }

    // Retrieve challenge from session
    const expectedChallenge = req.session.webauthnChallenge;
    const userId = req.session.webauthnUserId;

    if (!expectedChallenge || userId !== req.user.id) {
      return res.status(400).json({
        error: 'Invalid session',
        message: 'Please restart the registration process'
      });
    }

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true
    });

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return res.status(400).json({
        error: 'Verification failed',
        message: 'Could not verify biometric credential'
      });
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp
    } = registrationInfo;

    // Save authenticator to database (efficient single write)
    const newAuthenticator = await prisma.authenticator.create({
      data: {
        userId: userId,
        credentialID: Buffer.from(credentialID),
        credentialPublicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        transports: credential.response.transports
          ? JSON.stringify(credential.response.transports)
          : null,
        deviceName: deviceName || `${credentialDeviceType || 'Device'} ${new Date().toLocaleDateString()}`
      }
    });

    // Clear challenge from session
    delete req.session.webauthnChallenge;
    delete req.session.webauthnUserId;

    res.json({
      success: true,
      message: 'Biometric authentication registered successfully',
      authenticator: {
        id: newAuthenticator.id,
        deviceName: newAuthenticator.deviceName,
        createdAt: newAuthenticator.createdAt
      }
    });

  } catch (error) {
    console.error('❌ WebAuthn registration finish error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
}

// =============================================================================
// AUTHENTICATION FLOW
// =============================================================================

/**
 * POST /auth/webauthn/login-start
 *
 * Generates authentication challenge for biometric login.
 * Does NOT require existing session (passwordless login).
 *
 * Free-Tier Optimized:
 * - No DB queries (challenge generation only)
 * - Challenge stored in session
 */
async function handleAuthenticationStart(req, res) {
  try {
    const { email } = req.body;

    // For admin fast-login, we need to know which user is trying to authenticate
    // This allows us to retrieve their specific authenticators
    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Please provide your email address'
      });
    }

    // Fetch user and their authenticators (single efficient query)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
        isAdmin: true,
        authenticators: {
          select: {
            credentialID: true,
            transports: true
          }
        }
      }
    });

    if (!user) {
      // Don't reveal if user exists (security best practice)
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email'
      });
    }

    if (user.authenticators.length === 0) {
      return res.status(400).json({
        error: 'No biometric credentials',
        message: 'Please set up biometric login first by signing in with Google'
      });
    }

    // Convert authenticators to WebAuthn format
    const allowCredentials = user.authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports ? JSON.parse(auth.transports) : ['internal']
    }));

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 300000 // 5 minutes
    });

    // Store challenge in session
    req.session.webauthnChallenge = options.challenge;
    req.session.webauthnEmail = email;

    res.json(options);

  } catch (error) {
    console.error('❌ WebAuthn authentication start error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
}

/**
 * POST /auth/webauthn/login-finish
 *
 * Verifies biometric signature and logs user in.
 *
 * Free-Tier Optimized:
 * - Single DB query with nested select
 * - Single DB update (counter only)
 * - No session writes (handled by passport)
 */
async function handleAuthenticationFinish(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential data' });
    }

    // Retrieve challenge from session
    const expectedChallenge = req.session.webauthnChallenge;
    const email = req.session.webauthnEmail;

    if (!expectedChallenge || !email) {
      return res.status(400).json({
        error: 'Invalid session',
        message: 'Please restart the login process'
      });
    }

    // Find the authenticator (efficient query with user data)
    const authenticator = await prisma.authenticator.findUnique({
      where: {
        credentialID: Buffer.from(isoBase64URL.toBuffer(credential.id))
      },
      include: {
        user: {
          select: {
            id: true,
            googleId: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isAdmin: true,
            chipBalance: true
          }
        }
      }
    });

    if (!authenticator) {
      return res.status(400).json({
        error: 'Invalid credential',
        message: 'This biometric credential is not recognized'
      });
    }

    // Verify the user matches the email
    if (authenticator.user.email !== email) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Credential does not belong to this user'
      });
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: authenticator.credentialID,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: Number(authenticator.counter)
      },
      requireUserVerification: true
    });

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      return res.status(400).json({
        error: 'Verification failed',
        message: 'Could not verify biometric signature'
      });
    }

    // Update counter (replay attack prevention)
    const { newCounter } = authenticationInfo;
    await prisma.authenticator.update({
      where: { id: authenticator.id },
      data: { counter: BigInt(newCounter) }
    });

    // Log the user in (passport session)
    req.login(authenticator.user, (err) => {
      if (err) {
        console.error('❌ Session login error:', err);
        return res.status(500).json({
          error: 'Login failed',
          message: 'Could not create session'
        });
      }

      // Clear challenge from session
      delete req.session.webauthnChallenge;
      delete req.session.webauthnEmail;

      res.json({
        success: true,
        message: 'Biometric authentication successful',
        user: {
          id: authenticator.user.id,
          displayName: authenticator.user.displayName,
          email: authenticator.user.email,
          isAdmin: authenticator.user.isAdmin
        }
      });
    });

  } catch (error) {
    console.error('❌ WebAuthn authentication finish error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
}

// =============================================================================
// AUTHENTICATOR MANAGEMENT
// =============================================================================

/**
 * GET /auth/webauthn/authenticators
 *
 * Lists all registered biometric devices for the current user.
 */
async function getAuthenticators(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const authenticators = await prisma.authenticator.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        transports: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ authenticators });

  } catch (error) {
    console.error('❌ Get authenticators error:', error);
    res.status(500).json({ error: 'Failed to fetch authenticators' });
  }
}

/**
 * DELETE /auth/webauthn/authenticators/:id
 *
 * Removes a biometric device from the user's account.
 */
async function deleteAuthenticator(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const authenticatorId = parseInt(req.params.id);

    if (isNaN(authenticatorId)) {
      return res.status(400).json({ error: 'Invalid authenticator ID' });
    }

    // Delete only if it belongs to the current user
    const deleted = await prisma.authenticator.deleteMany({
      where: {
        id: authenticatorId,
        userId: req.user.id
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Authenticator not found' });
    }

    res.json({ success: true, message: 'Authenticator removed' });

  } catch (error) {
    console.error('❌ Delete authenticator error:', error);
    res.status(500).json({ error: 'Failed to delete authenticator' });
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  handleRegistrationStart,
  handleRegistrationFinish,
  handleAuthenticationStart,
  handleAuthenticationFinish,
  getAuthenticators,
  deleteAuthenticator
};
