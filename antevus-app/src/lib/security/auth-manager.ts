/**
 * Secure Authentication Manager with JWT Verification
 *
 * SECURITY NOTICE:
 * - Tokens are stored in memory only, never in localStorage/sessionStorage
 * - Proper JWT verification with jose library
 * - Demo mode is explicitly gated behind DEMO_MODE environment variable
 * - Fails closed when verification fails
 *
 * PRODUCTION REQUIREMENTS:
 * - Use httpOnly cookies for token storage
 * - Implement CSRF protection
 * - Add token refresh mechanism
 * - Use secure SameSite cookie attributes
 * - Configure proper JWKS endpoint or public key
 */

import { jwtVerify, createRemoteJWKSet, importSPKI, JWTPayload, errors as joseErrors } from 'jose'
import { UserRole } from '@/lib/security/authorization'
import { logger } from '@/lib/logger'
import { isDemoMode } from '@/lib/config/demo-mode'
import jwt from 'jsonwebtoken'

interface AuthToken {
  value: string
  expiresAt: Date
  userId?: string
  scope?: string[]
}

interface VerifiedClaims {
  sub: string // Subject (user ID)
  email?: string
  roles?: string[]
  exp?: number
  iat?: number
  iss?: string
  aud?: string | string[]
  [key: string]: unknown
}

// Configuration from environment variables
const config = {
  // Demo mode - use centralized function
  isDemoMode: isDemoMode(),

  // JWT Configuration (for production) - no NEXT_PUBLIC_* fallbacks
  jwksUri: process.env.JWKS_URI,
  jwtIssuer: process.env.JWT_ISSUER,
  jwtAudience: process.env.JWT_AUDIENCE,

  // Alternative: Use a static public key instead of JWKS
  jwtPublicKey: process.env.JWT_PUBLIC_KEY,
}

// Runtime validation function - only validates when actually used
function validateProductionConfig(): void {
  const isProd = process.env.NODE_ENV === 'production'

  // Skip validation during build phase
  if (typeof window === 'undefined' && process.env.NEXT_PHASE === 'phase-production-build') {
    return
  }

  if (isProd && !config.isDemoMode) {
    // Require JWT configuration in production
    if (!config.jwksUri && !config.jwtPublicKey) {
      logger.error('PRODUCTION ERROR: Either JWKS_URI or JWT_PUBLIC_KEY must be configured')
      // Don't throw during build, but fail in runtime
      if (process.env.NEXT_PHASE !== 'phase-production-build') {
        throw new Error('PRODUCTION ERROR: Either JWKS_URI or JWT_PUBLIC_KEY must be configured')
      }
    }

    // SECURITY: Require explicit issuer in production - no defaults
    if (!config.jwtIssuer) {
      logger.error('PRODUCTION ERROR: JWT_ISSUER must be configured - no defaults allowed')
      if (process.env.NEXT_PHASE !== 'phase-production-build') {
        throw new Error('PRODUCTION ERROR: JWT_ISSUER must be configured in production')
      }
    }

    // SECURITY: Require explicit audience in production - no defaults
    if (!config.jwtAudience) {
      logger.error('PRODUCTION ERROR: JWT_AUDIENCE must be configured - no defaults allowed')
      if (process.env.NEXT_PHASE !== 'phase-production-build') {
        throw new Error('PRODUCTION ERROR: JWT_AUDIENCE must be configured in production')
      }
    }
  }
}

class SecureAuthManager {
  private token: AuthToken | null = null
  private refreshToken: string | null = null
  private tokenRefreshTimer: NodeJS.Timeout | null = null
  private readonly TOKEN_LIFETIME_MS = 15 * 60 * 1000 // 15 minutes
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null

