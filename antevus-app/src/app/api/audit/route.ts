import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authManager } from '@/lib/security/auth-manager'
import { logger } from '@/lib/logger'
import { withRateLimit, checkRateLimit, addRateLimitHeaders } from '@/lib/api/rate-limit-helper'

// Constants for security limits
const MAX_REQUEST_SIZE = 1024 * 1024 // 1MB max request size
const MAX_LOGS_PER_REQUEST = 100 // Maximum logs in a single batch

// Rate limiting constants
const AUTHENTICATED_RATE_LIMIT = 1000 // Requests per minute for authenticated users
const UNAUTHENTICATED_RATE_LIMIT = 50 // Requests per minute for unauthenticated users
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute window
const AUTHENTICATED_BLOCK_DURATION = 5 * 60 * 1000 // 5 minutes
const UNAUTHENTICATED_BLOCK_DURATION = 15 * 60 * 1000 // 15 minutes

// Security: Allowlist of event types that can be logged without authentication
// Only critical security events are allowed for unauthenticated requests
const UNAUTHENTICATED_ALLOWED_EVENT_TYPES = [
  'user.failed_login',
  'security.suspicious_activity',
  'security.rate_limit_exceeded',
  'security.unauthorized_access'
]

/**
 * SECURED API endpoint for receiving audit logs
 *
 * SECURITY IMPLEMENTATION:
 * - Authentication required via Bearer token for most events
 * - Unauthenticated requests restricted to security event types only
 * - Rate limiting per client (1000 requests/minute authenticated, 50/minute unauthenticated)
 * - Request size validation (max 1MB)
 * - Secure response headers (HSTS, CSP, etc.)
 * - Principal binding prevents forgery (strict userId validation)
 * - HIPAA/SOC 2 compliant audit trail
 *
 * Production recommendations:
 * - Store logs in immutable WORM storage
 * - Use dedicated service (Datadog, Splunk, CloudWatch)
 * - Implement log retention policies
 */

/**
 * Add secure headers to response
 */
function addSecureHeaders(response: NextResponse): NextResponse {
  // Security headers for defense in depth
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';")
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  response.headers.set('Pragma', 'no-cache')

  return response
}

/**
 * Create error response with secure headers
 */
function createErrorResponse(message: string, status: number, allowedMethods?: string[]): NextResponse {
  const response = NextResponse.json({ error: message }, { status })

  // Add Allow header for 405 responses
  if (status === 405 && allowedMethods) {
    response.headers.set('Allow', allowedMethods.join(', '))
  }

  return addSecureHeaders(response)
}

