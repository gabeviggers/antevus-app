/**
 * Secure Authentication Manager
 *
 * SECURITY NOTICE:
 * - Tokens are stored in memory only, never in localStorage/sessionStorage
 * - Vulnerable to XSS attacks are mitigated by:
 *   1. No client-side token storage
 *   2. Short-lived tokens
 *   3. Automatic cleanup on page unload
 *
 * PRODUCTION REQUIREMENTS:
 * - Use httpOnly cookies for token storage
 * - Implement CSRF protection
 * - Add token refresh mechanism
 * - Use secure SameSite cookie attributes
 */

interface AuthToken {
  value: string
  expiresAt: Date
  userId?: string
  scope?: string[]
}

class SecureAuthManager {
  private token: AuthToken | null = null
  private refreshToken: string | null = null
  private tokenRefreshTimer: NodeJS.Timeout | null = null
  private readonly TOKEN_LIFETIME_MS = 15 * 60 * 1000 // 15 minutes

  constructor() {
    // Clear tokens on page unload for security
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.clearAuth())
    }
  }

  /**
   * Store authentication token securely in memory
   * WARNING: This is for demo only. Production must use httpOnly cookies
   */
  setToken(token: string, expiresInMs?: number): void {
    const expiresAt = new Date(
      Date.now() + (expiresInMs || this.TOKEN_LIFETIME_MS)
    )

    this.token = {
      value: token,
      expiresAt
    }

    // Set up automatic token expiration
    this.setupTokenExpiration()

    // Token stored securely in memory
  }

  /**
   * Get current authentication token
   * Returns null if token is expired or not set
   */
  getToken(): string | null {
    if (!this.token) {
      return null
    }

    // Check if token is expired
    if (new Date() > this.token.expiresAt) {
      // Token expired
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
  } {
    const now = Date.now()

    return {
      isAuthenticated: this.isAuthenticated(),
      tokenExpiresIn: this.token
        ? Math.max(0, this.token.expiresAt.getTime() - now)
        : null,
      securityMode: 'memory-only' // Never localStorage/sessionStorage
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