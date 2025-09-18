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

import { jwtVerify, createRemoteJWKSet, JWTPayload, errors as joseErrors } from 'jose'

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
  // Demo mode - only enable for development/testing
  isDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true',

  // JWT Configuration (for production)
  jwksUri: process.env.JWKS_URI || process.env.NEXT_PUBLIC_JWKS_URI,
  jwtIssuer: process.env.JWT_ISSUER || process.env.NEXT_PUBLIC_JWT_ISSUER || 'https://auth.antevus.com',
  jwtAudience: process.env.JWT_AUDIENCE || process.env.NEXT_PUBLIC_JWT_AUDIENCE || 'https://api.antevus.com',

  // Alternative: Use a static public key instead of JWKS
  jwtPublicKey: process.env.JWT_PUBLIC_KEY || process.env.NEXT_PUBLIC_JWT_PUBLIC_KEY,
}

class SecureAuthManager {
  private token: AuthToken | null = null
  private refreshToken: string | null = null
  private tokenRefreshTimer: NodeJS.Timeout | null = null
  private readonly TOKEN_LIFETIME_MS = 15 * 60 * 1000 // 15 minutes
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null

  constructor() {
    // Initialize JWKS if URI is provided
    if (config.jwksUri && !config.isDemoMode) {
      try {
        this.jwks = createRemoteJWKSet(new URL(config.jwksUri))
      } catch (error) {
        console.error('Failed to initialize JWKS:', error)
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

    // CRITICAL: Check for demo tokens FIRST before any other validation
    // This ensures demo_token_* patterns work even if not stored
    if (config.isDemoMode && token.startsWith('demo_token_')) {
      // Parse demo token format: demo_token_<timestamp>_<userId>
      const parts = token.split('_')

      // Format: demo_token_<timestamp>_<userId>
      if (parts.length >= 4 && parts[0] === 'demo' && parts[1] === 'token') {
        console.log('Demo mode: Accepting demo_token with userId:', parts[3])
        return {
          sub: parts[3] || 'demo-user-001',
          email: 'demo@antevus.com',
          roles: ['scientist'],
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iat: Math.floor(Date.now() / 1000),
          iss: 'demo-issuer',
          aud: 'demo-audience'
        }
      }

      // Simple format: demo_token_<timestamp> or just demo_token_*
      console.log('Demo mode: Accepting simple demo_token')
      return {
        sub: 'demo-user-001',
        email: 'demo@antevus.com',
        roles: ['scientist'],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'demo-issuer',
        aud: 'demo-audience'
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
        const result = await jwtVerify(token, this.jwks, {
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        })
        payload = result.payload
      } else if (config.jwtPublicKey) {
        // Verify using static public key
        const publicKey = await crypto.subtle.importKey(
          'spki',
          Buffer.from(config.jwtPublicKey, 'base64'),
          { name: 'RSA-PSS', hash: 'SHA-256' },
          false,
          ['verify']
        )

        const result = await jwtVerify(token, publicKey, {
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        })
        payload = result.payload
      } else {
        // No verification configuration available
        console.error('JWT verification not configured. Set JWKS_URI or JWT_PUBLIC_KEY')
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
          console.warn('JWT expired')
        } else if (error instanceof joseErrors.JWTInvalid) {
          console.warn('JWT invalid')
        } else if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
          console.warn('JWT signature verification failed')
        } else {
          console.warn('JWT verification failed:', error)
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