  constructor() {
    // Validate configuration at runtime (not during build)
    if (typeof window !== 'undefined' || process.env.NEXT_PHASE !== 'phase-production-build') {
      validateProductionConfig()
    }

    // Initialize JWKS if URI is provided
    if (config.jwksUri && !config.isDemoMode) {
      try {
        this.jwks = createRemoteJWKSet(new URL(config.jwksUri))
      } catch (error) {
        logger.error('Failed to initialize JWKS', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Clear tokens on page unload for security
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.clearAuth())
    }
  }

  /**
   * Store authentication token securely in memory
   *
   * SECURITY: Tokens are stored in memory ONLY to prevent:
   * - XSS attacks from accessing localStorage/sessionStorage
   * - Token persistence across sessions (HIPAA compliance)
   * - Unauthorized access to sensitive authentication data
   *
   * NEVER store tokens in:
   * - localStorage (persists indefinitely, accessible via JS)
   * - sessionStorage (persists for session, accessible via JS)
   * - Non-httpOnly cookies (accessible via JS)
   *
   * PRODUCTION: Use httpOnly, secure, sameSite cookies set by server
   */
  setToken(token: string, expiresInMs?: number): void {
    const expiresAt = new Date(
      Date.now() + (expiresInMs || this.TOKEN_LIFETIME_MS)
    )

    // SECURITY: Store in memory only - never in browser storage
    this.token = {
      value: token,
      expiresAt
    }

    // Set up automatic token expiration
    this.setupTokenExpiration()

    // Token stored securely in memory only
  }

  /**
   * Get current authentication token from memory
   * Returns null if token is expired or not set
   *
   * SECURITY: Reads from memory only - never from browser storage
   * This ensures tokens cannot be persisted or accessed via XSS
   */
  getToken(): string | null {
    // Read from memory - no localStorage/sessionStorage access
    if (!this.token) {
      return null
    }

    // Check if token is expired
    if (new Date() > this.token.expiresAt) {
      // Token expired - clear from memory
      this.clearAuth()
      return null
    }

    return this.token.value
  }

  /**
   * Get authorization header for API requests
   * Returns empty object if no valid token
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken()

    if (!token) {
      return {}
    }

    return {
      'Authorization': `Bearer ${token}`
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null
  }

  /**
   * Clear all authentication data
   */
  clearAuth(): void {
    this.token = null
    this.refreshToken = null

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }

    // Authentication cleared
  }