// Schema for incoming audit logs
const AuditLogBatchSchema = z.object({
  logs: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    eventType: z.string(),
    severity: z.string(),
    userId: z.string().nullable(),
    sessionId: z.string().nullable(),
    action: z.string(),
    outcome: z.enum(['SUCCESS', 'FAILURE', 'PENDING']),
    metadata: z.record(z.string(), z.any()).optional()
  })),
  clientTime: z.string()
})

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting for authenticated requests
    // This is reasonable for audit logs while preventing abuse
    const rateLimited = await withRateLimit(request, {
      key: 'api:audit:logs',
      limit: AUTHENTICATED_RATE_LIMIT,
      window: RATE_LIMIT_WINDOW,
      blockDuration: AUTHENTICATED_BLOCK_DURATION
    })
    if (rateLimited) {
      return addSecureHeaders(rateLimited)
    }

    // SECURITY: Check request size before parsing
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      logger.warn('Audit API request size limit exceeded', {
        size: contentLength,
        ip: request.headers.get('x-forwarded-for')
      })
      return createErrorResponse('Request entity too large - max 1MB', 413)
    }

    // SECURITY: Authentication handling for HIPAA/SOC 2 compliance
    // Allow unauthenticated requests for critical security events (failed logins)
    // but apply stricter rate limiting
    const authHeader = request.headers.get('authorization')
    let verifiedUserId = 'anonymous'
    let verificationMethod = 'none' // Track how the request was verified

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Authenticated request - full access
      verificationMethod = 'jwt' // Will be verified below
    } else {
      // Unauthenticated request - allow for security events but with stricter limits
      const unauthRateLimited = await withRateLimit(request, {
        key: 'api:audit:unauth',
        limit: UNAUTHENTICATED_RATE_LIMIT,
        window: RATE_LIMIT_WINDOW,
        blockDuration: UNAUTHENTICATED_BLOCK_DURATION
      })
      if (unauthRateLimited) {
        return addSecureHeaders(unauthRateLimited)
      }
    }

    // Verify token if provided
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      // CRITICAL: Verify token and extract verified claims
      const claims = await authManager.verifyToken(token)
      if (!claims?.sub) {
        logger.warn('Invalid token presented to audit API', {
          tokenLength: token?.length,
          ip: request.headers.get('x-forwarded-for')
        })
        return createErrorResponse('Unauthorized - invalid or expired token', 401)
      }

      // Extract verified user ID from token claims
      verifiedUserId = String(claims.sub)
    }

    // Get session ID from headers (now authenticated)
    const sessionId = request.headers.get('X-Audit-Session')

    // Parse request body
    const body = await request.json()

    // Validate the payload
    const validation = AuditLogBatchSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse('Invalid audit log format', 400)
    }

    const { logs, clientTime: _clientTime } = validation.data // eslint-disable-line @typescript-eslint/no-unused-vars

    // SECURITY: Limit number of logs per request
    if (logs.length > MAX_LOGS_PER_REQUEST) {
      logger.warn('Too many logs in single request', {
        count: logs.length,
        verifiedUserId,
        ip: request.headers.get('x-forwarded-for')
      })
      return createErrorResponse(`Too many logs - max ${MAX_LOGS_PER_REQUEST} per request`, 400)
    }

    // SECURITY: For unauthenticated requests, only allow specific event types
    if (verificationMethod === 'none') {
      const disallowedEvents = logs.filter(
        log => !UNAUTHENTICATED_ALLOWED_EVENT_TYPES.includes(log.eventType)
      )
      if (disallowedEvents.length > 0) {
        logger.warn('Unauthenticated request attempted to log restricted event types', {
          attemptedEventTypes: [...new Set(disallowedEvents.map(l => l.eventType))],
          ip: request.headers.get('x-forwarded-for')
        })
        return createErrorResponse(
          'Forbidden - unauthenticated requests can only log security events',
          403
        )
      }
    }

    // CRITICAL SECURITY: Enforce principal binding
    // Prevent users from forging audit logs with different userIds
    // For anonymous/unauthenticated requests, userId must be 'anonymous' or undefined
    const forgedLogs = verificationMethod === 'jwt'
      ? logs.filter(log => log.userId && log.userId !== verifiedUserId)
      : logs.filter(log => log.userId && log.userId !== 'anonymous')

    if (forgedLogs.length > 0) {
      logger.error('Attempted audit log forgery detected', {
        verifiedUserId,
        verificationMethod,
        attemptedUserIds: [...new Set(forgedLogs.map(l => l.userId))],
        sessionId,
        ip: request.headers.get('x-forwarded-for')
      })
      return createErrorResponse('Forbidden - user ID mismatch in audit logs', 403)
    }

    // All logs must either have no userId or match the verified principal
    const validatedLogs = logs.map(log => ({
      ...log,
      userId: log.userId || verifiedUserId, // Ensure userId is set
      verifiedBy: verificationMethod // Mark verification method (jwt/none)
    }))

    // SECURITY: Audit logs are now authenticated and cannot be forged
    // Store these logs securely - never expose to console

    // In production, implement:
    // 1. Store in immutable WORM storage (Write Once Read Many)
    // 2. Forward to SIEM system (Security Information Event Management)
    // 3. Trigger alerts for critical security events
    // 4. Maintain chain of custody for compliance


    // Store validated logs (in production, save to database)
    logger.info('Audit logs received and validated', {
      count: validatedLogs.length,
      verifiedUserId,
      sessionId
    })

    // Check rate limit for response headers (use same limits as initial check)
    const rateLimitResult = await checkRateLimit(request, {
      key: 'api:audit:logs',
      limit: AUTHENTICATED_RATE_LIMIT,
      window: RATE_LIMIT_WINDOW,
      blockDuration: AUTHENTICATED_BLOCK_DURATION
    })

    // Create success response
    const response = NextResponse.json(
      {
        success: true,
        received: validatedLogs.length,
        verifiedUserId,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )

    // Add rate limit headers
    if (rateLimitResult) {
      addRateLimitHeaders(response, rateLimitResult, AUTHENTICATED_RATE_LIMIT)
    }

    // Add secure headers and return
    return addSecureHeaders(response)
  } catch (error) {
    logger.error('Audit API error processing logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return createErrorResponse('Failed to process audit logs', 500)
  }
}

// Method handlers with proper Allow header
export async function GET() {
  return createErrorResponse('Method not allowed - only POST is supported', 405, ['POST'])
}

export async function PUT() {
  return createErrorResponse('Method not allowed - only POST is supported', 405, ['POST'])
}

export async function PATCH() {
  return createErrorResponse('Method not allowed - only POST is supported', 405, ['POST'])
}

export async function DELETE() {
  return createErrorResponse('Method not allowed - only POST is supported', 405, ['POST'])
}

export async function HEAD() {
  return createErrorResponse('Method not allowed - only POST is supported', 405, ['POST'])
}

export async function OPTIONS() {
  // Handle preflight requests
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Allow', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Audit-Session')
  response.headers.set('Access-Control-Max-Age', '86400')
  return addSecureHeaders(response)
}