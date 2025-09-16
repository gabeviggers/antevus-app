/**
 * CSRF Protection with JWT tokens
 * Production-ready CSRF implementation using signed JWTs
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose'
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auditLogger } from '@/lib/audit/logger'
import { logger } from '@/lib/logger'
import { User } from '@/lib/auth/types'

// CSRF token configuration
const CSRF_TOKEN_EXPIRY = '1h' // 1 hour
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const CSRF_COOKIE_NAME = '__Host-csrf-token' // __Host- prefix for security

// Get CSRF secret from environment
function getCSRFSecret(): Uint8Array {
  const secret = process.env.CSRF_SECRET

  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      // Use a development key
      return new TextEncoder().encode('dev-csrf-secret-min-32-characters-long!')
    }
    throw new Error('CSRF_SECRET is required in production')
  }

  // Ensure secret is at least 32 characters
  if (secret.length < 32) {
    throw new Error('CSRF_SECRET must be at least 32 characters')
  }

  return new TextEncoder().encode(secret)
}

interface CSRFTokenPayload extends JWTPayload {
  userId: string
  sessionId: string
  nonce: string
  fingerprint?: string // Optional browser fingerprint
}

/**
 * Generate a new CSRF token for a user session
 */
export async function generateCSRFToken(
  userId: string,
  sessionId: string,
  fingerprint?: string
): Promise<string> {
  try {
    const nonce = randomBytes(16).toString('hex')
    const secret = getCSRFSecret()

    const token = await new SignJWT({
      userId,
      sessionId,
      nonce,
      fingerprint
    } as CSRFTokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(CSRF_TOKEN_EXPIRY)
      .setIssuedAt()
      .setSubject(userId)
      .sign(secret)

    return token
  } catch (error) {
    logger.error('Failed to generate CSRF token', error, { userId })
    throw new Error('Failed to generate CSRF token')
  }
}

/**
 * Verify and decode a CSRF token
 */
async function verifyCSRFToken(token: string): Promise<CSRFTokenPayload | null> {
  try {
    const secret = getCSRFSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as CSRFTokenPayload
  } catch (error) {
    logger.debug('CSRF token verification failed', { error })
    return null
  }
}

/**
 * Extract CSRF token from request
 */
function extractCSRFToken(request: NextRequest): {
  headerToken?: string
  cookieToken?: string
} {
  // Check header
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || undefined

  // Check cookie (for double-submit pattern)
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value

  return { headerToken, cookieToken }
}

/**
 * Validate CSRF token from request
 * Implements double-submit cookie pattern for additional security
 */
export async function validateCSRFToken(
  request: NextRequest,
  userId: string,
  sessionId: string,
  user?: User | null
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return { valid: true }
    }

    const { headerToken, cookieToken } = extractCSRFToken(request)

    // Check if tokens are present
    if (!headerToken) {
      await logCSRFFailure(request, user, 'Missing CSRF token in header')
      return { valid: false, error: 'Missing CSRF token' }
    }

    // For double-submit pattern, both tokens must match
    if (process.env.ENABLE_DOUBLE_SUBMIT === 'true' && headerToken !== cookieToken) {
      await logCSRFFailure(request, user, 'CSRF token mismatch between header and cookie')
      return { valid: false, error: 'CSRF token mismatch' }
    }

    // Verify the JWT token
    const payload = await verifyCSRFToken(headerToken)

    if (!payload) {
      await logCSRFFailure(request, user, 'Invalid CSRF token signature')
      return { valid: false, error: 'Invalid CSRF token' }
    }

    // Verify token is for the correct user
    if (payload.userId !== userId) {
      await logCSRFFailure(request, user, 'CSRF token user mismatch')
      return { valid: false, error: 'CSRF token does not match user' }
    }

    // Verify token is for the correct session
    if (payload.sessionId !== sessionId) {
      await logCSRFFailure(request, user, 'CSRF token session mismatch')
      return { valid: false, error: 'CSRF token does not match session' }
    }

    // Optional: Verify browser fingerprint if provided
    if (payload.fingerprint) {
      const requestFingerprint = request.headers.get('X-Browser-Fingerprint')
      if (requestFingerprint && payload.fingerprint !== requestFingerprint) {
        await logCSRFFailure(request, user, 'Browser fingerprint mismatch')
        return { valid: false, error: 'Browser fingerprint mismatch' }
      }
    }

    return { valid: true }

  } catch (error) {
    logger.error('CSRF validation error', error, { userId })
    await logCSRFFailure(request, user, 'CSRF validation error')
    return { valid: false, error: 'CSRF validation failed' }
  }
}

/**
 * Log CSRF failure for audit
 */
async function logCSRFFailure(
  request: NextRequest,
  user: User | null | undefined,
  reason: string
): Promise<void> {
  await auditLogger.logEvent(
    user || null,
    'security.csrf_failure',
    {
      resourceType: 'api',
      resourceId: request.nextUrl.pathname,
      success: false,
      errorMessage: reason,
      metadata: {
        method: request.method,
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent')
      }
    }
  )
}

/**
 * Create CSRF token response with secure cookie
 */
export function createCSRFTokenResponse(
  token: string,
  response: NextResponse
): NextResponse {
  // Set CSRF token in a secure, HttpOnly cookie
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 3600 // 1 hour
  })

  // Also include in response header for client to read
  response.headers.set('X-CSRF-Token', token)

  return response
}

/**
 * Middleware to check CSRF on all state-changing requests
 */
export async function csrfMiddleware(
  request: NextRequest,
  userId?: string,
  sessionId?: string
): Promise<NextResponse | null> {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null
  }

  // Skip for API routes that don't need CSRF (e.g., public endpoints)
  const publicPaths = ['/api/health', '/api/status']
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return null
  }

  // Require userId and sessionId for CSRF validation
  if (!userId || !sessionId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Validate CSRF token
  const validation = await validateCSRFToken(request, userId, sessionId)

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || 'CSRF validation failed' },
      { status: 403 }
    )
  }

  return null // Continue to next middleware
}

/**
 * Generate a new CSRF token for the current session
 * This should be called on login and periodically refreshed
 */
export async function refreshCSRFToken(
  userId: string,
  sessionId: string,
  response: NextResponse
): Promise<NextResponse> {
  try {
    const token = await generateCSRFToken(userId, sessionId)
    return createCSRFTokenResponse(token, response)
  } catch (error) {
    logger.error('Failed to refresh CSRF token', error, { userId })
    throw error
  }
}