  /**
   * Set up automatic token expiration
   */
  private setupTokenExpiration(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer)
    }

    if (this.token) {
      const timeUntilExpiry = this.token.expiresAt.getTime() - Date.now()

      this.tokenRefreshTimer = setTimeout(() => {
        // Token expired
        this.clearAuth()

        // In production, trigger re-authentication flow
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'))
        }
      }, timeUntilExpiry)
    }
  }

  /**
   * Verify token and extract claims
   * Returns verified user information or null if invalid
   *
   * SECURITY: This method performs proper JWT verification
   * - In demo mode: Accepts demo_token_* format FIRST (before any other checks)
   * - In production: Validates JWT signature, expiry, issuer, audience
   *
   * IMPORTANT: Demo token parsing happens BEFORE stored token checks
   * to ensure demo_token_* flows are never blocked
   */
  async verifyToken(token: string): Promise<VerifiedClaims | null> {
    if (!token) {
      return null
    }

    // Check for demo tokens with proper JWT validation
    if (config.isDemoMode) {
      try {
        const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production'

        // Verify and decode the token with specific validations
        const decoded = jwt.verify(token, jwtSecret, {
          issuer: 'antevus-demo',
          audience: 'antevus-platform'
        }) as jwt.JwtPayload

        // Check if token is a valid demo token
        if (decoded.isDemo) {
          logger.info('Demo mode: Valid demo JWT token', { userId: decoded.userId })
          return {
            sub: decoded.userId || 'demo-user-001',
            email: decoded.email || 'demo@antevus.com',
            roles: decoded.roles || [UserRole.SCIENTIST],
            exp: decoded.exp,
            iat: decoded.iat,
            iss: decoded.iss,
            aud: decoded.aud
          }
        }
      } catch (error) {
        // Not a valid demo JWT, continue to regular validation
        if (error instanceof jwt.TokenExpiredError) {
          logger.debug('Demo token expired')
        } else if (error instanceof jwt.JsonWebTokenError) {
          logger.debug('Invalid demo token - trying regular validation')
        }
      }
    }

    // NO STORED TOKEN CHECK: This method verifies ANY token passed to it
    // It does NOT compare against this.token - that's the caller's responsibility
    // This ensures demo tokens and API tokens can be verified independently

    // PRODUCTION MODE: Proper JWT verification
    try {
      let payload: JWTPayload

      if (this.jwks) {
        // Verify using JWKS (recommended for production)
        // SECURITY: Only pass issuer/audience if configured - no defaults
        const verifyOptions: Parameters<typeof jwtVerify>[2] = {}
        if (config.jwtIssuer) verifyOptions.issuer = config.jwtIssuer
        if (config.jwtAudience) verifyOptions.audience = config.jwtAudience

        const result = await jwtVerify(token, this.jwks, verifyOptions)
        payload = result.payload
      } else if (config.jwtPublicKey) {
        // Verify using static public key with jose.importSPKI
        // Convert base64 to PEM format if needed
        let pemKey = config.jwtPublicKey
        if (!pemKey.includes('BEGIN PUBLIC KEY')) {
          // If it's base64, wrap it in PEM format
          pemKey = `-----BEGIN PUBLIC KEY-----\n${config.jwtPublicKey}\n-----END PUBLIC KEY-----`
        }

        // Import the public key using jose's importSPKI
        const publicKey = await importSPKI(pemKey, 'RS256')

        // SECURITY: No fallback defaults - config must be explicit
        const verifyOptions: Parameters<typeof jwtVerify>[2] = {
          algorithms: ['RS256']
        }
        if (config.jwtIssuer) verifyOptions.issuer = config.jwtIssuer
        if (config.jwtAudience) verifyOptions.audience = config.jwtAudience

        const result = await jwtVerify(token, publicKey, verifyOptions)
        payload = result.payload
      } else {
        // No verification configuration available
        logger.error('JWT verification not configured. Set JWKS_URI or JWT_PUBLIC_KEY')
        return null
      }

      // Extract and return verified claims
      return {
        sub: payload.sub || '',
        email: payload.email as string | undefined,
        roles: payload.roles as string[] | undefined,
        exp: payload.exp,
        iat: payload.iat,
        iss: payload.iss,
        aud: payload.aud,
        ...payload
      }
    } catch (error) {
      // Log verification errors in development only
      if (process.env.NODE_ENV === 'development') {
        if (error instanceof joseErrors.JWTExpired) {
          logger.warn('JWT expired')
        } else if (error instanceof joseErrors.JWTInvalid) {
          logger.warn('JWT invalid')
        } else if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
          logger.warn('JWT signature verification failed')
        } else {
          logger.warn('JWT verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      return null
    }
  }

  /**
   * Simulate token refresh (for production implementation)
   */
  async refreshAuthToken(): Promise<boolean> {
    // Token refresh not implemented in demo mode
    // In production:
    // 1. Use refresh token to get new access token
    // 2. Update stored token
    // 3. Reset expiration timer
    return false
  }

  /**
   * Get security status for monitoring
   */
  getSecurityStatus(): {
    isAuthenticated: boolean
    tokenExpiresIn: number | null
    securityMode: string
    demoMode: boolean
  } {
    const now = Date.now()

    return {
      isAuthenticated: this.isAuthenticated(),
      tokenExpiresIn: this.token
        ? Math.max(0, this.token.expiresAt.getTime() - now)
        : null,
      securityMode: 'memory-only', // Never localStorage/sessionStorage
      demoMode: config.isDemoMode
    }
  }

  /**
   * Extract token from incoming request (server-side)
   * Checks Authorization header and cookies
   */
  getTokenFromRequest(request: Request): string | null {
    // First check Authorization header
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7)
    }

    // Then check cookies (for httpOnly cookie support)
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies: Record<string, string> = {}

      // Parse cookies properly, handling values with '=' in them
      cookieHeader.split('; ').forEach(cookie => {
        const eqIndex = cookie.indexOf('=')
        if (eqIndex === -1) {
          // Cookie without value (just a flag)
          const name = cookie.trim()
          if (name) {
            cookies[decodeURIComponent(name)] = ''
          }
        } else {
          // Split on first '=' only
          const name = cookie.substring(0, eqIndex).trim()
          const value = cookie.substring(eqIndex + 1)
          if (name) {
            cookies[decodeURIComponent(name)] = decodeURIComponent(value)
          }
        }
      })

      if (cookies['auth-token']) {
        return cookies['auth-token']
      }
    }

    return null
  }

  /**
   * Validate token and return session info with expiration checking
   * This combines token extraction and verification
   */
  async validateToken(token: string | null): Promise<{
    userId: string
    email?: string
    roles?: string[]
    expiresAt?: Date
    isExpired?: boolean
  } | null> {
    if (!token) {
      logger.debug('No token provided for validation')
      return null
    }

    const claims = await this.verifyToken(token)
    if (!claims) {
      logger.debug('Token verification failed')
      return null
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000) // Current time in seconds
    const isExpired = claims.exp ? claims.exp < now : false

    if (isExpired) {
      logger.warn('Token has expired', {
        exp: claims.exp,
        now,
        userId: claims.sub
      })

      // Still return the session info but mark as expired
      // This allows the caller to decide how to handle expired sessions
      return {
        userId: claims.sub,
        email: claims.email,
        roles: claims.roles,
        expiresAt: claims.exp ? new Date(claims.exp * 1000) : undefined,
        isExpired: true
      }
    }

    // Calculate time until expiration for monitoring
    if (claims.exp) {
      const expiresInSeconds = claims.exp - now
      if (expiresInSeconds < 300) { // Less than 5 minutes
        logger.info('Token expiring soon', {
          expiresInSeconds,
          userId: claims.sub
        })
      }
    }

    return {
      userId: claims.sub,
      email: claims.email,
      roles: claims.roles,
      expiresAt: claims.exp ? new Date(claims.exp * 1000) : undefined,
      isExpired: false
    }
  }

  /**
   * Check if a session needs refresh based on expiration time
   */
  shouldRefreshToken(expiresAt: Date | undefined): boolean {
    if (!expiresAt) return false

    const now = Date.now()
    const expiryTime = expiresAt.getTime()
    const timeUntilExpiry = expiryTime - now
    const refreshThreshold = 5 * 60 * 1000 // 5 minutes

    return timeUntilExpiry <= refreshThreshold
  }
}

