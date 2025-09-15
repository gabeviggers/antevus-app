import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { auditLogger } from '@/lib/audit/logger'
import { User } from '@/lib/auth/types'

// CSRF token storage (in production, use Redis or database)
const csrfTokenStore = new Map<string, { token: string; expiry: number }>()

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Store CSRF token for a user
 */
export function storeCSRFToken(userId: string, token: string, expiryMs: number = 3600000): void {
  csrfTokenStore.set(userId, {
    token,
    expiry: Date.now() + expiryMs
  })
}

/**
 * Get stored CSRF token for a user
 */
export function getStoredCSRFToken(userId: string): { token: string; expiry: number } | undefined {
  const stored = csrfTokenStore.get(userId)

  // Clean up expired tokens
  if (stored && Date.now() > stored.expiry) {
    csrfTokenStore.delete(userId)
    return undefined
  }

  return stored
}

/**
 * Validate CSRF token from request
 * Returns true if valid, false otherwise
 */
export function validateCSRFToken(
  request: NextRequest,
  userId: string,
  user?: User | null
): { valid: boolean; error?: string } {
  const csrfToken = request.headers.get('X-CSRF-Token')
  const storedToken = getStoredCSRFToken(userId)

  // No token provided
  if (!csrfToken) {
    if (user) {
      auditLogger.logEvent(user, 'security.csrf_failure', {
        resourceType: 'api',
        success: false,
        errorMessage: 'Missing CSRF token',
        metadata: {
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
    }
    return { valid: false, error: 'Missing CSRF token' }
  }

  // No stored token for user
  if (!storedToken) {
    if (user) {
      auditLogger.logEvent(user, 'security.csrf_failure', {
        resourceType: 'api',
        success: false,
        errorMessage: 'No CSRF token found for user',
        metadata: {
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
    }
    return { valid: false, error: 'Invalid CSRF token - no token found' }
  }

  // Token mismatch
  if (csrfToken !== storedToken.token) {
    if (user) {
      auditLogger.logEvent(user, 'security.csrf_failure', {
        resourceType: 'api',
        success: false,
        errorMessage: 'CSRF token mismatch',
        metadata: {
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })
    }
    return { valid: false, error: 'Invalid CSRF token' }
  }

  // Token expired
  if (Date.now() > storedToken.expiry) {
    if (user) {
      auditLogger.logEvent(user, 'security.csrf_failure', {
        resourceType: 'api',
        success: false,
        errorMessage: 'CSRF token expired',
        metadata: {
          endpoint: request.nextUrl.pathname,
          method: request.method,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          tokenExpiry: new Date(storedToken.expiry).toISOString()
        }
      })
    }
    return { valid: false, error: 'CSRF token expired' }
  }

  return { valid: true }
}

/**
 * Generate and store a new CSRF token for a user
 */
export function createCSRFTokenForUser(userId: string): string {
  const token = generateCSRFToken()
  storeCSRFToken(userId, token)
  return token
}