// Export singleton instance
export const authManager = new SecureAuthManager()

// Helper function for secure API calls
export async function secureApiCall(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = authManager.getAuthHeaders()

  const secureOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {})
    },
    credentials: 'same-origin', // Important for CSRF protection
  }

  const response = await fetch(url, secureOptions)

  // Handle token expiration
  if (response.status === 401) {
    authManager.clearAuth()
    window.dispatchEvent(new CustomEvent('auth:expired'))
  }

  return response
}

// Security warning for developers
export const AUTH_SECURITY_WARNING = `
⚠️ SECURITY WARNING - Authentication Token Storage:

CURRENT IMPLEMENTATION (Demo Only):
- Tokens stored in memory only during session
- Automatically expire after 15 minutes
- Cleared on page refresh or close

NEVER DO THIS:
- localStorage.setItem('token', token) ❌
- sessionStorage.setItem('token', token) ❌
- document.cookie = 'token=' + token ❌

PRODUCTION REQUIREMENTS:
1. Use httpOnly, secure, sameSite cookies
2. Implement CSRF protection
3. Use short-lived access tokens (15 min)
4. Implement refresh token rotation
5. Add rate limiting on auth endpoints

Example Production Setup:
- Access Token: httpOnly cookie, 15 min expiry
- Refresh Token: httpOnly cookie, 7 days, rotate on use
- CSRF Token: Separate header/meta tag
`

// Security warning disabled to avoid console spam